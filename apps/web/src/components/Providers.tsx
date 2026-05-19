'use client';

import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider, useThemeMode } from '../theme/theme-context';
import { buildAntdTheme } from '../theme/antd-theme';

function AntdShell({ children }: { children: ReactNode }): JSX.Element {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildAntdTheme(mode), [mode]);
  return (
    <ConfigProvider theme={theme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <AntdRegistry>
      <ThemeProvider>
        <AntdShell>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </AntdShell>
      </ThemeProvider>
    </AntdRegistry>
  );
}
