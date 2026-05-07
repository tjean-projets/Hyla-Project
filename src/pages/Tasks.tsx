import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, TASK_TYPE_LABELS_HYLA, TASK_STATUS_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock, Trash2, User, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { SkeletonTable } from '@/components/ui/skeleton-card';

interface TaskFormData {
  title: string;
  type: string;
  status: string;
  due_date: string;
  description: string;
  contact_id: string;
}

const EMPTY_FORM: TaskFormData = { title: '', type: 'autre', status: 'a_faire', due_date: '', description: '', contact_id: '' };

function TaskForm({
  onSuccess,
  initialData,
  onDelete,
  contacts,
}: {
  onSuccess: () => void;
  initialData?: any | null;
  onDelete?: () => void;
  contacts: any[];
}) {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        type: initialData.type || 'autre',
        status: initialData.status || 'a_faire',
        due_date: initialData.due_date ? initialData.due_date.slice(0, 16) : '',
        description: initialData.description || '',
        contact_id: initialData.contact_id || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [initialData]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const payload = {
        user_id: effectiveId,
        title: form.title,
        type: form.type as any,
        status: form.status as any,
        due_date: form.due_date || null,
        description: form.description || null,
        contact_id: form.contact_id || null,
        completed_at: form.status === 'terminee' ? (initialData?.completed_at || new Date().toISOString()) : null,
      };
      if (isEdit) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
      queryClient.invalidateQueries({ queryKey: ['notif-today'] });
      toast({ title: isEdit ? 'Tâche modifiée' : 'Tâche créée' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initialData) return;
      const { error } = await supabase.from('tasks').delete().eq('id', initialData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
      queryClient.invalidateQueries({ queryKey: ['notif-today'] });
      toast({ title: 'Tâche supprimée' });
      onDelete?.();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!validate()) return; mutation.mutate(); }} className="space-y-4">
      <div>
        <Label className="text-xs">Titre *</Label>
        <Input
          className={`h-11 ${errors.title ? 'border-red-400 dark:border-red-600 focus:border-red-400' : ''}`}
          value={form.title}
          onChange={(e) => { setForm({ ...form, title: e.target.value }); if (errors.title) setErrors(prev => ({ ...prev, title: '' })); }}
        />
        {errors.title && <p className="text-[10px] text-red-500 mt-1">{errors.title}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_TYPE_LABELS_HYLA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isEdit && (
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isEdit && (
          <div>
            <Label className="text-xs">Échéance</Label>
            <Input className="h-11" type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        )}
      </div>
      {isEdit && (
        <div>
          <Label className="text-xs">Échéance</Label>
          <Input className="h-11" type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      )}
      <div>
        <Label className="text-xs">Contact associé</Label>
        <Select value={form.contact_id || '__none__'} onValueChange={(v) => setForm({ ...form, contact_id: v === '__none__' ? '' : v })}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Aucun contact" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Aucun contact</SelectItem>
            {contacts.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#3b82f6] text-white font-semibold rounded-xl disabled:opacity-50 active:bg-[#3b82f6]/80"
      >
        {mutation.isPending ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Créer la tâche'}
      </button>
      {isEdit && (
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white font-semibold rounded-xl disabled:opacity-50 active:bg-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
        </button>
      )}
    </form>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>('active');
  // Vue Kanban par défaut, Liste = filter 'active', Terminées = filter 'done'
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [draggingTask, setDraggingTask] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── List touch-drag reorder — clé par filtre pour éviter collision ──
  const storageKey = effectiveId ? `tasks-order-${effectiveId}-${filter}` : null;
  const [listOrder, setListOrder] = useState<string[]>([]);
  const [activeDragIdx, setActiveDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listDragRef = useRef<{ active: boolean; fromIdx: number; startY: number } | null>(null);
  const listLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Kanban long-press ──
  const kanbanLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .order('due_date', { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-for-tasks', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('user_id', effectiveId)
        .order('first_name');
      return data || [];
    },
    enabled: !!effectiveId,
  });

  // ── Colonnes Kanban personnalisables (table task_columns) ──
  type TaskColumn = { id: string; name: string; position: number; color: string; base_status: string; is_default: boolean };
  const { data: kanbanColumns = [] } = useQuery({
    queryKey: ['task-columns', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('task_columns' as any)
        .select('*')
        .eq('user_id', effectiveId)
        .order('position');
      return (data || []) as TaskColumn[];
    },
    enabled: !!effectiveId,
    staleTime: 30000,
  });

  const upsertColumn = useMutation({
    mutationFn: async (col: Partial<TaskColumn> & { id?: string }) => {
      if (!effectiveId) throw new Error('Non connecté');
      if (col.id) {
        const { error } = await supabase.from('task_columns' as any).update({
          name: col.name, color: col.color, position: col.position, base_status: col.base_status,
        }).eq('id', col.id);
        if (error) throw error;
      } else {
        const nextPos = (kanbanColumns[kanbanColumns.length - 1]?.position ?? -1) + 1;
        const { error } = await supabase.from('task_columns' as any).insert({
          user_id: effectiveId,
          name: col.name || 'Nouvelle colonne',
          color: col.color || '#6366f1',
          position: col.position ?? nextPos,
          base_status: col.base_status || 'a_faire',
          is_default: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-columns', effectiveId] }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteColumn = useMutation({
    mutationFn: async (col: TaskColumn) => {
      if (col.is_default) throw new Error('Impossible de supprimer une colonne par défaut. Renomme-la plutôt.');
      // Réassigne les tâches de cette colonne vers la colonne par défaut du même base_status
      const fallback = kanbanColumns.find(c => c.is_default && c.base_status === col.base_status);
      if (fallback) {
        await supabase.from('tasks').update({ column_id: fallback.id }).eq('column_id', col.id);
      } else {
        await supabase.from('tasks').update({ column_id: null }).eq('column_id', col.id);
      }
      const { error } = await supabase.from('task_columns' as any).delete().eq('id', col.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-columns', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', effectiveId] });
      toast({ title: 'Colonne supprimée' });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const [editingColumn, setEditingColumn] = useState<TaskColumn | 'new' | null>(null);

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'terminee', completed_at: new Date().toISOString() }).eq('id', taskId);
      if (error) throw error;
      // Update last_contacted_at on the contact when completing a relance task
      const task = tasks.find((t: any) => t.id === taskId);
      if (task?.contact_id && (task.type === 'relance' || task.type === 'suivi' || task.type === 'rdv')) {
        await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', task.contact_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
      queryClient.invalidateQueries({ queryKey: ['notif-today'] });
    },
  });

  // Décocher une tâche terminée → la remet dans "À faire"
  const uncompleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'a_faire', completed_at: null }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
      queryClient.invalidateQueries({ queryKey: ['notif-today'] });
    },
  });

  const toggleTask = (task: any) => {
    if (task.status === 'terminee') uncompleteTask.mutate(task.id);
    else completeTask.mutate(task.id);
  };

  const filtered = useMemo(() => tasks.filter((t: any) => {
    if (filter === 'active') return t.status === 'a_faire' || t.status === 'en_cours';
    if (filter === 'done') return t.status === 'terminee';
    return true;
  }), [tasks, filter]);

  // Deep-link : ouvre l'édition d'une tâche via ?taskId=xxx (depuis le Dashboard)
  useEffect(() => {
    const id = searchParams.get('taskId');
    if (id && tasks.length > 0) {
      const task = tasks.find((t: any) => t.id === id);
      if (task) {
        setEditingTask(task);
        setShowForm(true);
        // Nettoie le paramètre de l'URL pour éviter de rouvrir au re-render
        searchParams.delete('taskId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [tasks, searchParams, setSearchParams]);

  // Sync listOrder when tasks/filter change and not dragging
  useEffect(() => {
    if (activeDragIdx === null) {
      const freshIds = filtered.map((t: any) => t.id);
      if (storageKey) {
        try {
          const saved: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
          if (saved.length > 0) {
            // merge: keep saved order for known IDs, append new IDs at end
            const known = new Set(freshIds);
            const ordered = saved.filter((id) => known.has(id));
            const newIds = freshIds.filter((id) => !ordered.includes(id));
            setListOrder([...ordered, ...newIds]);
            return;
          }
        } catch { /* ignore */ }
      }
      setListOrder(freshIds);
    }
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderedFiltered = useMemo(() => {
    if (listOrder.length === 0) return filtered;
    const map = new Map(filtered.map((t: any) => [t.id, t]));
    return listOrder.map(id => map.get(id)).filter(Boolean) as any[];
  }, [listOrder, filtered]);

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
    setShowForm(true);
  };

  // List touch-drag handlers
  const handleListTouchMove = useCallback((e: TouchEvent) => {
    if (!listDragRef.current?.active) {
      if (listLongPressRef.current) {
        clearTimeout(listLongPressRef.current);
        listLongPressRef.current = null;
      }
      return;
    }
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    const delta = currentY - listDragRef.current.startY;
    const itemHeightPx = 80;
    const steps = Math.round(delta / itemHeightPx);
    const len = orderedFiltered.length;
    const newIdx = Math.max(0, Math.min(len - 1, listDragRef.current.fromIdx + steps));
    setDragOverIdx(newIdx);
  }, [orderedFiltered.length]);

  const handleListTouchEnd = useCallback(() => {
    if (listLongPressRef.current) {
      clearTimeout(listLongPressRef.current);
      listLongPressRef.current = null;
    }
    if (!listDragRef.current?.active) return;
    const from = listDragRef.current.fromIdx;
    const to = dragOverIdx ?? from;
    if (from !== to) {
      const newOrder = [...listOrder];
      const [moved] = newOrder.splice(from, 1);
      newOrder.splice(to, 0, moved);
      setListOrder(newOrder);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newOrder)); } catch { /* ignore */ }
      }
    }
    listDragRef.current = null;
    setActiveDragIdx(null);
    setDragOverIdx(null);
  }, [dragOverIdx, listOrder]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handleListTouchMove, { passive: false });
    el.addEventListener('touchend', handleListTouchEnd);
    el.addEventListener('touchcancel', handleListTouchEnd);
    return () => {
      el.removeEventListener('touchmove', handleListTouchMove);
      el.removeEventListener('touchend', handleListTouchEnd);
      el.removeEventListener('touchcancel', handleListTouchEnd);
    };
  }, [handleListTouchMove, handleListTouchEnd]);

  return (
    <AppLayout
      title="Tâches"
      actions={
        <button
          onClick={() => { setEditingTask(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-semibold rounded-xl active:bg-[#3b82f6]/80"
        >
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </button>
      }
    >
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleCloseForm(); else setShowForm(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
          </DialogHeader>
          <TaskForm
            onSuccess={handleCloseForm}
            initialData={editingTask}
            onDelete={handleCloseForm}
            contacts={contacts}
          />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {/* Ordre : Kanban (défaut) → Liste → Terminées */}
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'kanban' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => { setView('list'); setFilter('active'); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'list' && filter === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Liste
            </button>
            <button
              onClick={() => { setView('list'); setFilter('done'); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'list' && filter === 'done' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Terminées
            </button>
          </div>
        </div>

        {view === 'list' && tasksLoading && <SkeletonTable rows={5} />}
        {view === 'list' && !tasksLoading && (
        <div ref={listContainerRef} className="space-y-2">
          {activeDragIdx !== null && (
            <p className="text-[11px] text-blue-500 text-center py-1 font-medium">↕ Glisse pour réordonner</p>
          )}
          {orderedFiltered.map((task: any, idx: number) => {
            const isBeingDragged = activeDragIdx === idx;
            const isDropTarget = dragOverIdx === idx && activeDragIdx !== null && activeDragIdx !== idx;
            return (
            <div
              key={task.id}
              className={`bg-card rounded-2xl shadow-sm border p-4 flex items-center gap-4 transition-all duration-150 ${
                isBeingDragged
                  ? 'border-blue-400 shadow-lg scale-[1.02] opacity-80 z-10 relative'
                  : isDropTarget
                  ? 'border-green-400 shadow-md'
                  : 'border-border hover:shadow-md cursor-pointer active:scale-[0.99]'
              }`}
              onClick={() => { if (activeDragIdx === null) handleOpenEdit(task); }}
              onTouchStart={(e) => {
                listLongPressRef.current = setTimeout(() => {
                  navigator.vibrate?.(40);
                  listDragRef.current = { active: true, fromIdx: idx, startY: e.touches[0].clientY };
                  setActiveDragIdx(idx);
                  setDragOverIdx(idx);
                }, 450);
              }}
            >
              {/* Grip handle */}
              <div className={`flex-shrink-0 ${activeDragIdx !== null ? 'text-blue-400' : 'text-gray-300'}`}>
                <GripVertical className="h-5 w-5" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeDragIdx !== null) return;
                  toggleTask(task);
                }}
                title={task.status === 'terminee' ? 'Cliquer pour remettre la tâche à faire' : 'Cliquer pour terminer'}
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'terminee'
                    ? 'bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {task.status === 'terminee' && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'terminee' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description.length > 60 ? task.description.slice(0, 60) + '…' : task.description}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{TASK_TYPE_LABELS_HYLA[task.type as keyof typeof TASK_TYPE_LABELS_HYLA]}</span>
                  {task.contacts && (
                    <span className="text-xs text-blue-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.contacts.first_name} {task.contacts.last_name}
                    </span>
                  )}
                </div>
              </div>
              {task.due_date && (
                <span className={`text-xs font-medium flex items-center gap-1 flex-shrink-0 ${
                  new Date(task.due_date) < new Date() && task.status !== 'terminee' ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  <Clock className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            );
          })}
          {orderedFiltered.length === 0 && <p className="text-center py-12 text-muted-foreground">Aucune tâche</p>}
        </div>
        )}

        {view === 'kanban' && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain auto' }}>
            {(kanbanColumns.length > 0 ? kanbanColumns : [
              { id: '__a_faire__', name: 'À faire', color: '#3b82f6', base_status: 'a_faire', position: 0, is_default: true } as TaskColumn,
              { id: '__en_cours__', name: 'En cours', color: '#f59e0b', base_status: 'en_cours', position: 1, is_default: true } as TaskColumn,
              { id: '__terminee__', name: 'Terminée', color: '#22c55e', base_status: 'terminee', position: 2, is_default: true } as TaskColumn,
            ]).map((col) => {
              // Une tâche est dans la colonne si son column_id pointe dessus
              // OU si elle a aucun column_id et que son status correspond au base_status d'une colonne par défaut.
              const colTasks = tasks.filter((t: any) =>
                t.column_id === col.id ||
                (!t.column_id && col.is_default && t.status === col.base_status)
              );
              return (
                <div
                  key={col.id}
                  className="min-w-[220px] max-w-[280px] flex-shrink-0 flex-1 rounded-xl transition-colors p-1"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('ring-2', 'ring-blue-500/40', 'bg-blue-500/5');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-blue-500/40', 'bg-blue-500/5');
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2', 'ring-blue-500/40', 'bg-blue-500/5');
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId) {
                      const updates: any = { status: col.base_status, column_id: col.id.startsWith('__') ? null : col.id };
                      if (col.base_status === 'terminee') updates.completed_at = new Date().toISOString();
                      else updates.completed_at = null;
                      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
                      if (error) {
                        toast({ title: 'Erreur', description: 'Impossible de déplacer la tâche. Réessaie.', variant: 'destructive' });
                      }
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                      queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
                      queryClient.invalidateQueries({ queryKey: ['notif-today'] });
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 group">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-foreground truncate">{col.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
                    {!col.id.startsWith('__') && (
                      <button
                        onClick={() => setEditingColumn(col)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-opacity"
                        title="Modifier la colonne"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {colTasks.map((task: any) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('taskId', task.id);
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        onTouchStart={() => {
                          kanbanLongPressRef.current = setTimeout(() => {
                            navigator.vibrate?.(40);
                            setDraggingTask(task);
                          }, 400);
                        }}
                        onTouchEnd={() => {
                          if (kanbanLongPressRef.current) {
                            clearTimeout(kanbanLongPressRef.current);
                            kanbanLongPressRef.current = null;
                          }
                        }}
                        onTouchMove={() => {
                          if (kanbanLongPressRef.current) {
                            clearTimeout(kanbanLongPressRef.current);
                            kanbanLongPressRef.current = null;
                          }
                        }}
                        onClick={() => handleOpenEdit(task)}
                        className={`bg-card rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] ${
                          task.due_date && new Date(task.due_date) < new Date() && task.status !== 'terminee'
                            ? 'border-red-300 dark:border-red-800'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.status === 'terminee' ? 'text-muted-foreground line-through' : 'text-foreground'} truncate`}>{task.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {TASK_TYPE_LABELS_HYLA[task.type as keyof typeof TASK_TYPE_LABELS_HYLA] || task.type}
                              </span>
                              {task.contacts && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />
                                  {task.contacts.first_name} {task.contacts.last_name}
                                </span>
                              )}
                            </div>
                            {task.due_date && (
                              <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                                new Date(task.due_date) < new Date() && task.status !== 'terminee' ? 'text-red-500 font-semibold' : 'text-muted-foreground'
                              }`}>
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                            title={task.status === 'terminee' ? 'Cliquer pour remettre la tâche à faire' : 'Cliquer pour terminer'}
                            className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              task.status === 'terminee'
                                ? 'bg-green-500 hover:bg-green-600'
                                : 'border-2 border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {task.status === 'terminee' && <Check className="h-3 w-3 text-white" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="bg-muted rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Aucune tâche
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Bouton "+ Colonne" pour ajouter une colonne custom */}
            <button
              onClick={() => setEditingColumn('new')}
              className="min-w-[180px] flex-shrink-0 rounded-xl border-2 border-dashed border-border hover:border-blue-400 hover:bg-blue-500/5 p-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-blue-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une colonne
            </button>
          </div>
        )}
      </div>

      {/* Modale édition / création de colonne Kanban */}
      {editingColumn && (
        <ColumnEditor
          column={editingColumn === 'new' ? null : editingColumn}
          onSave={(patch) => {
            upsertColumn.mutate(patch, { onSuccess: () => setEditingColumn(null) });
          }}
          onDelete={(col) => {
            if (confirm(`Supprimer la colonne "${col.name}" ? Les tâches qu'elle contient seront déplacées vers la colonne par défaut correspondante.`)) {
              deleteColumn.mutate(col, { onSuccess: () => setEditingColumn(null) });
            }
          }}
          onClose={() => setEditingColumn(null)}
          saving={upsertColumn.isPending || deleteColumn.isPending}
        />
      )}

      {/* Touch drag bar for mobile */}
      {draggingTask && (
        <div className="fixed bottom-20 left-4 right-4 bg-card rounded-2xl shadow-xl border p-3 z-50">
          <p className="text-xs text-muted-foreground mb-2 text-center">Déplacer « {draggingTask.title} » vers :</p>
          <div className="flex gap-2">
            {[
              { status: 'a_faire', label: 'À faire', color: '#3b82f6' },
              { status: 'en_cours', label: 'En cours', color: '#f59e0b' },
              { status: 'terminee', label: 'Terminée', color: '#22c55e' },
            ].map(col => (
              <button
                key={col.status}
                onClick={async () => {
                  // Trouve la colonne par défaut correspondant à ce statut pour aligner column_id
                  const defaultCol = kanbanColumns.find(c => c.is_default && c.base_status === col.status);
                  const updates: any = { status: col.status, column_id: defaultCol?.id ?? null };
                  if (col.status === 'terminee') updates.completed_at = new Date().toISOString();
                  else updates.completed_at = null;
                  const { error } = await supabase.from('tasks').update(updates).eq('id', draggingTask.id);
                  if (error) toast({ title: 'Erreur', description: 'Impossible de déplacer la tâche.', variant: 'destructive' });
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                  queryClient.invalidateQueries({ queryKey: ['notif-overdue'] });
                  queryClient.invalidateQueries({ queryKey: ['notif-today'] });
                  setDraggingTask(null);
                }}
                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold border-2 active:scale-[0.97]"
                style={{ borderColor: col.color, color: col.color }}
              >
                {col.label}
              </button>
            ))}
          </div>
          <button onClick={() => setDraggingTask(null)} className="w-full mt-2 text-xs text-muted-foreground py-1">Annuler</button>
        </div>
      )}
    </AppLayout>
  );
}

/* ── Modale édition/création d'une colonne Kanban personnalisée ── */
function ColumnEditor({
  column,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  column: { id: string; name: string; color: string; base_status: string; is_default: boolean; position: number } | null;
  onSave: (patch: { id?: string; name: string; color: string; base_status: string }) => void;
  onDelete: (col: { id: string; name: string; color: string; base_status: string; is_default: boolean; position: number }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState(column?.color ?? '#6366f1');
  const [baseStatus, setBaseStatus] = useState(column?.base_status ?? 'a_faire');

  const PRESETS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#14b8a6', '#ef4444'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">{column ? 'Modifier la colonne' : 'Nouvelle colonne Kanban'}</h3>
        <div>
          <Label>Nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: À valider, Bloqué…" autoFocus />
        </div>
        <div>
          <Label>Couleur</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-lg border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Statut de référence</Label>
          <select
            value={baseStatus}
            onChange={(e) => setBaseStatus(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="terminee">Terminée</option>
            <option value="annulee">Annulée</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Détermine le statut "officiel" assigné aux tâches déposées dans cette colonne. Garde le bon mapping pour que les filtres et rappels fonctionnent.
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          {column && !column.is_default && (
            <button
              onClick={() => onDelete(column)}
              disabled={saving}
              className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold disabled:opacity-50 hover:bg-red-500/20"
            >
              Supprimer
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold">Annuler</button>
          <button
            onClick={() => onSave({ id: column?.id, name: name.trim() || 'Sans titre', color, base_status: baseStatus })}
            disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? '…' : column ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
