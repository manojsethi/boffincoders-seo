export { runCrawl, type CrawlOptions, type CrawlResult } from './orchestrator';
export { normalizeUrl, isSameHost, isSameSite, getOrigin, getPathDepth, resolveLink } from './normalize/url';
export { getRobots, type RobotsHandle } from './discover/robots';
export { discoverFromSitemaps } from './discover/sitemap';
export { cheerioFetcher } from './fetchers/cheerio.fetcher';
export { crawl4aiExtract, crawl4aiHealth } from './fetchers/crawl4ai.fetcher';
export { extractAll, type Extraction } from './extract';
export { guessPageRole, type PageRole } from './page-role';
export { emptyDiagnostics, computeHealth, bumpReason, type Diagnostics } from './diagnostics';
