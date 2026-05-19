import TurndownService from 'turndown';

let svc: TurndownService | null = null;

function getService(): TurndownService {
  if (svc) return svc;
  svc = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
  });
  svc.remove(['script', 'style', 'noscript', 'iframe', 'svg']);
  return svc;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return getService().turndown(html).trim();
  } catch {
    return '';
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
