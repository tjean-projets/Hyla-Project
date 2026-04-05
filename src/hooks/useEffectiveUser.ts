import { useAuth } from '@/hooks/useAuth';
import { useImpersonationSafe } from '@/hooks/useImpersonation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Returns the effective user ID to use for data queries.
 * When an admin is impersonating a partner, returns the partner's ID.
 * Otherwise returns the logged-in user's ID.
 */
export function useEffectiveUserId(): string | undefined {
  const { user } = useAuth();
  const impersonation = useImpersonationSafe();

  if (impersonation?.isImpersonating && impersonation.partnerId) {
    return impersonation.partnerId;
  }

  return user?.id;
}

/**
 * Returns the effective profile (name, email, etc.) for the current view.
 * When impersonating, fetches the impersonated user's profile from Supabase.
 * Otherwise returns the logged-in user's profile.
 */
export function useEffectiveProfile() {
  const { user, profile } = useAuth();
  const impersonation = useImpersonationSafe();
  const isImpersonating = impersonation?.isImpersonating && impersonation.partnerId;

  const { data: impersonatedProfile } = useQuery({
    queryKey: ['impersonated-profile', impersonation?.partnerId],
    queryFn: async () => {
      if (!impersonation?.partnerId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, invite_code, created_at, role, plan, plan_status, trial_ends_at')
        .eq('id', impersonation.partnerId)
        .single();
      return data;
    },
    enabled: !!isImpersonating,
    staleTime: 60000,
  });

  if (isImpersonating && impersonatedProfile) {
    return {
      profile: impersonatedProfile,
      isImpersonating: true,
    };
  }

  return {
    profile,
    isImpersonating: false,
  };
}
