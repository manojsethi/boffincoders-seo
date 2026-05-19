import type { CheerioAPI } from 'cheerio';

export type PageMetadata = {
  title?: string;
  metaDescription?: string;
  metaRobots?: string;
  canonicalUrl?: string;
  lang?: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
};

export function extractMetadata($: CheerioAPI, baseUrl: string): PageMetadata {
  const og: Record<string, string> = {};
  const tw: Record<string, string> = {};

  $('meta[property]').each((_i, el) => {
    const property = ($(el).attr('property') ?? '').toLowerCase();
    const content = ($(el).attr('content') ?? '').trim();
    if (!property || !content) return;
    if (property.startsWith('og:')) og[property.slice(3)] = content;
  });

  $('meta[name]').each((_i, el) => {
    const name = ($(el).attr('name') ?? '').toLowerCase();
    const content = ($(el).attr('content') ?? '').trim();
    if (!name || !content) return;
    if (name.startsWith('twitter:')) tw[name.slice(8)] = content;
  });

  const title = $('head > title').first().text().trim() || undefined;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || undefined;
  const metaRobots = $('meta[name="robots"]').attr('content')?.trim() || undefined;
  const canonicalHref = $('link[rel="canonical"]').attr('href')?.trim();
  const canonicalUrl = canonicalHref ? resolveAbs(canonicalHref, baseUrl) : undefined;
  const lang = $('html').attr('lang')?.trim() || undefined;

  return { title, metaDescription, metaRobots, canonicalUrl, lang, openGraph: og, twitter: tw };
}

function resolveAbs(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
