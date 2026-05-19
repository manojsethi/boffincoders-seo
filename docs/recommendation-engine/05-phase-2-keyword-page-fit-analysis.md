# 05. Phase 2: Keyword Page Fit Analysis

## Phase Goal

Tell analysts which keywords to work on, which page should target them, and whether the current ranking page is correct.

## Inputs

- GSC queries.
- mapped keywords.
- ranking URL.
- target page.
- page title/meta/H1.
- page summary.
- page content markdown.
- page role.
- issue list.
- goals.
- conversion data if available.

## Verdicts

Every keyword-page analysis should produce one verdict:

| Verdict | Meaning |
|---|---|
| `good_fit` | Current page matches intent |
| `needs_minor_update` | Page is mostly right but needs small changes |
| `must_improve` | Page is relevant but too weak to perform well |
| `wrong_page_ranking` | Google ranks a different page than intended |
| `create_new_page` | No suitable page exists |
| `merge_or_redirect` | Multiple pages split the topic |
| `do_not_target` | Keyword is irrelevant or low value |
| `monitor` | Not enough evidence to act |

## Must Improve Conditions

Use strict `must_improve` only when evidence supports it:

- high impressions and low CTR.
- position 4-20 with commercial/important intent.
- title/H1 does not match query.
- page does not answer query.
- page lacks required sections.
- page has thin content for its role.
- page has weak CTA for lead/ecommerce intent.
- page has clear technical blockers.

## Wrong Page Ranking

Detect when:

- GSC ranking URL differs from mapped target page.
- ranking page is less relevant.
- two or more pages rank for the same query.
- internal links/canonical/title suggest confusion.

Recommendation examples:

- improve intended page.
- add internal links to intended page.
- de-optimize or consolidate wrong page.
- create clearer hub/landing page.

## Output Shape

```json
{
  "keywordId": "...",
  "pageId": "...",
  "verdict": "must_improve",
  "intent": "commercial",
  "rootCauseSummary": "The page ranks in quick-win range but does not directly cover the query topic.",
  "evidence": [
    "Average position 7.8",
    "Impressions 1200",
    "CTR 0.3%",
    "No H2 section about technical SEO audits"
  ],
  "recommendedActions": [
    "Rewrite title/meta to include the target topic",
    "Add a dedicated section answering the query",
    "Add FAQ schema if question-style queries exist",
    "Add internal links from related SEO pages"
  ],
  "confidence": 0.86
}
```

## AI Use

Local AI:

- classify intent.
- compare page summary to keyword intent.
- identify missing sections.

External AI:

- high-quality content brief.
- final content rewrite.

## UI Requirements

Keyword workspace should show:

- keyword.
- ranking page.
- mapped page.
- intent.
- impressions/clicks/CTR/position.
- verdict.
- reason.
- recommended action.
- create recommendation button.

## Validation Checklist

Do not mark complete until:

- GSC keywords receive verdicts.
- wrong-page ranking is visible.
- must-improve verdicts have hard evidence.
- analyst can approve/reject recommendations.
- keyword-page recommendations link to pages/goals.
- self-audit is written.
