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
  FileBox, Trash2, Users, Settings, Copy, ExternalLink, X, Eye, FolderPlus,
  Folder, Edit2, TrendingUp, CheckCircle2, GripVertical,
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type AcademyFile = {
  id: string;
  academy_id: string;
  section_id: string | null;
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

type AcademySection = {
  id: string;
  academy_id: string;
  title: string;
  description: string | null;
  sort_order: number;
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

  const [tab, setTab] = useState<'contenu' | 'acces' | 'stats' | 'parametres'>('contenu');
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [grantEmail, setGrantEmail] = useState('');
  const [editingSection, setEditingSection] = useState<AcademySection | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });
  const [activeUploadSection, setActiveUploadSection] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [showLinkForm, setShowLinkForm] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ title: '', url: '' });
  const [editingFile, setEditingFile] = useState<AcademyFile | null>(null);
  const [editingFileTitle, setEditingFileTitle] = useState('');
  const [editingFileDescription, setEditingFileDescription] = useState('');
  const [showFileEditModal, setShowFileEditModal] = useState(false);

  // Sensors pour le drag & drop (delay 250ms pour différencier d'un click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex(s => s.id === active.id);
    const newIdx = sections.findIndex(s => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(sections, oldIdx, newIdx).map(s => s.id);
    reorderSections.mutate(newOrder);
  };

  const handleLessonDragEnd = (event: DragEndEvent, sectionId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sectionFiles = files.filter(f => f.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);
    const oldIdx = sectionFiles.findIndex(f => f.id === active.id);
    const newIdx = sectionFiles.findIndex(f => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(sectionFiles, oldIdx, newIdx).map(f => f.id);
    reorderFiles.mutate(newOrder);
  };

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

  // Sections
  const { data: sections = [] } = useQuery({
    queryKey: ['academy-sections', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase
        .from('academy_sections')
        .select('*')
        .eq('academy_id', academy.id)
        .order('sort_order', { ascending: true });
      return (data || []) as AcademySection[];
    },
    enabled: !!academy,
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

  // ── Stats : progression par user / par leçon ──
  const { data: progressData = [] } = useQuery({
    queryKey: ['academy-progress-stats', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const fileIds = files.map(f => f.id);
      if (fileIds.length === 0) return [];
      const { data } = await supabase
        .from('academy_file_progress')
        .select('file_id, user_id, completed_at')
        .in('file_id', fileIds);
      return (data || []) as Array<{ file_id: string; user_id: string; completed_at: string }>;
    },
    enabled: !!academy && files.length > 0,
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

  // ── Sections CRUD ──
  const saveSection = useMutation({
    mutationFn: async () => {
      if (!academy) throw new Error('Pas d\'académie');
      if (editingSection) {
        const { error } = await supabase.from('academy_sections')
          .update({ title: sectionForm.title, description: sectionForm.description || null })
          .eq('id', editingSection.id);
        if (error) throw error;
      } else {
        const nextOrder = (sections[sections.length - 1]?.sort_order ?? -1) + 1;
        const { error } = await supabase.from('academy_sections').insert({
          academy_id: academy.id,
          title: sectionForm.title,
          description: sectionForm.description || null,
          sort_order: nextOrder,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-sections'] });
      setShowSectionForm(false);
      setEditingSection(null);
      setSectionForm({ title: '', description: '' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academy_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-sections'] });
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      toast({ title: 'Section supprimée' });
    },
  });

  // Reorder sections en batch (utilisé par drag & drop)
  const reorderSections = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update tous les sort_order d'un coup
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('academy_sections').update({ sort_order: idx }).eq('id', id)
        )
      );
    },
    onMutate: async (orderedIds) => {
      // Optimistic update : applique le nouvel ordre immédiatement
      await queryClient.cancelQueries({ queryKey: ['academy-sections', academy?.id] });
      const previous = queryClient.getQueryData(['academy-sections', academy?.id]) as AcademySection[] | undefined;
      if (previous) {
        const reordered = orderedIds
          .map(id => previous.find(s => s.id === id))
          .filter(Boolean)
          .map((s, idx) => ({ ...s!, sort_order: idx }));
        queryClient.setQueryData(['academy-sections', academy?.id], reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['academy-sections', academy?.id], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-sections'] });
    },
  });

  // Upload fichier
  const uploadFile = useMutation({
    mutationFn: async ({ file, sectionId }: { file: File; sectionId: string | null }) => {
      if (!academy || !user) throw new Error('Pas d\'académie');
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || '';
      const path = `${academy.id}/${fileId}.${ext}`;
      const { error: uErr } = await supabase.storage.from('academy-files').upload(path, file);
      if (uErr) throw uErr;
      const fileType = inferFileType(file);
      const sectionFiles = files.filter(f => f.section_id === sectionId);
      const nextOrder = (sectionFiles[sectionFiles.length - 1]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from('academy_files').insert({
        academy_id: academy.id,
        section_id: sectionId,
        uploaded_by: user.id,
        title: uploadTitle || file.name,
        file_url: path,
        file_type: fileType,
        is_external: false,
        file_size_mb: Math.ceil(file.size / 1024 / 1024),
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      setUploadTitle('');
      setActiveUploadSection(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'Fichier uploadé' });
    },
    onError: (e: Error) => toast({ title: 'Erreur upload', description: e.message, variant: 'destructive' }),
  });

  const addLink = useMutation({
    mutationFn: async (sectionId: string | null) => {
      if (!academy || !user || !linkForm.url) throw new Error('Lien invalide');
      const sectionFiles = files.filter(f => f.section_id === sectionId);
      const nextOrder = (sectionFiles[sectionFiles.length - 1]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from('academy_files').insert({
        academy_id: academy.id,
        section_id: sectionId,
        uploaded_by: user.id,
        title: linkForm.title || linkForm.url,
        file_url: linkForm.url,
        file_type: 'link',
        is_external: true,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      setLinkForm({ title: '', url: '' });
      setShowLinkForm(null);
      toast({ title: 'Lien ajouté' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const updateFile = useMutation({
    mutationFn: async () => {
      if (!editingFile) return;
      const { error } = await supabase.from('academy_files').update({
        title: editingFileTitle,
        description: editingFileDescription || null,
      }).eq('id', editingFile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
      setEditingFile(null);
      setShowFileEditModal(false);
      toast({ title: 'Leçon modifiée' });
    },
  });

  // Reorder fichiers en batch (drag & drop dans une section)
  const reorderFiles = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('academy_files').update({ sort_order: idx }).eq('id', id)
        )
      );
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['academy-files', academy?.id] });
      const previous = queryClient.getQueryData(['academy-files', academy?.id]) as AcademyFile[] | undefined;
      if (previous) {
        const idToOrder = new Map(orderedIds.map((id, idx) => [id, idx]));
        const updated = previous.map(f =>
          idToOrder.has(f.id) ? { ...f, sort_order: idToOrder.get(f.id)! } : f
        );
        queryClient.setQueryData(['academy-files', academy?.id], updated);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['academy-files', academy?.id], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-files'] });
    },
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
      toast({ title: 'Accès accordé', description: 'L\'utilisateur recevra une notification.' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const revokeAccess = useMutation({
    mutationFn: async (userId: string) => {
      if (!academy) return;
      const { error } = await supabase.from('academy_access').delete().eq('academy_id', academy.id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-access'] });
      toast({ title: 'Accès révoqué' });
    },
  });

  if (!isPro) return <AppLayout><PaywallScreen feature="finance" /></AppLayout>;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

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
              Structure tes formations en sections (modules) et leçons. Inspiré de Skool.
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div>
              <Label>Nom de l'académie *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Ex: Académie Marie Conseil" className="h-11" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Quelques mots sur le contenu proposé..." rows={3} />
            </div>
            <button onClick={() => createAcademy.mutate()} disabled={!createForm.name || createAcademy.isPending} className="w-full py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
              {createAcademy.isPending ? 'Création...' : 'Créer mon académie'}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Files sans section
  const orphanFiles = files.filter(f => !f.section_id);

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
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-3 flex-wrap">
            <span>{sections.length} section{sections.length > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{files.length} leçon{files.length > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{accessList.length} accès</span>
            <span>•</span>
            <span>{academy.storage_used_mb}/{academy.storage_quota_mb} MB</span>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/academie/${academy.slug}`); toast({ title: 'Lien copié' }); }} className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-400">
              <Copy className="h-3 w-3" /> Lien
            </button>
            <button onClick={() => navigate(`/academie/${academy.slug}`)} className="flex items-center gap-1 text-violet-500 hover:text-violet-400">
              <Eye className="h-3 w-3" /> Voir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card rounded-xl p-1 border border-border overflow-x-auto">
          {([
            { key: 'contenu', label: 'Contenu', icon: FileText },
            { key: 'acces', label: 'Accès', icon: Users },
            { key: 'stats', label: 'Stats', icon: TrendingUp },
            { key: 'parametres', label: 'Paramètres', icon: Settings },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${tab === key ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab : Contenu */}
        {tab === 'contenu' && (
          <div className="space-y-3">
            {/* Add section button */}
            <button
              onClick={() => { setEditingSection(null); setSectionForm({ title: '', description: '' }); setShowSectionForm(true); }}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-border hover:border-blue-500/50 hover:bg-muted/30 transition-colors flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-4 w-4" />
              Nouvelle section
            </button>

            {/* Sections — drag & drop pour réordonner */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {sections.map((section) => {
                    const sectionFiles = files.filter(f => f.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);
                    return (
                      <SortableSection key={section.id} id={section.id}>
                        {(dragHandle) => (
                          <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
                              {dragHandle}
                              <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{section.title}</p>
                                {section.description && <p className="text-[10px] text-muted-foreground truncate">{section.description}</p>}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{sectionFiles.length} leçon{sectionFiles.length > 1 ? 's' : ''}</span>
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => { setEditingSection(section); setSectionForm({ title: section.title, description: section.description || '' }); setShowSectionForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => { if (confirm('Supprimer cette section ? Les leçons seront déplacées en "Sans section".')) deleteSection.mutate(section.id); }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>

                            {/* Files in section — drag & drop pour réordonner */}
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleLessonDragEnd(e, section.id)}>
                              <SortableContext items={sectionFiles.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                <div className="divide-y divide-border">
                                  {sectionFiles.map((f) => {
                                    const Icon = FILE_TYPE_ICONS[f.file_type];
                                    return (
                                      <SortableLesson key={f.id} id={f.id}>
                                        {(lessonHandle) => (
                                          <div className="px-4 py-2.5 flex items-center gap-2.5">
                                            {lessonHandle}
                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 dark:text-blue-400"><Icon className="h-4 w-4" /></div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{f.title}</p>
                                              <p className="text-[10px] text-muted-foreground uppercase">{f.file_type}{f.file_size_mb ? ` · ${f.file_size_mb} MB` : ''}{f.description ? ' · 📝' : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                              <button
                                                onClick={() => {
                                                  setEditingFile(f);
                                                  setEditingFileTitle(f.title);
                                                  setEditingFileDescription(f.description || '');
                                                  setShowFileEditModal(true);
                                                }}
                                                className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </button>
                                              {f.is_external && <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted text-muted-foreground"><ExternalLink className="h-3 w-3" /></a>}
                                              <button onClick={() => { if (confirm('Supprimer ?')) deleteFile.mutate(f); }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                                            </div>
                                          </div>
                                        )}
                                      </SortableLesson>
                                    );
                                  })}
                                  {sectionFiles.length === 0 && (
                                    <p className="px-4 py-4 text-xs text-muted-foreground text-center italic">Aucune leçon dans cette section</p>
                                  )}
                                </div>
                              </SortableContext>
                            </DndContext>

                            {/* Add to section */}
                            <div className="px-4 py-2 border-t border-border bg-muted/20">
                              {activeUploadSection === section.id ? (
                                <div className="space-y-2">
                                  <Input placeholder="Titre de la leçon (optionnel)" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} className="h-9 text-xs" />
                                  <input ref={fileInputRef} type="file" accept="video/*,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile.mutate({ file: f, sectionId: section.id }); }} className="hidden" />
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadFile.isPending} className="py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"><Upload className="h-3 w-3" />{uploadFile.isPending ? '...' : 'Fichier'}</button>
                                    <button onClick={() => setShowLinkForm(section.id)} className="py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1"><LinkIcon className="h-3 w-3" />Lien</button>
                                    <button onClick={() => { setActiveUploadSection(null); setUploadTitle(''); setShowLinkForm(null); }} className="py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] font-semibold">Annuler</button>
                                  </div>
                                  {showLinkForm === section.id && (
                                    <div className="space-y-1.5 pt-2">
                                      <Input placeholder="Titre du lien" value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} className="h-9 text-xs" />
                                      <Input placeholder="URL (Canva, YouTube, GDrive...)" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} className="h-9 text-xs" />
                                      <button onClick={() => addLink.mutate(section.id)} disabled={!linkForm.url || addLink.isPending} className="w-full py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold disabled:opacity-50">Ajouter le lien</button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button onClick={() => setActiveUploadSection(section.id)} className="w-full py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
                                  <Plus className="h-3.5 w-3.5" /> Ajouter une leçon
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </SortableSection>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Orphan files (sans section) */}
            {orphanFiles.length > 0 && (
              <div className="bg-card border border-amber-500/30 rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Sans section ({orphanFiles.length})</p>
                </div>
                <div className="divide-y divide-border">
                  {orphanFiles.map(f => {
                    const Icon = FILE_TYPE_ICONS[f.file_type];
                    return (
                      <div key={f.id} className="px-4 py-2.5 flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 dark:text-blue-400"><Icon className="h-4 w-4" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.title}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{f.file_type}</p>
                        </div>
                        <button onClick={() => { if (confirm('Supprimer ?')) deleteFile.mutate(f); }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sections.length === 0 && orphanFiles.length === 0 && (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <Folder className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Crée ta première section pour commencer</p>
              </div>
            )}
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
                <Input placeholder="Email de l'utilisateur" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} type="email" className="flex-1" />
                <button onClick={() => grantAccess.mutate()} disabled={!grantEmail || grantAccess.isPending} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">
                  {grantAccess.isPending ? '...' : 'Accorder'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">L'utilisateur recevra une notification dans Triibu.</p>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{accessList.length} accès actif{accessList.length > 1 ? 's' : ''}</p>
              </div>
              {accessList.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun accès accordé pour l'instant</p>}
              {accessList.map((a: any) => (
                <div key={a.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center text-xs font-bold dark:text-blue-400">{a.profile?.full_name?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.profile?.full_name || 'Utilisateur'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.profile?.email || a.user_id}</p>
                  </div>
                  <button onClick={() => revokeAccess.mutate(a.user_id)} className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab : Stats */}
        {tab === 'stats' && (
          <div className="space-y-3">
            {(() => {
              // Agrégations par user
              const completedByUser = new Map<string, Set<string>>();
              for (const p of progressData) {
                if (!completedByUser.has(p.user_id)) completedByUser.set(p.user_id, new Set());
                completedByUser.get(p.user_id)!.add(p.file_id);
              }
              // Agrégations par leçon
              const completedByFile = new Map<string, number>();
              for (const p of progressData) {
                completedByFile.set(p.file_id, (completedByFile.get(p.file_id) || 0) + 1);
              }
              const totalStudents = accessList.length;
              const totalLessons = files.length;
              const avgCompletion = totalStudents > 0 && totalLessons > 0
                ? Math.round(
                    (Array.from(completedByUser.values()).reduce((s, set) => s + set.size, 0) / (totalStudents * totalLessons)) * 100
                  )
                : 0;

              return (
                <>
                  {/* Headline KPIs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Étudiants</p>
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{totalStudents}</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3">
                      <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider">Leçons</p>
                      <p className="text-2xl font-black text-violet-700 dark:text-violet-300 mt-1">{totalLessons}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Avancement</p>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{avgCompletion}%</p>
                    </div>
                  </div>

                  {/* Par étudiant */}
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progression par étudiant</p>
                    </div>
                    {accessList.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun étudiant</p>}
                    {accessList.map((a: any) => {
                      const completed = completedByUser.get(a.user_id)?.size || 0;
                      const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
                      return (
                        <div key={a.user_id} className="px-4 py-3 border-b border-border last:border-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 dark:text-blue-400">
                              {a.profile?.full_name?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{a.profile?.full_name || 'Utilisateur'}</p>
                              <p className="text-[10px] text-muted-foreground">{completed}/{totalLessons} leçons terminées</p>
                            </div>
                            <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-muted-foreground'}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Par leçon */}
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engagement par leçon</p>
                    </div>
                    {files.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune leçon</p>}
                    {files.map(f => {
                      const completed = completedByFile.get(f.id) || 0;
                      const pct = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;
                      const Icon = FILE_TYPE_ICONS[f.file_type];
                      return (
                        <div key={f.id} className="px-4 py-2.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 dark:text-blue-400">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-sm font-medium flex-1 truncate">{f.title}</p>
                            <span className="text-[11px] text-muted-foreground">{completed}/{totalStudents}</span>
                            <CheckCircle2 className={`h-3.5 w-3.5 ${pct >= 80 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-muted-foreground/30'}`} />
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5 ml-9">
                            <div className={`h-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Tab : Paramètres */}
        {tab === 'parametres' && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Paramètres avancés à venir.</p>
            <div className="rounded-xl bg-muted p-3 space-y-1">
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Lien public</p>
              <p className="text-xs font-mono text-foreground break-all">{window.location.origin}/academie/{academy.slug}</p>
            </div>
            <button onClick={() => navigate(`/academie/${academy.slug}`)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-700">
              <Eye className="h-4 w-4" />
              Voir mon académie côté visiteur
            </button>
            <p className="text-[10px] text-muted-foreground">
              Stockage : {academy.storage_used_mb} MB utilisés sur {academy.storage_quota_mb} MB. Pour augmenter, contacte contact@triibu.fr.
            </p>
          </div>
        )}

        {/* Section Form Dialog */}
        {showSectionForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowSectionForm(false)}>
            <div className="bg-background rounded-2xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold">{editingSection ? 'Modifier la section' : 'Nouvelle section'}</h3>
              <div>
                <Label>Titre *</Label>
                <Input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Ex: Module 1 — Les bases" autoFocus />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Textarea value={sectionForm.description} onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })} placeholder="Que va-t-on apprendre ici ?" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowSectionForm(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">Annuler</button>
                <button onClick={() => saveSection.mutate()} disabled={!sectionForm.title || saveSection.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
                  {saveSection.isPending ? '...' : editingSection ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Edit Modal — titre + description Markdown */}
        {showFileEditModal && editingFile && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowFileEditModal(false)}>
            <div className="bg-background rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col p-5 gap-3" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold flex-shrink-0">Modifier la leçon</h3>
              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                <div>
                  <Label>Titre</Label>
                  <Input value={editingFileTitle} onChange={(e) => setEditingFileTitle(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Description (Markdown supporté)</Label>
                  <Textarea
                    value={editingFileDescription}
                    onChange={(e) => setEditingFileDescription(e.target.value)}
                    rows={8}
                    placeholder={`# Titre\n\nTexte avec **gras** et *italique*.\n\n- Liste\n- Item 2\n\n[Un lien](https://exemple.fr)`}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Markdown supporté : titres (#), gras (**), italique (*), listes (-), liens [texte](url), code (```)
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-2 flex-shrink-0">
                <button onClick={() => setShowFileEditModal(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">Annuler</button>
                <button onClick={() => updateFile.mutate()} disabled={!editingFileTitle || updateFile.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
                  {updateFile.isPending ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}


/* ── Wrapper Sortable pour une section (drag & drop) ── */
function SortableSection({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };
  const handle = (
    <button
      {...attributes}
      {...listeners}
      type="button"
      aria-label="Glisser pour réorganiser"
      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style as React.CSSProperties}>
      {children(handle)}
    </div>
  );
}

/* ── Wrapper Sortable pour une leçon (drag & drop) ── */
function SortableLesson({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "hsl(var(--muted))" : undefined,
  };
  const handle = (
    <button
      {...attributes}
      {...listeners}
      type="button"
      aria-label="Glisser pour réorganiser"
      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/60 touch-none"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style as React.CSSProperties}>
      {children(handle)}
    </div>
  );
}
