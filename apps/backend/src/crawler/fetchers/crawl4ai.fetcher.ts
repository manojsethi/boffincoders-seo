import { request } from 'undici';
import { getLogger } from '../../config/logger';

const log = getLogger('crawler:crawl4ai');

export type Crawl4AIResult = {
  ok: boolean;
  markdown?: string;
  cleanText?: string;
  html?: string;
  statusCode?: number;
  error?: string;
};

let unavailableUntil = 0;
const COOLDOWN_MS = 60_000;

function pickString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['raw_markdown', 'markdown_with_citations', 'fit_markdown', 'markdown', 'text', 'content']) {
      const v = obj[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return '';
}

export async function crawl4aiHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await request(`${baseUrl}/health`, {
      method: 'GET',
      headersTimeout: 3000,
      bodyTimeout: 3000,
    });
    const ok = res.statusCode === 200;
    await res.body.dump();
    return ok;
  } catch {
    return false;
  }
}

export async function crawl4aiExtract(opts: {
  baseUrl: string;
  url: string;
  timeoutMs?: number;
}): Promise<Crawl4AIResult> {
  if (Date.now() < unavailableUntil) return { ok: false, error: 'crawl4ai in cooldown' };

  try {
    const res = await request(`${opts.baseUrl}/crawl`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ urls: [opts.url], priority: 5 }),
      headersTimeout: opts.timeoutMs ?? 60_000,
      bodyTimeout: opts.timeoutMs ?? 60_000,
    });
    if (res.statusCode !== 200) {
      await res.body.dump();
      unavailableUntil = Date.now() + COOLDOWN_MS;
      return { ok: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` };
    }
    const data = (await res.body.json()) as Record<string, unknown>;
    const results = (data['results'] as Array<Record<string, unknown>>) ?? [];
    const first = results[0];
    if (!first) return { ok: false, error: 'no results' };
    return {
      ok: true,
      markdown: pickString(first['markdown']) || pickString(first['cleaned_html']) || '',
      cleanText: pickString(first['cleaned_text']) || '',
      html: pickString(first['html']),
      statusCode: 200,
    };
  } catch (err) {
    log.warn({ err, url: opts.url }, 'crawl4ai extract failed');
    unavailableUntil = Date.now() + COOLDOWN_MS;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
