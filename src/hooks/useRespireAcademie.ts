import { useQuery } from '@tanstack/react-query';
import { supabase, isSuperAdmin } from '@/lib/supabase';
import { useEffectiveUserId } from './useEffectiveUser';
import { useAuth } from './useAuth';
import { useImpersonationSafe } from './useImpersonation';

export function useRespireAcademie() {
  const { user } = useAuth();
  const effectiveId = useEffectiveUserId();
  const { isImpersonating } = useImpersonationSafe();

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
    staleTime: 0,
  });

  // En mode impersonation, les droits sont ceux de l'utilisateur effectif uniquement
  // (pas ceux de l'admin qui impersonne — sinon Véronique hériterait des droits de Thomas)
  const isRealAdmin = !isImpersonating && isSuperAdmin(user?.email);

  const hasAccess = isRealAdmin || settings?.respire_academie_access === true;
  const canGrant = isRealAdmin || settings?.can_grant_academie_access === true;

  return { hasAccess, canGrant };
}
