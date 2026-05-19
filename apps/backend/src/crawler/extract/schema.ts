import type { CheerioAPI } from 'cheerio';

export type SchemaExtraction = {
  blocks: unknown[];
  types: string[];
  parseErrors: string[];
};

export function extractJsonLd($: CheerioAPI): SchemaExtraction {
  const blocks: unknown[] = [];
  const parseErrors: string[] = [];
  const typeSet = new Set<string>();

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        blocks.push(item);
        collectTypes(item, typeSet);
      }
    } catch (err) {
      parseErrors.push((err as Error).message);
    }
  });

  return { blocks, types: [...typeSet], parseErrors };
}

function collectTypes(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const t = obj['@type'];
  if (typeof t === 'string') into.add(t);
  else if (Array.isArray(t)) for (const v of t) if (typeof v === 'string') into.add(v);
  // Walk @graph
  const graph = obj['@graph'];
  if (Array.isArray(graph)) for (const g of graph) collectTypes(g, into);
}

/**
 * Compose schemaSource from raw + rendered presence.
 */
export function deriveSchemaSource(opts: {
  hasRaw: boolean;
  renderedRan: boolean;
  hasRendered: boolean;
}): 'raw-html' | 'rendered-html' | 'both' | 'none' | 'not-verified' {
  if (opts.hasRaw && opts.hasRendered) return 'both';
  if (opts.hasRaw) return 'raw-html';
  if (opts.hasRendered) return 'rendered-html';
  if (opts.renderedRan) return 'none';
  return 'not-verified';
}
