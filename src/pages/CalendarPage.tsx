import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, APPOINTMENT_TYPE_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Clock, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const TYPE_DOT_COLORS: Record<string, string> = {
  rdv: 'bg-[#3b82f6]',
  demo: 'bg-violet-500',
  relance: 'bg-amber-500',
  formation: 'bg-emerald-500',
  autre: 'bg-gray-400',
};

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function CalendarPage() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'rdv' as string, date: '', duration: '60', location: '', notes: '' });

  // View state
  const [calView, setCalView] = useState<'grid' | 'list'>('grid');
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('appointments')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!effectiveId,
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

  // ── Grid calendar logic ──
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayRaw = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // lundi = 0
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const today = new Date();
  const todayDateStr = today.toISOString().slice(0, 10);

  function getDayApts(year: number, month: number, day: number) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter((a: any) => a.date?.slice(0, 10) === dayStr);
  }

  function prevMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
  }

  const selectedDayApts = selectedDay
    ? getDayApts(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
    : [];

  const selectedDayLabel = selectedDay
    ? selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  function AppointmentCard({ apt }: { apt: any }) {
    const status = STATUS_STYLES[apt.status] || STATUS_STYLES.planifie;
    const typeColor = TYPE_COLORS[apt.type] || TYPE_COLORS.autre;
    const time = new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(new Date(apt.date).getTime() + (apt.duration || 60) * 60000)
      .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex">
          <div className={`w-1.5 ${typeColor} flex-shrink-0`} />
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[#3b82f6]">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold">{time}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs text-muted-foreground">{endTime}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{apt.duration || 60} min</span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{apt.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md text-white ${typeColor}`}>
                    {APPOINTMENT_TYPE_LABELS[apt.type as keyof typeof APPOINTMENT_TYPE_LABELS]}
                  </span>
                  {apt.contacts && (
                    <span className="text-xs text-muted-foreground">{apt.contacts.first_name} {apt.contacts.last_name}</span>
                  )}
                </div>
                {apt.location && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />{apt.location}
                  </p>
                )}
              </div>
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
        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aujourd'hui</p>
            <p className="text-2xl font-bold text-foreground mt-1">{todayCount}</p>
          </div>
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cette semaine</p>
            <p className="text-2xl font-bold text-[#3b82f6] mt-1">{thisWeek}</p>
          </div>
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground mt-1">{appointments.length}</p>
          </div>
        </div>

        {/* ── View toggle ── */}
        <div className="flex justify-end">
          <div className="flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setCalView('grid')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                calView === 'grid'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Grille
            </button>
            <button
              onClick={() => setCalView('list')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                calView === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Liste
            </button>
          </div>
        </div>

        {/* ── Grid View ── */}
        {calView === 'grid' && (
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold text-foreground">
                {MONTH_NAMES_FR[calMonth.getMonth()]} {calMonth.getFullYear()}
              </h3>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDay + 1;
                const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dayStr = inMonth
                  ? `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                  : '';
                const isToday = dayStr === todayDateStr;
                const dayApts = inMonth ? getDayApts(calMonth.getFullYear(), calMonth.getMonth(), dayNum) : [];
                const hasApts = dayApts.length > 0;

                // Out-of-month display day number
                let displayNum = dayNum;
                if (!inMonth) {
                  if (idx < firstDay) {
                    // days before month start
                    displayNum = new Date(calMonth.getFullYear(), calMonth.getMonth(), 0).getDate() - (firstDay - 1 - idx);
                  } else {
                    // days after month end
                    displayNum = idx - firstDay - daysInMonth + 1;
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (inMonth && hasApts) {
                        setSelectedDay(new Date(calMonth.getFullYear(), calMonth.getMonth(), dayNum));
                      }
                    }}
                    className={cn(
                      'rounded-xl border border-border bg-card min-h-[52px] flex flex-col items-center pt-1.5 pb-1 px-0.5 relative',
                      !inMonth && 'opacity-30',
                      inMonth && hasApts && 'cursor-pointer hover:bg-muted transition-colors'
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-[#3b82f6] text-white font-bold'
                          : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {displayNum}
                    </span>
                    {/* Dots */}
                    {hasApts && (
                      <div className="flex flex-wrap gap-0.5 justify-center mt-1 px-1">
                        {dayApts.slice(0, 3).map((apt: any, i: number) => (
                          <span
                            key={i}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0',
                              TYPE_DOT_COLORS[apt.type] || TYPE_DOT_COLORS.autre
                            )}
                          />
                        ))}
                        {dayApts.length > 3 && (
                          <span className="text-[8px] text-muted-foreground leading-none">+{dayApts.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Day detail modal ── */}
        <Dialog open={!!selectedDay} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="capitalize">{selectedDayLabel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {selectedDayApts.map((apt: any) => {
                const typeColor = TYPE_COLORS[apt.type] || TYPE_COLORS.autre;
                const time = new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={apt.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted">
                    <div className={cn('w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0', typeColor)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{apt.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{time}</span>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded text-white', typeColor)}>
                          {APPOINTMENT_TYPE_LABELS[apt.type as keyof typeof APPOINTMENT_TYPE_LABELS]}
                        </span>
                      </div>
                      {apt.contacts && (
                        <p className="text-xs text-muted-foreground mt-0.5">{apt.contacts.first_name} {apt.contacts.last_name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── List View ── */}
        {calView === 'list' && (
          <>
            {Object.keys(upcomingGrouped).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarCheck className="h-4 w-4 text-[#3b82f6]" />
                  <h3 className="text-sm font-bold text-foreground">À venir</h3>
                </div>
                {Object.entries(upcomingGrouped).map(([day, apts]) => (
                  <div key={day} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">{day}</h4>
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

            {Object.keys(pastGrouped).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-muted-foreground">Passés</h3>
                </div>
                {Object.entries(pastGrouped).map(([day, apts]) => (
                  <div key={day} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">{day}</h4>
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
                <CalendarCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun rendez-vous</p>
              </div>
            )}
          </>
        )}

        {/* Empty state for grid view */}
        {calView === 'grid' && appointments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Aucun rendez-vous ce mois</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
