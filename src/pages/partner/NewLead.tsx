import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, CheckCircle, Heart } from 'lucide-react';
import { fireConfetti } from '@/lib/confetti';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { ConsentModal } from '@/components/ConsentModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase, CONTRACT_TYPE_LABELS, type ContractType } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useToast } from '@/hooks/use-toast';

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  contractType: ContractType | '';
  montant: string;
  banque: string;
  typeProjet: string;
}

export default function NewLead() {
  const navigate = useNavigate();
  const { partnerId, partnerType } = useAuth();
  const { toast } = useToast();
  const isPrivate = partnerType === 'private';
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
    contractType: '',
    montant: '',
    banque: '',
    typeProjet: '',
  });
  const [showConsent, setShowConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.phone.trim()) {
        toast({ title: 'Champs requis', description: 'Prénom, Nom et Téléphone sont obligatoires.', variant: 'destructive' });
        return;
      }
      const phoneClean = formData.phone.replace(/\s/g, '');
      if (phoneClean.length < 10) {
        toast({ title: 'Numéro invalide', variant: 'destructive' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.contractType) {
        toast({ title: 'Type de contrat requis', variant: 'destructive' });
        return;
      }
      setShowConsent(true);
    }
  };

  const handleConfirmConsent = async () => {
    if (!partnerId) {
      toast({ title: 'Votre compte est en cours de validation par notre équipe.', variant: 'destructive' });
      setShowConsent(false);
      return;
    }
    
    setIsSubmitting(true);
    const consentTimestamp = new Date().toISOString();

    const leadData = {
      partner_id: partnerId,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      notes_partner: formData.notes.trim() || null,
      contract_type: formData.contractType as ContractType,
      montant: formData.montant ? parseFloat(formData.montant) : null,
      banque: formData.banque.trim() || null,
      type_projet: formData.typeProjet.trim() || null,
      consent_confirmed: true,
      consent_timestamp: consentTimestamp,
      consent_text_version: 'checkbox_v1',
      status: 'NOUVEAU' as const,
    };

    const { data, error } = await supabase.from('leads').insert(leadData).select();

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setIsSubmitting(false);
      setShowConsent(false);
      return;
    }

    const createdLead = data?.[0];

    if (createdLead) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: partnerData } = await supabase
          .from('partners')
          .select('display_name')
          .eq('id', partnerId)
          .maybeSingle();

        if (session && partnerData) {
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-consent-document`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                leadId: createdLead.id,
                partnerName: partnerData.display_name,
                prospectFirstName: formData.firstName.trim(),
                prospectLastName: formData.lastName.trim(),
                prospectPhone: formData.phone.trim(),
                prospectEmail: formData.email.trim() || null,
                consentTimestamp,
                contractType: formData.contractType,
              }),
            }
          ).catch((err) => console.error('Consent document generation failed:', err));
        }
      } catch (err) {
        console.error('Error initiating consent document:', err);
      }
    }

    setIsSubmitting(false);
    setShowConsent(false);
    setIsSuccess(true);
    fireConfetti();
    toast({ title: 'Lead envoyé !', description: 'Le prospect sera contacté rapidement.' });
  };

  const handleAddAnother = () => {
    setFormData({ firstName: '', lastName: '', phone: '', email: '', notes: '', contractType: '', montant: '', banque: '', typeProjet: '' });
    setIsSuccess(false);
    setStep(1);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <AppHeader title={isPrivate ? 'Parrainer un proche' : 'Nouveau lead'} />
        <main className="container py-8">
          <div className="max-w-md mx-auto rounded-lg border bg-card p-6 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Lead envoyé avec succès !</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {formData.firstName} {formData.lastName} sera contacté rapidement.
            </p>
            <div className="space-y-2.5">
              <Button onClick={handleAddAnother} className="w-full" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter un autre lead
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full" size="sm">
                Retour au dashboard
              </Button>
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title={isPrivate ? 'Parrainer un proche' : 'Nouveau lead'} />

      <main className="container py-4">
        <Button variant="ghost" size="sm" onClick={() => step === 1 ? navigate('/dashboard') : setStep(1)} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {step === 1 ? 'Retour' : 'Étape précédente'}
        </Button>

        {/* Step indicator */}
        <div className="flex gap-2 mb-5 max-w-md mx-auto">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-foreground' : 'bg-muted'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-foreground' : 'bg-muted'}`} />
        </div>

        <div className="max-w-md mx-auto rounded-lg border bg-card p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-3">Informations du prospect</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs">Prénom *</Label>
                  <Input id="firstName" placeholder="Jean" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} required className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs">Nom *</Label>
                  <Input id="lastName" placeholder="Dupont" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} required className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Téléphone *</Label>
                <Input id="phone" type="tel" placeholder="06 12 34 56 78" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" type="email" placeholder="jean.dupont@email.com" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className="h-10" />
              </div>
              <Button onClick={handleNext} className="w-full h-10 text-sm">
                Continuer
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-3">Détails du projet</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type de contrat *</Label>
                <Select value={formData.contractType} onValueChange={(v) => handleChange('contractType', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="montant" className="text-xs">Montant du projet (€)</Label>
                <Input id="montant" type="number" placeholder="250000" value={formData.montant} onChange={(e) => handleChange('montant', e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banque" className="text-xs">Banque</Label>
                <Input id="banque" placeholder="Nom de la banque" value={formData.banque} onChange={(e) => handleChange('banque', e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="typeProjet" className="text-xs">Type de projet</Label>
                <Input id="typeProjet" placeholder="Achat résidence principale..." value={formData.typeProjet} onChange={(e) => handleChange('typeProjet', e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">Commentaire</Label>
                <Textarea id="notes" placeholder="Contexte, urgence..." value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} />
              </div>
              <Button onClick={handleNext} className="w-full h-10 text-sm">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Envoyer le lead
              </Button>
            </div>
          )}
        </div>
      </main>

      <ConsentModal open={showConsent} onOpenChange={setShowConsent} onConfirm={handleConfirmConsent} isLoading={isSubmitting} />
      <MobileNav />
    </div>
  );
}
