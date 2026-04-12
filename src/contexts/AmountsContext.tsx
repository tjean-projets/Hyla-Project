import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AmountsContextType {
  visible: boolean;
  toggle: () => void;
  /** Renvoie la valeur formatée si visible, sinon "•••" */
  mask: (value: string | number) => string;
}

const AmountsContext = createContext<AmountsContextType>({
  visible: true,
  toggle: () => {},
  mask: (v) => String(v),
});

export function AmountsProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hyla_amounts_visible') !== 'false';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setVisible(v => {
      const next = !v;
      try { localStorage.setItem('hyla_amounts_visible', String(next)); } catch {}
      return next;
    });
  };

  const mask = (value: string | number): string => {
    if (visible) return String(value);
    return '•••';
  };

  return (
    <AmountsContext.Provider value={{ visible, toggle, mask }}>
      {children}
    </AmountsContext.Provider>
  );
}

export function useAmounts() {
  return useContext(AmountsContext);
}
