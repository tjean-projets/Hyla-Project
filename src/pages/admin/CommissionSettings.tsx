import { useState, useEffect, useRef } from 'react';
import { Save, Upload, User, Building, FileText, Eye, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface AdminSettings {
  id?: string;
  first_name: string;
  last_name: string;
  company_name: string;
  siret: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  orias_number: string;
  cni_url: string | null;
  justificatif_domicile_url: string | null;
  kbis_url: string | null;
  rib_url: string | null;
}

const EMPTY: AdminSettings = {
  first_name: '', last_name: '', company_name: '', siret: '',
  address: '', city: '', postal_code: '', phone: '', email: '',
  orias_number: '', cni_url: null, justificatif_domicile_url: null,
  kbis_url: null, rib_url: null,
};

const DOC_FIELDS = [
  { key: 'cni_url' as const, label: 'CNI ou Passeport', accept: 'image/*,application/pdf' },
  { key: 'justificatif_domicile_url' as const, label: 'Justificatif de domicile', accept: 'image/*,application/pdf' },
  { key: 'kbis_url' as const, label: 'K-BIS', accept: 'image/*,application/pdf' },
  { key: 'rib_url' as const, label: 'RIB', accept: 'image/*,application/pdf' },
];

export default function CommissionSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) setSettings(data as unknown as AdminSettings & { id: string });
    setIsLoading(false);
  };

  const update = (field: keyof AdminSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const payload = {
      user_id: user.id,
      first_name: settings.first_name.trim(),
      last_name: settings.last_name.trim(),
      company_name: settings.company_name.trim(),
      siret: settings.siret.trim(),
      address: settings.address.trim(),
      city: settings.city.trim(),
      postal_code: settings.postal_code.trim(),
      phone: settings.phone.trim(),
      email: settings.email.trim(),
      orias_number: settings.orias_number.trim(),
      cni_url: settings.cni_url,
      justificatif_domicile_url: settings.justificatif_domicile_url,
      kbis_url: settings.kbis_url,
      rib_url: settings.rib_url,
      updated_at: new Date().toISOString(),
    };

    if (settings.id) {
      await supabase.from('admin_settings').update(payload).eq('id', settings.id);
    } else {
      await supabase.from('admin_settings').insert(payload);
    }

    await fetchSettings();
    setIsSaving(false);
    toast({ title: 'Paramètres enregistrés', description: 'Vos informations ont été mises à jour.' });
  };

  const handleUpload = async (field: keyof AdminSettings, file: File) => {
    if (!user) return;
    setUploading(field);

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${field}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('admin-documents').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Erreur upload', description: error.message, variant: 'destructive' });
      setUploading(null);
      return;
    }

    setSettings(prev => ({ ...prev, [field]: path }));
    setUploading(null);
    toast({ title: 'Document uploadé', description: 'N\'oubliez pas d\'enregistrer.' });
  };

  const handlePreview = async (path: string, label: string) => {
    const { data } = await supabase.storage.from('admin-documents').createSignedUrl(path, 300);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewLabel(label);
    }
  };

  const handleRemoveDoc = (field: keyof AdminSettings) => {
    setSettings(prev => ({ ...prev, [field]: null }));
  };

  if (isLoading) {
    return (
      <AdminLayout title="Paramètres">
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-60 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Paramètres">
      <div className="max-w-3xl space-y-6">
        {/* Identity */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Identité du courtier</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom</Label>
              <Input value={settings.first_name} onChange={e => update('first_name', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom</Label>
              <Input value={settings.last_name} onChange={e => update('last_name', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={settings.phone} onChange={e => update('phone', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={settings.email} onChange={e => update('email', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* Company */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Informations société</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Raison sociale</Label>
              <Input value={settings.company_name} onChange={e => update('company_name', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SIRET</Label>
              <Input value={settings.siret} onChange={e => update('siret', e.target.value)} className="h-9 text-sm" maxLength={14} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° ORIAS</Label>
              <Input value={settings.orias_number} onChange={e => update('orias_number', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Adresse</Label>
              <Input value={settings.address} onChange={e => update('address', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code postal</Label>
              <Input value={settings.postal_code} onChange={e => update('postal_code', e.target.value)} className="h-9 text-sm" maxLength={5} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ville</Label>
              <Input value={settings.city} onChange={e => update('city', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Pièces justificatives</p>
          </div>
          <div className="space-y-3">
            {DOC_FIELDS.map(doc => {
              const value = settings[doc.key];
              return (
                <div key={doc.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.label}</p>
                    {value ? (
                      <p className="text-xs text-muted-foreground truncate">{value.split('/').pop()}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Non fourni</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    {value && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePreview(value, doc.label)}>
                          <Eye className="h-3 w-3 mr-1" />
                          Voir
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleRemoveDoc(doc.key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={uploading === doc.key}
                      onClick={() => fileRefs.current[doc.key]?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {uploading === doc.key ? '...' : value ? 'Remplacer' : 'Uploader'}
                    </Button>
                    <input
                      ref={el => { fileRefs.current[doc.key] = el; }}
                      type="file"
                      accept={doc.accept}
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(doc.key, file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full h-10 text-sm">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">{previewLabel}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(pdf)/) || previewUrl.includes('.pdf') ? (
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
