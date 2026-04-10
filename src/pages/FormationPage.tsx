import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSuperAdmin, HYLA_LEVELS } from '@/lib/supabase';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Play,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Edit2,
  Trash2,
  Youtube,
  FileText,
  Link,
  Clock,
  Settings,
  Award,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormationModule {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  position: number;
  thumbnail_url: string | null;
  visible_from_level: string | null;
  created_at: string;
  updated_at: string;
  lesson_count?: number;
}

interface FormationLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_type: 'youtube' | 'canva' | 'pdf' | 'text';
  content_url: string | null;
  position: number;
  duration_minutes: number | null;
  created_at: string;
}

interface ModuleFormData {
  title: string;
  description: string;
  thumbnail_url: string;
  visible_from_level: string;
  position: number;
}

interface LessonFormData {
  title: string;
  description: string;
  content_type: 'youtube' | 'canva' | 'pdf' | 'text';
  content_url: string;
  duration_minutes: number | '';
  position: number;
}


const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  youtube: <Youtube className="h-4 w-4 text-red-500" />,
  canva: <Link className="h-4 w-4 text-purple-500" />,
  pdf: <FileText className="h-4 w-4 text-orange-500" />,
  text: <FileText className="h-4 w-4 text-blue-500" />,
};

// ─── YouTube helper ───────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-white/10', className)} />;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl p-3 space-y-2">
          <Skeleton className="h-20 w-full rounded-lg bg-slate-700" />
          <Skeleton className="h-4 w-3/4 bg-slate-700" />
          <Skeleton className="h-2 w-full bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-2/3 bg-gray-200 dark:bg-gray-700" />
      <Skeleton className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700" />
      <Skeleton className="h-64 w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── Gradient thumbnails ──────────────────────────────────────────────────────

const MODULE_GRADIENTS = [
  'from-violet-600 to-indigo-600',
  'from-blue-600 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-700',
];

function ModuleThumbnail({
  url,
  index,
  className,
}: {
  url: string | null;
  index: number;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn('object-cover', className)}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  const gradient = MODULE_GRADIENTS[index % MODULE_GRADIENTS.length];
  return (
    <div
      className={cn(
        `bg-gradient-to-br ${gradient} flex items-center justify-center`,
        className
      )}
    >
      <BookOpen className="h-6 w-6 text-white/80" />
    </div>
  );
}

// ─── Module Form Dialog ───────────────────────────────────────────────────────

function ModuleFormDialog({
  open,
  onClose,
  initial,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<ModuleFormData>;
  onSave: (data: ModuleFormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ModuleFormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    thumbnail_url: initial?.thumbnail_url ?? '',
    visible_from_level: initial?.visible_from_level ?? '',
    position: initial?.position ?? 0,
  });

  useEffect(() => {
    setForm({
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      thumbnail_url: initial?.thumbnail_url ?? '',
      visible_from_level: initial?.visible_from_level ?? '',
      position: initial?.position ?? 0,
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.title ? 'Modifier le module' : 'Nouveau module'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex : Techniques de vente"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brève description du module"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL de la miniature</Label>
            <Input
              value={form.thumbnail_url}
              onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Visible à partir du niveau</Label>
            <Select
              value={form.visible_from_level}
              onValueChange={(v) => setForm((f) => ({ ...f, visible_from_level: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les niveaux" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les niveaux</SelectItem>
                {HYLA_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Input
              type="number"
              min={0}
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.title.trim() || loading}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Form Dialog ───────────────────────────────────────────────────────

function LessonFormDialog({
  open,
  onClose,
  initial,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<LessonFormData>;
  onSave: (data: LessonFormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<LessonFormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    content_type: initial?.content_type ?? 'youtube',
    content_url: initial?.content_url ?? '',
    duration_minutes: initial?.duration_minutes ?? '',
    position: initial?.position ?? 0,
  });

  useEffect(() => {
    setForm({
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      content_type: initial?.content_type ?? 'youtube',
      content_url: initial?.content_url ?? '',
      duration_minutes: initial?.duration_minutes ?? '',
      position: initial?.position ?? 0,
    });
  }, [open]);

  const contentTypeLabels: Record<LessonFormData['content_type'], string> = {
    youtube: 'Vidéo YouTube',
    canva: 'Présentation Canva',
    pdf: 'Document PDF',
    text: 'Texte / HTML',
  };

  const needsUrl = form.content_type !== 'text';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial?.title ? 'Modifier la leçon' : 'Nouvelle leçon'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex : Introduction à la purification"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description courte de la leçon"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type de contenu</Label>
            <Select
              value={form.content_type}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  content_type: v as LessonFormData['content_type'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(contentTypeLabels) as LessonFormData['content_type'][]).map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {contentTypeLabels[t]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          {form.content_type === 'text' ? (
            <div className="space-y-1.5">
              <Label>Contenu</Label>
              <Textarea
                value={form.content_url}
                onChange={(e) => setForm((f) => ({ ...f, content_url: e.target.value }))}
                placeholder="Saisissez le contenu textuel de la leçon..."
                rows={6}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                {form.content_type === 'youtube'
                  ? 'URL YouTube'
                  : form.content_type === 'canva'
                  ? 'URL de partage Canva'
                  : 'URL du PDF'}
              </Label>
              <Input
                value={form.content_url}
                onChange={(e) => setForm((f) => ({ ...f, content_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Durée (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    duration_minutes: e.target.value === '' ? '' : parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input
                type="number"
                min={0}
                value={form.position}
                onChange={(e) =>
                  setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={
              !form.title.trim() ||
              (needsUrl && !form.content_url.trim()) ||
              loading
            }
          >
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Content Renderer ──────────────────────────────────────────────────

function LessonContent({ lesson }: { lesson: FormationLesson }) {
  if (!lesson.content_url && lesson.content_type !== 'text') {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-400 gap-2">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Aucun contenu disponible</p>
      </div>
    );
  }

  if (lesson.content_type === 'youtube') {
    const videoId = extractYouTubeId(lesson.content_url ?? '');
    if (!videoId) {
      return (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-400 gap-2">
          <Youtube className="h-8 w-8 text-red-400" />
          <p className="text-sm">URL YouTube invalide</p>
        </div>
      );
    }
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (lesson.content_type === 'canva') {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-gray-50" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={lesson.content_url ?? ''}
          title={lesson.title}
          allowFullScreen
        />
      </div>
    );
  }

  if (lesson.content_type === 'pdf') {
    return (
      <div className="space-y-3">
        <div className="relative w-full rounded-xl overflow-hidden bg-gray-50" style={{ minHeight: '500px' }}>
          <iframe
            className="w-full h-full min-h-[500px]"
            src={lesson.content_url ?? ''}
            title={lesson.title}
          />
        </div>
        <a
          href={lesson.content_url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 hover:underline"
        >
          <FileText className="h-4 w-4" />
          Ouvrir le PDF dans un nouvel onglet
        </a>
      </div>
    );
  }

  // text
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-6">
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
        {lesson.content_url ?? ''}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FormationPage() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Admin / content manager state
  const [adminMode, setAdminMode] = useState(false);

  // Selection state
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<FormationModule | null>(null);

  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<FormationLesson | null>(null);
  const [lessonDialogModuleId, setLessonDialogModuleId] = useState<string | null>(null);
  const [newLessonPosition, setNewLessonPosition] = useState(0);

  // Delete confirmations
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<string | null>(null);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings-formation', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('is_content_manager')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const {
    data: modules = [],
    isLoading: modulesLoading,
    error: modulesError,
  } = useQuery<FormationModule[]>({
    queryKey: ['formation-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formation_modules')
        .select('*, formation_lessons(count)')
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        lesson_count: m.formation_lessons?.[0]?.count ?? 0,
      }));
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  const {
    data: lessons = [],
    isLoading: lessonsLoading,
  } = useQuery<FormationLesson[]>({
    queryKey: ['formation-lessons', selectedModuleId],
    queryFn: async () => {
      if (!selectedModuleId) return [];
      const { data, error } = await supabase
        .from('formation_lessons')
        .select('*')
        .eq('module_id', selectedModuleId)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedModuleId,
    staleTime: 60000,
  });

  const { data: completedIds = [] } = useQuery<string[]>({
    queryKey: ['formation-progress', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('formation_progress')
        .select('lesson_id')
        .eq('user_id', effectiveUserId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.lesson_id as string);
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const isContentManager =
    isSuperAdmin(user?.email) ||
    !!userSettings?.is_content_manager ||
    modules.some((m) => m.user_id === effectiveUserId);

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;
  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) ?? null;

  const currentLessonIndex = lessons.findIndex((l) => l.id === selectedLessonId);
  const prevLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null;

  const moduleCompletedCount = (moduleId: string, lessonList: FormationLesson[]) =>
    lessonList.filter((l) => completedIds.includes(l.id)).length;

  const selectedModuleLessons = lessons;
  const selectedModuleCompleted = moduleCompletedCount(selectedModuleId ?? '', selectedModuleLessons);
  const isModuleComplete =
    selectedModuleLessons.length > 0 &&
    selectedModuleCompleted === selectedModuleLessons.length;

  // Auto-select first module/lesson
  useEffect(() => {
    if (!selectedModuleId && modules.length > 0) {
      setSelectedModuleId(modules[0].id);
    }
  }, [modules]);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedModuleId]);

  // ── Mark as complete mutation ─────────────────────────────────────────────

  const markCompleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!effectiveUserId) throw new Error('Non authentifié');
      const { error } = await supabase.from('formation_progress').upsert(
        { user_id: effectiveUserId, lesson_id: lessonId, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-progress', effectiveUserId] });
      toast({ title: 'Leçon marquée comme vue !' });
      if (nextLesson) setSelectedLessonId(nextLesson.id);
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder la progression.', variant: 'destructive' });
    },
  });

  // ── Module mutations ──────────────────────────────────────────────────────

  const saveModuleMutation = useMutation({
    mutationFn: async (data: ModuleFormData & { id?: string }) => {
      if (!effectiveUserId) throw new Error('Non authentifié');
      if (data.id) {
        const { error } = await supabase
          .from('formation_modules')
          .update({
            title: data.title,
            description: data.description || null,
            thumbnail_url: data.thumbnail_url || null,
            visible_from_level: data.visible_from_level || null,
            position: data.position,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('formation_modules').insert({
          user_id: effectiveUserId,
          title: data.title,
          description: data.description || null,
          thumbnail_url: data.thumbnail_url || null,
          visible_from_level: data.visible_from_level || null,
          position: data.position,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setModuleDialogOpen(false);
      setEditingModule(null);
      toast({ title: 'Module enregistré' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formation_modules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setDeleteModuleTarget(null);
      if (selectedModuleId === deleteModuleTarget) {
        setSelectedModuleId(null);
        setSelectedLessonId(null);
      }
      toast({ title: 'Module supprimé' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  // ── Lesson mutations ──────────────────────────────────────────────────────

  const saveLessonMutation = useMutation({
    mutationFn: async (data: LessonFormData & { id?: string; module_id: string }) => {
      const payload = {
        module_id: data.module_id,
        title: data.title,
        description: data.description || null,
        content_type: data.content_type,
        content_url: data.content_url || null,
        duration_minutes: data.duration_minutes === '' ? null : Number(data.duration_minutes),
        position: data.position,
      };
      if (data.id) {
        const { error } = await supabase
          .from('formation_lessons')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('formation_lessons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-lessons', selectedModuleId] });
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setLessonDialogOpen(false);
      setEditingLesson(null);
      toast({ title: 'Leçon enregistrée' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formation_lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-lessons', selectedModuleId] });
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setDeleteLessonTarget(null);
      if (selectedLessonId === deleteLessonTarget) setSelectedLessonId(null);
      toast({ title: 'Leçon supprimée' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSaveModule(data: ModuleFormData) {
    saveModuleMutation.mutate({ ...data, id: editingModule?.id });
  }

  function handleSaveLesson(data: LessonFormData) {
    const moduleId = lessonDialogModuleId ?? selectedModuleId!;
    saveLessonMutation.mutate({ ...data, id: editingLesson?.id, module_id: moduleId });
  }

  function openNewLesson(moduleId: string) {
    setEditingLesson(null);
    setLessonDialogModuleId(moduleId);
    const maxPos = Math.max(0, ...lessons.map((l) => l.position));
    setNewLessonPosition(maxPos + 1);
    setLessonDialogOpen(true);
  }

  function openEditLesson(lesson: FormationLesson) {
    setEditingLesson(lesson);
    setLessonDialogModuleId(lesson.module_id);
    setLessonDialogOpen(true);
  }

  function openEditModule(mod: FormationModule) {
    setEditingModule(mod);
    setModuleDialogOpen(true);
  }

  function openNewModule() {
    setEditingModule(null);
    setModuleDialogOpen(true);
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!modulesLoading && modules.length === 0 && !adminMode) {
    return (
      <AppLayout title="Formation">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <div className="text-6xl">📚</div>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">
            Aucun contenu pour le moment
          </h2>
          <p className="text-gray-400 max-w-sm">
            Les modules de formation seront disponibles prochainement. Revenez bientôt !
          </p>
          {isContentManager && (
            <Button
              onClick={() => setAdminMode(true)}
              className="mt-2 bg-violet-600 hover:bg-violet-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer le premier module
            </Button>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── Sidebar content for one module ───────────────────────────────────────

  function ModuleCard({ mod, index }: { mod: FormationModule; index: number }) {
    const isActive = mod.id === selectedModuleId;
    // We don't have lesson lists per module in sidebar unless selected, so use lesson_count
    const count = mod.lesson_count ?? 0;
    // approximate completed for sidebar (only precise for selected module)
    const approxCompleted = mod.id === selectedModuleId ? selectedModuleCompleted : 0;
    const progressPct = count > 0 ? Math.round((approxCompleted / count) * 100) : 0;

    return (
      <div
        className={cn(
          'group relative rounded-xl cursor-pointer transition-all duration-200 overflow-hidden',
          isActive
            ? 'ring-2 ring-violet-500 bg-white/10'
            : 'hover:bg-white/5'
        )}
        onClick={() => {
          setSelectedModuleId(mod.id);
          setSelectedLessonId(null);
        }}
      >
        {/* Thumbnail */}
        <div className="h-20 w-full overflow-hidden rounded-t-xl">
          <ModuleThumbnail url={mod.thumbnail_url} index={index} className="h-20 w-full" />
        </div>

        <div className="p-3 space-y-2">
          <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
            {mod.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BookOpen className="h-3 w-3" />
            <span>{count} leçon{count !== 1 ? 's' : ''}</span>
          </div>
          {count > 0 && (
            <div className="space-y-1">
              <Progress
                value={progressPct}
                className="h-1.5 bg-white/10 [&>div]:bg-violet-500"
              />
              <p className="text-xs text-slate-500">
                {approxCompleted}/{count}
              </p>
            </div>
          )}
        </div>

        {/* Admin controls overlay */}
        {adminMode && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 rounded bg-black/60 hover:bg-black/80 text-white"
              onClick={(e) => {
                e.stopPropagation();
                openEditModule(mod);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              className="p-1 rounded bg-red-600/80 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModuleTarget(mod.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Formation">
      {/* Admin toolbar */}
      {isContentManager && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Gestion du contenu</span>
          </div>
          <div className="flex items-center gap-2">
            {adminMode && (
              <Button
                size="sm"
                variant="default"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={openNewModule}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouveau module
              </Button>
            )}
            <Button
              size="sm"
              variant={adminMode ? 'secondary' : 'outline'}
              onClick={() => setAdminMode((v) => !v)}
            >
              {adminMode ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  Quitter l'admin
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-1" />
                  Gérer le contenu
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
        {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-900 shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              Modules
            </h2>
          </div>

          {modulesLoading ? (
            <SidebarSkeleton />
          ) : modulesError ? (
            <div className="p-4 text-red-400 text-sm">Erreur de chargement</div>
          ) : (
            <div className="p-3 space-y-2 flex-1">
              {modules.map((mod, i) => (
                <ModuleCard key={mod.id} mod={mod} index={i} />
              ))}
              {adminMode && (
                <button
                  className="w-full rounded-xl border-2 border-dashed border-white/20 text-white/40 hover:border-violet-500/60 hover:text-violet-400 transition-colors py-4 text-sm flex items-center justify-center gap-2"
                  onClick={openNewModule}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un module
                </button>
              )}
            </div>
          )}
        </aside>

        {/* ── Mobile tabs ───────────────────────────────────────────────── */}
        <div className="lg:hidden fixed top-[5.5rem] left-0 right-0 z-10 bg-slate-900 overflow-x-auto flex gap-2 px-3 py-2 border-b border-white/10">
          {modulesLoading
            ? [...Array(3)].map((_, i) => (
                <div key={i} className="flex-shrink-0 h-8 w-24 rounded-full animate-pulse bg-slate-700" />
              ))
            : modules.map((mod) => (
                <button
                  key={mod.id}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                    mod.id === selectedModuleId
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  )}
                  onClick={() => {
                    setSelectedModuleId(mod.id);
                    setSelectedLessonId(null);
                  }}
                >
                  {mod.title}
                </button>
              ))}
        </div>

        {/* ── Content area ──────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden lg:mt-0 mt-12">
          {/* Lesson list */}
          {selectedModuleId && (
            <div className="hidden md:flex flex-col w-56 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-y-auto shrink-0">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
                  {selectedModule?.title}
                </p>
              </div>

              {lessonsLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg animate-pulse bg-gray-200 dark:bg-gray-700" />
                  ))}
                </div>
              ) : lessons.length === 0 && !lessonsLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Aucune leçon dans ce module</p>
                  {adminMode && <p className="text-xs mt-1">Ajoutez une leçon avec le bouton +</p>}
                </div>
              ) : (
                <div className="p-2 space-y-1 flex-1">
                  {lessons.map((lesson) => {
                    const done = completedIds.includes(lesson.id);
                    const isActive = lesson.id === selectedLessonId;
                    return (
                      <div key={lesson.id} className="group relative">
                        <button
                          className={cn(
                            'w-full text-left rounded-lg px-3 py-2 text-xs transition-colors',
                            isActive
                              ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                          )}
                          onClick={() => setSelectedLessonId(lesson.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {done ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Play className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium line-clamp-2 leading-tight">{lesson.title}</p>
                              {lesson.duration_minutes && (
                                <span className="flex items-center gap-1 mt-0.5 text-gray-400">
                                  <Clock className="h-2.5 w-2.5" />
                                  {lesson.duration_minutes} min
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {adminMode && (
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-600 dark:text-gray-300"
                              onClick={() => openEditLesson(lesson)}
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                              className="p-1 rounded bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-500"
                              onClick={() => setDeleteLessonTarget(lesson.id)}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {adminMode && selectedModuleId && (
                <div className="p-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    className="w-full text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center justify-center gap-1 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                    onClick={() => openNewLesson(selectedModuleId)}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une leçon
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lesson viewer */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
            {!selectedModuleId ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <BookOpen className="h-12 w-12 text-gray-200 dark:text-gray-700" />
                <p className="text-gray-400">Sélectionnez un module pour commencer</p>
              </div>
            ) : lessonsLoading ? (
              <ContentSkeleton />
            ) : !selectedLesson ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                {isModuleComplete && lessons.length > 0 ? (
                  <>
                    <div className="text-5xl">🎉</div>
                    <div className="flex items-center gap-2">
                      <Award className="h-6 w-6 text-amber-500" />
                      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                        Module terminé !
                      </h2>
                    </div>
                    <p className="text-gray-400 max-w-sm">
                      Félicitations ! Vous avez complété toutes les leçons de ce module.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedLessonId(lessons[0]?.id)}
                    >
                      Revoir depuis le début
                    </Button>
                  </>
                ) : lessons.length === 0 ? (
                  <>
                    <BookOpen className="h-10 w-10 text-gray-200 dark:text-gray-700" />
                    <p className="text-gray-400">
                      {adminMode
                        ? 'Ce module est vide. Ajoutez des leçons via le panneau de gauche.'
                        : 'Ce module ne contient pas encore de leçons.'}
                    </p>
                    {adminMode && (
                      <Button
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-700"
                        onClick={() => openNewLesson(selectedModuleId)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter la première leçon
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Play className="h-10 w-10 text-gray-200 dark:text-gray-700" />
                    <p className="text-gray-400">Sélectionnez une leçon pour commencer</p>
                    <Button
                      className="bg-violet-600 hover:bg-violet-700"
                      onClick={() => setSelectedLessonId(lessons[0].id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Commencer le module
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
                {/* Lesson header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {CONTENT_TYPE_ICONS[selectedLesson.content_type]}
                        <span className="capitalize">{selectedLesson.content_type}</span>
                        {selectedLesson.duration_minutes && (
                          <>
                            <span>·</span>
                            <Clock className="h-3 w-3" />
                            <span>{selectedLesson.duration_minutes} min</span>
                          </>
                        )}
                      </div>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedLesson.title}
                      </h1>
                    </div>
                    {completedIds.includes(selectedLesson.id) && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Vu
                      </Badge>
                    )}
                  </div>
                  {selectedLesson.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedLesson.description}
                    </p>
                  )}
                </div>

                {/* Module completion banner */}
                {isModuleComplete && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Award className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Module complété à 100% — Félicitations !
                    </p>
                  </div>
                )}

                {/* Content */}
                <LessonContent lesson={selectedLesson} />

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && setSelectedLessonId(prevLesson.id)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>

                  <div className="flex gap-2">
                    {adminMode && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditLesson(selectedLesson)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                    )}
                    {!completedIds.includes(selectedLesson.id) && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => markCompleteMutation.mutate(selectedLesson.id)}
                        disabled={markCompleteMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {markCompleteMutation.isPending ? 'Sauvegarde...' : 'Marquer comme vu ✓'}
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && setSelectedLessonId(nextLesson.id)}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Mobile lesson list */}
                <div className="md:hidden border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Toutes les leçons
                  </h3>
                  {lessons.map((lesson) => {
                    const done = completedIds.includes(lesson.id);
                    const isActive = lesson.id === selectedLessonId;
                    return (
                      <button
                        key={lesson.id}
                        className={cn(
                          'w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors flex items-center gap-3',
                          isActive
                            ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                            : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                        )}
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        {done ? (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Play className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                        )}
                        <span className="font-medium">{lesson.title}</span>
                        {lesson.duration_minutes && (
                          <span className="ml-auto text-xs text-gray-400">
                            {lesson.duration_minutes} min
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {adminMode && selectedModuleId && (
                    <button
                      className="w-full text-xs text-violet-600 hover:text-violet-700 flex items-center justify-center gap-1 py-2"
                      onClick={() => openNewLesson(selectedModuleId)}
                    >
                      <Plus className="h-3 w-3" />
                      Ajouter une leçon
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      <ModuleFormDialog
        open={moduleDialogOpen}
        onClose={() => {
          setModuleDialogOpen(false);
          setEditingModule(null);
        }}
        initial={
          editingModule
            ? {
                title: editingModule.title,
                description: editingModule.description ?? '',
                thumbnail_url: editingModule.thumbnail_url ?? '',
                visible_from_level: editingModule.visible_from_level ?? '',
                position: editingModule.position,
              }
            : { position: modules.length }
        }
        onSave={handleSaveModule}
        loading={saveModuleMutation.isPending}
      />

      <LessonFormDialog
        open={lessonDialogOpen}
        onClose={() => {
          setLessonDialogOpen(false);
          setEditingLesson(null);
        }}
        initial={
          editingLesson
            ? {
                title: editingLesson.title,
                description: editingLesson.description ?? '',
                content_type: editingLesson.content_type,
                content_url: editingLesson.content_url ?? '',
                duration_minutes: editingLesson.duration_minutes ?? '',
                position: editingLesson.position,
              }
            : { position: newLessonPosition }
        }
        onSave={handleSaveLesson}
        loading={saveLessonMutation.isPending}
      />

      {/* Delete module confirmation */}
      <Dialog
        open={!!deleteModuleTarget}
        onOpenChange={(v) => !v && setDeleteModuleTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le module ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Cette action supprimera le module et toutes ses leçons. Elle est irréversible.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteModuleTarget(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteModuleTarget && deleteModuleMutation.mutate(deleteModuleTarget)}
              disabled={deleteModuleMutation.isPending}
            >
              {deleteModuleMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete lesson confirmation */}
      <Dialog
        open={!!deleteLessonTarget}
        onOpenChange={(v) => !v && setDeleteLessonTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la leçon ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            La leçon et la progression associée seront définitivement supprimées.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteLessonTarget(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteLessonTarget && deleteLessonMutation.mutate(deleteLessonTarget)}
              disabled={deleteLessonMutation.isPending}
            >
              {deleteLessonMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
