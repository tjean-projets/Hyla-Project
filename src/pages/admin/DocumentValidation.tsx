import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { supabase, type Partner } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import {
  CheckCircle, XCircle, Eye, FolderOpen, ArrowLeft, User, FileText, Phone,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocWithPartner {
  id: string;
  partner_id: string;
  lead_id: string | null;
  document_type: string;
  file_name: string;
  file_url: string;
  validation_status: string;
  created_at: string;
}

interface LeadConsent {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  consent_document_url: string | null;
  consent_timestamp: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  cni: 'CNI / Passeport',
  rib: 'RIB',
  rib_pro: 'RIB Pro',
  kbis: 'KBIS',
  justificatif_domicile: 'Justificatif de domicile',
  signed_contract: 'Contrat signé',
  contract: 'Contrat',
};

const STATUS_COLORS: Record<string, 'default' | 'destructive' | 'secondary'> = {
  validated: 'default',
  rejected: 'destructive',
  pending: 'secondary',
};

export default function DocumentValidation() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocWithPartner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [consents, setConsents] = useState<LeadConsent[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [docsRes, partRes] = await Promise.all([
      supabase.from('partner_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('*').order('display_name'),
    ]);
    if (docsRes.data) setDocs(docsRes.data as unknown as DocWithPartner[]);
    if (partRes.data) setPartners(partRes.data as unknown as Partner[]);
    setIsLoading(false);
  };

  const selectPartner = async (partner: Partner) => {
    setSelectedPartner(partner);
    // Fetch consent documents for this partner's leads
    const { data } = await supabase
      .from('leads')
      .select('id, first_name, last_name, phone, consent_document_url, consent_timestamp, created_at')
      .eq('partner_id', partner.id)
      .not('consent_document_url', 'is', null)
      .order('created_at', { ascending: false });
    setConsents((data || []) as unknown as LeadConsent[]);
  };

  const handleValidate = async (docId: string, status: 'validated' | 'rejected') => {
    const { error } = await supabase.from('partner_documents').update({
      validation_status: status,
    } as Record<string, unknown>).eq('id', docId);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }

    const doc = docs.find(d => d.id === docId);
    if (doc) {
      const partner = partners.find(p => p.id === doc.partner_id);
      if (partner?.user_id) {
        await supabase.from('notifications').insert({
          user_id: partner.user_id,
          title: status === 'validated' ? '✅ Document validé' : '❌ Document refusé',
          message: status === 'validated'
            ? `✅ Votre document "${DOC_TYPE_LABELS[doc.document_type] || doc.document_type}" a été validé.`
            : `❌ Votre document "${DOC_TYPE_LABELS[doc.document_type] || doc.document_type}" a été refusé. Veuillez le renvoyer.`,
          type: status === 'validated' ? 'success' : 'error',
          link: '/documents',
        });
      }
    }

    sonnerToast.success(status === 'validated' ? 'Document validé' : 'Document refusé');
    fetchData();
  };

  const handlePreviewDoc = async (doc: DocWithPartner) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_url.replace('documents/', ''), 300);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewLabel(DOC_TYPE_LABELS[doc.document_type] || doc.file_name);
    }
  };

  const handlePreviewConsent = async (consent: LeadConsent) => {
    if (!consent.consent_document_url) return;
    const path = consent.consent_document_url.replace('consent-documents/', '');
    const { data } = await supabase.storage
      .from('consent-documents')
      .createSignedUrl(path, 300);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewLabel(`Consentement — ${consent.first_name} ${consent.last_name}`);
    }
  };

  const partnerDocs = selectedPartner
    ? docs.filter(d => d.partner_id === selectedPartner.id)
    : [];

  const getPartnerDocStats = (pid: string) => {
    const pDocs = docs.filter(d => d.partner_id === pid);
    const pending = pDocs.filter(d => d.validation_status === 'pending').length;
    const total = pDocs.length;
    return { pending, total };
  };

  if (isLoading) {
    return (
      <AdminLayout title="Documents KYC">
        <Skeleton className="h-48 w-full rounded-lg" />
      </AdminLayout>
    );
  }

  // Partner folder detail view
  if (selectedPartner) {
    return (
      <AdminLayout title="Documents KYC">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedPartner(null)} className="h-8">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{selectedPartner.display_name}</h2>
              <p className="text-xs text-muted-foreground">{selectedPartner.email}</p>
            </div>
          </div>

          {/* KYC Documents */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Documents KYC</p>
              {partnerDocs.filter(d => d.validation_status === 'pending').length > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  {partnerDocs.filter(d => d.validation_status === 'pending').length} en attente
                </Badge>
              )}
            </div>

            {partnerDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun document KYC soumis</p>
            ) : (
              <div className="space-y-2">
                {partnerDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
                        <Badge variant={STATUS_COLORS[doc.validation_status] || 'secondary'} className="text-[10px]">
                          {doc.validation_status === 'pending' ? 'En attente' : doc.validation_status === 'validated' ? 'Validé' : 'Refusé'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.file_name} • {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePreviewDoc(doc)}>
                        <Eye className="h-3 w-3 mr-1" />
                        Voir
                      </Button>
                      {doc.validation_status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleValidate(doc.id, 'validated')}>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valider
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleValidate(doc.id, 'rejected')}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consent Documents */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Consentements d'appel</p>
              <Badge variant="secondary" className="text-[10px] h-5">{consents.length}</Badge>
            </div>

            {consents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun consentement enregistré</p>
            ) : (
              <div className="space-y-2">
                {consents.map(consent => (
                  <div key={consent.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{consent.first_name} {consent.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {consent.phone} • {format(new Date(consent.created_at), 'd MMM yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs ml-3"
                      onClick={() => handlePreviewConsent(consent)}
                      disabled={!consent.consent_document_url}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-sm">{previewLabel}</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              previewUrl.match(/\.pdf/) ? (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded-md border" />
              ) : (
                <img src={previewUrl} alt={previewLabel} className="w-full max-h-[70vh] object-contain rounded-md" />
              )
            )}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // Partner list view
  return (
    <AdminLayout title="Documents KYC">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sélectionnez un partenaire pour consulter et valider ses documents.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {partners.map(partner => {
            const stats = getPartnerDocStats(partner.id);
            return (
              <button
                key={partner.id}
                onClick={() => selectPartner(partner)}
                className="rounded-lg border bg-card p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <User className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{partner.display_name}</p>
                      <p className="text-xs text-muted-foreground">{partner.email}</p>
                    </div>
                  </div>
                  <FolderOpen className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {stats.total} doc{stats.total !== 1 ? 's' : ''}
                  </Badge>
                  {stats.pending > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {stats.pending} en attente
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}

          {partners.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              Aucun partenaire enregistré
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
