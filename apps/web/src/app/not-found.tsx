import Link from 'next/link';

export default function NotFound(): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center">
      <p className="text-[11px] uppercase tracking-wider text-text-subtle mb-2">404</p>
      <h1 className="text-lg font-semibold text-text">Page not found</h1>
      <p className="text-sm text-text-muted mt-2">
        The page you tried to reach does not exist.
      </p>
      <div className="mt-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm text-text-onaccent hover:bg-accent-hover transition-colors"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  );
}
