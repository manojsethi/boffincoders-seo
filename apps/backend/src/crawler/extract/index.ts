import * as cheerio from 'cheerio';
import { extractMetadata, type PageMetadata } from './metadata';
import { extractHeadings, type Heading } from './headings';
import { extractJsonLd, type SchemaExtraction } from './schema';
import { extractLinks, type ExtractedLink } from './links';
import { extractImages, type ExtractedImage } from './images';
import { extractCleanText } from './text';
import { htmlToMarkdown, estimateTokens } from './markdown';

export type Extraction = {
  metadata: PageMetadata;
  h1: string[];
  headings: Heading[];
  schema: SchemaExtraction;
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
  images: ExtractedImage[];
  imageMissingAltCount: number;
  cleanText: string;
  markdown: string;
  wordCount: number;
  listItemCount: number;
  tableCount: number;
  paragraphCount: number;
  tokenEstimate: number;
};

export function extractAll(opts: {
  html: string;
  url: string;
  allowedHosts: string[];
  includeMarkdown?: boolean;
  markdownOverride?: string;
}): Extraction {
  const $ = cheerio.load(opts.html);

  const metadata = extractMetadata($, opts.url);
  const { h1, headings } = extractHeadings($);
  const schema = extractJsonLd($);
  const { internal, external } = extractLinks($, opts.url, opts.allowedHosts);
  const images = extractImages($, opts.url);
  const imageMissingAltCount = images.filter((i) => !i.alt || i.alt.trim().length === 0).length;
  const { cleanText, wordCount } = extractCleanText($);
  const markdown =
    opts.markdownOverride && opts.markdownOverride.trim().length > 0
      ? opts.markdownOverride.trim()
      : opts.includeMarkdown
        ? htmlToMarkdown($.html())
        : '';

  return {
    metadata,
    h1,
    headings,
    schema,
    internalLinks: internal,
    externalLinks: external,
    images,
    imageMissingAltCount,
    cleanText,
    markdown,
    wordCount,
    listItemCount: $('li').length,
    tableCount: $('table').length,
    paragraphCount: $('p').length,
    tokenEstimate: estimateTokens(markdown || cleanText),
  };
}

export * from './metadata';
export * from './headings';
export * from './schema';
export * from './links';
export * from './images';
export * from './text';
export * from './markdown';
