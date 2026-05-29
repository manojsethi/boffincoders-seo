// Centralized prompt builders for every AI task. Refactor 2026-05-28.
//
// Each exported function returns `{ system, user }` consumed by the task service. Schemas
// live alongside their `registerTask()` call in `tasks/index.ts`; this file holds the prompt
// strings only so prompt tuning is one-file.
//
// For each prompt we document:
//   - task key
//   - purpose
//   - expected output shape
//   - safety rule
//
// Prompt template versions stay attached to the task definition (so AiTaskRun audit rows can
// trace which version produced any given output) — when a prompt here changes meaningfully
// the matching `promptTemplateVersion` on the task in `tasks/index.ts` must be bumped.

export interface PromptOutput {
  system: string;
  user: string;
}

// ---------- 1. summarize-page ----------
// Purpose: 2-3 sentence factual page summary for analyst review.
// Output: { summary, topics[], audience, confidence }.
// Safety: factual only; no invented brands/people; analyst-review required.
export function summarizePagePrompt(p: {
  title?: string;
  h1?: string;
  url?: string;
  markdown: string;
}): PromptOutput {
  return {
    system:
      'You are an SEO analyst assistant. Reply ONLY with valid JSON. Be factual. Do not invent details that are not in the input. Never reference a brand or person not in the input.',
    user: `Summarize this page in 2-3 sentences. Output JSON:
{
  "summary": "...",
  "topics": ["..."],
  "audience": "...",
  "confidence": 0.0-1.0
}

Page URL: ${p.url ?? '(unknown)'}
Title: ${p.title ?? '(none)'}
H1: ${p.h1 ?? '(none)'}

Content:
${p.markdown}`,
  };
}

// ---------- 2. classify-search-intent ----------
// Purpose: keyword intent classification.
// Output: { intent, funnelStage, reasoning, confidence }.
// Safety: use only provided context; analyst decides whether to apply.
export function classifySearchIntentPrompt(p: {
  keyword: string;
  siteCategory?: string;
  rankingUrl?: string;
}): PromptOutput {
  return {
    system:
      'You are an SEO analyst assistant. Reply ONLY with valid JSON. Use the keyword + provided context; do not assume website knowledge.',
    user: `Classify this search query's intent. Output JSON:
{
  "intent": "informational | commercial | transactional | navigational | local | support",
  "funnelStage": "TOFU | MOFU | BOFU | retention",
  "reasoning": "...",
  "confidence": 0.0-1.0
}

Keyword: ${p.keyword}
Site category: ${p.siteCategory ?? '(unknown)'}
Currently ranking URL: ${p.rankingUrl ?? '(none)'}`,
  };
}

// ---------- 3. suggest-missing-sections ----------
// Purpose: structural section suggestions for a page; augments deterministic content-fit gaps.
// Output: { sections[{name,why}], confidence }.
// Safety: structural only, no invented company facts.
export function suggestMissingSectionsPrompt(p: {
  role?: string;
  title?: string;
  h1?: string;
  targetKeywords?: string[];
  existingHeadings?: string[];
  markdown: string;
}): PromptOutput {
  return {
    system:
      'You are an SEO content strategist. Reply ONLY with valid JSON. Do not invent facts about the company; suggest only structural sections.',
    user: `Given this page, list sections that are missing for strong SEO performance against the target keywords. Output JSON:
{
  "sections": [{"name":"...","why":"..."}],
  "confidence": 0.0-1.0
}

Page role: ${p.role ?? '(unknown)'}
Title: ${p.title ?? '(none)'}
H1: ${p.h1 ?? '(none)'}
Target keywords: ${(p.targetKeywords ?? []).join(', ') || '(none)'}
Existing headings: ${(p.existingHeadings ?? []).join(' | ') || '(none)'}

Excerpt:
${p.markdown}`,
  };
}

// ---------- 4. rewrite-recommendation ----------
// Purpose: reword recommendation for analyst or client audience.
// Output: { title, rootCauseSummary, recommendedAction, whyItMatters, confidence }.
// Safety: keep meaning identical, no new facts.
export function rewriteRecommendationPrompt(p: {
  audience: 'analyst' | 'client';
  title: string;
  rootCauseSummary: string;
  recommendedAction: string;
  whyItMatters: string;
}): PromptOutput {
  return {
    system:
      'You rewrite SEO recommendations in clearer language. Reply ONLY with valid JSON. Keep meaning identical; do not add new facts. Match the requested audience tone.',
    user: `Rewrite the following recommendation for a ${p.audience} audience. Output JSON:
{
  "title": "...",
  "rootCauseSummary": "...",
  "recommendedAction": "...",
  "whyItMatters": "...",
  "confidence": 0.0-1.0
}

Original title: ${p.title}
Root cause summary: ${p.rootCauseSummary}
Recommended action: ${p.recommendedAction}
Why it matters: ${p.whyItMatters}`,
  };
}

// ---------- 5. explain-evidence ----------
// Purpose: plain-language explanation of a technical finding for client reports.
// Output: { explanation, confidence }.
// Safety: don't invent numbers; only use what was provided.
export function explainEvidencePrompt(p: {
  ruleId?: string;
  observation?: string;
  metrics?: Record<string, unknown>;
}): PromptOutput {
  return {
    system:
      'You translate SEO technical evidence into plain language. Reply ONLY with valid JSON. Do not invent numbers; only use what is provided.',
    user: `Explain this evidence in 1-2 plain-language sentences a non-technical client could understand. Output JSON:
{
  "explanation": "...",
  "confidence": 0.0-1.0
}

Rule: ${p.ruleId ?? '(none)'}
Observation: ${p.observation ?? '(none)'}
Metrics: ${JSON.stringify(p.metrics ?? {})}`,
  };
}

// ---------- 6. infer-website-profile ----------
// Purpose: website profile suggestion from crawl + audit evidence.
// Output: large structured suggestion (see schema in tasks/index.ts).
// Safety: use only provided evidence; analyst-review required before applying.
export function inferWebsiteProfilePrompt(p: {
  site: { primaryDomain?: string; siteName?: string; clientName?: string };
  crawl: Record<string, unknown>;
  audit: Record<string, unknown>;
  topFindings: Array<{
    ruleId: string;
    severity: string;
    category: string;
    title: string;
    affectedPages: number;
  }>;
  categoryCounts: Record<string, number>;
  representativePages: Array<{
    url?: string;
    role?: string;
    title?: string;
    h1?: string;
    schemaTypes?: unknown[];
    excerpt: string;
  }>;
}): PromptOutput {
  return {
    system: `You are a senior SEO analyst. Use ONLY the provided evidence. Do not invent facts.
If evidence is insufficient, state it. Reply ONLY with valid JSON, no markdown fencing.`,
    user: `Analyze this site and return a profile suggestion in EXACTLY this JSON shape:
{
  "websiteProfileSuggestion": {
    "websiteCategory": "<one of: service-business|saas|ecommerce|ngo|education|publisher|government|healthcare|local-business|marketplace|documentation|community|event|personal-brand|mixed-other>",
    "categoryConfidence": <0..1>,
    "description": "<2-3 sentence factual summary of what this site is>",
    "audienceSegments": ["..."],
    "primaryGoals": ["..."],
    "conversionActions": ["..."],
    "entityGroups": ["..."],
    "contentSections": ["..."],
    "complianceContext": "<healthcare|finance|legal|govt|none|other>",
    "markets": ["..."],
    "languages": ["..."],
    "reasoning": "<short paragraph citing evidence>"
  },
  "prioritySummary": [
    { "title": "...", "rationale": "...", "evidenceRefs": ["finding:<ruleId>", "page:<url>"] }
  ],
  "contentOpportunities": [
    { "topic": "...", "rationale": "...", "suggestedAudience": "...", "evidenceRefs": ["..."] }
  ],
  "internalLinkingOpportunities": [
    { "fromUrl": "...", "toUrl": "...", "anchorIdea": "...", "rationale": "..." }
  ],
  "geoAeoObservations": [
    { "observation": "...", "impact": "...", "evidenceRefs": ["..."] }
  ],
  "confidence": <0..1>
}

Evidence:
${JSON.stringify(p, null, 0)}`,
  };
}

// ---------- 7. classify-page-role ----------
// Purpose: page-role suggestion from URL/title/H1/excerpt.
// Output: { role, reasoning, confidence }.
// Safety: use only the input.
export function classifyPageRolePrompt(p: {
  url?: string;
  title?: string;
  h1?: string;
  markdown?: string;
}): PromptOutput {
  return {
    system:
      'You classify SEO page roles. Reply ONLY with valid JSON. Use only the input. Do not invent context.',
    user: `Classify this page's role. Output JSON:
{
  "role": "home | service | category | content-article | blog | about | contact | legal | documentation | utility | other",
  "reasoning": "...",
  "confidence": 0.0-1.0
}

URL: ${p.url ?? '(unknown)'}
Title: ${p.title ?? '(none)'}
H1: ${p.h1 ?? '(none)'}

Excerpt:
${(p.markdown ?? '').slice(0, 4000)}`,
  };
}

// ---------- 8. extract-entities-topics ----------
// Purpose: entities + topics for keyword mapping / content briefs.
// Output: { entities[{name,type}], topics[], primarySubject, confidence }.
// Safety: only what's in the provided text.
export function extractEntitiesTopicsPrompt(p: {
  url?: string;
  title?: string;
  markdown: string;
}): PromptOutput {
  return {
    system:
      'You extract entities and topics for SEO use. Reply ONLY with valid JSON. Use only the provided text.',
    user: `Extract entities and topics. Output JSON:
{
  "entities": [{"name":"...","type":"organization|product|person|location|other"}],
  "topics": ["..."],
  "primarySubject": "...",
  "confidence": 0.0-1.0
}

URL: ${p.url ?? '(unknown)'}
Title: ${p.title ?? '(none)'}

Excerpt:
${p.markdown.slice(0, 4000)}`,
  };
}

// ---------- 9. group-similar-issues ----------
// Purpose: cluster issues with shared root cause.
// Output: { groups[{name,rationale,issueIds[]}], confidence }.
// Safety: use only provided list; deterministic groupKey remains source of truth.
export function groupSimilarIssuesPrompt(p: {
  issues: Array<{ id: string; title: string; ruleId: string; url?: string }>;
}): PromptOutput {
  return {
    system:
      'You group SEO issues that should be handled together. Reply ONLY with valid JSON. Use only the provided list.',
    user: `Group these issues into clusters that share a root cause. Output JSON:
{
  "groups": [
    { "name": "...", "rationale": "...", "issueIds": ["..."] }
  ],
  "confidence": 0.0-1.0
}

Issues:
${JSON.stringify(p.issues, null, 0)}`,
  };
}

// ---------- 10. draft-report-section ----------
// Purpose: draft one report section from structured inputs.
// Output: { title, body, bullets[], confidence }.
// Safety: reference numbers from inputs only; analyst review required.
export function draftReportSectionPrompt(p: {
  section: 'executive_summary' | 'what_changed' | 'next_month_plan' | 'risks';
  audience: 'analyst' | 'client';
  inputs: Record<string, unknown>;
}): PromptOutput {
  return {
    system: `You draft SEO report sections. Reply ONLY with valid JSON. Use only the provided inputs.
Be concrete and reference numbers from the inputs. Match the requested audience tone.
Do not invent metrics or vendor claims.`,
    user: `Draft the "${p.section}" section for a ${p.audience} audience. Output JSON:
{
  "title": "...",
  "body": "...",
  "bullets": ["..."],
  "confidence": 0.0-1.0
}

Inputs:
${JSON.stringify(p.inputs, null, 0)}`,
  };
}

// ---------- 11. suggest-content-outline ----------
// Purpose: H2/H3 outline + FAQs + title/meta suggestions for a content brief.
// Output: { outline, faqs, h1, titleSuggestions, metaSuggestions, confidence }.
// Safety: structural only; do not write copy.
export function suggestContentOutlinePrompt(p: {
  keyword: string;
  intent?: string;
  pageRole?: string;
  pageSummary?: string;
  existingHeadings?: string[];
  secondaryKeywords?: string[];
}): PromptOutput {
  return {
    system:
      'You produce SEO content outlines. Reply ONLY with valid JSON. Use only the input. Structural only; do not write copy.',
    user: `Suggest a content outline. Output JSON:
{
  "outline": [{"heading":"...", "level":2, "points":["..."]}],
  "faqs": [{"question":"...","answer":"..."}],
  "h1": "...",
  "titleSuggestions": ["..."],
  "metaSuggestions": ["..."],
  "confidence": 0.0-1.0
}

Target keyword: ${p.keyword}
Search intent: ${p.intent ?? 'unknown'}
Page role: ${p.pageRole ?? 'unknown'}
Secondary keywords: ${(p.secondaryKeywords ?? []).join(', ') || '(none)'}
Existing headings: ${(p.existingHeadings ?? []).join(' | ') || '(none)'}
Page summary: ${p.pageSummary ?? '(none)'}`,
  };
}

// ---------- 12. summarize-page-for-brief ----------
// Purpose: factual one-paragraph summary tuned for a content brief.
// Output: { summary, primaryTopic, audienceClue, confidence }.
// Safety: factual only.
export function summarizePageForBriefPrompt(p: {
  title?: string;
  h1?: string;
  headings?: string[];
  markdown: string;
}): PromptOutput {
  return {
    system:
      'You write factual page summaries for SEO content briefs. Reply ONLY with valid JSON. Use only the input.',
    user: `Write a one-paragraph factual summary suitable for a content brief. Output JSON:
{
  "summary": "...",
  "primaryTopic": "...",
  "audienceClue": "...",
  "confidence": 0.0-1.0
}

Title: ${p.title ?? '(none)'}
H1: ${p.h1 ?? '(none)'}
Headings: ${(p.headings ?? []).join(' | ') || '(none)'}

Body:
${p.markdown.slice(0, 4500)}`,
  };
}

// ---------- 13. rewrite-brief-section ----------
// Purpose: reword a single content-brief section.
// Output: { value, confidence }.
// Safety: keep meaning identical; do not add new facts.
export function rewriteBriefSectionPrompt(p: {
  sectionKey: string;
  audience: 'analyst' | 'client';
  currentValue: string;
  briefContext: string;
}): PromptOutput {
  return {
    system:
      'You reword SEO content brief sections. Reply ONLY with valid JSON. Keep meaning identical; do not add new facts.',
    user: `Rewrite the "${p.sectionKey}" section for a ${p.audience} audience. Output JSON:
{
  "value": "...",
  "confidence": 0.0-1.0
}

Brief context:
${p.briefContext.slice(0, 2000)}

Current value:
${p.currentValue}`,
  };
}

// ---------- 14. draft-content-brief ----------
// Purpose: full content-brief body from keyword + evidence.
// Output: full brief JSON (see schema).
// Safety: use only provided inputs; do not invent competitor/SEO facts.
export function draftContentBriefPrompt(p: {
  keyword: string;
  secondaryKeywords?: string[];
  intent?: string;
  funnelStage?: string;
  pageRole?: string;
  pageUrl?: string;
  pageSummary?: string;
  contentGaps?: string[];
  goals?: Array<{ type: string; label?: string }>;
  audit?: { missingSections?: string[]; ctaClarity?: string; depth?: string };
  evidenceSnapshot?: Record<string, unknown>;
}): PromptOutput {
  return {
    system: `You produce evidence-backed SEO content briefs. Reply ONLY with valid JSON.

Strict rules:
- Use ONLY the provided inputs (keyword, page summary, gaps, evidence). Do not invent competitor lists, search volume, backlinks, or SERP facts.
- If data is missing, note it in dataGaps and avoid making claims.
- Sections must be structural, not full prose.`,
    user: `Produce a content brief. Output JSON:
{
  "objective": "...",
  "audience": "...",
  "titleSuggestions": ["..."],
  "metaSuggestions": ["..."],
  "h1": "...",
  "outline": [{"heading":"...","level":2,"points":["..."]}],
  "requiredSections": [{"name":"...","why":"..."}],
  "faqs": [{"question":"...","answer":"..."}],
  "internalLinksToAdd": [{"targetUrl":"...","anchorIdea":"...","rationale":"..."}],
  "schemaSuggestions": ["..."],
  "ctaRecommendation": "...",
  "trustProofNeeded": ["..."],
  "whatToAvoid": ["..."],
  "seoChecklist": ["..."],
  "validationChecklist": ["..."],
  "confidence": 0.0-1.0
}

Inputs:
${JSON.stringify(p, null, 0)}`,
  };
}

// ---------- 15. rewrite-fix-plan-summary ----------
// Purpose: reword fix-plan description/expected impact.
// Output: { description, expectedImpactSummary, confidence }.
// Safety: tone only — do not invent items, numbers, or completion claims.
export function rewriteFixPlanSummaryPrompt(p: {
  audience: 'analyst' | 'client';
  title: string;
  description: string;
  itemCount: number;
  counts: Record<string, number>;
}): PromptOutput {
  return {
    system:
      'You reword SEO fix-plan summaries. Reply ONLY with valid JSON. Tone only — do not invent items, numbers, or completion claims.',
    user: `Rewrite the description for a ${p.audience} audience. Output JSON:
{
  "description": "...",
  "expectedImpactSummary": "...",
  "confidence": 0.0-1.0
}

Plan title: ${p.title}
Current description: ${p.description}
Item count: ${p.itemCount}
Source counts: ${JSON.stringify(p.counts)}`,
  };
}

// ---------- 16. draft-client-progress-summary ----------
// Purpose: client-facing progress summary.
// Output: { summary, bullets[], confidence }.
// Safety: use only the supplied items + metrics; do not invent claims.
export function draftClientProgressSummaryPrompt(p: {
  planTitle: string;
  periodLabel: string;
  validatedTitles: string[];
  inProgressTitles: string[];
  plannedTitles: string[];
  keyMetrics?: Record<string, string>;
}): PromptOutput {
  return {
    system:
      'You write client-facing SEO progress summaries. Reply ONLY with valid JSON. Use only the supplied items + metrics. Do not invent completion or performance claims.',
    user: `Draft a client-friendly progress summary. Output JSON:
{
  "summary": "...",
  "bullets": ["..."],
  "confidence": 0.0-1.0
}

Plan: ${p.planTitle}
Period: ${p.periodLabel}
Validated this period: ${JSON.stringify(p.validatedTitles)}
In progress: ${JSON.stringify(p.inProgressTitles)}
Planned: ${JSON.stringify(p.plannedTitles)}
Key metrics: ${JSON.stringify(p.keyMetrics ?? {})}`,
  };
}

// ---------- 17. suggest-crawl-scope-rules ----------
// Purpose: propose crawl/sample/exclude rules from discovered URL groups + project profile.
// Output: { suggestions[], warnings[], confidence }.
// Safety: never invent groups/numbers; output stored as `suggested` only — analyst must
// approve before any effect on crawl.
export function suggestCrawlScopeRulesPrompt(p: {
  siteCategory?: string;
  goals?: Array<{ type: string; label?: string }>;
  candidateGroups: Array<{
    name: string;
    pattern: string;
    discovered: number;
    examples: string[];
    behavior?: string;
  }>;
  existingRules?: Array<{ pattern: string; behavior: string }>;
}): PromptOutput {
  return {
    system: `You design SEO crawl scope rules. Reply ONLY with valid JSON.
Strict rules:
- Use only the provided groups + counts. Never invent groups or numbers.
- Default to crawl-all unless evidence (group size, page family) clearly supports sampling.
- Prefer sample limits in the 3-8 range.
- Recommend exclude only for known noise (tag archives, search, feeds, login/cart). Never exclude a group whose family is service/product/location/campaign/course on the matching site type.
- Add a warning when a sampled/excluded group conflicts with stated goals.`,
    user: `Propose crawl scope rules. Output JSON:
{
  "suggestions": [
    {
      "groupName": "...",
      "pattern": "/...",
      "patternType": "glob",
      "behavior": "crawl|sample|exclude|force_include",
      "sampleLimit": 5,
      "pageFamily": "...",
      "reason": "...",
      "riskIfWrong": "...",
      "confidence": 0.0-1.0
    }
  ],
  "warnings": [
    { "message": "...", "severity": "low|medium|high" }
  ],
  "confidence": 0.0-1.0
}

Site category: ${p.siteCategory ?? '(unknown)'}
Goals: ${JSON.stringify(p.goals ?? [])}
Existing rules: ${JSON.stringify(p.existingRules ?? [])}

Candidate groups:
${JSON.stringify(p.candidateGroups, null, 0)}`,
  };
}
