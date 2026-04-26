import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [draggingTask, setDraggingTask] = useState<any>(null);

  // ── List touch-drag reorder ──
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const filtered = useMemo(() => tasks.filter((t: any) => {
    if (filter === 'active') return t.status === 'a_faire' || t.status === 'en_cours';
    if (filter === 'done') return t.status === 'terminee';
    return true;
  }), [tasks, filter]);

  // Sync listOrder when tasks/filter change and not dragging
  useEffect(() => {
    if (activeDragIdx === null) {
      setListOrder(filtered.map((t: any) => t.id));
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
            {[['active', 'À faire'], ['done', 'Terminées'], ['all', 'Toutes']].map(([key, label]) => (
              <button key={key} onClick={() => { setFilter(key); setView('list'); }} className={`px-3 py-1.5 text-sm font-medium rounded-md ${filter === key && view === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
            ))}
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'kanban' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Kanban</button>
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
                  if (task.status !== 'terminee' && activeDragIdx === null) completeTask.mutate(task.id);
                }}
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'terminee' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
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
            {[
              { status: 'a_faire', label: 'À faire', color: '#3b82f6', bgColor: 'bg-blue-50' },
              { status: 'en_cours', label: 'En cours', color: '#f59e0b', bgColor: 'bg-amber-50' },
              { status: 'terminee', label: 'Terminée', color: '#22c55e', bgColor: 'bg-green-50' },
            ].map((col) => {
              const colTasks = tasks.filter((t: any) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  className="min-w-[220px] max-w-[280px] flex-shrink-0 flex-1"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = col.bgColor.includes('blue') ? '#eff6ff' : col.bgColor.includes('amber') ? '#fffbeb' : '#f0fdf4'; }}
                  onDragLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.style.backgroundColor = '';
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId) {
                      const updates: any = { status: col.status };
                      if (col.status === 'terminee') updates.completed_at = new Date().toISOString();
                      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
                      if (error) {
                        toast({ title: 'Erreur', description: 'Impossible de déplacer la tâche. Réessaie.', variant: 'destructive' });
                      }
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
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
                          {task.status !== 'terminee' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); completeTask.mutate(task.id); }}
                              className="h-5 w-5 rounded-full border-2 border-gray-300 hover:border-green-400 flex items-center justify-center flex-shrink-0 transition-colors"
                            />
                          )}
                          {task.status === 'terminee' && (
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
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
          </div>
        )}
      </div>

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
                  const updates: any = { status: col.status };
                  if (col.status === 'terminee') updates.completed_at = new Date().toISOString();
                  const { error } = await supabase.from('tasks').update(updates).eq('id', draggingTask.id);
                  if (error) toast({ title: 'Erreur', description: 'Impossible de déplacer la tâche.', variant: 'destructive' });
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
