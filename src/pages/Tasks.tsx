import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, TASK_TYPE_LABELS, TASK_STATUS_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('active');
  const [form, setForm] = useState({ title: '', type: 'autre' as string, due_date: '', description: '' });

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

  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: form.title,
        type: form.type as any,
        due_date: form.due_date || null,
        description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowForm(false);
      setForm({ title: '', type: 'autre', due_date: '', description: '' });
      toast({ title: 'Tâche créée' });
    },
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

  return (
    <AppLayout
      title="Tâches"
      actions={
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90"><Plus className="h-4 w-4 mr-2" />Nouvelle tâche</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTask.mutate(); }} className="space-y-4">
              <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Échéance</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" disabled={createTask.isPending} className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[['active', 'À faire'], ['done', 'Terminées'], ['all', 'Toutes']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${filter === key ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{label}</button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((task: any) => (
            <div key={task.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <button
                onClick={() => task.status !== 'terminee' && completeTask.mutate(task.id)}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.status === 'terminee' ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {task.status === 'terminee' && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'terminee' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS]}</span>
                  {task.contacts && <span className="text-xs text-gray-400">• {task.contacts.first_name} {task.contacts.last_name}</span>}
                </div>
              </div>
              {task.due_date && (
                <span className={`text-xs font-medium flex items-center gap-1 ${
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
