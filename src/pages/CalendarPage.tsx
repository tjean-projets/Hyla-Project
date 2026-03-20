import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase, APPOINTMENT_TYPE_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Clock, CalendarCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  planifie: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Confirmé' },
  realise: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Réalisé' },
  annule: { bg: 'bg-red-50', text: 'text-red-600', label: 'Annulé' },
  reporte: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Reporté' },
};

const TYPE_COLORS: Record<string, string> = {
  rdv: 'bg-[#3b82f6]',
  demo: 'bg-violet-500',
  relance: 'bg-amber-500',
  formation: 'bg-emerald-500',
  autre: 'bg-gray-400',
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'rdv' as string, date: '', duration: '60', location: '', notes: '' });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('appointments')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const createApt = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('appointments').insert({
        user_id: user.id,
        title: form.title,
        type: form.type as any,
        date: form.date,
        duration: parseInt(form.duration) || 60,
        location: form.location || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowForm(false);
      setForm({ title: '', type: 'rdv', date: '', duration: '60', location: '', notes: '' });
      toast({ title: 'Rendez-vous créé' });
    },
  });

  // Separate upcoming vs past
  const nowStr = new Date().toISOString();
  const upcoming = appointments.filter((a: any) => a.date >= nowStr);
  const past = appointments.filter((a: any) => a.date < nowStr);

  // Group by day
  const groupByDay = (apts: any[]) =>
    apts.reduce((acc: Record<string, any[]>, apt: any) => {
      const day = new Date(apt.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!acc[day]) acc[day] = [];
      acc[day].push(apt);
      return acc;
    }, {});

  const upcomingGrouped = groupByDay(upcoming);
  const pastGrouped = groupByDay(past);

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = appointments.filter((a: any) => a.date?.slice(0, 10) === todayStr).length;
  const thisWeek = appointments.filter((a: any) => {
    const d = new Date(a.date);
    const diff = (d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  function AppointmentCard({ apt }: { apt: any }) {
    const status = STATUS_STYLES[apt.status] || STATUS_STYLES.planifie;
    const typeColor = TYPE_COLORS[apt.type] || TYPE_COLORS.autre;
    const time = new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(new Date(apt.date).getTime() + (apt.duration || 60) * 60000)
      .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex">
          {/* Left color accent bar (mockup 1 style) */}
          <div className={`w-1.5 ${typeColor} flex-shrink-0`} />

          <div className="flex-1 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Time range */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[#3b82f6]">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold">{time}</span>
                  </div>
                  <span className="text-xs text-gray-300">→</span>
                  <span className="text-xs text-gray-400">{endTime}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{apt.duration || 60} min</span>
                </div>

                {/* Title */}
                <p className="text-sm font-semibold text-gray-900 truncate">{apt.title}</p>

                {/* Contact + type */}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md text-white ${typeColor}`}>
                    {APPOINTMENT_TYPE_LABELS[apt.type as keyof typeof APPOINTMENT_TYPE_LABELS]}
                  </span>
                  {apt.contacts && (
                    <span className="text-xs text-gray-400">{apt.contacts.first_name} {apt.contacts.last_name}</span>
                  )}
                </div>

                {/* Location */}
                {apt.location && (
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-300" />{apt.location}
                  </p>
                )}
              </div>

              {/* Status badge (mockup 1: colored pill) */}
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${status.bg} ${status.text} flex-shrink-0`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      title="Calendrier"
      actions={
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white"><Plus className="h-4 w-4 mr-2" />Nouveau</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createApt.mutate(); }} className="space-y-4">
              <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date *</Label><Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Durée (min)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
                <div><Label>Lieu</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button type="submit" disabled={createApt.isPending} className="w-full bg-[#3b82f6] hover:bg-[#3b82f6]/90">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* ── Quick stats (mockup 1: small summary row) ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Aujourd'hui</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{todayCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cette semaine</p>
            <p className="text-2xl font-bold text-[#3b82f6] mt-1">{thisWeek}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{appointments.length}</p>
          </div>
        </div>

        {/* ── Upcoming appointments (mockup 1: card list grouped by day) ── */}
        {Object.keys(upcomingGrouped).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CalendarCheck className="h-4 w-4 text-[#3b82f6]" />
              <h3 className="text-sm font-bold text-gray-900">À venir</h3>
            </div>
            {Object.entries(upcomingGrouped).map(([day, apts]) => (
              <div key={day} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider capitalize">{day}</h4>
                </div>
                <div className="space-y-2 ml-4">
                  {(apts as any[]).map((apt) => (
                    <AppointmentCard key={apt.id} apt={apt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Past appointments ── */}
        {Object.keys(pastGrouped).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-400">Passés</h3>
            </div>
            {Object.entries(pastGrouped).map(([day, apts]) => (
              <div key={day} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider capitalize">{day}</h4>
                </div>
                <div className="space-y-2 ml-4 opacity-60">
                  {(apts as any[]).map((apt) => (
                    <AppointmentCard key={apt.id} apt={apt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {appointments.length === 0 && (
          <div className="text-center py-16">
            <CalendarCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun rendez-vous</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
