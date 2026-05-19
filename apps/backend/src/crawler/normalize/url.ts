const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'mc_eid',
  'mc_cid',
  'ref',
  'ref_src',
  '_hsenc',
  '_hsmi',
]);

export function normalizeUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(input, base) : new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  const filtered = new URLSearchParams();
  const keys: string[] = [];
  url.searchParams.forEach((_v, k) => {
    if (!keys.includes(k)) keys.push(k);
  });
  keys.sort();
  for (const key of keys) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) continue;
    for (const v of url.searchParams.getAll(key)) filtered.append(key, v);
  }
  url.search = filtered.toString();

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  if (url.pathname === '') url.pathname = '/';

  return url.toString();
}

export function isSameHost(url: string, allowedHosts: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowedHosts.map((h) => h.toLowerCase()).includes(host);
  } catch {
    return false;
  }
}

export function isSameSite(url: string, primaryDomain: string, includeSubdomains: boolean): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const root = primaryDomain.toLowerCase();
    if (host === root) return true;
    if (includeSubdomains && host.endsWith(`.${root}`)) return true;
    return false;
  } catch {
    return false;
  }
}

export function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getPathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

export function resolveLink(href: string, base: string): string | null {
  return normalizeUrl(href, base);
}
