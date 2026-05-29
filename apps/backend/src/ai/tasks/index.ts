// Task definitions. All AI tasks share a single OpenRouter-backed transport (see ai-service).
// Each task returns structured JSON; the task-service validates against the Zod schema before
// persisting. Prompt builders are centralized in `../prompts.ts` so prompt tuning lives in
// one place.

import { registerTask, z } from '../task-service';
import {
  summarizePagePrompt,
  classifySearchIntentPrompt,
  suggestMissingSectionsPrompt,
  rewriteRecommendationPrompt,
  explainEvidencePrompt,
  inferWebsiteProfilePrompt,
  classifyPageRolePrompt,
  extractEntitiesTopicsPrompt,
  groupSimilarIssuesPrompt,
  draftReportSectionPrompt,
  suggestContentOutlinePrompt,
  summarizePageForBriefPrompt,
  rewriteBriefSectionPrompt,
  draftContentBriefPrompt,
  rewriteFixPlanSummaryPrompt,
  draftClientProgressSummaryPrompt,
  suggestCrawlScopeRulesPrompt,
} from '../prompts';

// 1. Summarize a page in plain language. Used in page workspace.
registerTask({
  key: 'summarize-page',
  label: 'Summarize page',
  description:
    'Produce a 2-3 sentence summary of the page from its markdown + title + H1. For analyst review only; never written back to evidence as truth.',
  affects: ['page'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 300,
  needsAnalystReview: true,
  buildPrompt: summarizePagePrompt,
  outputSchema: z.object({
    summary: z.string().max(600),
    topics: z.array(z.string()).max(8),
    audience: z.string().max(200),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 2. Classify search intent for a keyword.
registerTask({
  key: 'classify-search-intent',
  label: 'Classify search intent',
  description:
    'Given a keyword + context, suggest one of informational/commercial/transactional/navigational/local/support. Confidence + reasoning included. Analyst decides whether to apply.',
  affects: ['keyword'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 1000,
  maxOutputTokens: 200,
  needsAnalystReview: true,
  buildPrompt: classifySearchIntentPrompt,
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

// 3. Suggest missing sections.
registerTask({
  key: 'suggest-missing-sections',
  label: 'Suggest missing sections',
  description:
    'Given a page summary + role + target keywords, suggest sections the page is missing for a strong SEO + user experience. Analyst-suggested only.',
  affects: ['page'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 400,
  needsAnalystReview: true,
  buildPrompt: suggestMissingSectionsPrompt,
  outputSchema: z.object({
    sections: z
      .array(z.object({ name: z.string().max(80), why: z.string().max(400) }))
      .max(10),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 4. Rewrite a recommendation.
registerTask({
  key: 'rewrite-recommendation',
  label: 'Rewrite recommendation',
  description:
    'Reword a recommendation in clearer language. Optionally tuned for "analyst" or "client" audience. Evidence + verdict are not changed.',
  affects: ['recommendation'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 3500,
  maxOutputTokens: 500,
  needsAnalystReview: true,
  buildPrompt: rewriteRecommendationPrompt,
  outputSchema: z.object({
    title: z.string().min(1).max(200),
    rootCauseSummary: z.string().max(800),
    recommendedAction: z.string().max(2000),
    whyItMatters: z.string().max(800),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 5. Explain evidence.
registerTask({
  key: 'explain-evidence',
  label: 'Explain evidence',
  description:
    'Translate technical evidence into 1-2 plain-language sentences. Useful for client-facing reports. Does not change underlying evidence.',
  affects: ['recommendation', 'issue', 'opportunity'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 2500,
  maxOutputTokens: 250,
  needsAnalystReview: true,
  buildPrompt: explainEvidencePrompt,
  outputSchema: z.object({
    explanation: z.string().max(500),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 6. Infer website profile.
registerTask({
  key: 'infer-website-profile',
  label: 'Infer website profile',
  description:
    'Read crawl summary, audit findings, and representative page excerpts. Produce a profile suggestion (category, audience, goals, conversion actions, markets, languages) for analyst review.',
  affects: ['project', 'website-profile'],
  riskLevel: 'medium',
  promptTemplateVersion: 'v2',
  maxInputChars: 60000,
  maxOutputTokens: 3500,
  needsAnalystReview: true,
  buildPrompt: inferWebsiteProfilePrompt,
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
      .array(
        z.object({
          title: z.string(),
          rationale: z.string(),
          evidenceRefs: z.array(z.string()),
        }),
      )
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

// 7. Classify page role.
registerTask({
  key: 'classify-page-role',
  label: 'Classify page role',
  description:
    'Suggest a page role (home/service/category/content-article/blog/about/contact/legal/documentation/utility) from URL + title + H1 + content excerpt. Analyst-suggested only.',
  affects: ['page'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 250,
  needsAnalystReview: true,
  buildPrompt: classifyPageRolePrompt,
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

// 8. Extract entities and topics.
registerTask({
  key: 'extract-entities-topics',
  label: 'Extract entities + topics',
  description:
    'Pull entities (organizations, products, locations) + topics covered by the page. Analyst-suggested input for keyword mapping + content briefs.',
  affects: ['page'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 400,
  needsAnalystReview: true,
  buildPrompt: extractEntitiesTopicsPrompt,
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

// 9. Group similar issues.
registerTask({
  key: 'group-similar-issues',
  label: 'Group similar issues',
  description:
    'Given a list of issue titles + rule IDs + page URLs, suggest groups that should be handled together. Analyst-suggested; does not modify groupKey.',
  affects: ['issues'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 10000,
  maxOutputTokens: 700,
  needsAnalystReview: true,
  buildPrompt: groupSimilarIssuesPrompt,
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

// 10. Draft a report section.
registerTask({
  key: 'draft-report-section',
  label: 'Draft report section',
  description:
    'Draft a single report section (executive summary, what changed, next-month plan) from structured inputs. Analyst-reviewed before publishing.',
  affects: ['report'],
  riskLevel: 'medium',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 1200,
  needsAnalystReview: true,
  buildPrompt: draftReportSectionPrompt,
  outputSchema: z.object({
    title: z.string().max(160),
    body: z.string().max(4000),
    bullets: z.array(z.string().max(280)).max(10).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 11. Suggest content outline.
registerTask({
  key: 'suggest-content-outline',
  label: 'Suggest content outline',
  description:
    'Hierarchical H2/H3 outline with talking points + FAQs. Structural only — does not write copy.',
  affects: ['content-brief'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 800,
  needsAnalystReview: true,
  buildPrompt: suggestContentOutlinePrompt,
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

// 12. Summarize page for brief.
registerTask({
  key: 'summarize-page-for-brief',
  label: 'Summarize page for brief',
  description: 'One-paragraph factual summary tuned for a content brief.',
  affects: ['content-brief'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 6000,
  maxOutputTokens: 300,
  needsAnalystReview: true,
  buildPrompt: summarizePageForBriefPrompt,
  outputSchema: z.object({
    summary: z.string().max(800),
    primaryTopic: z.string().max(160),
    audienceClue: z.string().max(160),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 13. Rewrite brief section.
registerTask({
  key: 'rewrite-brief-section',
  label: 'Rewrite brief section',
  description:
    'Reword one section of an existing brief. Keeps meaning identical; does not add new facts.',
  affects: ['content-brief'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 600,
  needsAnalystReview: true,
  buildPrompt: rewriteBriefSectionPrompt,
  outputSchema: z.object({
    value: z.string().max(4000),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 14. Draft content brief.
registerTask({
  key: 'draft-content-brief',
  label: 'Draft content brief',
  description:
    'Produce the analyst-facing brief body: objective, audience, intent, outline, FAQs, schema, CTA, checklists.',
  affects: ['content-brief'],
  riskLevel: 'medium',
  promptTemplateVersion: 'v1',
  maxInputChars: 14000,
  maxOutputTokens: 2200,
  needsAnalystReview: true,
  buildPrompt: draftContentBriefPrompt,
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

// 15. Rewrite fix plan summary.
registerTask({
  key: 'rewrite-fix-plan-summary',
  label: 'Rewrite fix plan summary',
  description:
    'Reword the description/expectedImpactSummary of a fix plan. Tone-only — facts come from inputs. Analyst reviews before saving.',
  affects: ['fix-plan'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 600,
  needsAnalystReview: true,
  buildPrompt: rewriteFixPlanSummaryPrompt,
  outputSchema: z.object({
    description: z.string().max(2000),
    expectedImpactSummary: z.string().max(2000),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 16. Draft client progress summary.
registerTask({
  key: 'draft-client-progress-summary',
  label: 'Draft client progress summary',
  description:
    'Client-facing 1-paragraph summary of what was validated, what is in progress, and what is next. Numbers come from inputs only — never invented.',
  affects: ['fix-plan'],
  riskLevel: 'low',
  promptTemplateVersion: 'v1',
  maxInputChars: 4000,
  maxOutputTokens: 700,
  needsAnalystReview: true,
  buildPrompt: draftClientProgressSummaryPrompt,
  outputSchema: z.object({
    summary: z.string().max(2000),
    bullets: z.array(z.string().max(280)).max(8).default([]),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

// 17. Crawl scope suggestions.
registerTask({
  key: 'suggest-crawl-scope-rules',
  label: 'Suggest crawl scope rules',
  description:
    'Propose crawl/sample/exclude rules from discovered URL groups + project category + goals. Stored as `suggested` only — analyst must approve before they affect crawls.',
  affects: ['project'],
  riskLevel: 'medium',
  promptTemplateVersion: 'v1',
  maxInputChars: 8000,
  maxOutputTokens: 1400,
  needsAnalystReview: true,
  buildPrompt: suggestCrawlScopeRulesPrompt,
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
