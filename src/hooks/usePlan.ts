import { useAuth } from '@/hooks/useAuth';
import { useEffectiveProfile } from '@/hooks/useEffectiveUser';
import { isSuperAdmin } from '@/lib/supabase';

export type PlanType = 'legacy' | 'trial' | 'conseillere' | 'manager' | 'expired';

export interface PlanAccess {
  network: boolean;    // NetworkPage complète
  finance: boolean;    // Import Finance
  stats: boolean;      // StatsPage avancée
  basic: boolean;      // Tout le reste (dashboard, contacts, deals, tasks, calendar, commissions)
}

export function usePlan() {
  const { user } = useAuth();
  const { profile } = useEffectiveProfile();

  // Super admins ont toujours accès à tout
  if (isSuperAdmin(user?.email)) {
    return {
      plan: 'legacy' as PlanType,
      planStatus: 'active',
      isTrial: false,
      isLegacy: true,
      isExpired: false,
      trialDaysLeft: 0,
      trialEndsAt: null,
      canAccess: { network: true, finance: true, stats: true, basic: true },
    };
  }

  const plan = (profile?.plan as PlanType) || 'trial';
  const planStatus = profile?.plan_status || 'trialing';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;

  // Déterminer si le trial est encore valide
  const trialValid = trialEndsAt ? trialEndsAt > new Date() : false;

  // Accès global actif
  const isActive =
    plan === 'legacy' ||
    plan === 'manager' ||
    plan === 'conseillere' ||
    (plan === 'trial' && trialValid);

  // Accès features manager
  const hasManagerAccess =
    plan === 'legacy' ||
    plan === 'manager' ||
    (plan === 'trial' && trialValid);

  const canAccess: PlanAccess = {
    network: hasManagerAccess,
    finance: hasManagerAccess,
    stats: hasManagerAccess,
    basic: isActive,
  };

  // Jours restants essai
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isExpired = !isActive;
  const isTrial = plan === 'trial' && trialValid;
  const isLegacy = plan === 'legacy';

  return {
    plan,
    planStatus,
    isTrial,
    isLegacy,
    isExpired,
    trialDaysLeft,
    trialEndsAt,
    canAccess,
  };
}
