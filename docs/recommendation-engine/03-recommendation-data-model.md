# 03. Recommendation Data Model

## Goal

Define data models that turn audit findings, keyword opportunities, and content analysis into actionable SEO recommendations.

## Core Model: Recommendation

Suggested fields:

| Field | Purpose |
|---|---|
| `projectId` | Project |
| `type` | technical, content, keyword, internal-link, schema, conversion, performance |
| `status` | draft, proposed, approved, planned, in_progress, implemented, verified, rejected |
| `verdict` | must_change, should_improve, consider, monitor, no_action |
| `title` | Short action title |
| `rootCauseSummary` | Short explanation of what is wrong |
| `rootCause` | Why it is happening |
| `recommendedAction` | What to do |
| `whyItMatters` | SEO/business reason |
| `evidence` | Structured evidence references |
| `expectedImpact` | high, medium, low |
| `effort` | trivial, small, medium, large |
| `priorityScore` | Computed priority |
| `confidence` | Recommendation confidence |
| `ownerType` | seo, content, developer, client, analyst |
| `assignedToUserId` | Optional user |
| `dueDate` | Optional due date |
| `validationMethod` | How to confirm fix |
| `validatedAt` | When verified |
| `source` | rule, ai, gsc, ga4, cwv, analyst, mixed |
| `sourceFindingIds` | Linked findings |
| `sourceIssueIds` | Linked issues |
| `sourceOpportunityIds` | Linked opportunities |
| `pageIds` | Linked pages |
| `keywordIds` | Linked keywords |
| `goalIds` | Linked goals |
| `reportVisibility` | internal, client, both, hidden |

## Recommendation Statuses

| Status | Meaning |
|---|---|
| `draft` | Generated but not reviewed |
| `proposed` | Ready for analyst review |
| `approved` | Analyst agrees |
| `planned` | Scheduled/assigned |
| `in_progress` | Being worked on |
| `implemented` | Claimed fixed |
| `verified` | Tool/analyst confirmed |
| `rejected` | Analyst rejected |

## Verdicts

| Verdict | Meaning |
|---|---|
| `must_change` | Strong evidence says this blocks SEO/business outcome |
| `should_improve` | Meaningful improvement expected |
| `consider` | Optional or lower confidence |
| `monitor` | Watch before acting |
| `no_action` | No fix needed |

## Evidence Object

Evidence should be structured:

```json
{
  "pages": ["pageId"],
  "keywords": ["keywordId"],
  "findings": ["findingId"],
  "metrics": [
    { "source": "gsc", "label": "Impressions", "value": 1200 },
    { "source": "gsc", "label": "CTR", "value": "0.3%" }
  ],
  "observations": [
    "Title does not mention target keyword",
    "Page ranks at average position 7.8"
  ]
}
```

## Fix Plan

A fix plan groups recommendations into execution order.

Suggested fields:

| Field | Purpose |
|---|---|
| `projectId` | Project |
| `title` | Example: Week 1 Technical Fixes |
| `periodStart` / `periodEnd` | Plan window |
| `recommendationIds` | Included actions |
| `ownerUserId` | Lead owner |
| `status` | draft, active, completed |
| `summary` | Why these actions matter |

## Content Brief

Generated from approved content/keyword recommendation.

Suggested fields:

| Field | Purpose |
|---|---|
| `projectId` | Project |
| `recommendationId` | Source recommendation |
| `targetPageId` | Existing or new target page |
| `targetKeywords` | Keywords |
| `intent` | Search intent |
| `titleSuggestions` | Draft title options |
| `h1Suggestion` | Draft H1 |
| `requiredSections` | Sections to add |
| `faqSuggestions` | FAQ ideas |
| `internalLinkTargets` | Pages to link from/to |
| `schemaRecommendation` | Schema to add |
| `ctaRecommendation` | CTA |
| `externalAiDraftId` | If content draft generated externally |
| `status` | draft, approved, writing, implemented |

## Recommendation Generation Sources

Recommendations can be created from:

- audit issues.
- GSC opportunity.
- GA4 low conversion/engagement.
- CWV failure.
- keyword-page mismatch.
- content analysis.
- analyst manual action.

## Validation Link

Every recommendation needs a validation method:

- re-crawl.
- re-audit.
- GSC metric movement.
- GA4 conversion/engagement.
- CWV new snapshot.
- analyst manual confirmation.
