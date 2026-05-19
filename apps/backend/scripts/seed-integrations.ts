import { loadEnv } from '../src/config/env';
import { connectMongo, disconnectMongo } from '../src/db/connect';
import { PageModel, CwvMetricModel, GscRowModel, Ga4RowModel, SiteConnectionModel } from '../src/db';
import { Types } from 'mongoose';

const PROJECT_ID = '6a0709794137001a448ea31c';

async function main(): Promise<void> {
  const env = loadEnv();
  await connectMongo(env.MONGODB_URI);
  const pid = new Types.ObjectId(PROJECT_ID);

  // Mark GSC + GA4 as connected (mock).
  for (const provider of ['gsc', 'ga4'] as const) {
    await SiteConnectionModel.updateOne(
      { projectId: pid, provider },
      {
        $set: {
          projectId: pid,
          provider,
          status: 'connected',
          siteUrl: provider === 'gsc' ? 'https://boffincoders.com/' : undefined,
          ga4PropertyId: provider === 'ga4' ? '0000-mock' : undefined,
          refreshToken: 'mock',
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  // Wipe any prior placeholder queries left from earlier seed runs.
  await GscRowModel.deleteMany({ projectId: pid, query: { $in: ['mock-query', 'mock_query', 'placeholder'] } });

  // Realistic per-page query candidates so opportunity output reads like real client data.
  // Each page gets 2-3 queries with varied position/impression profiles to exercise quick-win,
  // CTR, cannibalization, and content-gap rules.
  const QUERY_POOLS: Record<string, string[]> = {
    home: ['boffincoders', 'boffincoders agency', 'enterprise seo agency'],
    service: ['technical seo audit', 'enterprise seo consulting', 'seo audit services'],
    'content-article': ['core web vitals checklist', 'lcp optimization guide', 'cwv tuning'],
    category: ['seo services', 'digital marketing services', 'growth agency'],
    about: ['boffincoders team', 'about boffincoders'],
    contact: ['boffincoders contact', 'seo agency contact'],
    legal: ['boffincoders privacy policy'],
    documentation: ['seo audit docs', 'audit api docs'],
    utility: ['site search results'],
  };
  const FALLBACK = ['seo audit', 'site optimization', 'organic traffic growth'];

  const pages = await PageModel.find({ projectId: pid }).limit(20).lean();
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 28);
  let gsc = 0, ga4 = 0, cwv = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const role = (p.pageRole as string | undefined) ?? 'utility';
    const pool = QUERY_POOLS[role] ?? FALLBACK;
    // Pick 2-3 queries per page deterministically based on index.
    const queries = pool.slice(0, (i % 3) + 1);
    for (let q = 0; q < queries.length; q++) {
      const query = queries[q]!;
      // Position varies across queries — first query best, drop off after.
      const position = 3 + q * 2 + (i % 5) * 1.3;
      const impressions = Math.max(80, 900 - i * 30 - q * 90);
      const ctr = position > 12 ? 0.006 : 0.05 / position;
      const clicks = Math.floor(impressions * ctr);
      await GscRowModel.updateOne(
        { projectId: pid, pageUrl: p.url!, query, rangeEnd: now },
        {
          $set: {
            projectId: pid,
            pageUrl: p.url!,
            query,
            clicks,
            impressions,
            ctr,
            position,
            rangeStart: start,
            rangeEnd: now,
          },
        },
        { upsert: true },
      );
      gsc++;
    }
    // GA4
    const sessions = 200 - i * 8;
    const engagedSessions = Math.floor(sessions * (0.55 - i * 0.02));
    const conversions = i % 3 === 0 ? 0 : Math.max(0, Math.floor(sessions * 0.02));
    await Ga4RowModel.updateOne(
      { projectId: pid, pagePath: new URL(p.url!).pathname, channel: 'Organic Search', rangeEnd: now },
      {
        $set: {
          projectId: pid,
          pagePath: new URL(p.url!).pathname,
          channel: 'Organic Search',
          sessions,
          engagedSessions,
          engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
          conversions,
          rangeStart: start,
          rangeEnd: now,
        },
      },
      { upsert: true },
    );
    ga4++;
    // CWV — alternate good vs poor
    const isPoor = i % 4 === 0;
    await CwvMetricModel.create({
      projectId: pid,
      pageUrl: p.url!,
      strategy: 'mobile',
      lcp: isPoor ? 4200 : 1900,
      inp: isPoor ? 600 : 150,
      cls: isPoor ? 0.32 : 0.05,
      performanceScore: isPoor ? 35 : 88,
      capturedAt: now,
    });
    cwv++;
  }
  console.log(`Seeded gsc=${gsc} ga4=${ga4} cwv=${cwv}`);
  await disconnectMongo();
}
main().catch(e => { console.error(e); process.exit(1); });
