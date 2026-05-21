// Task definitions. Each task is local-tier (cheap) by default. Premium tier is reserved for
// content-writing work later (Phase 5+). All tasks return structured JSON; the task-service
// validates against the Zod schema before persisting.

import { registerTask, z } from '../task-service';

// 1. Summarize a page in plain language. Used in page workspace.
registerTask({
  key: 'summarize-page',
  label: 'Summarize page',
  description:
    'Produce a 2-3 sentence summary of the page from its markdown + title + H1. For analyst review only; never written back to evidence as truth.',
  affects: ['page'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 300,
  needsAnalystReview: true,
  buildPrompt: (p: {
    title?: string;
    h1?: string;
    url?: string;
    markdown: string;
  }) => ({
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
  }),
  outputSchema: z.object({
    summary: z.string().max(600),
    topics: z.array(z.string()).max(8),
    audience: z.string().max(200),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 2. Classify search intent for a keyword. Used in Keywords workspace.
registerTask({
  key: 'classify-search-intent',
  label: 'Classify search intent',
  description:
    'Given a keyword + context, suggest one of informational/commercial/transactional/navigational/local/support. Confidence + reasoning included. Analyst decides whether to apply.',
  affects: ['keyword'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 1000,
  maxOutputTokens: 200,
  needsAnalystReview: true,
  buildPrompt: (p: { keyword: string; siteCategory?: string; rankingUrl?: string }) => ({
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
  }),
  outputSchema: z.object({
    intent: z.enum([
      'informational',
      'commercial',
      'transactional',
      'navigational',
      'local',
      'support',
    ]),
    funnelStage: z.enum(['TOFU', 'MOFU', 'BOFU', 'retention']),
    reasoning: z.string().max(400),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 3. Suggest missing sections for a page. Augments deterministic content-fit gaps.
registerTask({
  key: 'suggest-missing-sections',
  label: 'Suggest missing sections',
  description:
    'Given a page summary + role + target keywords, suggest sections the page is missing for a strong SEO + user experience. Analyst-suggested only.',
  affects: ['page'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 400,
  needsAnalystReview: true,
  buildPrompt: (p: {
    role?: string;
    title?: string;
    h1?: string;
    targetKeywords?: string[];
    existingHeadings?: string[];
    markdown: string;
  }) => ({
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
  }),
  outputSchema: z.object({
    sections: z
      .array(z.object({ name: z.string().max(80), why: z.string().max(400) }))
      .max(10),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 4. Rewrite a recommendation in clearer analyst-or-client-friendly language.
//    Does NOT change underlying evidence; only the wording.
registerTask({
  key: 'rewrite-recommendation',
  label: 'Rewrite recommendation',
  description:
    'Reword a recommendation in clearer language. Optionally tuned for "analyst" or "client" audience. Evidence + verdict are not changed.',
  affects: ['recommendation'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 3500,
  maxOutputTokens: 500,
  needsAnalystReview: true,
  buildPrompt: (p: {
    audience: 'analyst' | 'client';
    title: string;
    rootCauseSummary: string;
    recommendedAction: string;
    whyItMatters: string;
  }) => ({
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
  }),
  outputSchema: z.object({
    title: z.string().min(1).max(200),
    rootCauseSummary: z.string().max(800),
    recommendedAction: z.string().max(2000),
    whyItMatters: z.string().max(800),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 5. Explain evidence in plain language for a client report.
registerTask({
  key: 'explain-evidence',
  label: 'Explain evidence',
  description:
    'Translate technical evidence into 1-2 plain-language sentences. Useful for client-facing reports. Does not change underlying evidence.',
  affects: ['recommendation', 'issue', 'opportunity'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 2500,
  maxOutputTokens: 250,
  needsAnalystReview: true,
  buildPrompt: (p: { ruleId?: string; observation?: string; metrics?: Record<string, unknown> }) => ({
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
  }),
  outputSchema: z.object({
    explanation: z.string().max(500),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 6. Infer website profile — replaces old analyze-evidence direct routeAI() call. Same prompt,
// same JSON shape, but goes through the task service so we have audit + schema validation.
registerTask({
  key: 'infer-website-profile',
  label: 'Infer website profile',
  description:
    'Read crawl summary, audit findings, and representative page excerpts. Produce a profile suggestion (category, audience, goals, conversion actions, markets, languages) for analyst review.',
  affects: ['project', 'website-profile'],
  riskLevel: 'medium',
  tier: 'cheap',
  promptTemplateVersion: 'v2',
  maxInputChars: 60000,
  maxOutputTokens: 3500,
  needsAnalystReview: true,
  buildPrompt: (p: {
    site: { primaryDomain?: string; siteName?: string; clientName?: string };
    crawl: Record<string, unknown>;
    audit: Record<string, unknown>;
    topFindings: Array<{ ruleId: string; severity: string; category: string; title: string; affectedPages: number }>;
    categoryCounts: Record<string, number>;
    representativePages: Array<{ url?: string; role?: string; title?: string; h1?: string; schemaTypes?: unknown[]; excerpt: string }>;
  }) => ({
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
  }),
  outputSchema: z.object({
    websiteProfileSuggestion: z.object({
      websiteCategory: z.string(),
      categoryConfidence: z.number().min(0).max(1),
      description: z.string(),
      audienceSegments: z.array(z.string()),
      primaryGoals: z.array(z.string()),
      conversionActions: z.array(z.string()),
      entityGroups: z.array(z.string()).default([]),
      contentSections: z.array(z.string()).default([]),
      complianceContext: z.string().optional().default('none'),
      markets: z.array(z.string()).default([]),
      languages: z.array(z.string()).default([]),
      reasoning: z.string(),
    }),
    prioritySummary: z
      .array(z.object({ title: z.string(), rationale: z.string(), evidenceRefs: z.array(z.string()) }))
      .default([]),
    contentOpportunities: z
      .array(
        z.object({
          topic: z.string(),
          rationale: z.string(),
          suggestedAudience: z.string().optional().default(''),
          evidenceRefs: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    internalLinkingOpportunities: z
      .array(
        z.object({
          fromUrl: z.string(),
          toUrl: z.string(),
          anchorIdea: z.string(),
          rationale: z.string(),
        }),
      )
      .default([]),
    geoAeoObservations: z
      .array(
        z.object({
          observation: z.string(),
          impact: z.string().optional().default(''),
          evidenceRefs: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    confidence: z.number().min(0).max(1).optional().default(0.5),
  }),
});

// 7. Classify page role from URL + title + H1 + content excerpt. Augments deterministic role
// classifier; analyst chooses whether to apply.
registerTask({
  key: 'classify-page-role',
  label: 'Classify page role',
  description:
    'Suggest a page role (home/service/category/content-article/blog/about/contact/legal/documentation/utility) from URL + title + H1 + content excerpt. Analyst-suggested only.',
  affects: ['page'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 250,
  needsAnalystReview: true,
  buildPrompt: (p: { url?: string; title?: string; h1?: string; markdown?: string }) => ({
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
  }),
  outputSchema: z.object({
    role: z.enum([
      'home',
      'service',
      'category',
      'content-article',
      'blog',
      'about',
      'contact',
      'legal',
      'documentation',
      'utility',
      'other',
    ]),
    reasoning: z.string().max(400),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 8. Extract entities and topics from a page. Useful for keyword-page mapping + content briefs.
registerTask({
  key: 'extract-entities-topics',
  label: 'Extract entities + topics',
  description:
    'Pull entities (organizations, products, locations) + topics covered by the page. Analyst-suggested input for keyword mapping + content briefs.',
  affects: ['page'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 400,
  needsAnalystReview: true,
  buildPrompt: (p: { url?: string; title?: string; markdown: string }) => ({
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
  }),
  outputSchema: z.object({
    entities: z
      .array(
        z.object({
          name: z.string().max(120),
          type: z.enum(['organization', 'product', 'person', 'location', 'other']),
        }),
      )
      .max(30),
    topics: z.array(z.string().max(80)).max(15),
    primarySubject: z.string().max(160),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 9. Group similar issues. Suggests cross-issue clusters for batch action; deterministic groupKey
// stays the source of truth.
registerTask({
  key: 'group-similar-issues',
  label: 'Group similar issues',
  description:
    'Given a list of issue titles + rule IDs + page URLs, suggest groups that should be handled together. Analyst-suggested; does not modify groupKey.',
  affects: ['issues'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 10000,
  maxOutputTokens: 700,
  needsAnalystReview: true,
  buildPrompt: (p: { issues: Array<{ id: string; title: string; ruleId: string; url?: string }> }) => ({
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
  }),
  outputSchema: z.object({
    groups: z
      .array(
        z.object({
          name: z.string().max(120),
          rationale: z.string().max(400),
          issueIds: z.array(z.string()).min(2).max(50),
        }),
      )
      .max(15),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 10. Draft a report section. Phase 5 will expand this; phase 4 ships a minimal scaffold that
// proves the path. Stays cheap-tier until premium content writing arrives.
registerTask({
  key: 'draft-report-section',
  label: 'Draft report section',
  description:
    'Draft a single report section (executive summary, what changed, next-month plan) from structured inputs. Analyst-reviewed before publishing.',
  affects: ['report'],
  riskLevel: 'medium',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 1200,
  needsAnalystReview: true,
  buildPrompt: (p: {
    section: 'executive_summary' | 'what_changed' | 'next_month_plan' | 'risks';
    audience: 'analyst' | 'client';
    inputs: Record<string, unknown>;
  }) => ({
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
  }),
  outputSchema: z.object({
    title: z.string().max(160),
    body: z.string().max(4000),
    bullets: z.array(z.string().max(280)).max(10).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 11-14. Content brief tasks (Phase 5). Local-tier outline + summary + section rewrite. Full brief
// drafting is cheap-tier by default, premium-eligible when analyst passes preferredProvider.

registerTask({
  key: 'suggest-content-outline',
  label: 'Suggest content outline',
  description:
    'Hierarchical H2/H3 outline with talking points + FAQs. Structural only — does not write copy.',
  affects: ['content-brief'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 800,
  needsAnalystReview: true,
  buildPrompt: (p: {
    keyword: string;
    intent?: string;
    pageRole?: string;
    pageSummary?: string;
    existingHeadings?: string[];
    secondaryKeywords?: string[];
  }) => ({
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
  }),
  outputSchema: z.object({
    outline: z
      .array(
        z.object({
          heading: z.string().max(160),
          level: z.number().int().min(2).max(4),
          points: z.array(z.string().max(280)).default([]),
        }),
      )
      .max(20),
    faqs: z
      .array(z.object({ question: z.string().max(220), answer: z.string().max(800) }))
      .max(10)
      .default([]),
    h1: z.string().max(160).default(''),
    titleSuggestions: z.array(z.string().max(80)).max(5).default([]),
    metaSuggestions: z.array(z.string().max(180)).max(5).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

registerTask({
  key: 'summarize-page-for-brief',
  label: 'Summarize page for brief',
  description: 'One-paragraph factual summary tuned for a content brief.',
  affects: ['content-brief'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 300,
  needsAnalystReview: true,
  buildPrompt: (p: { title?: string; h1?: string; headings?: string[]; markdown: string }) => ({
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
  }),
  outputSchema: z.object({
    summary: z.string().max(800),
    primaryTopic: z.string().max(160),
    audienceClue: z.string().max(160),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

registerTask({
  key: 'rewrite-brief-section',
  label: 'Rewrite brief section',
  description:
    'Reword one section of an existing brief. Keeps meaning identical; does not add new facts.',
  affects: ['content-brief'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 600,
  needsAnalystReview: true,
  buildPrompt: (p: {
    sectionKey: string;
    audience: 'analyst' | 'client';
    currentValue: string;
    briefContext: string;
  }) => ({
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
  }),
  outputSchema: z.object({
    value: z.string().max(4000),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

registerTask({
  key: 'draft-content-brief',
  label: 'Draft content brief',
  description:
    'Produce the analyst-facing brief body: objective, audience, intent, outline, FAQs, schema, CTA, checklists. Cheap-tier by default; premium-eligible when analyst passes preferredProvider.',
  affects: ['content-brief'],
  riskLevel: 'medium',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 14000,
  maxOutputTokens: 2200,
  needsAnalystReview: true,
  buildPrompt: (p: {
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
  }) => ({
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
  }),
  outputSchema: z.object({
    objective: z.string().max(800).default(''),
    audience: z.string().max(600).default(''),
    titleSuggestions: z.array(z.string().max(80)).max(5).default([]),
    metaSuggestions: z.array(z.string().max(180)).max(5).default([]),
    h1: z.string().max(160).default(''),
    outline: z
      .array(
        z.object({
          heading: z.string().max(160),
          level: z.number().int().min(2).max(4),
          points: z.array(z.string().max(280)).default([]),
        }),
      )
      .max(20)
      .default([]),
    requiredSections: z
      .array(z.object({ name: z.string().max(120), why: z.string().max(400) }))
      .max(15)
      .default([]),
    faqs: z
      .array(z.object({ question: z.string().max(220), answer: z.string().max(800) }))
      .max(10)
      .default([]),
    internalLinksToAdd: z
      .array(
        z.object({
          targetUrl: z.string().max(400),
          anchorIdea: z.string().max(160),
          rationale: z.string().max(400),
        }),
      )
      .max(10)
      .default([]),
    schemaSuggestions: z.array(z.string().max(120)).max(10).default([]),
    ctaRecommendation: z.string().max(400).default(''),
    trustProofNeeded: z.array(z.string().max(280)).max(10).default([]),
    whatToAvoid: z.array(z.string().max(280)).max(10).default([]),
    seoChecklist: z.array(z.string().max(280)).max(20).default([]),
    validationChecklist: z.array(z.string().max(280)).max(20).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 15-16. Fix plan tasks (Phase 6). Language assistance only — AI never decides validation truth.

registerTask({
  key: 'rewrite-fix-plan-summary',
  label: 'Rewrite fix plan summary',
  description:
    'Reword the description/expectedImpactSummary of a fix plan. Tone-only — facts come from inputs. Analyst reviews before saving.',
  affects: ['fix-plan'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 600,
  needsAnalystReview: true,
  buildPrompt: (p: {
    audience: 'analyst' | 'client';
    title: string;
    description: string;
    itemCount: number;
    counts: Record<string, number>;
  }) => ({
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
  }),
  outputSchema: z.object({
    description: z.string().max(2000),
    expectedImpactSummary: z.string().max(2000),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

registerTask({
  key: 'draft-client-progress-summary',
  label: 'Draft client progress summary',
  description:
    'Client-facing 1-paragraph summary of what was validated, what is in progress, and what is next. Numbers come from inputs only — never invented.',
  affects: ['fix-plan'],
  riskLevel: 'low',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 700,
  needsAnalystReview: true,
  buildPrompt: (p: {
    planTitle: string;
    periodLabel: string;
    validatedTitles: string[];
    inProgressTitles: string[];
    plannedTitles: string[];
    keyMetrics?: Record<string, string>;
  }) => ({
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
  }),
  outputSchema: z.object({
    summary: z.string().max(2000),
    bullets: z.array(z.string().max(280)).max(8).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 17. Crawl scope suggestions (Phase 11). AI proposes scope rules from discovery candidates +
//     project profile. Never silently applied — output is stored as suggestions for analyst
//     review.

registerTask({
  key: 'suggest-crawl-scope-rules',
  label: 'Suggest crawl scope rules',
  description:
    'Propose crawl/sample/exclude rules from discovered URL groups + project category + goals. Stored as `suggested` only — analyst must approve before they affect crawls.',
  affects: ['project'],
  riskLevel: 'medium',
  tier: 'cheap',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 1400,
  needsAnalystReview: true,
  buildPrompt: (p: {
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
  }) => ({
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
  }),
  outputSchema: z.object({
    suggestions: z
      .array(
        z.object({
          groupName: z.string().max(120),
          pattern: z.string().max(400),
          patternType: z.enum(['glob', 'prefix', 'regex']).default('glob'),
          behavior: z.enum(['crawl', 'sample', 'exclude', 'force_include']),
          sampleLimit: z.number().int().min(1).max(200).optional(),
          pageFamily: z.string().max(60).optional().default(''),
          reason: z.string().max(500).optional().default(''),
          riskIfWrong: z.string().max(500).optional().default(''),
          confidence: z.number().min(0).max(1).optional(),
        }),
      )
      .max(40)
      .default([]),
    warnings: z
      .array(
        z.object({
          message: z.string().max(400),
          severity: z.enum(['low', 'medium', 'high']).default('medium'),
        }),
      )
      .max(20)
      .default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

export {};
