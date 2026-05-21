/**
 * Default system rules. Phase 11. Seeded into a project the first time it asks for scope rules.
 *
 * Important: defaults exist so the analyst sees a sensible starting set, not to be silently
 * applied. They are stored with `source: 'system'` and `status: 'approved'` since they are safe
 * exclusions; sampled defaults for `/blog/**` and similar are stored as `status: 'suggested'`
 * so analyst confirms website type first.
 */

import type { PatternType } from './match';

export interface DefaultRule {
  name: string;
  pattern: string;
  patternType: PatternType;
  behavior: 'crawl' | 'sample' | 'exclude' | 'force_include' | 'normalize';
  sampleLimit?: number;
  priority: number;
  groupName: string;
  pageFamily?: string;
  reason: string;
  status: 'approved' | 'suggested';
  normalizeStripParams?: string[];
}

/** Always-exclude noise paths. Pre-approved. */
const ALWAYS_EXCLUDE: DefaultRule[] = [
  { name: 'WordPress JSON API', pattern: '/wp-json/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'wp-json', reason: 'API endpoints — not user-facing content.', status: 'approved' },
  { name: 'WP admin', pattern: '/wp-admin/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'wp-admin', reason: 'CMS admin pages.', status: 'approved' },
  { name: 'Site search', pattern: '/search/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'search', reason: 'Search results — typically thin / noindex.', status: 'approved' },
  { name: 'Feeds', pattern: '/feed/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'feed', reason: 'RSS/Atom feeds — not user-facing pages.', status: 'approved' },
  { name: 'Nested feeds', pattern: '/**/feed/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'feed', reason: 'RSS/Atom feeds — not user-facing pages.', status: 'approved' },
  { name: 'Cart', pattern: '/cart/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'cart', reason: 'Transactional cart pages.', status: 'approved' },
  { name: 'Checkout', pattern: '/checkout/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'checkout', reason: 'Transactional checkout pages.', status: 'approved' },
  { name: 'Account', pattern: '/account/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'account', reason: 'Authenticated user account.', status: 'approved' },
  { name: 'Login', pattern: '/login/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'login', reason: 'Authentication pages.', status: 'approved' },
  { name: 'Admin', pattern: '/admin/**', patternType: 'glob', behavior: 'exclude', priority: 100, groupName: 'admin', reason: 'Admin-only pages.', status: 'approved' },
  { name: 'UTM tracking variants', pattern: '?utm_*', patternType: 'glob', behavior: 'normalize', priority: 90, groupName: 'utm-variants', reason: 'Strip utm_* before dedupe.', status: 'approved', normalizeStripParams: ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id'] },
  { name: 'Google Click ID', pattern: '?gclid=*', patternType: 'glob', behavior: 'normalize', priority: 90, groupName: 'gclid', reason: 'Strip gclid before dedupe.', status: 'approved', normalizeStripParams: ['gclid'] },
  { name: 'Facebook Click ID', pattern: '?fbclid=*', patternType: 'glob', behavior: 'normalize', priority: 90, groupName: 'fbclid', reason: 'Strip fbclid before dedupe.', status: 'approved', normalizeStripParams: ['fbclid'] },
];

/** Heuristic sample defaults. Stored as `suggested` so analyst opts in. */
const SUGGESTED_SAMPLE: DefaultRule[] = [
  { name: 'Blog articles', pattern: '/blog/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'Blog articles', pageFamily: 'article', reason: 'Large repeated article directory. Sample to detect template-level issues without crawling every post.', status: 'suggested' },
  { name: 'News', pattern: '/news/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'News articles', pageFamily: 'article', reason: 'News template — sample to detect repeated issues.', status: 'suggested' },
  { name: 'Case studies', pattern: '/case-studies/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'Case studies', pageFamily: 'case-study', reason: 'Case-study template — sample.', status: 'suggested' },
  { name: 'Testimonials', pattern: '/testimonials/**', patternType: 'glob', behavior: 'sample', sampleLimit: 3, priority: 50, groupName: 'Testimonials', pageFamily: 'testimonial', reason: 'Repeated testimonial pages — sample.', status: 'suggested' },
  { name: 'Resources', pattern: '/resources/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'Resources', pageFamily: 'resource', reason: 'Resource library — sample.', status: 'suggested' },
  { name: 'Events', pattern: '/events/**', patternType: 'glob', behavior: 'sample', sampleLimit: 3, priority: 50, groupName: 'Events', pageFamily: 'event', reason: 'Event detail pages — sample.', status: 'suggested' },
  { name: 'Authors', pattern: '/authors/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'Authors', pageFamily: 'profile', reason: 'Author archive — usually low-value.', status: 'suggested' },
  { name: 'Tag archives', pattern: '/tag/**', patternType: 'glob', behavior: 'exclude', priority: 60, groupName: 'Tag archives', pageFamily: 'tag', reason: 'Tag archive pages — duplicate of canonical content.', status: 'suggested' },
  { name: 'Category archives', pattern: '/category/**', patternType: 'glob', behavior: 'sample', sampleLimit: 5, priority: 50, groupName: 'Category archives', pageFamily: 'collection', reason: 'Category listings — sample.', status: 'suggested' },
];

const ASSET_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'zip', 'css', 'js', 'woff', 'woff2'];

const ASSET_EXCLUDES: DefaultRule[] = ASSET_EXTS.map((ext) => ({
  name: `Asset .${ext}`,
  pattern: `**/*.${ext}`,
  patternType: 'glob',
  behavior: 'exclude',
  priority: 100,
  groupName: `asset-${ext}`,
  reason: `Binary/static asset — not a crawlable HTML page.`,
  status: 'approved',
}));

export function getDefaultScopeRules(): DefaultRule[] {
  return [...ALWAYS_EXCLUDE, ...SUGGESTED_SAMPLE, ...ASSET_EXCLUDES];
}
