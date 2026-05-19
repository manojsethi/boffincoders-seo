'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeMode } from '../styles/tokens';

const STORAGE_KEY = 'boffin-theme';

type ThemeCtx = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Hydrate from storage / system on mount
  useEffect(() => {
    let next: ThemeMode = 'dark';
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') next = stored;
      else if (window.matchMedia('(prefers-color-scheme: light)').matches) next = 'light';
    } catch {
      // ignore
    }
    setModeState(next);
  }, []);

  // Apply attribute to html
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggle = useCallback(() => setModeState((m) => (m === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo<ThemeCtx>(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemeMode(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useThemeMode must be used inside ThemeProvider');
  return v;
}
