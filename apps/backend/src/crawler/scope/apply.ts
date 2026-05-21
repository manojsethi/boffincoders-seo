import type { Types } from 'mongoose';
import { compilePattern, inferGroupFromPath, type CompiledPattern, type PatternType } from './match';

/**
 * Apply approved scope rules to a candidate URL. Phase 11.
 *
 * Priority resolution:
 *  - rules with higher `priority` number win
 *  - within same priority, `force_include` > `exclude` > `sample` > `crawl` > `normalize`
 *  - `force_include` overrides any matching `exclude` or `sample` (analyst-pinned URLs always
 *    enter the queue unless robots blocks them)
 *  - `normalize` only applies to URL normalization, not to the crawl decision — multiple rules
 *    may set normalize on the same URL
 */

export type Behavior = 'crawl' | 'sample' | 'exclude' | 'force_include' | 'normalize';

export interface ScopeRuleLite {
  id: string;
  name: string;
  pattern: string;
  patternType: PatternType;
  behavior: Behavior;
  sampleLimit: number;
  priority: number;
  groupName: string;
  pageFamily: string;
  reason: string;
  status: string;
  source: string;
  confidence: number;
  normalizeStripParams: string[];
}

export interface RuleDecision {
  behavior: Behavior;
  rule: ScopeRuleLite;
  group: string;
  reason: string;
}

const BEHAVIOR_RANK: Record<Behavior, number> = {
  force_include: 4,
  exclude: 3,
  sample: 2,
  crawl: 1,
  normalize: 0,
};

export class ScopeMatcher {
  private compiled: Array<{ rule: ScopeRuleLite; compiled: CompiledPattern }>;
  private defaultBehavior: 'crawl' | 'sample';

  constructor(
    rules: ScopeRuleLite[],
    defaultBehavior: 'crawl' | 'sample' = 'crawl',
  ) {
    this.compiled = rules
      // Only approved rules are honored at crawl time. Suggested/rejected/disabled rules are
      // visible in the UI but never affect the queue.
      .filter((r) => r.status === 'approved')
      .map((rule) => ({ rule, compiled: compilePattern(rule.pattern, rule.patternType) }));
    this.defaultBehavior = defaultBehavior;
  }

  /**
   * Return the winning decision for `url`, or null if no rule matches (caller should use the
   * project's `defaultBehavior`).
   */
  decide(url: string): RuleDecision | null {
    let winner: { rule: ScopeRuleLite; compiled: CompiledPattern } | null = null;
    for (const c of this.compiled) {
      if (c.rule.behavior === 'normalize') continue; // handled separately
      if (!c.compiled.test(url)) continue;
      if (!winner) {
        winner = c;
        continue;
      }
      if (c.rule.priority > winner.rule.priority) {
        winner = c;
        continue;
      }
      if (c.rule.priority === winner.rule.priority) {
        if (BEHAVIOR_RANK[c.rule.behavior] > BEHAVIOR_RANK[winner.rule.behavior]) {
          winner = c;
        }
      }
    }
    if (!winner) return null;
    return {
      behavior: winner.rule.behavior,
      rule: winner.rule,
      group: winner.rule.groupName || winner.rule.name,
      reason: winner.rule.reason,
    };
  }

  /** Decide many URLs at once. Includes a fallback to default behavior. */
  decideAll(
    urls: string[],
  ): Map<
    string,
    | { kind: 'matched'; decision: RuleDecision }
    | { kind: 'default'; behavior: 'crawl' | 'sample' }
  > {
    const out = new Map<
      string,
      | { kind: 'matched'; decision: RuleDecision }
      | { kind: 'default'; behavior: 'crawl' | 'sample' }
    >();
    for (const url of urls) {
      const d = this.decide(url);
      if (d) out.set(url, { kind: 'matched', decision: d });
      else out.set(url, { kind: 'default', behavior: this.defaultBehavior });
    }
    return out;
  }

  /** Return the set of normalize rules whose pattern matches the URL. */
  normalizeMatches(url: string): ScopeRuleLite[] {
    const out: ScopeRuleLite[] = [];
    for (const c of this.compiled) {
      if (c.rule.behavior !== 'normalize') continue;
      if (c.compiled.test(url)) out.push(c.rule);
    }
    return out;
  }
}

/**
 * Group candidates by the winning rule (or by heuristic if no rule matches). Used to pick which
 * URLs feed the sample selector.
 */
export type CandidateSource = 'seed' | 'sitemap' | 'homepage-link' | 'gsc' | 'link' | 'analyst';

export interface CandidateWithDecision {
  url: string;
  normalizedUrl: string;
  source: CandidateSource;
  decision:
    | { kind: 'matched'; decision: RuleDecision }
    | { kind: 'default'; behavior: 'crawl' | 'sample' };
  sitemapLastmod?: Date | null;
}

export function groupByRule(
  candidates: CandidateWithDecision[],
): Map<string, { rule?: ScopeRuleLite; urls: CandidateWithDecision[]; behavior: Behavior }> {
  const map = new Map<string, { rule?: ScopeRuleLite; urls: CandidateWithDecision[]; behavior: Behavior }>();
  for (const c of candidates) {
    let key: string;
    let rule: ScopeRuleLite | undefined;
    let behavior: Behavior;
    if (c.decision.kind === 'matched') {
      rule = c.decision.decision.rule;
      key = `rule:${rule.id}`;
      behavior = rule.behavior;
    } else {
      // No rule matched — bucket by heuristic-inferred pattern so each top-level path becomes
      // its own group. Without this every default URL would collapse into a single bucket.
      let path = '/';
      try {
        path = new URL(c.normalizedUrl).pathname;
      } catch {
        /* keep '/' */
      }
      const heur = inferGroupFromPath(path);
      key = `default:${c.decision.behavior}:${heur.pattern}`;
      behavior = c.decision.behavior;
    }
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { rule, urls: [], behavior };
      map.set(key, bucket);
    }
    bucket.urls.push(c);
  }
  return map;
}

/**
 * Sample selector. Doc 11 §"Sampling Strategy" — pick up to `limit` representative URLs from a
 * group, preferring newest/oldest/most-internally-linked/top-GSC/random rather than just first-N.
 */
export interface SampleSignals {
  gscTopUrls?: Set<string>;
  internalLinkScore?: Map<string, number>;
}

export function selectSamples(
  candidates: CandidateWithDecision[],
  limit: number,
  signals: SampleSignals = {},
): Array<{ url: string; reason: string }> {
  if (candidates.length === 0 || limit <= 0) return [];
  if (candidates.length <= limit) {
    return candidates.map((c, i) => ({ url: c.normalizedUrl, reason: i === 0 ? 'only-candidate' : 'small-group' }));
  }
  const picked = new Map<string, string>(); // url → reason

  const withLastmod = candidates.filter((c) => c.sitemapLastmod);
  const byLastmodDesc = [...withLastmod].sort(
    (a, b) => (b.sitemapLastmod?.getTime() ?? 0) - (a.sitemapLastmod?.getTime() ?? 0),
  );
  const byLastmodAsc = [...withLastmod].sort(
    (a, b) => (a.sitemapLastmod?.getTime() ?? 0) - (b.sitemapLastmod?.getTime() ?? 0),
  );

  const tryPick = (c: CandidateWithDecision | undefined, reason: string): void => {
    if (!c) return;
    if (picked.has(c.normalizedUrl)) return;
    if (picked.size >= limit) return;
    picked.set(c.normalizedUrl, reason);
  };

  // 1. newest by sitemap lastmod
  tryPick(byLastmodDesc[0], 'newest-in-group');
  // 2. oldest by sitemap lastmod
  tryPick(byLastmodAsc[0], 'oldest-in-group');
  // 3. top GSC clicks if available
  if (signals.gscTopUrls && signals.gscTopUrls.size > 0) {
    const c = candidates.find((x) => signals.gscTopUrls!.has(x.normalizedUrl));
    tryPick(c, 'top-gsc-page');
  }
  // 4. top internal link target if scored
  if (signals.internalLinkScore && signals.internalLinkScore.size > 0) {
    const sorted = [...candidates].sort((a, b) => {
      const sa = signals.internalLinkScore!.get(a.normalizedUrl) ?? 0;
      const sb = signals.internalLinkScore!.get(b.normalizedUrl) ?? 0;
      return sb - sa;
    });
    tryPick(sorted[0], 'top-internal-link');
  }
  // 5. first by source order (sitemap first, then homepage-link, then other)
  tryPick(candidates[0], 'first-discovered');
  // 6. random-ish from the middle
  if (candidates.length > 2) {
    const mid = Math.floor(candidates.length / 2);
    tryPick(candidates[mid], 'middle-of-group');
  }
  // Fill remaining with deterministic spread.
  let i = 0;
  const step = Math.max(1, Math.floor(candidates.length / limit));
  while (picked.size < limit && i < candidates.length) {
    tryPick(candidates[i], 'spread-sample');
    i += step;
  }
  return [...picked.entries()].map(([url, reason]) => ({ url, reason }));
}

/** Helper: shape Mongo lean rule documents into the lite struct above. */
export function toScopeRuleLite(r: Record<string, unknown>): ScopeRuleLite {
  return {
    id: String((r as { _id: Types.ObjectId })._id),
    name: String(r.name ?? ''),
    pattern: String(r.pattern ?? ''),
    patternType: ((r.patternType as PatternType) ?? 'glob'),
    behavior: ((r.behavior as Behavior) ?? 'crawl'),
    sampleLimit: Number(r.sampleLimit ?? 5),
    priority: Number(r.priority ?? 50),
    groupName: String(r.groupName ?? ''),
    pageFamily: String(r.pageFamily ?? ''),
    reason: String(r.reason ?? ''),
    status: String(r.status ?? 'approved'),
    source: String(r.source ?? 'system'),
    confidence: Number(r.confidence ?? 0.8),
    normalizeStripParams: (r.normalizeStripParams as string[] | undefined) ?? [],
  };
}
