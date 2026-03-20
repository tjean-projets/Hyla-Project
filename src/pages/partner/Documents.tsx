import { useState, useEffect } from 'react';
import { FileText, Download, ShieldCheck, Receipt, FileSignature } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase, type PartnerDocument } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocWithStatus extends PartnerDocument {
  validation_status: string;
}

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  contract: { label: 'Contrat d\'apport', icon: FileSignature, color: 'bg-primary/10 text-primary' },
  signed_contract: { label: 'Contrat signé', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  invoice: { label: 'Facture', icon: Receipt, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  consent: { label: 'Consentement', icon: ShieldCheck, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  cni: { label: 'CNI', icon: FileText, color: 'bg-primary/10 text-primary' },
  rib: { label: 'RIB', icon: FileText, color: 'bg-primary/10 text-primary' },
  rib_pro: { label: 'RIB Pro', icon: FileText, color: 'bg-primary/10 text-primary' },
  kbis: { label: 'KBIS', icon: FileText, color: 'bg-primary/10 text-primary' },
};

const VALIDATION_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'En attente de validation', variant: 'secondary' },
  validated: { label: 'Validé', variant: 'default' },
  rejected: { label: 'Refusé', variant: 'destructive' },
};

export default function Documents() {
  const { partnerId } = useAuth();
  const [documents, setDocuments] = useState<DocWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (partnerId) fetchDocuments();
  }, [partnerId]);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('partner_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data as unknown as DocWithStatus[]);
    }
    setIsLoading(false);
  };

  const handleDownload = async (doc: DocWithStatus) => {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_url.replace('documents/', ''), 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const filterByType = (types: string[]) =>
    documents.filter((d) => types.includes(d.document_type));

  const contractDocs = filterByType(['contract', 'signed_contract']);
  const invoiceDocs = filterByType(['invoice']);
  const consentDocs = filterByType(['consent']);

  const renderDocList = (docs: DocWithStatus[], emptyMessage: string) => {
    if (isLoading) {
      return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
    }
    if (docs.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {docs.map((doc) => {
          const config = DOC_TYPE_CONFIG[doc.document_type] || DOC_TYPE_CONFIG.consent;
          const DocIcon = config.icon;
          const valStatus = VALIDATION_STATUS_CONFIG[doc.validation_status] || VALIDATION_STATUS_CONFIG.pending;
          return (
            <Card key={doc.id} className="animate-fade-in">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`rounded-lg p-2 ${config.color}`}>
                      <DocIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                        <Badge variant={valStatus.variant} className="text-xs">{valStatus.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Mes Documents" />

      <main className="container py-4">
        <Tabs defaultValue="contracts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contracts">Contrats</TabsTrigger>
            <TabsTrigger value="invoices">Factures</TabsTrigger>
            <TabsTrigger value="consents">Consentements</TabsTrigger>
          </TabsList>
          <TabsContent value="contracts" className="mt-4">
            {renderDocList(contractDocs, 'Aucun contrat disponible pour le moment.')}
          </TabsContent>
          <TabsContent value="invoices" className="mt-4">
            {renderDocList(invoiceDocs, 'Aucune facture disponible pour le moment.')}
          </TabsContent>
          <TabsContent value="consents" className="mt-4">
            {renderDocList(consentDocs, 'Aucun document de consentement disponible.')}
          </TabsContent>
        </Tabs>
      </main>

      <MobileNav />
    </div>
  );
}
