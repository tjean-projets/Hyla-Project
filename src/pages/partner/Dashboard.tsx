import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Inbox, Send, Phone, FileText, CheckCircle2, Euro, Target, TrendingUp, PiggyBank, Smartphone, X } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { KPICard } from '@/components/KPICard';
import { RadialProgress } from '@/components/RadialProgress';
import { SegmentedProgress } from '@/components/SegmentedProgress';
import { Button } from '@/components/ui/button';
import { supabase, type Lead, type LeadStatus, type TierRule, type PartnerTier, STATUS_LABELS } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast as sonnerToast } from 'sonner';

interface MotivationData {
  current_tier_name: string;
  current_rate: number;
  signed_count: number;
  next_tier_name: string | null;
  next_rate: number | null;
  dossiers_manquants: number;
  bonus_potentiel: number;
}

export default function PartnerDashboard() {
  const { partnerId, partnerName } = useAuth();
  const { isImpersonating, partnerName: impersonatedName } = useImpersonation();
  const displayName = isImpersonating ? impersonatedName : partnerName;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPrompt = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [tierRules, setTierRules] = useState<TierRule[]>([]);
  const [currentTier, setCurrentTier] = useState<PartnerTier | null>(null);
  const [motivation, setMotivation] = useState<MotivationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (partnerId) fetchData();
  }, [partnerId]);

  // PWA install prompt
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (isStandalone || dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as typeof deferredPrompt.current;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Sur iOS, pas d'événement beforeinstallprompt — on affiche quand même la bannière manuelle
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !dismissed) setShowInstallBanner(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') setShowInstallBanner(false);
    }
    localStorage.setItem('pwa-banner-dismissed', '1');
    setShowInstallBanner(false);
  };

  const fetchData = async () => {
    if (!partnerId) return;

    const [leadsRes, tiersRes, tierRes, motivRes] = await Promise.all([
      supabase.from('leads').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
      supabase.from('tier_rules').select('*').order('min_signed'),
      supabase.rpc('get_partner_tier', { p_partner_id: partnerId }),
      supabase.rpc('get_motivation_data', { p_partner_id: partnerId }),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as unknown as Lead[]);
    if (tiersRes.data) setTierRules(tiersRes.data as unknown as TierRule[]);
    if (tierRes.data && (tierRes.data as unknown[]).length > 0) {
      setCurrentTier((tierRes.data as unknown as PartnerTier[])[0]);
    }
    if (motivRes.data && (motivRes.data as unknown[]).length > 0) {
      setMotivation((motivRes.data as unknown as MotivationData[])[0]);
    }
    setIsLoading(false);
  };

  // Realtime: lead status changes + paiement compagnie
  useEffect(() => {
    if (!partnerId) return;

    const channel = supabase
      .channel('partner-lead-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leads',
        filter: `partner_id=eq.${partnerId}`,
      }, (payload) => {
        const newLead = payload.new as Lead;
        const oldLead = payload.old as Partial<Lead>;
        const name = `${newLead.first_name} ${newLead.last_name}`;
        const notifRate = (currentTier?.rate_percent || 50) / 100;
        const commissionEstimated = (newLead.commission_estimated || 0) * notifRate;
        const commissionFinal = (newLead.commission_final || newLead.commission_estimated || 0) * notifRate;
        const savings = newLead.savings_achieved || 0;

        // ── Statut changé ──
        if (oldLead.status !== newLead.status) {
          if (newLead.status === 'DEVIS_ENVOYE') {
            sonnerToast.info('📊 Devis envoyé à votre client !', {
              description: savings > 0
                ? `${name} — Économies estimées : ${savings.toLocaleString('fr-FR')} €/an · Commission potentielle : ${commissionEstimated.toLocaleString('fr-FR')} €`
                : `${name} — Commission potentielle : ${commissionEstimated.toLocaleString('fr-FR')} €`,
              duration: 7000,
            });
          } else if (newLead.status === 'SIGNATURE') {
            sonnerToast.info('✍️ Contrat en cours de signature !', {
              description: `${name} — Le contrat est en cours de signature. Plus qu'un pas !`,
              duration: 6000,
            });
          } else if (newLead.status === 'SIGNE') {
            sonnerToast.success('🎉 Dossier signé !', {
              description: `${name} — Votre commission : +${commissionFinal.toLocaleString('fr-FR')} €`,
              duration: 8000,
            });
          } else if (newLead.status === 'REFUSE') {
            sonnerToast.error('❌ Dossier refusé', {
              description: `${name} — Le dossier n'a pas abouti.`,
              duration: 5000,
            });
          } else if (newLead.status === 'EN_COURS') {
            sonnerToast.info('📋 Dossier en cours d\'étude', {
              description: `${name} — Thomas Jean Courtage instruit votre dossier.`,
              duration: 5000,
            });
          } else if (newLead.status === 'CONTACT') {
            sonnerToast.info('📞 Client contacté', {
              description: `${name} — Le client a été contacté.`,
              duration: 5000,
            });
          } else {
            sonnerToast.info(`📥 Dossier ${STATUS_LABELS[newLead.status] || newLead.status}`, {
              description: `${name}`,
              duration: 5000,
            });
          }
        }

        // ── Paiement reçu de la Compagnie → retrait disponible ──
        if (!oldLead.paiement_compagnie_recu && newLead.paiement_compagnie_recu) {
          sonnerToast.success('💰 Commission disponible au retrait !', {
            description: `${name} — La Compagnie a réglé votre courtier. Vous pouvez maintenant demander le versement de votre commission (${commissionFinal.toLocaleString('fr-FR')} €).`,
            duration: 10000,
          });
        }

        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partnerId]);

  const countByStatus = (status: LeadStatus) => leads.filter((l) => l.status === status).length;

  const rate = (currentTier?.rate_percent || 50) / 100;

  const commissionPotentielle = leads
    .filter((l) => l.commission_estimated && l.status !== 'SIGNE' && l.status !== 'REFUSE' && l.status !== 'PERDU')
    .reduce((sum, l) => sum + (l.commission_estimated || 0) * rate, 0);

  const commissionSignee = leads
    .filter((l) => l.status === 'SIGNE')
    .reduce((sum, l) => sum + (l.commission_final || l.commission_estimated || 0) * rate, 0);

  const totalSavings = leads
    .filter((l) => l.savings_achieved)
    .reduce((sum, l) => sum + (l.savings_achieved || 0), 0);

  const signedCount = currentTier?.signed_count || 0;
  const nextTier = tierRules.find(t => t.min_signed > signedCount);
  const nextTierSegments = nextTier ? nextTier.min_signed : signedCount + 1;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Tableau de Bord" />

      <main className="container pt-5 pb-4 space-y-5">
        {/* Personalized welcome */}
        <div className="px-1">
          <h2 className="text-xl font-bold text-foreground">
            Bienvenue, {displayName ? displayName.split(' ')[0] : 'vous'} 👋
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Voici l'état de votre activité</p>
        </div>

        {/* Install PWA banner */}
        {showInstallBanner && !isImpersonating && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-3">
            <Smartphone className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Accès rapide</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {deferredPrompt.current
                  ? "Installez l'app pour y accéder en un clic depuis votre téléphone."
                  : "Sur iPhone : appuyez sur Partager → « Sur l'écran d'accueil »"}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {deferredPrompt.current && (
                <Button size="sm" className="h-7 text-xs px-2" onClick={handleInstall}>
                  Installer
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { localStorage.setItem('pwa-banner-dismissed', '1'); setShowInstallBanner(false); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tier Progress Widget */}
        {!isLoading && currentTier && (
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-5">
              <RadialProgress
                value={signedCount}
                max={nextTierSegments}
                size={100}
                strokeWidth={6}
              >
                <div className="text-center">
                  <p className="text-xl font-bold">{currentTier.rate_percent}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Palier</p>
                </div>
              </RadialProgress>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold">{currentTier.tier_name}</p>

                <SegmentedProgress
                  current={signedCount}
                  segments={nextTierSegments}
                  label={`${signedCount} signé${signedCount !== 1 ? 's' : ''}`}
                />

                {motivation && motivation.next_tier_name && (
                  <div className="mt-2 p-2.5 rounded-md bg-muted space-y-1">
                    <p className="text-xs text-foreground">
                      <Target className="h-3 w-3 inline mr-1" />
                      Plus que <span className="font-semibold">{motivation.dossiers_manquants} signature{motivation.dossiers_manquants > 1 ? 's' : ''}</span> pour {motivation.next_tier_name} ({motivation.next_rate}%)
                    </p>
                    {motivation.bonus_potentiel > 0 && (
                      <p className="text-xs font-medium" style={{ color: 'hsl(142, 71%, 45%)' }}>
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        Gain supplémentaire potentiel : +{motivation.bonus_potentiel.toLocaleString('fr-FR')} €
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Row 1: KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KPICard title="Nouveau" value={countByStatus('NOUVEAU')} icon={Send} color="bg-muted text-foreground" />
          <KPICard title="Devis" value={countByStatus('DEVIS_ENVOYE')} icon={FileText} color="bg-sky-50 text-sky-600" />
          <KPICard title="Gains clients" value={`${totalSavings.toLocaleString('fr-FR')}€`} subtitle="/an" icon={PiggyBank} color="bg-teal-50 text-teal-600" />
        </div>

        {/* Row 2: commissions */}
        <div className="grid grid-cols-3 gap-2">
          <KPICard title="Signé" value={countByStatus('SIGNE')} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
          <KPICard title="Pot." value={`${commissionPotentielle.toFixed(0)}€`} subtitle="commission" icon={Euro} color="bg-amber-50 text-amber-500" />
          <KPICard title="Signée" value={`${commissionSignee.toFixed(0)}€`} subtitle="commission" icon={Euro} color="bg-emerald-50 text-emerald-600" />
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-10">
            <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Aucun lead pour le moment</p>
            <Link to="/leads/new">
              <Button className="mt-3" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter un lead
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-2">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} au total
            </p>
            <Link to="/leads">
              <Button variant="outline" size="sm">Voir tous mes leads</Button>
            </Link>
          </div>
        )}
      </main>

      <Link to="/leads/new" className="fab">
        <Plus className="h-5 w-5" />
      </Link>

      <MobileNav />
    </div>
  );
}
