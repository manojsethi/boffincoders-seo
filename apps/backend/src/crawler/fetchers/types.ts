export type FetchInput = {
  url: string;
  userAgent: string;
  timeoutMs: number;
  maxRedirects: number;
  conditionalHeaders?: { ifNoneMatch?: string; ifModifiedSince?: string };
};

export type FetchResult = {
  status: 'ok' | 'not-modified' | 'error';
  statusCode: number;
  finalUrl?: string;
  html?: string;
  headers?: Record<string, string>;
  error?: string;
  fetcher: 'cheerio' | 'playwright' | 'crawl4ai';
  redirectChain?: string[];
};

export interface Fetcher {
  name: 'cheerio' | 'playwright' | 'crawl4ai';
  fetch(input: FetchInput): Promise<FetchResult>;
}
