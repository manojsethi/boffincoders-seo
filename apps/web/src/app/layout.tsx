import type { ReactNode } from 'react';
import '../styles/globals.css';
import { Providers } from '../components/Providers';
import { AppShell } from '../components/AppShell';

export const metadata = {
  title: 'Boffin SEO v2',
  description: 'Evidence-first SEO operating system',
};

export const dynamic = 'force-dynamic';

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('boffin-theme');
    var mode = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = mode;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
