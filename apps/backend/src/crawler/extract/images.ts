import type { CheerioAPI } from 'cheerio';

export type ExtractedImage = { src: string; alt?: string; width?: number; height?: number };

export function extractImages($: CheerioAPI, baseUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  $('img').each((_i, el) => {
    const raw = $(el).attr('src') ?? $(el).attr('data-src') ?? '';
    if (!raw) return;
    const src = absolute(raw, baseUrl);
    const alt = $(el).attr('alt')?.trim();
    const width = parseDim($(el).attr('width'));
    const height = parseDim($(el).attr('height'));
    images.push({ src, alt, width, height });
  });
  return images;
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
function parseDim(v?: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
