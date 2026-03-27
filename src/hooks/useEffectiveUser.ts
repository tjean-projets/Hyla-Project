import { useAuth } from '@/hooks/useAuth';
import { useImpersonationSafe } from '@/hooks/useImpersonation';

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
