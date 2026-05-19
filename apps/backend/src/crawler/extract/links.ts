import type { CheerioAPI } from 'cheerio';
import { resolveLink, isSameHost } from '../normalize/url';

export type ExtractedLink = {
  href: string;
  text: string;
  rel?: string;
  isNofollow: boolean;
  surroundingText: string;
  position: number;
};

export function extractLinks(
  $: CheerioAPI,
  baseUrl: string,
  allowedHosts: string[],
): { internal: ExtractedLink[]; external: ExtractedLink[] } {
  const internal: ExtractedLink[] = [];
  const external: ExtractedLink[] = [];
  let pos = 0;

  $('a[href]').each((_i, el) => {
    const raw = ($(el).attr('href') ?? '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:')) return;
    const resolved = resolveLink(raw, baseUrl);
    if (!resolved) return;

    const rel = $(el).attr('rel')?.trim();
    const isNofollow = (rel ?? '').toLowerCase().split(/\s+/).includes('nofollow');
    const text = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 200);
    const surroundingText = $(el).parent().text().trim().replace(/\s+/g, ' ').slice(0, 280);

    const link: ExtractedLink = { href: resolved, text, rel, isNofollow, surroundingText, position: pos++ };
    if (isSameHost(resolved, allowedHosts)) internal.push(link);
    else external.push(link);
  });

  return { internal, external };
}
