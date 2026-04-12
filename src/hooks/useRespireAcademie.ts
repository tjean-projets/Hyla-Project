import { useQuery } from '@tanstack/react-query';
import { supabase, isSuperAdmin } from '@/lib/supabase';
import { useEffectiveUserId } from './useEffectiveUser';
import { useAuth } from './useAuth';

export function useRespireAcademie() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();

  const { data: settings } = useQuery({
    queryKey: ['respire-academie-access', effectiveId],
    queryFn: async () => {
      if (!effectiveId) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('respire_academie_access, can_grant_academie_access')
        .eq('user_id', effectiveId)
        .maybeSingle();
      return data;
    },
    enabled: !!effectiveId,
    staleTime: 60000,
  });

  const hasAccess = isSuperAdmin(user?.email) || settings?.respire_academie_access === true;
  const canGrant = isSuperAdmin(user?.email) || settings?.can_grant_academie_access === true;

  return { hasAccess, canGrant };
}
