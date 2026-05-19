# 05. Phase 2: Website Profile And Page Classification

## Phase Goal

Use local AI to make the project flexible for any kind of website.

This phase should improve:

- website type detection.
- project profile suggestions.
- page role classification.
- analyst review/edit flow.

## Why This Matters

The product must not assume every website has services, industries, technologies, case studies, or blogs.

It must support:

- service businesses.
- SaaS.
- ecommerce.
- NGOs.
- education.
- publishers.
- healthcare.
- local businesses.
- government/institutional sites.
- portfolios.
- documentation sites.

## Website Profile Inference

Use Qwen3-4B.

Inputs:

- homepage markdown.
- top navigation labels.
- page URL list.
- top 10-20 important page summaries if available.
- title/meta from important pages.

Output:

```json
{
  "websiteType": "ngo",
  "businessModel": "donation_and_awareness",
  "primaryGoals": ["donations", "volunteer_signups", "awareness"],
  "audiences": ["donors", "volunteers", "beneficiaries"],
  "entityGroups": [
    { "type": "program", "label": "Education Programs" },
    { "type": "location", "label": "India" }
  ],
  "importantPagePatterns": ["donate", "program", "about", "impact"],
  "confidence": 0.84,
  "needsReview": false
}
```

## Page Role Classification

Use SmolLM3-3B for bulk, Qwen3-4B for low-confidence retry.

Inputs per page:

- URL.
- title.
- meta description.
- H1.
- headings.
- word count.
- markdown excerpt.
- existing heuristic role.

Output:

```json
{
  "pageRole": "donation",
  "confidence": 0.91,
  "reason": "The page focuses on donation CTA, recurring giving, and impact messaging.",
  "secondaryRoles": ["landing-page"]
}
```

## Supported Page Roles

Start with:

- home.
- about.
- contact.
- service.
- product.
- collection.
- category.
- blog.
- content-article.
- case-study.
- pricing.
- legal.
- utility.
- documentation.
- landing-page.
- donation.
- program.
- course.
- event.
- location.
- author.
- other.

## Analyst Review Flow

AI should not silently override analyst decisions.

Flow:

1. crawler assigns heuristic role.
2. AI suggests role and confidence.
3. if confidence high and no analyst override exists, save as AI role.
4. if confidence low, mark `needs_review`.
5. analyst can override role.
6. analyst override wins over future AI runs unless manually refreshed.

## Backend Storage

Store:

- `roleSource`: `heuristic`, `ai`, or `analyst`.
- `roleConfidence`.
- `roleConfidenceLevel`.
- `roleInferredAt`.
- AI reason if useful.

## UI Requirements

Pages table:

- show role.
- show confidence marker.
- show source: heuristic/AI/analyst.
- allow filter `needs role review`.

Page workspace:

- show role explanation.
- allow "Infer role with local AI".
- allow analyst override.

Project profile:

- show detected website type.
- show entity groups.
- show business goals suggestion.
- allow accept/edit/reject.

## Validation Checklist

Do not mark complete until:

- website profile inference works on at least 3 different website types.
- page role AI inference works on service, NGO, education, blog, and legal pages.
- analyst override is preserved.
- low confidence role becomes review item.
- deterministic rules respect AI/analyst role.
- self-audit is written.

