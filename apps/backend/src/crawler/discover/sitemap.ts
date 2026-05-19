import { request } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { getLogger } from '../../config/logger';
import { getOrigin, normalizeUrl } from '../normalize/url';
import { getDispatcher } from '../http';

const log = getLogger('crawler:sitemap');
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true, trimValues: true });

export type SitemapUrl = { loc: string; lastmod?: Date; changefreq?: string; priority?: number };
export type SitemapDiscoveryResult = {
  urls: SitemapUrl[];
  sources: string[];
  errors: Array<{ url: string; error: string }>;
};

export async function discoverFromSitemaps(opts: {
  seedUrl: string;
  userAgent: string;
  extraSitemaps?: string[];
  maxDepth?: number;
}): Promise<SitemapDiscoveryResult> {
  const origin = getOrigin(opts.seedUrl);
  if (!origin) return { urls: [], sources: [], errors: [] };

  const candidates = new Set<string>();
  candidates.add(`${origin}/sitemap.xml`);
  candidates.add(`${origin}/sitemap_index.xml`);
  for (const s of opts.extraSitemaps ?? []) candidates.add(s);

  const visited = new Set<string>();
  const urls = new Map<string, SitemapUrl>();
  const sources: string[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const queue: Array<{ url: string; depth: number }> = [...candidates].map((u) => ({ url: u, depth: 0 }));
  const maxDepth = opts.maxDepth ?? 3;

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    if (visited.has(item.url) || item.depth > maxDepth) continue;
    visited.add(item.url);

    const fetched = await fetchText(item.url, opts.userAgent);
    if (!fetched.ok) {
      errors.push({ url: item.url, error: fetched.error });
      continue;
    }
    sources.push(item.url);

    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(fetched.body) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err, url: item.url }, 'sitemap parse failed');
      errors.push({ url: item.url, error: `Parse failed: ${msg}` });
      continue;
    }

    const idx = parsed['sitemapindex'] as Record<string, unknown> | undefined;
    if (idx) {
      for (const e of asArray(idx['sitemap'])) {
        const loc = readLoc(e);
        if (loc) queue.push({ url: loc, depth: item.depth + 1 });
      }
      continue;
    }

    const urlset = parsed['urlset'] as Record<string, unknown> | undefined;
    if (urlset) {
      for (const e of asArray(urlset['url'])) {
        const loc = readLoc(e);
        if (!loc) continue;
        const norm = normalizeUrl(loc);
        if (!norm) continue;
        urls.set(norm, {
          loc: norm,
          lastmod: readDate(e, 'lastmod'),
          changefreq: readString(e, 'changefreq'),
          priority: readNumber(e, 'priority'),
        });
      }
    }
  }

  return { urls: [...urls.values()], sources, errors };
}

async function fetchText(
  url: string,
  userAgent: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  try {
    const res = await request(url, {
      method: 'GET',
      headers: { 'user-agent': userAgent, accept: 'application/xml,text/xml,*/*' },
      dispatcher: getDispatcher(),
      bodyTimeout: 15_000,
      headersTimeout: 10_000,
    });
    if (res.statusCode !== 200) {
      await res.body.dump();
      return { ok: false, error: `HTTP ${res.statusCode}` };
    }
    return { ok: true, body: await res.body.text() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return [value as Record<string, unknown>];
}
function readLoc(entry: Record<string, unknown>): string | null {
  const loc = entry['loc'];
  return typeof loc === 'string' ? loc.trim() : null;
}
function readDate(entry: Record<string, unknown>, key: string): Date | undefined {
  const v = entry[key];
  if (typeof v !== 'string') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function readString(entry: Record<string, unknown>, key: string): string | undefined {
  const v = entry[key];
  return typeof v === 'string' ? v : undefined;
}
function readNumber(entry: Record<string, unknown>, key: string): number | undefined {
  const v = entry[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
