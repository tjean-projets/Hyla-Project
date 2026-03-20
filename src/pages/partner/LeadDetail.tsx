import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Clock, Edit2, Save, X, Euro, ShieldCheck } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, type Lead } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { partnerId, role, partnerRate } = useAuth();
  const { toast } = useToast();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    notes_partner: '',
  });

  useEffect(() => {
    if (id) fetchLead();
  }, [id]);

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Lead introuvable.', variant: 'destructive' });
      navigate('/dashboard');
      return;
    }

    const leadData = data as unknown as Lead;
    setLead(leadData);
    setEditData({
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      phone: leadData.phone,
      email: leadData.email || '',
      notes_partner: leadData.notes_partner || '',
    });
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);

    const { error } = await supabase.from('leads').update({
      first_name: editData.first_name.trim(),
      last_name: editData.last_name.trim(),
      phone: editData.phone.trim(),
      email: editData.email.trim() || null,
      notes_partner: editData.notes_partner.trim() || null,
    }).eq('id', lead.id);

    setIsSaving(false);

    if (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
      return;
    }

    toast({ title: 'Modifications enregistrées' });
    setIsEditing(false);
    fetchLead();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader title="Détail du lead" />
        <main className="container py-4 space-y-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </main>
        <MobileNav />
      </div>
    );
  }

  if (!lead) return null;

  const fullName = `${lead.first_name} ${lead.last_name}`;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Détail du lead" />

      <main className="container py-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour
          </Button>
          {!isEditing && role === 'partner' && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Modifier
            </Button>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold">{fullName}</h2>
              <StatusBadge status={lead.status} className="mt-1" />
            </div>
            {lead.commission_estimated && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase">Votre commission</p>
                <p className="text-lg font-semibold text-emerald-600 flex items-center gap-0.5">
                  <Euro className="h-3.5 w-3.5" />
                  {((lead.commission_final || lead.commission_estimated) * partnerRate / 100).toFixed(0)}
                </p>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 pt-2 border-t">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Prénom</Label>
                  <Input value={editData.first_name} onChange={(e) => setEditData((p) => ({ ...p, first_name: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom</Label>
                  <Input value={editData.last_name} onChange={(e) => setEditData((p) => ({ ...p, last_name: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input value={editData.phone} onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={editData.email} onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={editData.notes_partner} onChange={(e) => setEditData((p) => ({ ...p, notes_partner: e.target.value }))} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving} className="flex-1 h-9 text-sm">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-9 text-sm">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {isSaving ? '...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-2 border-t text-sm">
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
              {lead.notes_partner && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                  <p className="text-xs">{lead.notes_partner}</p>
                </div>
              )}
            </div>
          )}
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
      </main>

      <MobileNav />
    </div>
  );
}
