import { useState, useEffect, useCallback, createContext, useContext, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { full_name: string; avatar_url: string | null; invite_code: string | null; sponsor_user_id: string | null; role: string | null } | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null; invite_code: string | null; sponsor_user_id: string | null; role: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, invite_code, sponsor_user_id, role')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  const clearAuth = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const clearAuthRef = useRef(clearAuth);
  clearAuthRef.current = clearAuth;

  useEffect(() => {
    let isMounted = true;

    const resolveUser = (userId: string) => {
      setIsLoading(true);
      void fetchProfileRef.current(userId)
        .catch(console.error)
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

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          resolveUser(newSession.user.id);
          return;
        }

        if (!initializedRef.current) {
          resolveUser(newSession.user.id);
        }
      }
    );

    const initializeFromStoredSession = async () => {
      try {
        const { data: { session: storedSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted || initializedRef.current) return;

        setSession(storedSession);
        setUser(storedSession?.user ?? null);

        if (storedSession?.user) {
          resolveUser(storedSession.user.id);
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

    const timeout = setTimeout(() => {
      if (isMounted && !initializedRef.current) {
        console.warn('Auth initialization timeout');
        initializedRef.current = true;
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthRef.current();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
