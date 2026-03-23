import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, TASK_TYPE_LABELS_HYLA_HYLA, TASK_STATUS_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const payload = {
        user_id: user.id,
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
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div>
        <Label className="text-xs">Titre *</Label>
        <Input className="h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [filter, setFilter] = useState<string>('active');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-for-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('user_id', user.id)
        .order('first_name');
      return data || [];
    },
    enabled: !!user,
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'terminee', completed_at: new Date().toISOString() }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const filtered = tasks.filter((t: any) => {
    if (filter === 'active') return t.status === 'a_faire' || t.status === 'en_cours';
    if (filter === 'done') return t.status === 'terminee';
    return true;
  });

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
    setShowForm(true);
  };

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
        <DialogContent className="max-w-lg">
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
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[['active', 'À faire'], ['done', 'Terminées'], ['all', 'Toutes']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${filter === key ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((task: any) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
              onClick={() => handleOpenEdit(task)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.status !== 'terminee') completeTask.mutate(task.id);
                }}
                className={`h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'terminee' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {task.status === 'terminee' && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'terminee' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">{TASK_TYPE_LABELS_HYLA[task.type as keyof typeof TASK_TYPE_LABELS_HYLA]}</span>
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
                  new Date(task.due_date) < new Date() && task.status !== 'terminee' ? 'text-red-500' : 'text-gray-400'
                }`}>
                  <Clock className="h-3 w-3" />
                  {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-12 text-gray-400">Aucune tâche</p>}
        </div>
      </div>
    </AppLayout>
  );
}
