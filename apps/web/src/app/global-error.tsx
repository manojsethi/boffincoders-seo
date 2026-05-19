'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          background: '#08090b',
          color: '#e5e7eb',
        }}
      >
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
        <pre
          style={{
            background: '#131720',
            padding: 12,
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 12,
            color: '#9ba3b4',
          }}
        >
          {error.message}
        </pre>
        {error.digest ? (
          <p style={{ color: '#6b7280', fontSize: 12 }}>digest: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #2a3140',
            background: '#5e6ad2',
            color: '#f8fafc',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
