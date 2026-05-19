// Static palettes for Antd ConfigProvider (needs resolved values, not CSS vars).
// CSS variable definitions are in globals.css. Keep both in sync.

export const dark = {
  bg: '#08090b',
  bgElevated: '#0e1014',
  surface: '#0e1014',
  surfaceMuted: '#131720',
  surfaceHover: '#181d27',
  border: '#1f2430',
  borderStrong: '#2a3140',
  text: '#e5e7eb',
  textMuted: '#9ba3b4',
  textSubtle: '#6b7280',
  accent: '#5e6ad2',
  accentHover: '#7d87de',
  accentSoft: 'rgba(94,106,210,0.16)',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#f87171',
  info: '#38bdf8',
} as const;

export const light = {
  bg: '#f7f8fa',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#f1f3f6',
  surfaceHover: '#eef0f4',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#94a3b8',
  accent: '#5e6ad2',
  accentHover: '#4854c0',
  accentSoft: 'rgba(94,106,210,0.12)',
  success: '#10b981',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#0ea5e9',
} as const;

export type ThemeMode = 'light' | 'dark';
export type Palette = Record<keyof typeof dark, string>;
export const palettes: Record<ThemeMode, Palette> = { dark, light };

export const radius = { sm: 4, md: 6, lg: 10, xl: 14 } as const;
