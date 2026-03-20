import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Copy, Check, Mail, Calendar, Trash2, Eye, PiggyBank } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { TierProgress } from '@/components/TierProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, type Partner, type PartnerType, type TierRule, type PartnerTier, PARTNER_TYPE_LABELS } from '@/lib/supabase';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function Partners() {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tierRules, setTierRules] = useState<TierRule[]>([]);
  const [partnerTiers, setPartnerTiers] = useState<Record<string, PartnerTier>>({});
  const [partnerSavings, setPartnerSavings] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    partnerType: 'professional' as PartnerType,
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [partnersRes, tiersRes, leadsRes] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      supabase.from('tier_rules').select('*').order('min_signed'),
      supabase.from('leads').select('partner_id, savings_achieved').not('savings_achieved', 'is', null),
    ]);

    if (partnersRes.data) {
      const partnerList = partnersRes.data as unknown as Partner[];
      setPartners(partnerList);
      const tierMap: Record<string, PartnerTier> = {};
      await Promise.all(
        partnerList.filter(p => p.invite_used_at).map(async (p) => {
          const { data } = await supabase.rpc('get_partner_tier', { p_partner_id: p.id });
          if (data && (data as unknown[]).length > 0) {
            tierMap[p.id] = (data as unknown as PartnerTier[])[0];
          }
        })
      );
      setPartnerTiers(tierMap);
    }

    if (leadsRes.data) {
      const savingsMap: Record<string, number> = {};
      for (const lead of leadsRes.data as { partner_id: string; savings_achieved: number | null }[]) {
        if (lead.savings_achieved) {
          savingsMap[lead.partner_id] = (savingsMap[lead.partner_id] || 0) + lead.savings_achieved;
        }
      }
      setPartnerSavings(savingsMap);
    }

    if (tiersRes.data) setTierRules(tiersRes.data as unknown as TierRule[]);
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.displayName.trim() || !formData.email.trim()) {
      toast({ title: 'Champs requis', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    const inviteCode = generateInviteCode();
    const expiresAt = addDays(new Date(), 30);

    const { error } = await supabase.from('partners').insert({
      display_name: formData.displayName.trim(),
      email: formData.email.trim(),
      invite_code: inviteCode,
      invite_expires_at: expiresAt.toISOString(),
      is_active: true,
      partner_type: formData.partnerType,
    });

    if (error) {
      setIsCreating(false);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    // Ouverture du client mail avec le message pré-rempli
    const inviteLink = `${window.location.origin}/invite/${inviteCode}`;
    const firstName = formData.displayName.trim().split(' ')[0];
    const subject = encodeURIComponent('Votre accès Espace Partenaires — Hyla');
    const body = encodeURIComponent(
`Bonjour ${firstName},

Je vous invite à rejoindre mon espace partenaires Hyla.

Cliquez sur le lien ci-dessous pour créer votre compte et commencer à m'envoyer vos contacts :

${inviteLink}

Ce lien est valable 30 jours.

À très bientôt,
Thomas Jean
Hyla`
    );
    const mailtoUrl = `mailto:${formData.email.trim()}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');

    try { await navigator.clipboard.writeText(inviteLink); } catch { /* ignore */ }

    toast({
      title: '✅ Partenaire créé — Email prêt !',
      description: `Votre client mail s'ouvre avec le message pré-rempli pour ${formData.displayName.trim()}.`,
    });

    setIsCreating(false);
    setFormData({ displayName: '', email: '', partnerType: 'professional' });
    setIsDialogOpen(false);
    fetchData();
  };

  const copyInviteLink = (partner: Partner) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${partner.invite_code}`);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Lien copié !' });
  };

  const handleDelete = async () => {
    if (!partnerToDelete) return;
    setIsDeleting(true);
    await supabase.from('leads').delete().eq('partner_id', partnerToDelete.id);
    const { error } = await supabase.from('partners').delete().eq('id', partnerToDelete.id);
    setIsDeleting(false);
    setPartnerToDelete(null);
    if (error) { toast({ title: 'Erreur', variant: 'destructive' }); return; }
    toast({ title: 'Partenaire supprimé' });
    fetchData();
  };

  const getPartnerStatus = (partner: Partner) => {
    if (partner.invite_used_at) return { label: 'Actif', variant: 'default' as const };
    if (new Date(partner.invite_expires_at) < new Date()) return { label: 'Expiré', variant: 'destructive' as const };
    return { label: 'Invité', variant: 'secondary' as const };
  };

  return (
    <AdminLayout title="Partenaires">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Partenaires</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Créer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-base">Nouveau partenaire</DialogTitle>
                <DialogDescription className="text-xs">Créez un partenaire et envoyez l'invitation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom / Prénom</Label>
                  <Input placeholder="Jean Dupont" value={formData.displayName} onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="jean@exemple.com" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={formData.partnerType} onValueChange={(v) => setFormData((p) => ({ ...p, partnerType: v as PartnerType }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professionnel</SelectItem>
                      <SelectItem value="private">Particulier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button size="sm" onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Création...' : 'Créer'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-10">
            <UserPlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Aucun partenaire</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {partners.map((partner) => {
              const status = getPartnerStatus(partner);
              const tier = partnerTiers[partner.id];
              return (
                <div key={partner.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <h3 className="text-sm font-medium truncate">{partner.display_name}</h3>
                        <Badge variant={status.variant} className="text-[10px] px-1.5 py-0 h-4">{status.label}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {PARTNER_TYPE_LABELS[partner.partner_type] || 'Pro'}
                        </Badge>
                      </div>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {partner.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(partner.created_at), 'd MMM yyyy', { locale: fr })}
                        </div>
                      </div>
                      {tier && tierRules.length > 0 && (
                        <div className="mt-2">
                          <TierProgress
                            signedCount={tier.signed_count}
                            tiers={tierRules}
                            currentTierRate={tier.rate_percent}
                          />
                        </div>
                      )}
                      {partnerSavings[partner.id] > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-teal-700">
                          <PiggyBank className="h-3 w-3" />
                          <span className="font-medium">{partnerSavings[partner.id].toLocaleString('fr-FR')} €/an</span>
                          <span className="text-muted-foreground">économisés pour ses clients</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        title="Simuler ce compte"
                        onClick={() => {
                          startImpersonation(partner.id, partner.display_name, partner.partner_type || 'professional');
                          navigate('/dashboard');
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {!partner.invite_used_at && (
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => copyInviteLink(partner)}>
                          {copiedId === partner.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setPartnerToDelete(partner)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!partnerToDelete} onOpenChange={(open) => !open && setPartnerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Supprimer ce partenaire ?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Irréversible. <strong>{partnerToDelete?.display_name}</strong> et ses leads seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="h-8 text-xs">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
