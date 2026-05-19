import { request } from 'undici';
import robotsParserModule from 'robots-parser';
import { RobotsCacheModel } from '../../db';
import { getLogger } from '../../config/logger';
import { getOrigin } from '../normalize/url';
import { getDispatcher } from '../http';

const robotsParser = robotsParserModule as unknown as (
  url: string,
  content: string,
) => {
  isAllowed: (url: string, ua: string) => boolean | undefined;
  getCrawlDelay: (ua: string) => number | undefined;
  getSitemaps: () => string[];
};

const log = getLogger('crawler:robots');
const TTL_MS = 24 * 60 * 60 * 1000;

export type RobotsHandle = {
  isAllowed(url: string, ua: string): boolean;
  crawlDelay(ua: string): number | undefined;
  sitemaps(): string[];
  statusCode: number;
};

export async function getRobots(seedUrl: string, userAgent: string): Promise<RobotsHandle | null> {
  const origin = getOrigin(seedUrl);
  if (!origin) return null;
  const host = new URL(origin).hostname.toLowerCase();
  const robotsUrl = `${origin}/robots.txt`;

  const cached = await RobotsCacheModel.findOne({ host }).lean();
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt.getTime() < TTL_MS) {
    return wrap(robotsUrl, cached.robotsTxt ?? '', cached.statusCode ?? 0);
  }

  let body = '';
  let statusCode = 0;
  try {
    const res = await request(robotsUrl, {
      method: 'GET',
      headers: { 'user-agent': userAgent, accept: 'text/plain,*/*' },
      dispatcher: getDispatcher(),
      bodyTimeout: 10_000,
      headersTimeout: 10_000,
    });
    statusCode = res.statusCode;
    if (statusCode === 200) body = await res.body.text();
    else await res.body.dump();
  } catch (err) {
    log.warn({ err, host }, 'robots.txt fetch failed');
  }

  const parsed = wrap(robotsUrl, body, statusCode);
  await RobotsCacheModel.findOneAndUpdate(
    { host },
    { $set: { host, robotsTxt: body, sitemaps: parsed.sitemaps(), statusCode, fetchedAt: new Date() } },
    { upsert: true },
  );
  return parsed;
}

function wrap(robotsUrl: string, content: string, statusCode: number): RobotsHandle {
  const parser = robotsParser(robotsUrl, content);
  return {
    statusCode,
    isAllowed(url, ua) {
      try {
        return parser.isAllowed(url, ua) !== false;
      } catch {
        return true;
      }
    },
    crawlDelay(ua) {
      try {
        const d = parser.getCrawlDelay(ua);
        return typeof d === 'number' ? d : undefined;
      } catch {
        return undefined;
      }
    },
    sitemaps() {
      try {
        return parser.getSitemaps() ?? [];
      } catch {
        return [];
      }
    },
  };
}
