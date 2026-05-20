# 04. Phase 3: Keyword-Page Fit And Content Analysis

## Purpose

Analyze whether important pages match the keywords, search intent, and client goals they are expected to support.

This phase moves the product beyond technical SEO.

## Must Read

- `docs/recommendation-engine/05-phase-2-keyword-page-fit-analysis.md`
- `docs/recommendation-engine/06-phase-3-page-content-analysis.md`
- `product-implementation-plan/06-phase-4-goals-keywords-opportunities.md`
- `product-implementation-plan/07-phase-5-reporting-dashboards-graphs.md`
- `docs/ai-implementation/06-phase-3-content-summaries-entities-and-intent.md`

## Build Scope

Use existing:

- page markdown.
- title/meta/H1/headings.
- page role.
- mapped keywords.
- GSC queries.
- GA4 metrics.
- CWV metrics.
- audit issues.
- internal links.
- schema status.
- project goals.

## Keyword-Page Fit Requirements

For each mapped keyword/page pair, show:

- target keyword.
- current ranking URL.
- intended target page.
- intent.
- funnel stage.
- GSC clicks/impressions/CTR/position.
- whether correct page is ranking.
- whether content directly answers intent.
- root cause summary.
- recommended actions.
- confidence.

Verdicts:

- `healthy`.
- `should_improve`.
- `must_improve`.
- `wrong_target`.
- `cannibalized`.
- `needs_new_page`.
- `monitor`.

## Page Content Analysis Requirements

For each important page, show:

- page purpose.
- target audience.
- target keywords.
- intent fit.
- content depth.
- missing sections.
- trust/proof gaps.
- CTA fit.
- internal link recommendations.
- schema recommendation.
- recommended fix plan.

Content analysis must support:

- service pages.
- articles/blogs.
- NGO/program pages.
- education/course pages.
- legal/policy pages.
- local pages.
- custom website types.

## AI Use

Local AI may:

- summarize page.
- classify intent.
- extract entities/topics.
- identify missing sections.
- suggest internal link topics.

External AI should be reserved for:

- final content briefs.
- rewrite/draft generation.
- high-quality client-facing strategy.

## Validation

Validate:

- page with good keyword fit.
- page ranking for wrong query.
- query where wrong page ranks.
- cannibalization case.
- thin page with high impressions.
- commercial page with weak CTA.
- page where there is insufficient data.

Do not mark complete unless missing data states are clear.

