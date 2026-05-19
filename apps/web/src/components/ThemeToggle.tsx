'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '../theme/theme-context';

export function ThemeToggle(): JSX.Element {
  const { mode, toggle } = useThemeMode();
  const Icon = mode === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
    >
      <Icon size={16} />
    </button>
  );
}
