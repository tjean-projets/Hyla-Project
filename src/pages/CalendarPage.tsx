import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase, APPOINTMENT_TYPE_LABELS } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Clock, CalendarCheck, ChevronLeft, ChevronRight, CalendarDays, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GoogleCalEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  planifie: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600', label: 'Confirmé' },
  realise:  { bg: 'bg-blue-50 dark:bg-blue-950',   text: 'text-blue-600',    label: 'Réalisé' },
  annule:   { bg: 'bg-red-50 dark:bg-red-950',     text: 'text-red-600',     label: 'Annulé' },
  reporte:  { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600',   label: 'Reporté' },
};

const TYPE_COLORS: Record<string, string> = {
  rdv:       'bg-[#3b82f6]',
  demo:      'bg-violet-500',
  relance:   'bg-amber-500',
  formation: 'bg-emerald-500',
  autre:     'bg-gray-400',
};

const MONTH_NAMES_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function AppointmentCard({ apt }: { apt: any }) {
  const status   = STATUS_STYLES[apt.status] || STATUS_STYLES.planifie;
  const typeColor = TYPE_COLORS[apt.type]    || TYPE_COLORS.autre;
  const time    = new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(new Date(apt.date).getTime() + (apt.duration || 60) * 60000)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex">
        <div className={`w-1.5 ${typeColor} flex-shrink-0`} />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-[#3b82f6]">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm font-bold">{time}</span>
                </div>
                <span className="text-xs text-muted-foreground">→ {endTime}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{(() => { const d = apt.duration || 60; const h = Math.floor(d / 60); const m = d % 60; return h > 0 ? (m > 0 ? `${h}h${m}` : `${h}h`) : `${m} min`; })()}</span>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{apt.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md text-white ${typeColor}`}>
                  {APPOINTMENT_TYPE_LABELS[apt.type as keyof typeof APPOINTMENT_TYPE_LABELS]}
                </span>
                {apt.contacts && (
                  <span className="text-xs text-muted-foreground">{apt.contacts.first_name} {apt.contacts.last_name}</span>
                )}
              </div>
              {apt.location && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{apt.location}
                </p>
              )}
            </div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { user }      = useAuth();
  const effectiveId   = useEffectiveUserId();
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'rdv' as string, date: '', duration: '60', location: '', notes: '' });

  const [calView, setCalView] = useState<'grid' | 'list'>('grid');
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Default: today is selected
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const [googleToken, setGoogleToken] = useState<string | null>(null)
  const [googleEvents, setGoogleEvents] = useState<GoogleCalEvent[]>([])
  const [googleLoading, setGoogleLoading] = useState(false)
  // Clé par user ID → chaque utilisateur a son propre état de connexion
  const googleStorageKey = `hyla_google_cal_${user?.id || 'anon'}`
  const [googleConnected, setGoogleConnected] = useState(() =>
    localStorage.getItem(`hyla_google_cal_${user?.id || 'anon'}`) === '1'
  )

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

  const { data: calTasks = [] } = useQuery({
    queryKey: ['calendar-tasks', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data } = await supabase
        .from('tasks')
        .select('*, contacts(first_name, last_name)')
        .eq('user_id', effectiveId)
        .not('due_date', 'is', null)
        .in('status', ['a_faire', 'en_cours'])
        .order('due_date', { ascending: true });
      return data || [];
    },
    enabled: !!effectiveId,
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'terminee' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: 'Tâche terminée !' });
    },
  });

  const createApt = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Non connecté');
      const { error } = await supabase.from('appointments').insert({
        user_id: effectiveId,
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

  const updateAptStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const deleteApt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'RDV supprimé' });
    },
  });

  function openNewForm() {
    if (calView === 'grid' && selectedDay) {
      const now = new Date();
      const pre = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), now.getHours(), now.getMinutes());
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pre.getFullYear()}-${pad(pre.getMonth()+1)}-${pad(pre.getDate())}T${pad(pre.getHours())}:${pad(pre.getMinutes())}`;
      setForm(f => ({ ...f, date: dateStr }));
    } else {
      setForm({ title: '', type: 'rdv', date: '', duration: '60', location: '', notes: '' });
    }
    setShowForm(true);
  }

  // ── Stats ──
  const todayStr    = new Date().toISOString().slice(0, 10);
  const todayCount  = appointments.filter((a: any) => a.date?.slice(0, 10) === todayStr).length
                    + calTasks.filter((t: any) => t.due_date?.slice(0, 10) === todayStr).length;
  const thisWeek    = appointments.filter((a: any) => {
    const diff = (new Date(a.date).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length + calTasks.filter((t: any) => {
    const diff = (new Date(t.due_date).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  // ── Grid helpers ──
  const today         = new Date();
  const todayDateStr  = today.toISOString().slice(0, 10);
  const daysInMonth   = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDayRaw   = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
  const firstDay      = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const totalCells    = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  function getDayApts(year: number, month: number, day: number) {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter((a: any) => a.date?.slice(0, 10) === d);
  }

  function getDayTasks(year: number, month: number, day: number) {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calTasks.filter((t: any) => t.due_date?.slice(0, 10) === d);
  }

  // ── Selected day data ──
  const selectedDayStr = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`;
  const selectedDayApts = appointments.filter((a: any) => a.date?.slice(0, 10) === selectedDayStr);
  const selectedDayTasks = calTasks.filter((t: any) => t.due_date?.slice(0, 10) === selectedDayStr);
  const selectedDayLabel = selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const googleDayEvents = googleEvents.filter(e => {
    const d = (e.start.dateTime || e.start.date || '').slice(0, 10)
    return d === selectedDay.toISOString().slice(0, 10)
  })

  // ── Google Calendar helpers ──
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  const fetchGoogleEvents = async (token: string, month: Date) => {
    setGoogleLoading(true)
    try {
      const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString()
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.status === 401) {
        setGoogleToken(null)
        setGoogleConnected(false)
        setGoogleEvents([])
        localStorage.removeItem(googleStorageKey)
        toast({ title: 'Session Google expirée', description: 'Reconnectez Google Agenda.', variant: 'destructive' })
        return
      }
      const data = await res.json()
      setGoogleEvents(data.items || [])
    } catch {
      toast({ title: 'Erreur Google Agenda', description: 'Impossible de récupérer les événements.', variant: 'destructive' })
    } finally {
      setGoogleLoading(false)
    }
  }

  const initTokenClient = (prompt: '' | 'consent', onSuccess: (token: string) => void) => {
    const g = (window as any).google
    if (!g?.accounts?.oauth2) return null
    return g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: async (resp: any) => {
        if (resp.access_token) onSuccess(resp.access_token)
      },
      error_callback: () => {
        // Échec silencieux (ex: utilisateur pas connecté à Google)
        setGoogleConnected(false)
        localStorage.removeItem(googleStorageKey)
      },
    })
  }

  const connectGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast({ title: 'Non configuré', description: 'Ajoutez VITE_GOOGLE_CLIENT_ID dans vos variables Vercel.', variant: 'destructive' })
      return
    }
    if (!(window as any).google?.accounts?.oauth2) {
      toast({ title: 'Google non chargé', description: 'Rechargez la page et réessayez.', variant: 'destructive' })
      return
    }
    const client = initTokenClient('consent', async (token) => {
      setGoogleToken(token)
      setGoogleConnected(true)
      localStorage.setItem(googleStorageKey, '1')
      await fetchGoogleEvents(token, calMonth)
    })
    client?.requestAccessToken({ prompt: 'consent' })
  }

  const disconnectGoogle = () => {
    if (googleToken) (window as any).google?.accounts?.oauth2?.revoke(googleToken)
    setGoogleToken(null)
    setGoogleConnected(false)
    setGoogleEvents([])
    localStorage.removeItem(googleStorageKey)
  }

  // Reconnexion silencieuse au chargement si l'utilisateur était connecté
  useEffect(() => {
    if (!googleConnected || !GOOGLE_CLIENT_ID) return
    const tryAutoConnect = () => {
      const client = initTokenClient('', async (token) => {
        setGoogleToken(token)
        await fetchGoogleEvents(token, calMonth)
      })
      client?.requestAccessToken({ prompt: '' })
    }
    // Attendre que le script Google soit chargé
    if ((window as any).google?.accounts?.oauth2) {
      tryAutoConnect()
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval)
          tryAutoConnect()
        }
      }, 500)
      return () => clearInterval(interval)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh quand on change de mois (si connecté)
  useEffect(() => {
    if (googleToken) fetchGoogleEvents(googleToken, calMonth)
  }, [calMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── List view helpers ──
  const nowStr = new Date().toISOString();
  const upcoming = appointments.filter((a: any) => a.date >= nowStr);
  const past     = appointments.filter((a: any) => a.date < nowStr);
  const groupByDay = (apts: any[]) =>
    apts.reduce((acc: Record<string, any[]>, apt: any) => {
      const key = new Date(apt.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!acc[key]) acc[key] = [];
      acc[key].push(apt);
      return acc;
    }, {});
  const upcomingGrouped = groupByDay(upcoming);
  const pastGrouped     = groupByDay(past);

  return (
    <AppLayout
      title="Calendrier"
      actions={
        <>
          {/* Google Calendar button */}
          {googleConnected ? (
            <button
              onClick={disconnectGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
              title="Déconnecter Google Agenda"
            >
              <img src="https://www.google.com/favicon.ico" className="h-3 w-3" alt="" />
              Google connecté
            </button>
          ) : (
            <button
              onClick={connectGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="h-3 w-3" alt="" />
              {googleLoading ? 'Chargement...' : 'Lier Google Agenda'}
            </button>
          )}
          <Button onClick={openNewForm} className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white">
            <Plus className="h-4 w-4 mr-2" />Nouveau
          </Button>
          <Dialog open={showForm} onOpenChange={setShowForm}>
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
        </>
      }
    >
      <div className="space-y-5">

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-2xl p-3 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aujourd'hui</p>
            <p className="text-2xl font-bold text-foreground mt-1">{todayCount}</p>
          </div>
          <div className="bg-card rounded-2xl p-3 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cette semaine</p>
            <p className="text-2xl font-bold text-[#3b82f6] mt-1">{thisWeek}</p>
          </div>
          <div className="bg-card rounded-2xl p-3 shadow-sm border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground mt-1">{appointments.length}</p>
          </div>
        </div>

        {/* ── View toggle ── */}
        <div className="flex justify-end">
          <div className="flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setCalView('grid')}
              className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                calView === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >Grille</button>
            <button
              onClick={() => setCalView('list')}
              className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                calView === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >Liste</button>
          </div>
        </div>

        {/* ── Grid View ── */}
        {calView === 'grid' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">

            {/* Calendar grid */}
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-bold text-foreground">
                  {MONTH_NAMES_FR[calMonth.getMonth()]} {calMonth.getFullYear()}
                </h3>
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const dayNum  = idx - firstDay + 1;
                  const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                  const dayStr  = inMonth
                    ? `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    : '';
                  const isToday    = dayStr === todayDateStr;
                  const isSelected = inMonth && dayStr === selectedDayStr;
                  const dayApts    = inMonth ? getDayApts(calMonth.getFullYear(), calMonth.getMonth(), dayNum) : [];
                  const dayTasks   = inMonth ? getDayTasks(calMonth.getFullYear(), calMonth.getMonth(), dayNum) : [];
                  const hasApts    = dayApts.length > 0 || dayTasks.length > 0;

                  let displayNum = dayNum;
                  if (!inMonth) {
                    displayNum = idx < firstDay
                      ? new Date(calMonth.getFullYear(), calMonth.getMonth(), 0).getDate() - (firstDay - 1 - idx)
                      : idx - firstDay - daysInMonth + 1;
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => inMonth && setSelectedDay(new Date(calMonth.getFullYear(), calMonth.getMonth(), dayNum))}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        'rounded-xl border min-h-[48px] flex flex-col items-center pt-1.5 pb-1 px-0.5 transition-colors',
                        !inMonth && 'opacity-25 cursor-default border-border/50 bg-muted/30',
                        inMonth && 'cursor-pointer',
                        inMonth && !isSelected && 'border-border bg-card hover:bg-muted',
                        isSelected && 'border-[#3b82f6] bg-blue-50 dark:bg-blue-950/40',
                      )}
                    >
                      <span className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        isToday    ? 'bg-[#3b82f6] text-white font-bold' : '',
                        !isToday && isSelected ? 'text-[#3b82f6] font-bold' : '',
                        !isToday && !isSelected && inMonth ? 'text-foreground' : '',
                        !inMonth && 'text-muted-foreground',
                      )}>
                        {displayNum}
                      </span>
                      {(hasApts || googleEvents.some(e => (e.start.dateTime || e.start.date || '').slice(0, 10) === dayStr)) && (
                        <div className="flex flex-wrap gap-0.5 justify-center mt-1 px-0.5">
                          {dayApts.slice(0, 2).map((apt: any, i: number) => (
                            <span key={i} className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', TYPE_COLORS[apt.type] || TYPE_COLORS.autre)} />
                          ))}
                          {dayTasks.slice(0, 2).map((_: any, i: number) => (
                            <span key={'t' + i} className="w-1.5 h-1.5 rounded-sm flex-shrink-0 bg-teal-500" />
                          ))}
                          {(dayApts.length + dayTasks.length) > 4 && <span className="text-[8px] text-muted-foreground">+{dayApts.length + dayTasks.length - 4}</span>}
                          {/* Google events dots */}
                          {inMonth && googleEvents
                            .filter(e => (e.start.dateTime || e.start.date || '').slice(0, 10) === `${calMonth.getFullYear()}-${String(calMonth.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`)
                            .slice(0, 2)
                            .map(e => (
                              <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-[#4285F4] flex-shrink-0" />
                            ))
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Day detail panel ── */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-bold text-foreground capitalize">{selectedDayLabel}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {(selectedDayApts.length + selectedDayTasks.length) === 0
                    ? 'Aucun événement'
                    : `${selectedDayApts.length} RDV · ${selectedDayTasks.length} tâche${selectedDayTasks.length > 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Tasks du jour */}
              {selectedDayTasks.length > 0 && (
                <div className="border-b border-border">
                  <div className="flex items-center gap-2 px-4 py-2 bg-teal-50/50 dark:bg-teal-950/20">
                    <CheckSquare className="h-3.5 w-3.5 text-teal-600" />
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">Tâches ({selectedDayTasks.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {selectedDayTasks.map((task: any) => (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => completeTask.mutate(task.id)}
                          className="flex-shrink-0 text-teal-500 hover:text-teal-700 transition-colors"
                          title="Marquer comme terminée"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          {task.contacts && (
                            <p className="text-[10px] text-muted-foreground">
                              {task.contacts.first_name} {task.contacts.last_name}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 flex-shrink-0">
                          {task.type || 'tâche'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {selectedDayApts.length > 0 ? (
                <div className="divide-y divide-border">
                  {selectedDayApts.map((apt: any) => {
                    const typeColor = TYPE_COLORS[apt.type] || TYPE_COLORS.autre;
                    const status    = STATUS_STYLES[apt.status] || STATUS_STYLES.planifie;
                    const time      = new Date(apt.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const endTime   = new Date(new Date(apt.date).getTime() + (apt.duration || 60) * 60000)
                      .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={apt.id} className="flex gap-3 p-4">
                        <div className={cn('w-1 rounded-full flex-shrink-0 self-stretch', typeColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground leading-tight">{apt.title}</p>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg flex-shrink-0', status.bg, status.text)}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1 text-[#3b82f6]">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs font-semibold">{time}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">→ {endTime}</span>
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded text-white', typeColor)}>
                              {APPOINTMENT_TYPE_LABELS[apt.type as keyof typeof APPOINTMENT_TYPE_LABELS]}
                            </span>
                          </div>
                          {apt.contacts && (
                            <p className="text-xs text-muted-foreground mt-1">
                              👤 {apt.contacts.first_name} {apt.contacts.last_name}
                            </p>
                          )}
                          {apt.location && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{apt.location}
                            </p>
                          )}
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{apt.notes}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {apt.status !== 'realise' && (
                              <button onClick={() => updateAptStatus.mutate({ id: apt.id, status: 'realise' })}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                                ✓ Réalisé
                              </button>
                            )}
                            {apt.status !== 'annule' && (
                              <button onClick={() => updateAptStatus.mutate({ id: apt.id, status: 'annule' })}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                ✕ Annulé
                              </button>
                            )}
                            {apt.status !== 'reporte' && (
                              <button onClick={() => updateAptStatus.mutate({ id: apt.id, status: 'reporte' })}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                                ↩ Reporté
                              </button>
                            )}
                            <button
                              onClick={() => { if (window.confirm('Supprimer ce RDV ?')) deleteApt.mutate(apt.id); }}
                              className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : selectedDayTasks.length === 0 && googleDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun événement ce jour</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Clique sur "Nouveau" pour en créer un</p>
                </div>
              ) : null}

              {/* Google Calendar events */}
              {googleDayEvents.length > 0 && (
                <div className="space-y-2 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#4285F4]" />
                    Google Agenda
                  </p>
                  {googleDayEvents.map(e => {
                    const time = e.start.dateTime
                      ? new Date(e.start.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : 'Journée'
                    const endTime = e.end.dateTime
                      ? new Date(e.end.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : ''
                    return (
                      <div key={e.id} className="bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-1 w-1 rounded-full bg-[#4285F4] flex-shrink-0" />
                          <span className="text-sm font-bold text-[#4285F4]">{time}{endTime ? ` → ${endTime}` : ''}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{e.summary || '(Sans titre)'}</p>
                        {e.location && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">📍 {e.location}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

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
                      {(apts as any[]).map((apt) => <AppointmentCard key={apt.id} apt={apt} />)}
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
                      {(apts as any[]).map((apt) => <AppointmentCard key={apt.id} apt={apt} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tâches à venir en vue liste */}
            {calTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckSquare className="h-4 w-4 text-teal-500" />
                  <h3 className="text-sm font-bold text-foreground">Tâches à échéance</h3>
                </div>
                <div className="space-y-2">
                  {calTasks.map((task: any) => (
                    <div key={task.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="flex">
                        <div className="w-1.5 bg-teal-500 flex-shrink-0" />
                        <div className="flex-1 p-4 flex items-center gap-3">
                          <button
                            onClick={() => completeTask.mutate(task.id)}
                            className="flex-shrink-0 text-teal-500 hover:text-teal-700 transition-colors"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{task.title}</p>
                            {task.contacts && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {task.contacts.first_name} {task.contacts.last_name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {appointments.length === 0 && calTasks.length === 0 && (
              <div className="text-center py-16">
                <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun événement</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
