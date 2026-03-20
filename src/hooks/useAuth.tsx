import { useState, useEffect, useCallback, createContext, useContext, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole, PartnerType } from '@/lib/supabase';
import { useImpersonationSafe } from './useImpersonation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerType: PartnerType | null;
  partnerRate: number;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [partnerRate, setPartnerRate] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchUserRole = useCallback(async (userId: string): Promise<void> => {
    try {
      // Parallel fetch: user_roles + partners
      const [roleResult, partnerResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('partners')
          .select('id, partner_type, display_name')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const roleData = roleResult.data;
      const partnerData = partnerResult.data;

      // Priority 1: explicit admin role in user_roles table
      if (roleData?.role === 'admin') {
        setRole('admin');
        setPartnerId(null);
        setPartnerType(null);
        return;
      }

      // Priority 2: partner record exists
      if (partnerData) {
        setRole('partner');
        setPartnerId(partnerData.id);
        setPartnerName((partnerData as { id: string; partner_type: string; display_name: string }).display_name || null);
        setPartnerType((partnerData.partner_type as PartnerType) || 'professional');
        // Fetch tier rate
        const { data: tierData } = await supabase.rpc('get_partner_tier', { p_partner_id: partnerData.id });
        if (tierData && (tierData as unknown[]).length > 0) {
          setPartnerRate((tierData as unknown as { rate_percent: number }[])[0].rate_percent);
        }
        return;
      }

      // Priority 3: any other role in user_roles
      if (roleData) {
        setRole(roleData.role as UserRole);
        setPartnerId(null);
        setPartnerType(null);
        return;
      }

      // No role found
      console.warn('No role found for user:', userId);
      setRole(null);
      setPartnerId(null);
      setPartnerType(null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole(null);
      setPartnerId(null);
      setPartnerType(null);
    }
  }, []);

  // Stable refs so the useEffect never re-runs
  const fetchUserRoleRef = useRef(fetchUserRole);
  fetchUserRoleRef.current = fetchUserRole;

  const clearAuthRef = useRef(() => {
    setUser(null);
    setSession(null);
    setRole(null);
    setPartnerId(null);
    setPartnerName(null);
    setPartnerType(null);
    setPartnerRate(50);
  });

  useEffect(() => {
    let isMounted = true;

    const resolveRoleForUser = (userId: string) => {
      setIsLoading(true);
      void fetchUserRoleRef.current(userId)
        .catch((error) => {
          console.error('Failed to fetch user role:', error);
        })
        .finally(() => {
          if (isMounted) {
            initializedRef.current = true;
            setIsLoading(false);
          }
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          clearAuthRef.current();
          initializedRef.current = true;
          setIsLoading(false);
          return;
        }

        const shouldFetchRole =
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED';

        if (shouldFetchRole) {
          resolveRoleForUser(newSession.user.id);
          return;
        }

        if (!initializedRef.current) {
          resolveRoleForUser(newSession.user.id);
        }
      }
    );

    // Bootstrap from persisted session (avoids race where auth event is delayed)
    const initializeFromStoredSession = async () => {
      try {
        const { data: { session: storedSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted || initializedRef.current) return;

        setSession(storedSession);
        setUser(storedSession?.user ?? null);

        if (storedSession?.user) {
          resolveRoleForUser(storedSession.user.id);
          return;
        }

        clearAuthRef.current();
        initializedRef.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('Error restoring session:', error);
        if (isMounted && !initializedRef.current) {
          clearAuthRef.current();
          initializedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    void initializeFromStoredSession();

    // Failsafe: never let auth stay in loading indefinitely.
    // If session restore/role fetch hangs, we unlock the UI after 10s.
    const timeout = setTimeout(() => {
      if (isMounted && !initializedRef.current) {
        const hasStoredSession = Object.keys(localStorage).some(
          key => key.startsWith('sb-') && (key.includes('auth-token') || key.includes('session'))
        );

        console.warn('Auth initialization timeout — forcing loading unlock');
        initializedRef.current = true;
        setIsLoading(false);

        // No persisted session at all: hard reset + redirect to login pages
        if (!hasStoredSession) {
          clearAuthRef.current();
          if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/invite') && !window.location.pathname.startsWith('/join')) {
            window.location.replace('/login');
          }
        }
      }
    }, 10000);

    return () => {
      isMounted = false;
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []); // Empty deps — runs once, refs keep functions stable

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthRef.current();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, partnerId, partnerName, partnerType, partnerRate, isLoading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  // Safe impersonation check — useContext never throws, returns undefined if outside provider
  const impersonation = useImpersonationSafe();
  if (impersonation?.isImpersonating && impersonation.partnerId) {
    return {
      ...context,
      role: 'partner' as UserRole,
      partnerId: impersonation.partnerId,
      partnerName: impersonation.partnerName,
      partnerType: impersonation.partnerType,
    };
  }

  return context;
}
