# 06. Phase 3: Content Summaries Entities And Intent

## Phase Goal

Use local AI to help analysts understand crawled pages faster.

This phase should reduce time spent opening pages one by one.

## Page Summary

Use SmolLM3-3B for bulk.

For each important page, generate:

- one-sentence summary.
- target audience.
- page purpose.
- main CTA.
- primary topic.
- content gaps if obvious.
- confidence.

Output:

```json
{
  "summary": "This page explains SEO services for B2B technology companies.",
  "audience": ["B2B founders", "marketing leaders"],
  "pagePurpose": "lead_generation",
  "primaryTopic": "technical SEO services",
  "mainCTA": "book a consultation",
  "confidence": 0.86
}
```

## Entity Extraction

Extract:

- services.
- products.
- industries.
- locations.
- technologies.
- authors.
- people.
- organizations.
- programs.
- courses.
- events.
- problems solved.
- audience segments.

Output should be structured:

```json
{
  "entities": [
    { "type": "service", "name": "Technical SEO", "evidence": "Technical SEO services" },
    { "type": "audience", "name": "B2B SaaS companies", "evidence": "for SaaS teams" }
  ]
}
```

## Search Intent Classification

Use Qwen3-4B.

Classify page/keyword intent:

- informational.
- commercial.
- transactional.
- navigational.
- local.
- comparison.
- support.
- donation.
- admissions.
- recruitment.

## Use In Product

Show summaries in:

- page workspace overview.
- pages table drawer/popover.
- internal report preparation.
- opportunity drawer.

Use entities in:

- profile settings.
- internal linking suggestions.
- content gap analysis.
- website type flexibility.

Use intent in:

- keyword mapping.
- opportunity scoring explanation.
- content recommendations.

## Validation Checklist

Do not mark complete until:

- summaries are concise and accurate.
- entity extraction works for multiple website types.
- intent labels help opportunity review.
- summaries include source page id.
- confidence is stored.
- analyst can refresh or ignore AI output.
- self-audit is written.

