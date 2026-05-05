import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { PaywallScreen } from '@/components/PaywallScreen';
import { supabase, isSuperAdmin } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  GraduationCap, Plus, Upload, Link as LinkIcon, FileText, Video, Image as ImageIcon,
  FileBox, Trash2, Users, Settings, Copy, ExternalLink, X, Check, Eye,
} from 'lucide-react';

type AcademyFile = {
  id: string;
  academy_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: 'video' | 'image' | 'pdf' | 'document' | 'link';
  is_external: boolean;
  file_size_mb: number | null;
  category: string | null;
  sort_order: number;
  created_at: string;
};

type Academy = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  storage_quota_mb: number;
  storage_used_mb: number;
};

const FILE_TYPE_ICONS = {
  video: Video,
  image: ImageIcon,
  pdf: FileText,
  document: FileBox,
  link: LinkIcon,
};

function inferFileType(file: File): AcademyFile['file_type'] {
  const t = file.type;
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('image/')) return 'image';
  if (t === 'application/pdf') return 'pdf';
  return 'document';
}

export default function MonAcademiePage() {
  const { user } = useAuth();
  const { plan, isLegacy } = usePlan();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPro = plan === 'manager' || isLegacy || isSuperAdmin(user?.email);

  const [tab, setTab] = useState<'contenu' | 'acces' | 'parametres'>('contenu');
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [linkForm, setLinkForm] = useState({ title: '', url: '', category: '' });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');

  // Mon académie
  const { data: academy, isLoading } = useQuery({
    queryKey: ['my-academy', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('academies')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      return data as Academy | null;
    },
    enabled: !!user,
  });

  // Fichiers
  const { data: files = [] } = useQuery({
    queryKey: ['academy-files', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase
        .from('academy_files')
        .select('*')
        .eq('academy_id', academy.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      return (data || []) as AcademyFile[];
    },
    enabled: !!academy,
  });

  // Accès accordés
  const { data: accessList = [] } = useQuery({
    queryKey: ['academy-access', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase
        .from('academy_access')
        .select('user_id, granted_at')
        .eq('academy_id', academy.id);
      if (!data || data.length === 0) return [];
      const userIds = data.map((a: any) => a.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      return data.map((a: any) => ({
        ...a,
        profile: profiles?.find((p: any) => p.id === a.user_id) || null,
      }));
    },
    enabled: !!academy,
  });

  // Créer l'académie
  const createAcademy = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const slug = createForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + user.id.slice(0, 6);
      const { error } = await supabase.from('academies').insert({
        owner_user_id: user.id,
        name: createForm.name,
        slug,
        description: createForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-academy'] });
      toast({ title: 'Académie créée !' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  // Upload fichier
  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!academy || !user) throw new Error('Pas d\'académie');
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || '';
      const path = `${academy.id}/${fileId}.${ext}`;
      const { error: uErr } = await supabase.storage.from('academy-files').upload(path, file);
      if (uErr) throw uErr;
      const fileType = inferFileType(file);
      const { error } = await supabase.from('academy_files').insert({
        academy_id: academy.id,
        uploaded_by: user.id,
        title: uploadTitle || file.name,
        file_url: path,
        file_type: fileType,
        is_external: false,
        file_size_mb: Math.ceil(file.size / 1024 / 1024),
        category: uploadCategory || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      setUploadTitle('');
      setUploadCategory('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'Fichier uploadé' });
    },
    onError: (e: Error) => toast({ title: 'Erreur upload', description: e.message, variant: 'destructive' }),
  });

  // Ajouter un lien externe
  const addLink = useMutation({
    mutationFn: async () => {
      if (!academy || !user || !linkForm.url) throw new Error('Lien invalide');
      const { error } = await supabase.from('academy_files').insert({
        academy_id: academy.id,
        uploaded_by: user.id,
        title: linkForm.title || linkForm.url,
        file_url: linkForm.url,
        file_type: 'link',
        is_external: true,
        category: linkForm.category || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      setLinkForm({ title: '', url: '', category: '' });
      setShowLinkForm(false);
      toast({ title: 'Lien ajouté' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteFile = useMutation({
    mutationFn: async (file: AcademyFile) => {
      if (!file.is_external) {
        await supabase.storage.from('academy-files').remove([file.file_url]);
      }
      const { error } = await supabase.from('academy_files').delete().eq('id', file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      toast({ title: 'Fichier supprimé' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const grantAccess = useMutation({
    mutationFn: async () => {
      if (!academy || !grantEmail) throw new Error('Email requis');
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', grantEmail.toLowerCase().trim())
        .maybeSingle();
      if (!profile) throw new Error('Aucun utilisateur avec cet email');
      const { error } = await supabase.from('academy_access').insert({
        academy_id: academy.id,
        user_id: profile.id,
        granted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-access'] });
      setGrantEmail('');
      toast({ title: 'Accès accordé' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const revokeAccess = useMutation({
    mutationFn: async (userId: string) => {
      if (!academy) return;
      const { error } = await supabase.from('academy_access')
        .delete()
        .eq('academy_id', academy.id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-access'] });
      toast({ title: 'Accès révoqué' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (!isPro) {
    return <AppLayout><PaywallScreen feature="finance" /></AppLayout>;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // ── Pas d'académie : formulaire de création ──
  if (!academy) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Créer mon académie</h1>
            <p className="text-sm text-muted-foreground">
              Mets à disposition tes formations, vidéos, documents et liens à tes conseillers.
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div>
              <Label>Nom de l'académie *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Ex: Académie Marie Conseil"
                className="h-11"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Quelques mots sur le contenu proposé..."
                rows={3}
              />
            </div>
            <button
              onClick={() => createAcademy.mutate()}
              disabled={!createForm.name || createAcademy.isPending}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {createAcademy.isPending ? 'Création...' : 'Créer mon académie'}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Académie existante : gestion ──
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{academy.name}</h1>
              {academy.description && <p className="text-xs text-muted-foreground line-clamp-2">{academy.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-3">
            <span>{files.length} fichier{files.length > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{accessList.length} accès accordé{accessList.length > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{academy.storage_used_mb}/{academy.storage_quota_mb} MB</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/academie/${academy.slug}`);
                toast({ title: 'Lien copié' });
              }}
              className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-400"
            >
              <Copy className="h-3 w-3" /> Lien
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card rounded-xl p-1 border border-border">
          {([
            { key: 'contenu', label: 'Contenu', icon: FileText },
            { key: 'acces', label: 'Accès', icon: Users },
            { key: 'parametres', label: 'Paramètres', icon: Settings },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                tab === key ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab : Contenu */}
        {tab === 'contenu' && (
          <div className="space-y-3">
            {/* Upload zone */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-500" />
                Ajouter du contenu
              </h3>
              <div className="space-y-2">
                <Input
                  placeholder="Titre du contenu (optionnel)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
                <Input
                  placeholder="Catégorie (optionnel) - ex: Formation, Vidéos, Outils..."
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile.mutate(f);
                  }}
                  className="hidden"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadFile.isPending}
                    className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadFile.isPending ? 'Upload...' : 'Choisir un fichier'}
                  </button>
                  <button
                    onClick={() => setShowLinkForm(!showLinkForm)}
                    className="py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Ajouter un lien
                  </button>
                </div>
                {showLinkForm && (
                  <div className="mt-3 p-3 rounded-xl bg-muted space-y-2">
                    <Input placeholder="Titre du lien" value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} />
                    <Input placeholder="URL (Canva, YouTube, Google Drive...)" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
                    <Input placeholder="Catégorie (optionnel)" value={linkForm.category} onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })} />
                    <div className="flex gap-2">
                      <button onClick={() => addLink.mutate()} disabled={!linkForm.url || addLink.isPending} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-50">Ajouter</button>
                      <button onClick={() => setShowLinkForm(false)} className="py-2 px-3 rounded-lg bg-muted text-muted-foreground text-xs">Annuler</button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Vidéos, images, PDF, Word, Excel, PowerPoint acceptés. Max 500 MB par fichier.
                </p>
              </div>
            </div>

            {/* Liste fichiers */}
            <div className="space-y-2">
              {files.length === 0 && (
                <div className="text-center py-12 bg-card border border-border rounded-2xl">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun contenu pour l'instant</p>
                </div>
              )}
              {files.map(f => {
                const Icon = FILE_TYPE_ICONS[f.file_type];
                return (
                  <div key={f.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase">{f.file_type}</span>
                        {f.category && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground truncate">{f.category}</span>
                          </>
                        )}
                        {f.file_size_mb && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">{f.file_size_mb} MB</span>
                          </>
                        )}
                      </div>
                    </div>
                    {f.is_external && (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-600">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce contenu ?')) deleteFile.mutate(f);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab : Accès */}
        {tab === 'acces' && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-500" />
                Accorder l'accès
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Email de l'utilisateur"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  type="email"
                  className="flex-1"
                />
                <button
                  onClick={() => grantAccess.mutate()}
                  disabled={!grantEmail || grantAccess.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {grantAccess.isPending ? '...' : 'Accorder'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                L'utilisateur doit déjà avoir un compte Triibu avec cet email.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {accessList.length} accès actif{accessList.length > 1 ? 's' : ''}
                </p>
              </div>
              {accessList.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun accès accordé pour l'instant</p>
              )}
              {accessList.map((a: any) => (
                <div key={a.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {a.profile?.full_name?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.profile?.full_name || 'Utilisateur'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.profile?.email || a.user_id}</p>
                  </div>
                  <button
                    onClick={() => revokeAccess.mutate(a.user_id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab : Paramètres */}
        {tab === 'parametres' && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Paramètres avancés à venir (édition nom/description, suppression, etc.)</p>
            <div className="rounded-xl bg-muted p-3 space-y-1">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Lien public</p>
              <p className="text-xs font-mono text-foreground break-all">{window.location.origin}/academie/{academy.slug}</p>
            </div>
            <button
              onClick={() => navigate(`/academie/${academy.slug}`)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              <Eye className="h-4 w-4" />
              Voir mon académie côté visiteur
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
