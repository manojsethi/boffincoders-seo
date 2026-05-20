// Page-level content analysis. Doc continuation §"Phase 3" + recommendation-engine §06.
// Deterministic-first. Aggregates existing data: page metadata, content markdown, mapped keywords,
// keyword-fit verdicts, active audit issues, schema status, internal links. No AI.

import { Types } from 'mongoose';
import {
  PageModel,
  PageContentModel,
  KeywordModel,
  KeywordFitModel,
  IssueModel,
  RecommendationModel,
  ProjectModel,
} from '../db';
import { ACTIVE_LIFECYCLE_STATUSES } from '../audit/lifecycle';

export type PageVerdict =
  | 'healthy'
  | 'minor_update'
  | 'must_improve'
  | 'wrong_target'
  | 'needs_rewrite'
  | 'merge_or_prune'
  | 'monitor';

export async function analyzePageContent(opts: { projectId: string; pageId: string }): Promise<{
  pageId: string;
  url?: string;
  pageRole?: string | null;
  purpose: { summary: string; ctaIntent: string; confidence: number };
  keywordFits: Array<{
    id: string;
    keyword: string;
    intent: string;
    verdict: string;
    confidence: number;
    rootCauseSummary: string;
    impressions: number;
    clicks: number;
    position: number;
    rankingUrl?: string;
    recommendedActions: string[];
  }>;
  missingSections: string[];
  trustProof: { hasAuthor: boolean; hasTestimonial: boolean; hasCaseStudy: boolean; notes: string[] };
  cta: { detected: boolean; clarity: 'strong' | 'weak' | 'unknown'; notes: string[] };
  internalLinks: { incoming: number; outgoing: number; weak: boolean };
  schema: { types: string[]; status: string };
  contentDepth: { wordCount: number; verdict: 'thin' | 'short' | 'reasonable' | 'deep' };
  activeIssues: Array<{ id: string; title: string; severity: string; ruleId: string }>;
  recommendations: Array<{ id: string; title: string; status: string; priorityScore: number }>;
  verdict: PageVerdict;
  reasoning: string[];
  dataGaps: string[];
}> {
  const pid = new Types.ObjectId(opts.projectId);
  const pageId = new Types.ObjectId(opts.pageId);

  const [page, content, project] = await Promise.all([
    PageModel.findOne({ _id: pageId, projectId: pid }).lean(),
    PageContentModel.findOne({ projectId: pid, pageId })
      .sort({ createdAt: -1 })
      .lean(),
    ProjectModel.findById(pid).select({ primaryDomain: 1 }).lean(),
  ]);
  if (!page) throw new Error('Page not found');

  const mappedKeywords = await KeywordModel.find({ projectId: pid, mappedPageId: pageId }).lean();
  const kwIds = mappedKeywords.map((k) => k._id);
  const fits = kwIds.length
    ? await KeywordFitModel.find({ projectId: pid, keywordId: { $in: kwIds } }).lean()
    : [];
  const fitByKw = new Map(fits.map((f) => [String(f.keywordId), f]));

  const issues = await IssueModel.find({
    projectId: pid,
    pageId,
    lifecycleStatus: { $in: ACTIVE_LIFECYCLE_STATUSES },
  })
    .select({ _id: 1, title: 1, severity: 1, ruleId: 1, category: 1 })
    .lean();

  const recs = await RecommendationModel.find({ projectId: pid, pageIds: pageId })
    .select({ _id: 1, title: 1, status: 1, priorityScore: 1 })
    .sort({ priorityScore: -1 })
    .limit(20)
    .lean();

  const cleanText = ((content?.cleanText ?? content?.markdown ?? '') as string).toLowerCase();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  // ---- Purpose inference (heuristic, no AI) ----
  const role = (page.pageRole as string | undefined) ?? null;
  const purpose = inferPurpose(role, page.title ?? undefined, page.h1 ?? undefined, mappedKeywords.map((k) => k.intent ?? 'unknown'));

  // ---- Missing sections by role ----
  const headings = (page.headings as Array<{ level: number; text: string }> | undefined) ?? [];
  const headingTexts = headings.map((h) => (h.text ?? '').toLowerCase());
  const has = (...needles: string[]): boolean =>
    needles.some((n) => headingTexts.some((h) => h.includes(n)) || cleanText.includes(n));
  const missing: string[] = [];
  if (role === 'service' || role === 'category') {
    if (!has('pricing', 'plan', 'package', 'cost', 'rate')) missing.push('Pricing / plans');
    if (!has('process', 'how it works', 'methodology')) missing.push('How it works / process');
    if (!has('faq', 'frequently asked')) missing.push('FAQ section');
    if (!has('case study', 'success story', 'client', 'portfolio')) missing.push('Proof / case studies');
    if (!has('contact', 'book', 'consultation', 'demo')) missing.push('Clear conversion CTA');
  } else if (role === 'content-article' || role === 'blog') {
    if (!has('faq', 'frequently asked')) missing.push('FAQ block (good for SERP visibility)');
    if (!has('author', 'reviewed by', 'updated')) missing.push('Author / last-updated byline');
    if (!has('summary', 'tldr', 'overview')) missing.push('TL;DR / summary');
  } else if (role === 'home') {
    if (!has('what we do', 'services', 'product')) missing.push('What we do / services');
    if (!has('testimonial', 'trusted', 'client')) missing.push('Trust block / testimonials');
    if (!has('contact')) missing.push('Clear contact path');
  } else if (role === 'contact') {
    if (!has('email', '@')) missing.push('Email address');
    if (!has('phone', 'tel:')) missing.push('Phone number');
    if (!has('address', 'office')) missing.push('Physical address (if applicable)');
  }
  if (wordCount > 0 && wordCount < 300 && role !== 'contact' && role !== 'legal') {
    missing.push('Body content is thin — expand to cover the topic in depth');
  }

  // ---- Trust + proof ----
  const trustProof = {
    hasAuthor: /\bauthor\b|written by|reviewed by/i.test(cleanText),
    hasTestimonial: /testimonial|quote|"|review/i.test(cleanText) || has('testimonial', 'reviews'),
    hasCaseStudy: has('case study', 'success story', 'results'),
    notes: [] as string[],
  };
  if (!trustProof.hasAuthor && (role === 'content-article' || role === 'blog')) {
    trustProof.notes.push('No author byline detected on article content — E-E-A-T gap.');
  }
  if (!trustProof.hasTestimonial && (role === 'service' || role === 'home')) {
    trustProof.notes.push('No testimonial / proof block detected for a commercial page.');
  }

  // ---- CTA fit ----
  const ctaHints = ['contact', 'book', 'schedule', 'demo', 'free trial', 'sign up', 'get started', 'donate', 'apply', 'enroll', 'subscribe'];
  const ctaHits = ctaHints.filter((h) => cleanText.includes(h)).length;
  const cta = {
    detected: ctaHits > 0,
    clarity: (ctaHits >= 2 ? 'strong' : ctaHits === 1 ? 'weak' : 'unknown') as 'strong' | 'weak' | 'unknown',
    notes: [] as string[],
  };
  if ((role === 'service' || role === 'home' || role === 'category') && cta.clarity !== 'strong') {
    cta.notes.push('Commercial-intent page should have a clear, repeated CTA.');
  }

  // ---- Internal links ----
  const incoming = (page.internalLinksIn as number | undefined) ?? 0;
  const outgoingArr = page.internalLinksOut as unknown[] | undefined;
  const outgoing = Array.isArray(outgoingArr) ? outgoingArr.length : 0;
  const internalLinks = {
    incoming,
    outgoing,
    weak: page.isImportant ? incoming < 3 : false,
  };

  // ---- Schema ----
  const schema = {
    types: (page.schemaTypes as string[] | undefined) ?? [],
    status: (page.schemaSource as string | undefined) ?? 'not-verified',
  };

  // ---- Depth verdict ----
  const depthVerdict: 'thin' | 'short' | 'reasonable' | 'deep' =
    wordCount === 0 ? 'thin' : wordCount < 250 ? 'thin' : wordCount < 600 ? 'short' : wordCount < 1500 ? 'reasonable' : 'deep';

  // ---- Page-level verdict (priority order) ----
  const reasoning: string[] = [];
  const fitVerdicts = fits.map((f) => f.verdict as string);
  let verdict: PageVerdict = 'monitor';

  if (mappedKeywords.length === 0) {
    reasoning.push('No mapped keywords — purpose only inferred from role and content.');
    if (page.isImportant) {
      verdict = 'must_improve';
      reasoning.push('Important page with no mapped keywords — assign target keywords.');
    } else {
      verdict = 'monitor';
    }
  } else if (fitVerdicts.includes('cannibalized') || fitVerdicts.includes('wrong_page_ranking')) {
    verdict = 'wrong_target';
    reasoning.push('Mapped keywords show competing or wrong-page ranking signals.');
  } else if (fitVerdicts.includes('must_improve') || depthVerdict === 'thin' || missing.length >= 4) {
    verdict = 'must_improve';
    reasoning.push('Content gaps + weak keyword fit on a mapped target.');
  } else if (missing.length > 0 || fitVerdicts.includes('needs_minor_update')) {
    verdict = 'minor_update';
    reasoning.push('Mostly aligned — small content/structure fixes will lift performance.');
  } else if (fitVerdicts.every((v) => v === 'good_fit')) {
    verdict = 'healthy';
    reasoning.push('All mapped keywords show good fit and the content has the required sections.');
  } else if (fitVerdicts.every((v) => v === 'monitor')) {
    verdict = 'monitor';
    reasoning.push('Not enough evidence yet — monitor before acting.');
  }

  const dataGaps: string[] = [];
  if (!content) dataGaps.push('No markdown content captured — re-crawl with content extraction enabled.');
  if (kwIds.length > 0 && fits.length < kwIds.length) {
    dataGaps.push('Some mapped keywords have not been analyzed yet — run keyword-fit recompute.');
  }
  if (!project) dataGaps.push('Project profile missing.');

  return {
    pageId: String(page._id),
    url: page.url,
    pageRole: role,
    purpose,
    keywordFits: mappedKeywords.map((k) => {
      const f = fitByKw.get(String(k._id));
      return {
        id: String(k._id),
        keyword: k.keyword,
        intent: k.intent ?? 'unknown',
        verdict: f?.verdict ?? 'monitor',
        confidence: f?.confidence ?? 0.5,
        rootCauseSummary: f?.rootCauseSummary ?? '',
        impressions: f?.impressions ?? k.impressions ?? 0,
        clicks: f?.clicks ?? k.clicks ?? 0,
        position: f?.position ?? k.position ?? 0,
        rankingUrl: f?.rankingUrl ?? k.rankingUrl ?? undefined,
        recommendedActions: f?.recommendedActions ?? [],
      };
    }),
    missingSections: missing,
    trustProof,
    cta,
    internalLinks,
    schema,
    contentDepth: { wordCount, verdict: depthVerdict },
    activeIssues: issues.map((i) => ({
      id: String(i._id),
      title: i.title,
      severity: i.severity,
      ruleId: i.ruleId,
    })),
    recommendations: recs.map((r) => ({
      id: String(r._id),
      title: r.title,
      status: r.status as string,
      priorityScore: r.priorityScore ?? 0,
    })),
    verdict,
    reasoning,
    dataGaps,
  };
}

function inferPurpose(
  role: string | null,
  title?: string,
  h1?: string,
  intents: string[] = [],
): { summary: string; ctaIntent: string; confidence: number } {
  const focus = (h1 ?? title ?? '').slice(0, 100);
  const dominant = intents.length > 0 ? mode(intents) : 'unknown';
  let summary = focus || 'Untitled page';
  let ctaIntent = 'unknown';
  switch (role) {
    case 'home':
      ctaIntent = dominant === 'unknown' ? 'brand-introduction' : dominant;
      summary = `Home / brand introduction: ${focus}`;
      break;
    case 'service':
      ctaIntent = 'commercial';
      summary = `Service / commercial offer: ${focus}`;
      break;
    case 'category':
      ctaIntent = 'commercial';
      summary = `Category / hub: ${focus}`;
      break;
    case 'content-article':
    case 'blog':
      ctaIntent = dominant === 'unknown' ? 'informational' : dominant;
      summary = `Article: ${focus}`;
      break;
    case 'contact':
      ctaIntent = 'transactional';
      summary = `Contact / conversion: ${focus}`;
      break;
    case 'about':
      ctaIntent = 'brand-trust';
      summary = `About / company trust signal`;
      break;
    case 'legal':
      ctaIntent = 'compliance';
      summary = `Legal / compliance page`;
      break;
    default:
      summary = focus || 'Unknown page role';
  }
  return { summary, ctaIntent, confidence: role ? 0.7 : 0.4 };
}

function mode(xs: string[]): string {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let top = xs[0] ?? 'unknown';
  let best = 0;
  for (const [k, v] of counts) {
    if (v > best) {
      top = k;
      best = v;
    }
  }
  return top;
}
