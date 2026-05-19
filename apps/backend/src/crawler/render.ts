import { Types } from 'mongoose';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { PageModel, RenderRunModel } from '../db';
import { playwrightFetcher } from './fetchers/playwright.fetcher';
import { extractJsonLd, deriveSchemaSource } from './extract/schema';

const DEFAULT_UA = 'BoffinSEO/2.0 (+https://boffincoders.com/seo-bot)';

export type RenderRecrawlResult = {
  pageId: string;
  url: string;
  ok: boolean;
  schemaSource: string;
  renderedSchemaCount: number;
  rawSchemaCount: number;
  parseErrors: string[];
  error?: string;
};

export async function renderRecrawlPages(opts: {
  projectId: string;
  pageIds: string[];
  reason?: string;
  concurrency?: number;
  userAgent?: string;
  timeoutMs?: number;
  /** Optional render-run id; when provided, progress reports back to RenderRunModel. */
  renderRunId?: string;
}): Promise<RenderRecrawlResult[]> {
  const projectId = new Types.ObjectId(opts.projectId);
  const ua = opts.userAgent ?? DEFAULT_UA;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const runObjectId = opts.renderRunId ? new Types.ObjectId(opts.renderRunId) : null;

  const pages = await PageModel.find({
    _id: { $in: opts.pageIds.map((p) => new Types.ObjectId(p)) },
    projectId,
  }).lean();

  let completed = 0;
  let success = 0;
  let failure = 0;
  const reportProgress = async (step: string): Promise<void> => {
    if (!runObjectId) return;
    const pct =
      pages.length === 0 ? 100 : Math.min(99, Math.round((completed / pages.length) * 100));
    await RenderRunModel.updateOne(
      { _id: runObjectId },
      {
        $set: {
          progressPercent: pct,
          currentStep: step,
          completedPages: completed,
          successCount: success,
          failureCount: failure,
          status: 'running',
        },
      },
    );
  };
  if (runObjectId) {
    await RenderRunModel.updateOne(
      { _id: runObjectId },
      {
        $set: {
          status: 'running',
          startedAt: new Date(),
          totalPages: pages.length,
          progressPercent: 0,
          currentStep: 'starting headless chromium',
        },
      },
    );
  }

  const limit = pLimit(concurrency);
  const results = await Promise.all(
    pages.map((p) =>
      limit(async (): Promise<RenderRecrawlResult> => {
        const url = p.url ?? p.normalizedUrl;
        const fetched = await playwrightFetcher.fetch({
          url,
          userAgent: ua,
          timeoutMs,
          maxRedirects: 5,
        });
        const reportPerPage = async (ok: boolean, label: string): Promise<void> => {
          completed += 1;
          if (ok) success += 1;
          else failure += 1;
          await reportProgress(label);
        };
        if (fetched.status !== 'ok' || !fetched.html) {
          // Do NOT set renderedExtractedAt on failure — schema rules treat that as proof rendered ran.
          // Record the failure in renderedRecrawlReason so analysts see the last attempt.
          await PageModel.updateOne(
            { _id: p._id },
            {
              $set: {
                renderedRecrawlReason: `failed:${fetched.error ?? `status-${fetched.statusCode}`}`,
              },
            },
          );
          await reportPerPage(false, `failed ${url}`);
          return {
            pageId: String(p._id),
            url,
            ok: false,
            schemaSource: p.schemaSource ?? 'not-verified',
            renderedSchemaCount: 0,
            rawSchemaCount: (p.rawSchema as unknown[] | undefined)?.length ?? 0,
            parseErrors: [],
            error: fetched.error ?? `status-${fetched.statusCode}`,
          };
        }

        const $ = cheerio.load(fetched.html);
        const rendered = extractJsonLd($);
        const rawCount = (p.rawSchema as unknown[] | undefined)?.length ?? 0;
        const renderedCount = rendered.blocks.length;
        const schemaSource = deriveSchemaSource({
          hasRaw: rawCount > 0,
          renderedRan: true,
          hasRendered: renderedCount > 0,
        });

        const combinedTypes = new Set<string>([
          ...((p.schemaTypes as string[] | undefined) ?? []),
          ...rendered.types,
        ]);

        await PageModel.updateOne(
          { _id: p._id },
          {
            $set: {
              renderedSchema: rendered.blocks,
              schemaSource,
              schemaTypes: [...combinedTypes],
              schemaParseErrors: [
                ...((p.schemaParseErrors as string[] | undefined) ?? []),
                ...rendered.parseErrors,
              ],
              renderedExtractedAt: new Date(),
              renderedRecrawlReason: opts.reason ?? 'analyst-triggered',
            },
          },
        );

        // Rendered HTML evidence lives inside the page.renderedSchema field for now.
        // page_raw collection requires a crawlRunId; render-recrawl is not a crawl run.

        await reportPerPage(true, `rendered ${url}`);
        return {
          pageId: String(p._id),
          url,
          ok: true,
          schemaSource,
          renderedSchemaCount: renderedCount,
          rawSchemaCount: rawCount,
          parseErrors: rendered.parseErrors,
        };
      }),
    ),
  );

  if (runObjectId) {
    await RenderRunModel.updateOne(
      { _id: runObjectId },
      {
        $set: {
          results,
          completedPages: completed,
          successCount: success,
          failureCount: failure,
        },
      },
    );
  }

  return results;
}
