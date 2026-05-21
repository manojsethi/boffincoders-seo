/**
 * Pattern matcher for crawl scope rules. Phase 11.
 *
 * Supports three pattern types:
 *  - glob   — `/blog/**`, `/products/*`, `/foo/*\/bar`, optional `?query` suffix
 *  - prefix — pathname startsWith
 *  - regex  — anchored RegExp against pathname (or full URL if pattern starts with http)
 *
 * Glob semantics:
 *  - `**` matches any number of path segments (including zero)
 *  - `*`  matches anything in one segment (no slashes)
 *  - everything else is literal
 *  - `?utm_*` style: pattern starting with `?` runs against the full query string and treats `*`
 *    as wildcard there too. Useful for "URLs containing utm_*".
 */

export type PatternType = 'glob' | 'prefix' | 'regex';

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function compileGlob(pattern: string): RegExp {
  // Query-only glob: starts with `?` — match any URL whose search string contains the pattern.
  if (pattern.startsWith('?')) {
    const body = pattern.slice(1);
    let re = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i]!;
      if (ch === '*') re += '.*';
      else re += escapeRegex(ch);
    }
    return new RegExp(re);
  }
  // Path glob.
  let re = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === '/' && pattern[i + 1] === '*' && pattern[i + 2] === '*') {
      // `/**` — match 0+ trailing segments. So `/blog/**` matches `/blog`, `/blog/x`, etc.
      re += '(?:/.*)?';
      i += 3;
    } else if (ch === '*' && pattern[i + 1] === '*') {
      // bare `**` (no leading slash) — match anything across slashes
      re += '.*';
      i += 2;
    } else if (ch === '*') {
      // `*` — anything inside one segment
      re += '[^/]*';
      i += 1;
    } else {
      re += escapeRegex(ch);
      i += 1;
    }
  }
  re += '$';
  return new RegExp(re);
}

export interface CompiledPattern {
  test(url: string): boolean;
  pattern: string;
  type: PatternType;
}

export function compilePattern(pattern: string, type: PatternType): CompiledPattern {
  if (type === 'prefix') {
    return {
      pattern,
      type,
      test: (url) => {
        const path = pathOf(url);
        return path !== null && path.startsWith(pattern);
      },
    };
  }
  if (type === 'regex') {
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      // Bad regex — never matches; caller should validate at save time.
      return { pattern, type, test: () => false };
    }
    return {
      pattern,
      type,
      test: (url) => {
        if (pattern.startsWith('^http')) return re.test(url);
        const path = pathOf(url);
        if (path === null) return false;
        return re.test(path);
      },
    };
  }
  // glob
  const re = compileGlob(pattern);
  const queryOnly = pattern.startsWith('?');
  return {
    pattern,
    type,
    test: (url) => {
      if (queryOnly) {
        const search = searchOf(url);
        return search !== null && re.test(search);
      }
      const path = pathOf(url);
      if (path === null) return false;
      return re.test(path);
    },
  };
}

function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    // Treat as already-a-path
    if (url.startsWith('/')) return url;
    return null;
  }
}

function searchOf(url: string): string | null {
  try {
    return new URL(url).search;
  } catch {
    return null;
  }
}

/**
 * Heuristic path-grouping: collapse numeric/date/slug-ish path segments to wildcards and return
 * a `/blog/**` style pattern + a friendly group name.
 *
 * Examples:
 *   /blog/seo-tips-2024     → /blog/**         "Blog"
 *   /blog/category/seo      → /blog/category/* "Blog Category"
 *   /products/12345         → /products/**     "Products"
 *   /                       → /                "Homepage"
 */
export function inferGroupFromPath(pathname: string): {
  pattern: string;
  name: string;
  pageFamily: string;
} {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return { pattern: '/', name: 'Homepage', pageFamily: 'home' };
  // Single-segment URLs collapse to the segment itself rather than a wildcard so service pages
  // ("/about", "/contact") don't get merged into one bucket.
  if (segs.length === 1) {
    return {
      pattern: '/' + segs[0],
      name: prettyName(segs[0]!),
      pageFamily: classifyFamily(segs[0]!),
    };
  }
  const first = segs[0]!;
  return {
    pattern: `/${first}/**`,
    name: `${prettyName(first)} (${first})`,
    pageFamily: classifyFamily(first),
  };
}

function prettyName(seg: string): string {
  return seg
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function classifyFamily(seg: string): string {
  const s = seg.toLowerCase();
  if (/^(blog|news|articles?|posts?)$/.test(s)) return 'article';
  if (/^(case-?studies?|stories|portfolio)$/.test(s)) return 'case-study';
  if (/^(products?|shop|store)$/.test(s)) return 'product';
  if (/^(collections?|categor(y|ies))$/.test(s)) return 'collection';
  if (/^(services?|solutions?)$/.test(s)) return 'service';
  if (/^(locations?|stores?|branch(es)?)$/.test(s)) return 'location';
  if (/^(events?|webinars?)$/.test(s)) return 'event';
  if (/^(authors?|team|staff|faculty)$/.test(s)) return 'profile';
  if (/^(courses?|programs?|degrees?)$/.test(s)) return 'course';
  if (/^(campaigns?|donate)$/.test(s)) return 'campaign';
  if (/^(testimonials?|reviews?)$/.test(s)) return 'testimonial';
  if (/^(resources?|guides?|docs?)$/.test(s)) return 'resource';
  if (/^(tags?|labels?)$/.test(s)) return 'tag';
  return 'unknown';
}
