import { chromium, type Browser } from 'playwright';
import type { FetchInput, FetchResult, Fetcher } from './types';
import { getLogger } from '../../config/logger';

const log = getLogger('crawler:playwright');

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    browserPromise.catch((err) => {
      log.error({ err }, 'failed to launch chromium');
      browserPromise = null;
    });
  }
  return browserPromise;
}

export async function closePlaywright(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b) await b.close().catch(() => {});
    browserPromise = null;
  }
}

export const playwrightFetcher: Fetcher = {
  name: 'playwright',
  async fetch(input: FetchInput): Promise<FetchResult> {
    const start = Date.now();
    let context;
    let page;
    try {
      const browser = await getBrowser();
      context = await browser.newContext({
        userAgent: input.userAgent,
        viewport: { width: 1280, height: 800 },
      });
      page = await context.newPage();
      const response = await page.goto(input.url, {
        waitUntil: 'domcontentloaded',
        timeout: input.timeoutMs,
      });
      // Allow late JS injections to finish (schema is typically set during hydration).
      await page
        .waitForLoadState('networkidle', { timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(800).catch(() => {});
      const html = await page.content();
      const statusCode = response?.status() ?? 0;
      const finalUrl = response?.url() ?? input.url;
      const headers = response?.headers() ?? {};
      log.info({ url: input.url, ms: Date.now() - start, statusCode }, 'rendered');
      return {
        status: statusCode >= 400 ? 'error' : 'ok',
        statusCode,
        finalUrl,
        html,
        headers,
        fetcher: 'playwright',
      };
    } catch (err) {
      log.warn({ err: (err as Error).message, url: input.url }, 'playwright fetch failed');
      return {
        status: 'error',
        statusCode: 0,
        error: (err as Error).message,
        fetcher: 'playwright',
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  },
};
