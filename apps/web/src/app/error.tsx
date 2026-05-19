'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">Error</p>
      <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
      <pre className="mt-3 text-xs bg-surface-muted p-3 rounded-md overflow-auto text-text-muted">
        {error.message}
      </pre>
      {error.digest ? (
        <p className="text-xs text-text-subtle mt-2">digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm text-text-onaccent hover:bg-accent-hover transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
