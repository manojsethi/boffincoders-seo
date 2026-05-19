import type { CheerioAPI } from 'cheerio';

export type Heading = { level: number; text: string };

export function extractHeadings($: CheerioAPI): { h1: string[]; headings: Heading[] } {
  const headings: Heading[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
    const m = tag.match(/^h([1-6])$/);
    if (!m || !m[1]) return;
    const level = Number(m[1]);
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.push({ level, text });
  });
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);
  return { h1, headings };
}
