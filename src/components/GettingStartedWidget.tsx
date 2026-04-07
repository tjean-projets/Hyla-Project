import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEffectiveUserId } from '@/hooks/useEffectiveUser';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, X, ArrowRight, Users, ShoppingBag, CheckSquare, Calendar, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'contact', label: 'Ajouter un contact', icon: Users, color: 'text-blue-500', link: '/contacts' },
  { key: 'deal', label: 'Créer une vente', icon: ShoppingBag, color: 'text-violet-500', link: '/deals' },
  { key: 'task', label: 'Planifier une tâche', icon: CheckSquare, color: 'text-emerald-500', link: '/tasks' },
  { key: 'appointment', label: 'Créer un rendez-vous', icon: Calendar, color: 'text-[#3b82f6]', link: '/calendar' },
  { key: 'objective', label: 'Définir ses objectifs', icon: Target, color: 'text-amber-500', link: '/settings' },
] as const;

const STORAGE_KEY = 'hyla_getting_started_done';

export default function GettingStartedWidget() {
  const effectiveId = useEffectiveUserId();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  const { data: profile } = useQuery({
    queryKey: ['profile-onboarding', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', effectiveId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId && !dismissed,
  });

  const { data: counts } = useQuery({
    queryKey: ['onboarding-counts', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const [
        { count: contacts },
        { count: deals },
        { count: tasks },
        { count: appointments },
        { data: settings },
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', effectiveId),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('user_id', effectiveId),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', effectiveId),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', effectiveId),
        supabase.from('user_settings').select('monthly_sales_target').eq('user_id', effectiveId).maybeSingle(),
      ]);
      return {
        contact: (contacts || 0) > 0,
        deal: (deals || 0) > 0,
        task: (tasks || 0) > 0,
        appointment: (appointments || 0) > 0,
        objective: ((settings as any)?.monthly_sales_target || 0) > 0,
      };
    },
    enabled: !!effectiveId && !dismissed,
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      if (!effectiveId) return;
      await supabase
        .from('profiles')
        .update({ onboarding_completed_at: new Date().toISOString() } as any)
        .eq('id', effectiveId);
    },
    onSuccess: () => {
      setDismissed(true);
      queryClient.invalidateQueries({ queryKey: ['profile-onboarding'] });
    },
  });

  if (dismissed || (profile as any)?.onboarding_completed_at) return null;
  if (!counts) return null;

  const doneCount = Object.values(counts).filter(Boolean).length;
  const allDone = doneCount === STEPS.length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">{doneCount}/{STEPS.length}</span>
          </div>
          <p className="text-sm font-semibold text-foreground">Bien démarrer</p>
        </div>
        <button
          onClick={() => dismiss.mutate()}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground">{doneCount} étape{doneCount > 1 ? 's' : ''} sur {STEPS.length}</span>
          <span className="text-[10px] font-bold text-[#3b82f6]">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-3 py-2 space-y-0.5">
        {STEPS.map((step) => {
          const done = counts[step.key];
          return (
            <Link
              key={step.key}
              to={step.link}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group',
                done ? 'opacity-50 pointer-events-none' : 'hover:bg-muted'
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className={cn('h-4 w-4 flex-shrink-0', step.color)} />
              )}
              <step.icon className={cn('h-3.5 w-3.5 flex-shrink-0', step.color)} />
              <span className={cn('text-sm flex-1', done ? 'line-through text-muted-foreground' : 'text-foreground font-medium')}>
                {step.label}
              </span>
              {!done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />}
            </Link>
          );
        })}
      </div>

      {/* CTA when all done */}
      {allDone && (
        <div className="px-4 pb-4 pt-2 border-t border-border mt-1">
          <button
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            className="w-full py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            Terminer l'installation ✓
          </button>
        </div>
      )}
    </div>
  );
}
