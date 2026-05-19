import { request } from 'undici';
import type { FetchInput, FetchResult, Fetcher } from './types';
import { getDispatcher } from '../http';

export const cheerioFetcher: Fetcher = {
  name: 'cheerio',
  async fetch(input: FetchInput): Promise<FetchResult> {
    const headers: Record<string, string> = {
      'user-agent': input.userAgent,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    };
    if (input.conditionalHeaders?.ifNoneMatch) headers['if-none-match'] = input.conditionalHeaders.ifNoneMatch;
    if (input.conditionalHeaders?.ifModifiedSince) headers['if-modified-since'] = input.conditionalHeaders.ifModifiedSince;

    const chain: string[] = [input.url];
    let currentUrl = input.url;
    const maxHops = Math.max(0, input.maxRedirects);

    try {
      for (let hop = 0; hop <= maxHops; hop += 1) {
        const res = await request(currentUrl, {
          method: 'GET',
          headers,
          dispatcher: getDispatcher(),
          bodyTimeout: input.timeoutMs,
          headersTimeout: input.timeoutMs,
        });
        const headerMap = flatHeaders(res.headers);

        if (res.statusCode >= 300 && res.statusCode < 400 && headerMap.location) {
          await res.body.dump();
          if (hop === maxHops) {
            return {
              status: 'error',
              statusCode: res.statusCode,
              headers: headerMap,
              fetcher: 'cheerio',
              error: `Too many redirects (>${maxHops})`,
              redirectChain: chain,
            };
          }
          let nextUrl: string;
          try {
            nextUrl = new URL(headerMap.location, currentUrl).toString();
          } catch {
            return {
              status: 'error',
              statusCode: res.statusCode,
              headers: headerMap,
              fetcher: 'cheerio',
              error: 'Invalid redirect Location header',
              redirectChain: chain,
            };
          }
          if (chain.includes(nextUrl)) {
            return {
              status: 'error',
              statusCode: res.statusCode,
              headers: headerMap,
              fetcher: 'cheerio',
              error: 'Redirect loop',
              redirectChain: [...chain, nextUrl],
            };
          }
          chain.push(nextUrl);
          currentUrl = nextUrl;
          continue;
        }

        if (res.statusCode === 304) {
          await res.body.dump();
          return {
            status: 'not-modified',
            statusCode: 304,
            headers: headerMap,
            fetcher: 'cheerio',
            redirectChain: chain.length > 1 ? chain : undefined,
          };
        }

        if (res.statusCode >= 400) {
          await res.body.dump();
          return {
            status: 'error',
            statusCode: res.statusCode,
            headers: headerMap,
            fetcher: 'cheerio',
            error: `HTTP ${res.statusCode}`,
            redirectChain: chain.length > 1 ? chain : undefined,
          };
        }

        const html = await res.body.text();
        return {
          status: 'ok',
          statusCode: res.statusCode,
          finalUrl: currentUrl,
          html,
          headers: headerMap,
          fetcher: 'cheerio',
          redirectChain: chain.length > 1 ? chain : undefined,
        };
      }
      return {
        status: 'error',
        statusCode: 0,
        fetcher: 'cheerio',
        error: 'Redirect handling exhausted unexpectedly',
        redirectChain: chain,
      };
    } catch (err) {
      return {
        status: 'error',
        statusCode: 0,
        error: err instanceof Error ? err.message : String(err),
        fetcher: 'cheerio',
        redirectChain: chain.length > 1 ? chain : undefined,
      };
    }
  },
};

function flatHeaders(h: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}
