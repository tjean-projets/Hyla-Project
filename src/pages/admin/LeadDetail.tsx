import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Clock, Save, Euro, ShieldCheck, History, CheckSquare, User, PiggyBank } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, type Lead, type LeadEvent, type LeadStatus, STATUS_LABELS, CONTRACT_TYPE_LABELS } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editData, setEditData] = useState({
    // Infos client
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    // Gestion
    status: 'NOUVEAU' as LeadStatus,
    commission_estimated: '',
    commission_final: '',
    frais_courtage: '',
    frais_courtage_mode: '' as 'fixe' | 'etale' | '',
    frais_courtage_mois: '',
    savings_achieved: '',
    admin_notes: '',
    lost_reason: '',
    paiement_compagnie_recu: false,
  });

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const [leadRes, eventsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).maybeSingle(),
      supabase.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ]);

    if (!leadRes.data) {
      toast({ title: 'Lead introuvable', variant: 'destructive' });
      navigate('/admin');
      return;
    }

    const leadData = leadRes.data as unknown as Lead;
    setLead(leadData);
    setEvents((eventsRes.data || []) as unknown as LeadEvent[]);

    setEditData({
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      phone: leadData.phone,
      email: leadData.email || '',
      status: leadData.status,
      commission_estimated: leadData.commission_estimated?.toString() || '',
      commission_final: leadData.commission_final?.toString() || '',
      frais_courtage: leadData.frais_courtage?.toString() || '',
      frais_courtage_mode: leadData.frais_courtage_mode || '',
      frais_courtage_mois: leadData.frais_courtage_mois?.toString() || '',
      savings_achieved: leadData.savings_achieved?.toString() || '',
      admin_notes: leadData.admin_notes || '',
      lost_reason: leadData.lost_reason || '',
      paiement_compagnie_recu: leadData.paiement_compagnie_recu || false,
    });

    const { data: partner } = await supabase
      .from('partners')
      .select('display_name, user_id')
      .eq('id', leadData.partner_id)
      .maybeSingle();

    if (partner) {
      setPartnerName(partner.display_name);
      setPartnerUserId(partner.user_id);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!lead) return;

    if (!editData.first_name.trim() || !editData.last_name.trim() || !editData.phone.trim()) {
      toast({ title: 'Nom, prénom et téléphone requis', variant: 'destructive' });
      return;
    }

    if (editData.status === 'REFUSE' && !editData.lost_reason.trim()) {
      toast({ title: 'Motif de refus requis', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const updateData: Record<string, unknown> = {
      first_name: editData.first_name.trim(),
      last_name: editData.last_name.trim(),
      phone: editData.phone.trim(),
      email: editData.email.trim() || null,
      status: editData.status,
      admin_notes: editData.admin_notes.trim() || null,
      lost_reason: editData.status === 'REFUSE' || editData.status === 'PERDU' ? editData.lost_reason.trim() : null,
      paiement_compagnie_recu: editData.paiement_compagnie_recu,
    };

    // frais_courtage fields — only include if column exists in DB (migration may be pending)
    if (editData.frais_courtage !== '') {
      updateData.frais_courtage = parseFloat(editData.frais_courtage) || null;
      updateData.frais_courtage_mode = editData.frais_courtage_mode || null;
      updateData.frais_courtage_mois = editData.frais_courtage_mode === 'etale' && editData.frais_courtage_mois
        ? parseInt(editData.frais_courtage_mois)
        : null;
    }

    if (editData.savings_achieved !== '') {
      updateData.savings_achieved = parseFloat(editData.savings_achieved) || null;
    }

    if (editData.commission_estimated) {
      updateData.commission_estimated = parseFloat(editData.commission_estimated);
    }

    if (editData.commission_final) {
      updateData.commission_final = parseFloat(editData.commission_final);
    }

    const { error } = await supabase.from('leads').update(updateData).eq('id', lead.id);

    setIsSaving(false);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    // Notification partenaire : paiement compagnie reçu pour la 1ère fois
    const paiementVientDEtreConfirme = editData.paiement_compagnie_recu && !lead.paiement_compagnie_recu;
    if (paiementVientDEtreConfirme && partnerUserId) {
      await supabase.from('notifications').insert({
        user_id: partnerUserId,
        title: '💸 Nouveau retrait disponible',
        message: `Le paiement compagnie pour le dossier ${editData.first_name} ${editData.last_name} a été reçu. Vous pouvez effectuer un retrait.`,
        type: 'info',
        link: '/wallet',
      });
    }

    toast({ title: 'Modifications enregistrées' });
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader title="Détail lead" />
        <main className="container py-4 space-y-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </main>
        <MobileNav />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Détail lead" />

      <main className="container py-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retour
        </Button>

        {/* Infos statiques */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold">{lead.first_name} {lead.last_name}</h2>
              <p className="text-xs text-muted-foreground">Partenaire : {partnerName}</p>
            </div>
            <StatusBadge status={lead.status} />
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(lead.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
            {lead.contract_type && (
              <div className="pt-2 border-t text-xs">
                <span className="text-muted-foreground">Contrat : </span>
                <span className="font-medium">{CONTRACT_TYPE_LABELS[lead.contract_type]}</span>
              </div>
            )}
            {lead.montant && (
              <div className="text-xs">
                <span className="text-muted-foreground">Montant : </span>
                <span className="font-medium">{lead.montant.toLocaleString('fr-FR')} €</span>
              </div>
            )}
            {lead.banque && (
              <div className="text-xs">
                <span className="text-muted-foreground">Banque : </span>
                <span className="font-medium">{lead.banque}</span>
              </div>
            )}
            {lead.notes_partner && (
              <div className="pt-2 border-t text-xs">
                <p className="text-muted-foreground mb-0.5">Notes partenaire</p>
                <p>{lead.notes_partner}</p>
              </div>
            )}
          </div>
        </div>

        {lead.consent_confirmed && lead.consent_timestamp && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs font-medium text-emerald-800">Consentement obtenu</p>
                <p className="text-[10px] text-emerald-600">
                  {format(new Date(lead.consent_timestamp), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section éditable */}
        <div className="rounded-lg border bg-card p-4 space-y-4">

          {/* Informations client */}
          <div className="space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Informations client
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Prénom</Label>
                <Input
                  value={editData.first_name}
                  onChange={(e) => setEditData((prev) => ({ ...prev, first_name: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom</Label>
                <Input
                  value={editData.last_name}
                  onChange={(e) => setEditData((prev) => ({ ...prev, last_name: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Téléphone
              </Label>
              <Input
                value={editData.phone}
                onChange={(e) => setEditData((prev) => ({ ...prev, phone: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <Input
                type="email"
                placeholder="client@exemple.com"
                value={editData.email}
                onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-semibold">Gestion</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Statut</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData((prev) => ({ ...prev, status: v as LeadStatus }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(editData.status === 'DEVIS_ENVOYE' || editData.status === 'SIGNATURE' || editData.status === 'SIGNE') && (
              <>
                {/* Commission de base */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    Commission de base (€)
                  </Label>
                  <Input
                    type="number"
                    placeholder="ex. 450"
                    value={editData.commission_estimated}
                    onChange={(e) => setEditData((prev) => ({ ...prev, commission_estimated: e.target.value }))}
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">Montant total de la commission que vous recevez — la part partenaire sera calculée dessus.</p>
                </div>

                {editData.status === 'SIGNE' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      Commission finale (€)
                    </Label>
                    <Input
                      type="number"
                      placeholder="ex. 430"
                      value={editData.commission_final}
                      onChange={(e) => setEditData((prev) => ({ ...prev, commission_final: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                )}

                {/* Frais de courtage */}
                <div className="border-t pt-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frais de courtage</p>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Montant (€ HT)</Label>
                    <Input
                      type="number"
                      placeholder="ex. 300"
                      value={editData.frais_courtage}
                      onChange={(e) => setEditData((prev) => ({ ...prev, frais_courtage: e.target.value }))}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Mode de paiement</Label>
                    <Select
                      value={editData.frais_courtage_mode}
                      onValueChange={(v) => setEditData((prev) => ({ ...prev, frais_courtage_mode: v as 'fixe' | 'etale', frais_courtage_mois: v === 'fixe' ? '' : prev.frais_courtage_mois }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixe">Fixe — versement en une fois</SelectItem>
                        <SelectItem value="etale">Étalé — lissé sur plusieurs mois</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editData.frais_courtage_mode === 'etale' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Durée d'étalement (mois)</Label>
                      <Input
                        type="number"
                        placeholder="ex. 12"
                        min={2}
                        max={60}
                        value={editData.frais_courtage_mois}
                        onChange={(e) => setEditData((prev) => ({ ...prev, frais_courtage_mois: e.target.value }))}
                        className="h-9"
                      />
                      {editData.frais_courtage && editData.frais_courtage_mois && (
                        <p className="text-[10px] text-muted-foreground">
                          ≈ {(parseFloat(editData.frais_courtage) / parseInt(editData.frais_courtage_mois)).toFixed(2)} €/mois
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Économies réalisées — visible dès que signé */}
            {editData.status === 'SIGNE' && (
              <div className="border-t pt-3 space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <PiggyBank className="h-3 w-3" />
                  Économies réalisées (€/an)
                </Label>
                <Input
                  type="number"
                  placeholder="ex. 350"
                  value={editData.savings_achieved}
                  onChange={(e) => setEditData((prev) => ({ ...prev, savings_achieved: e.target.value }))}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Économies annuelles constatées pour le client grâce à la mise en relation.</p>
              </div>
            )}

            {editData.status === 'SIGNE' && (
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="paiement_compagnie"
                  checked={editData.paiement_compagnie_recu}
                  onChange={(e) => setEditData((prev) => ({ ...prev, paiement_compagnie_recu: e.target.checked }))}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="paiement_compagnie" className="text-xs cursor-pointer">Paiement compagnie reçu</Label>
              </div>
            )}

            {(editData.status === 'REFUSE' || editData.status === 'PERDU') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motif de refus *</Label>
                <Textarea placeholder="Raison..." value={editData.lost_reason} onChange={(e) => setEditData((prev) => ({ ...prev, lost_reason: e.target.value }))} rows={2} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes admin</Label>
              <Textarea placeholder="Notes internes..." value={editData.admin_notes} onChange={(e) => setEditData((prev) => ({ ...prev, admin_notes: e.target.value }))} rows={2} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full h-9 text-sm">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>

        {events.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Historique
            </p>
            <div className="space-y-2">
              {events.slice(0, 10).map((event) => (
                <div key={event.id} className="border-l-2 border-muted pl-3 py-0.5">
                  <p className="text-xs font-medium">{event.event_type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(event.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
