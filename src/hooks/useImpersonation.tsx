import { createContext, useContext, useState, ReactNode } from 'react';
import type { PartnerType } from '@/lib/supabase';

const SESSION_KEY = 'impersonation';

interface ImpersonationState {
  isImpersonating: boolean;
  partnerId: string | null;
  partnerName: string | null;
  partnerType: PartnerType | null;
}

interface ImpersonationContextType extends ImpersonationState {
  startImpersonation: (partnerId: string, partnerName: string, partnerType: PartnerType) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

function loadFromSession(): ImpersonationState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as ImpersonationState;
  } catch {}
  return { isImpersonating: false, partnerId: null, partnerName: null, partnerType: null };
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImpersonationState>(loadFromSession);

  const startImpersonation = (partnerId: string, partnerName: string, partnerType: PartnerType) => {
    const next = { isImpersonating: true, partnerId, partnerName, partnerType };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setState(next);
  };

  const stopImpersonation = () => {
    const next = { isImpersonating: false, partnerId: null, partnerName: null, partnerType: null };
    sessionStorage.removeItem(SESSION_KEY);
    setState(next);
  };

  return (
    <ImpersonationContext.Provider value={{ ...state, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return context;
}

/** Safe version that returns undefined instead of throwing when outside provider */
export function useImpersonationSafe() {
  return useContext(ImpersonationContext);
}
