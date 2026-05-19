import type { CheerioAPI } from 'cheerio';

const BLOCK_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'nav',
  'footer',
  'header',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
];

export function extractCleanText($: CheerioAPI): { cleanText: string; wordCount: number } {
  const $clone = $.root().clone();
  for (const sel of BLOCK_SELECTORS) $clone.find(sel).remove();
  const main = $clone.find('main, article, [role="main"]').first();
  const target = main.length ? main : $clone.find('body');
  const cleanText = target.text().replace(/\s+/g, ' ').trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  return { cleanText, wordCount };
}
