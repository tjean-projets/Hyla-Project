import { lazy, Suspense } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useRespireAcademie } from '@/hooks/useRespireAcademie';
import { GraduationCap, MapPin, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy import des pages existantes pour réutiliser leur contenu
const FormationPage = lazy(() => import('./FormationPage'));
const MapPage = lazy(() => import('./MapPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}

// Wrapper qui supprime l'AppLayout des pages enfants en les rendant dans un contexte imbriqué
// Les pages Formation/Map utilisent AppLayout — on les rend directement sans double-wrap
// grâce à la structure React : AppLayout ne re-wrap pas si déjà dans un contexte main

function LockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
        <Lock className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Accès restreint</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Vous n'avez pas encore accès à la Respire Académie. Contactez votre responsable pour obtenir l'accès.
      </p>
    </div>
  );
}

export default function RespireAcademiePage() {
  const { hasAccess } = useRespireAcademie();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'carte' ? 'carte' : 'formation';

  return (
    <AppLayout title="Respire Académie">
      {/* Header gradient */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 p-5 shadow-lg shadow-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Respire Académie</h1>
            <p className="text-sm text-white/80">Formations et ressources Hyla pour progresser</p>
          </div>
        </div>
      </div>

      {!hasAccess ? (
        <LockedState />
      ) : (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 mb-6 bg-muted/50 rounded-xl p-1 w-fit">
            <NavLink
              to="/academie?tab=formation"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'formation'
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <GraduationCap className="h-4 w-4" />
              Formation
            </NavLink>
            <NavLink
              to="/academie?tab=carte"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'carte'
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MapPin className="h-4 w-4" />
              Carte
            </NavLink>
          </div>

          {/* Tab content — les pages Formation/Map ont leur propre AppLayout
              On les rend directement ici ; React rend le contenu de chaque page
              dans le body de la page actuelle. Pour éviter le double AppLayout,
              on importe les pages et on les rend : chaque page retourne son JSX
              complet (y compris AppLayout). Comme AppLayout ne crée pas de portal
              et ne bloque pas le rendu imbriqué, cette approche fonctionne mais
              produit un double sidebar visible.

              Solution propre : utiliser les routes existantes via un iframe ou
              rediriger l'utilisateur vers /formation et /map.
              Ici on utilise l'approche redirect contextuelle : les tabs
              pointent vers les pages originales avec un param de retour. */}

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden min-h-[400px]">
            {activeTab === 'formation' ? (
              <Suspense fallback={<PageLoader />}>
                <FormationPageContent />
              </Suspense>
            ) : (
              <Suspense fallback={<PageLoader />}>
                <MapPageContent />
              </Suspense>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}

// ── Inline Formation content (sans AppLayout) ────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase, isSuperAdmin, HYLA_LEVELS } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

function FormationPageContent() {
  const { user } = useAuth();
  const effectiveUserId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = isSuperAdmin(user?.email);

  const [selectedModule, setSelectedModule] = useState<FormationModule | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<FormationLesson | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<FormationModule | null>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<FormationLesson | null>(null);

  const [moduleForm, setModuleForm] = useState<ModuleFormData>({
    title: '', description: '', thumbnail_url: '', visible_from_level: 'none', position: 0,
  });
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    title: '', description: '', content_type: 'youtube', content_url: '', duration_minutes: '', position: 0,
  });

  // ── Fetch progress ──
  const { data: progress = [] } = useQuery({
    queryKey: ['formation-progress', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase
        .from('formation_progress')
        .select('lesson_id, completed_at')
        .eq('user_id', effectiveUserId);
      return data || [];
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  const completedLessonIds = new Set(progress.map((p: any) => p.lesson_id));

  // ── Fetch modules ──
  const { data: modules = [], isLoading: loadingModules } = useQuery({
    queryKey: ['formation-modules', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data } = await supabase
        .from('formation_modules')
        .select('*, formation_lessons(id)')
        .eq('user_id', effectiveUserId)
        .order('position');
      return (data || []).map((m: any) => ({ ...m, lesson_count: m.formation_lessons?.length || 0 })) as FormationModule[];
    },
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  // ── Fetch lessons for selected module ──
  const { data: lessons = [], isLoading: loadingLessons } = useQuery({
    queryKey: ['formation-lessons', selectedModule?.id],
    queryFn: async () => {
      if (!selectedModule) return [];
      const { data } = await supabase
        .from('formation_lessons')
        .select('*')
        .eq('module_id', selectedModule.id)
        .order('position');
      return (data || []) as FormationLesson[];
    },
    enabled: !!selectedModule,
    staleTime: 60000,
  });

  // ── Module mutations ──
  const saveModule = useMutation({
    mutationFn: async (form: ModuleFormData) => {
      if (editingModule) {
        await supabase.from('formation_modules').update(form).eq('id', editingModule.id);
      } else {
        await supabase.from('formation_modules').insert({ ...form, user_id: effectiveUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setShowModuleForm(false);
      setEditingModule(null);
      toast({ title: editingModule ? 'Module mis à jour' : 'Module créé' });
    },
  });

  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('formation_modules').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setSelectedModule(null);
      toast({ title: 'Module supprimé' });
    },
  });

  // ── Lesson mutations ──
  const saveLesson = useMutation({
    mutationFn: async (form: LessonFormData) => {
      const data = { ...form, duration_minutes: form.duration_minutes === '' ? null : form.duration_minutes, module_id: selectedModule?.id };
      if (editingLesson) {
        await supabase.from('formation_lessons').update(data).eq('id', editingLesson.id);
      } else {
        await supabase.from('formation_lessons').insert(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-lessons', selectedModule?.id] });
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      setShowLessonForm(false);
      setEditingLesson(null);
      toast({ title: editingLesson ? 'Leçon mise à jour' : 'Leçon créée' });
    },
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('formation_lessons').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formation-lessons', selectedModule?.id] });
      queryClient.invalidateQueries({ queryKey: ['formation-modules'] });
      if (selectedLesson?.id === editingLesson?.id) setSelectedLesson(null);
      toast({ title: 'Leçon supprimée' });
    },
  });

  const toggleProgress = useMutation({
    mutationFn: async (lessonId: string) => {
      if (completedLessonIds.has(lessonId)) {
        await supabase.from('formation_progress').delete().eq('user_id', effectiveUserId).eq('lesson_id', lessonId);
      } else {
        await supabase.from('formation_progress').insert({ user_id: effectiveUserId, lesson_id: lessonId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['formation-progress', effectiveUserId] }),
  });

  function openModuleForm(module?: FormationModule) {
    if (module) {
      setEditingModule(module);
      setModuleForm({ title: module.title, description: module.description || '', thumbnail_url: module.thumbnail_url || '', visible_from_level: module.visible_from_level || 'none', position: module.position });
    } else {
      setEditingModule(null);
      setModuleForm({ title: '', description: '', thumbnail_url: '', visible_from_level: 'none', position: modules.length });
    }
    setShowModuleForm(true);
  }

  function openLessonForm(lesson?: FormationLesson) {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({ title: lesson.title, description: lesson.description || '', content_type: lesson.content_type, content_url: lesson.content_url || '', duration_minutes: lesson.duration_minutes ?? '', position: lesson.position });
    } else {
      setEditingLesson(null);
      setLessonForm({ title: '', description: '', content_type: 'youtube', content_url: '', duration_minutes: '', position: lessons.length });
    }
    setShowLessonForm(true);
  }

  // ── Module list ──
  if (!selectedModule) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Modules de formation</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => openModuleForm()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Module
            </Button>
          )}
        </div>

        {loadingModules ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Aucun module disponible</p>
            {isAdmin && <p className="text-xs text-muted-foreground/70 mt-1">Créez votre premier module de formation</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map(module => {
              const moduleLessons = lessons.filter(l => l.module_id === module.id);
              const completedCount = moduleLessons.filter(l => completedLessonIds.has(l.id)).length;
              const total = module.lesson_count || 0;
              const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
              return (
                <div
                  key={module.id}
                  className="bg-background border border-border rounded-xl p-4 cursor-pointer hover:border-emerald-400 transition-colors group"
                  onClick={() => setSelectedModule(module)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{module.title}</p>
                        <p className="text-xs text-muted-foreground">{total} leçon{total !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); openModuleForm(module); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"
                      >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {module.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{module.description}</p>
                  )}
                  {total > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{completedCount}/{total} complétées</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    {module.visible_from_level && module.visible_from_level !== 'none' && (
                      <Badge variant="outline" className="text-[10px]">
                        {HYLA_LEVELS.find(l => l.value === module.visible_from_level)?.label || module.visible_from_level}+
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Module form dialog */}
        <Dialog open={showModuleForm} onOpenChange={o => { if (!o) { setShowModuleForm(false); setEditingModule(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingModule ? 'Modifier le module' : 'Nouveau module'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Titre</Label><Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Techniques de vente" /></div>
              <div><Label>Description</Label><Textarea value={moduleForm.description} onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))} placeholder="Description du module..." rows={3} /></div>
              <div><Label>URL miniature</Label><Input value={moduleForm.thumbnail_url} onChange={e => setModuleForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." /></div>
              <div>
                <Label>Visible à partir du niveau</Label>
                <Select value={moduleForm.visible_from_level} onValueChange={v => setModuleForm(f => ({ ...f, visible_from_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tous les niveaux</SelectItem>
                    {HYLA_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                {editingModule && (
                  <Button variant="destructive" size="sm" onClick={() => { deleteModule.mutate(editingModule.id); setShowModuleForm(false); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                  </Button>
                )}
                <Button className="flex-1" onClick={() => saveModule.mutate(moduleForm)} disabled={!moduleForm.title}>
                  {editingModule ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Lesson view ──
  if (selectedLesson) {
    const ytId = selectedLesson.content_type === 'youtube' && selectedLesson.content_url ? extractYouTubeId(selectedLesson.content_url) : null;
    const isDone = completedLessonIds.has(selectedLesson.id);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <button onClick={() => setSelectedLesson(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selectedLesson.title}</p>
            <p className="text-xs text-muted-foreground">{selectedModule.title}</p>
          </div>
          <button
            onClick={() => toggleProgress.mutate(selectedLesson.id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600')}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {isDone ? 'Complété' : 'Marquer fait'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {ytId && (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" allowFullScreen title={selectedLesson.title} />
            </div>
          )}
          {selectedLesson.content_type === 'canva' && selectedLesson.content_url && (
            <div className="aspect-video rounded-xl overflow-hidden border">
              <iframe src={selectedLesson.content_url} className="w-full h-full" allowFullScreen title={selectedLesson.title} />
            </div>
          )}
          {selectedLesson.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedLesson.description}</p>
            </div>
          )}
          {selectedLesson.content_type === 'pdf' && selectedLesson.content_url && (
            <a href={selectedLesson.content_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors">
              <FileText className="h-4 w-4" /> Ouvrir le PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Lesson list ──
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedModule(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold">{selectedModule.title}</h2>
          {selectedModule.description && <p className="text-xs text-muted-foreground">{selectedModule.description}</p>}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => openLessonForm()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Leçon
          </Button>
        )}
      </div>

      {loadingLessons ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Play className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Aucune leçon dans ce module</p>
          {isAdmin && <p className="text-xs text-muted-foreground/70 mt-1">Ajoutez votre première leçon</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, idx) => {
            const isDone = completedLessonIds.has(lesson.id);
            return (
              <div
                key={lesson.id}
                className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl cursor-pointer hover:border-emerald-400 transition-colors group"
                onClick={() => setSelectedLesson(lesson)}
              >
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold', isDone ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                  {isDone ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {CONTENT_TYPE_ICONS[lesson.content_type]}
                    {lesson.duration_minutes && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {lesson.duration_minutes}min</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); openLessonForm(lesson); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
              </div>
            );
          })}
        </div>
      )}

      {/* Lesson form dialog */}
      <Dialog open={showLessonForm} onOpenChange={o => { if (!o) { setShowLessonForm(false); setEditingLesson(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Modifier la leçon' : 'Nouvelle leçon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label><Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Introduction à la vente" /></div>
            <div>
              <Label>Type de contenu</Label>
              <Select value={lessonForm.content_type} onValueChange={v => setLessonForm(f => ({ ...f, content_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="canva">Canva</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="text">Texte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lessonForm.content_type !== 'text' && (
              <div><Label>URL du contenu</Label><Input value={lessonForm.content_url} onChange={e => setLessonForm(f => ({ ...f, content_url: e.target.value }))} placeholder="https://..." /></div>
            )}
            <div><Label>Description</Label><Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} placeholder="Contenu / notes..." rows={3} /></div>
            <div><Label>Durée (minutes)</Label><Input type="number" value={lessonForm.duration_minutes} onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : '' }))} placeholder="15" /></div>
            <div className="flex gap-2 pt-2">
              {editingLesson && (
                <Button variant="destructive" size="sm" onClick={() => { deleteLesson.mutate(editingLesson.id); setShowLessonForm(false); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                </Button>
              )}
              <Button className="flex-1" onClick={() => saveLesson.mutate(lessonForm)} disabled={!lessonForm.title}>
                {editingLesson ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Inline Map content (sans AppLayout) ─────────────────────────────────────

import { useRef, useCallback } from 'react';
import { Map, Overlay } from 'pigeon-maps';
import { osm } from 'pigeon-maps/providers';
import { HYLA_LEVELS as HYLA_LEVELS_MAP } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Users,
  Loader2,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface MapMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string;
  hyla_level: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface GeocodedMember extends MapMember {
  resolvedLat: number | null;
  resolvedLng: number | null;
}

const FRANCE_CENTER: [number, number] = [46.5, 2.3];
const FRANCE_ZOOM = 6;

const LEVEL_COLORS: Record<string, string> = {
  vendeur: '#3b82f6', manager: '#8b5cf6', chef_groupe: '#f97316',
  chef_agence: '#f97316', distributeur: '#f59e0b', elite_bronze: '#d97706',
  elite_argent: '#94a3b8', elite_or: '#eab308',
};

const LEVEL_BADGE_CLASSES: Record<string, string> = {
  vendeur: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  manager: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  chef_groupe: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  chef_agence: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  distributeur: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  elite_bronze: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  elite_argent: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  elite_or: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function getLevelLabelMap(level: string | null): string {
  if (!level) return 'Vendeur';
  return HYLA_LEVELS_MAP.find(l => l.value === level)?.label ?? level;
}

function getMemberNameMap(m: MapMember): string {
  const full = [m.first_name, m.last_name].filter(Boolean).join(' ');
  return full.trim() || m.email || 'Membre';
}

function getLevelColorMap(level: string | null): string {
  return LEVEL_COLORS[level ?? ''] ?? '#6b7280';
}

async function geocodeMap(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fr`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* ignore */ }
  return null;
}

function sleepMap(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function MapPageContent() {
  const effectiveUserId = useEffectiveUserId();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [center, setCenter] = useState<[number, number]>(FRANCE_CENTER);
  const [zoom, setZoom] = useState(FRANCE_ZOOM);
  const [selectedMember, setSelectedMember] = useState<GeocodedMember | null>(null);
  const [geocodedMembers, setGeocodedMembers] = useState<GeocodedMember[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodingAbortRef = useRef(false);

  const { data: rawMembers, isLoading } = useQuery<MapMember[]>({
    queryKey: ['map-members-academie', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('id, first_name, last_name, email, status, hyla_level, lat, lng, contacts(address)')
        .eq('user_id', effectiveUserId)
        .order('first_name');
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, address: m.contacts?.address ?? null })) as MapMember[];
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  const runGeocoding = useCallback(async (members: MapMember[]) => {
    geocodingAbortRef.current = false;
    const enriched: GeocodedMember[] = members.map(m => ({ ...m, resolvedLat: m.lat, resolvedLng: m.lng }));
    setGeocodedMembers(enriched);
    const toGeocode = enriched.filter(m => m.address && (m.resolvedLat === null || m.resolvedLng === null));
    if (toGeocode.length === 0) return;
    setIsGeocoding(true);
    for (const member of toGeocode) {
      if (geocodingAbortRef.current) break;
      const coords = await geocodeMap(member.address!);
      if (coords) {
        setGeocodedMembers(prev => prev.map(m => m.id === member.id ? { ...m, resolvedLat: coords.lat, resolvedLng: coords.lng } : m));
        await supabase.from('team_members').update({ lat: coords.lat, lng: coords.lng } as unknown as Record<string, unknown>).eq('id', member.id);
      }
      await sleepMap(1000);
    }
    setIsGeocoding(false);
    queryClient.invalidateQueries({ queryKey: ['map-members-academie', effectiveUserId] });
  }, [effectiveUserId, queryClient]);

  useEffect(() => {
    if (!rawMembers) return;
    geocodingAbortRef.current = true;
    runGeocoding(rawMembers);
  }, [rawMembers, runGeocoding]);

  useEffect(() => { return () => { geocodingAbortRef.current = true; }; }, []);

  const displayedMembers = geocodedMembers.filter(m => {
    const name = getMemberNameMap(m).toLowerCase();
    const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
    const matchLevel = levelFilter === 'all' || m.hyla_level === levelFilter;
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchLevel && matchStatus;
  });

  const membersOnMap = displayedMembers.filter(m => m.resolvedLat !== null && m.resolvedLng !== null);

  const handleMemberClick = useCallback((member: GeocodedMember) => {
    if (member.resolvedLat === null || member.resolvedLng === null) return;
    setCenter([member.resolvedLat, member.resolvedLng]);
    setZoom(12);
    setSelectedMember(member);
  }, []);

  return (
    <div className="flex flex-col" style={{ height: '600px' }}>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center p-2 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-8 text-sm w-[160px]">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {HYLA_LEVELS_MAP.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="inactif">Inactif</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {displayedMembers.length} / {geocodedMembers.length} membre{geocodedMembers.length !== 1 ? 's' : ''}
          {isGeocoding && <span className="ml-2 text-primary flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Géocodage…</span>}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative h-full">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Chargement de la carte…</span>
              </div>
            </div>
          ) : (
            <Map
              provider={osm}
              center={center}
              zoom={zoom}
              onBoundsChanged={({ center: c, zoom: z }) => { setCenter(c); setZoom(z); }}
              height={undefined as unknown as number}
              style={{ height: '100%', width: '100%' }}
              onClick={() => setSelectedMember(null)}
            >
              {membersOnMap.map(member => (
                <Overlay key={member.id} anchor={[member.resolvedLat!, member.resolvedLng!]} offset={[8, 8]}>
                  <div
                    onClick={e => { e.stopPropagation(); setSelectedMember(member); }}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: getLevelColorMap(member.hyla_level), border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.35)', cursor: 'pointer', transition: 'transform 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  />
                </Overlay>
              ))}
              {selectedMember && selectedMember.resolvedLat !== null && selectedMember.resolvedLng !== null && (
                <Overlay anchor={[selectedMember.resolvedLat, selectedMember.resolvedLng]} offset={[-80, 100]}>
                  <div className="bg-white rounded-xl shadow-xl border text-sm" style={{ width: 200, position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <div className="h-1 rounded-t-xl" style={{ background: getLevelColorMap(selectedMember.hyla_level) }} />
                    <div className="p-3">
                      <button onClick={() => setSelectedMember(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 leading-none" aria-label="Fermer">✕</button>
                      <p className="font-semibold pr-4 truncate">{getMemberNameMap(selectedMember)}</p>
                      {selectedMember.address && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{selectedMember.address}</p>}
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: getLevelColorMap(selectedMember.hyla_level) + '22', color: getLevelColorMap(selectedMember.hyla_level) }}>{getLevelLabelMap(selectedMember.hyla_level)}</span>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', selectedMember.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{selectedMember.status === 'actif' ? 'Actif' : 'Inactif'}</span>
                      </div>
                    </div>
                  </div>
                </Overlay>
              )}
            </Map>
          )}
          {!isLoading && membersOnMap.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none z-10">
              <div className="bg-background/90 backdrop-blur-sm border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg pointer-events-auto mx-4">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Aucun membre localisé</p>
                  <p className="text-xs text-muted-foreground">Ajoutez une adresse à vos membres pour les afficher sur la carte.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Member list panel — desktop */}
        <div className="hidden md:flex flex-col w-64 border-l border-border bg-background h-full overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Membres</span>
            <Badge variant="secondary" className="ml-auto text-xs">{displayedMembers.length}</Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 flex flex-col gap-1">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : displayedMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <MapPin className="w-6 h-6 mb-2 opacity-30" />
                  <p className="text-xs font-medium">Aucun membre</p>
                </div>
              ) : (
                displayedMembers.map(member => {
                  const hasLocation = member.resolvedLat !== null && member.resolvedLng !== null;
                  const name = getMemberNameMap(member);
                  const levelClass = LEVEL_BADGE_CLASSES[member.hyla_level ?? ''] ?? LEVEL_BADGE_CLASSES.vendeur;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => hasLocation && handleMemberClick(member)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg border transition-all',
                        hasLocation ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default opacity-70',
                        selectedMember?.id === member.id ? 'border-primary bg-primary/5' : 'border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getLevelColorMap(member.hyla_level) }} />
                        <span className="text-xs font-medium truncate flex-1">{name}</span>
                        <Badge variant="outline" className={cn('text-[9px] px-1 py-0 leading-4 border-0 flex-shrink-0', levelClass)}>
                          {getLevelLabelMap(member.hyla_level)}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
