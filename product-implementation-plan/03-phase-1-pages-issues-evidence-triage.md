# 03. Phase 1: Pages, Issues And Evidence Triage

## Phase Goal

Make the current product immediately useful for SEO triage.

Right now the Pages screen and Issues screen exist, but they do not yet help an analyst move quickly from "there is a problem" to "this exact page needs this exact fix."

This phase must connect:

- pages.
- issues.
- findings.
- evidence.
- severity.
- priority.
- owner.
- next action.

## Why This Phase Comes First

Before adding more rules or integrations, analysts need to see existing data clearly.

If the tool creates issues but does not show:

- which page is affected.
- how many issues each page has.
- which issue is most important.
- what evidence supports the issue.

then the product is not usable in real SEO work.

## Pages Screen Requirements

The Pages screen should become a triage table, not just a crawl output table.

### Required Columns

| Column | Purpose |
|---|---|
| URL | Open the page workspace. |
| Page Role | Understand page purpose. |
| Status | HTTP response status. |
| Indexability | Whether page can be indexed. |
| Issues | Total open issue count. |
| Severity | Critical/high/medium/low breakdown. |
| Top Issue | Highest-priority issue on the page. |
| Links In | Internal links pointing to page. |
| Links Out | Internal links from page. |
| Keywords | Mapped/ranking keyword count. |
| Clicks | GSC clicks when connected. |
| Impressions | GSC impressions when connected. |
| CTR | GSC click-through rate. |
| Position | Average GSC position. |
| Sessions | GA4 sessions when connected. |
| Conversions | GA4 conversions when connected. |
| Schema | Schema status. |
| Title | Page title. |
| Last Crawled | Freshness. |

### Issue Count Popover

The Issues column must show a number with a popover.

Popover content:

- Critical count.
- High count.
- Medium count.
- Low count.
- Info count.
- Top 3 issue titles.
- Button: View page issues.
- Button: Open page workspace.

Example:

```txt
7 open issues

Critical: 1
High: 2
Medium: 3
Low: 1

Top issues:
- Page is noindex
- Missing canonical
- Thin content

[View page issues] [Open page]
```

### Page Table Sorting

Analyst must be able to sort by:

- highest issue count.
- highest critical/high count.
- highest impressions.
- lowest CTR.
- highest clicks with open issues.
- lowest internal links in.
- most recent changes.
- highest conversion value with issues.

### Page Table Filters

Required filters:

- role.
- status code.
- indexability.
- issue severity.
- issue category.
- has critical issue.
- has GSC data.
- has GA4 data.
- has mapped keyword.
- schema missing.
- low internal links.

## Issues Screen Requirements

Issues screen must answer: "Where is this issue and what should I do?"

### Required Columns

| Column | Purpose |
|---|---|
| Severity | Risk level. |
| Issue | Issue title. |
| Affected URL | Exact page or site-wide label. |
| Page Role | Helps prioritize by page purpose. |
| Category | Audit category. |
| Status | Lifecycle status. |
| Owner | SEO/content/developer/client/analyst. |
| Priority | Sorting score. |
| Impact | SEO/business impact. |
| Effort | Estimate. |
| Evidence | Opens drawer. |
| First Seen | Historical context. |
| Last Seen | Latest audit context. |

### Issue Detail Drawer

Clicking an issue should open a drawer.

Drawer sections:

1. Issue summary.
2. Affected page or site-wide scope.
3. Evidence.
4. Why it matters.
5. How to fix.
6. Validation method.
7. Related findings.
8. History.
9. Owner/status/due date controls.
10. Report inclusion toggle.

### Evidence Section

Evidence must show:

- observed value.
- expected value.
- source.
- page URL.
- crawl run.
- audit run.
- markdown/content snippet where relevant.
- affected related pages for site-level issues.

Example evidence:

```txt
Observed:
No canonical URL was found in the crawled HTML.

Source:
Crawl run 2026-05-15, page HTML extraction.

Why this matters:
Canonical tags help search engines understand the preferred URL when duplicates exist.

Validation:
Re-crawl the page and confirm canonical URL is present and self-referencing or points to the correct master URL.
```

## Page Workspace Requirements

Each page should become a workspace with tabs.

### Overview Tab

Show:

- URL.
- title.
- meta description.
- H1.
- page role.
- status.
- indexability.
- canonical.
- top issues.
- traffic summary.
- keyword summary.
- conversion summary.

### Issues Tab

Show:

- open issues.
- resolved/verified issues.
- ignored/not applicable issues.
- issue history.

### Content Tab

Show:

- markdown.
- clean text.
- word count.
- headings.
- content quality signals.
- AI summary later.

### Keywords Tab

Show:

- mapped keywords.
- ranking GSC queries.
- clicks.
- impressions.
- CTR.
- position.
- missing query in title/H1.
- cannibalization warnings.

### Links Tab

Show:

- incoming internal links.
- outgoing internal links.
- anchor text.
- orphan status.
- internal link opportunities.

### Schema Tab

Show:

- schema types found.
- JSON-LD preview.
- schema extraction source.
- raw HTML schema result.
- rendered HTML schema result if available.
- schema parse errors.
- missing schema opportunities.
- validation issues.

## Schema Extraction And Crawl Source Requirements

Phase 1 / Phase B is not accepted until the product correctly distinguishes raw extraction, rendered extraction, genuinely missing schema, and schema not verified.

Cheerio remains the fast default crawler. Playwright/rendered extraction must be supported as selective verification, not as the default crawler for every page.

### Raw HTML Extraction

Cheerio must extract JSON-LD from raw server HTML.

Required extraction:

- `script[type="application/ld+json"]`
- parsed schema objects.
- schema types.
- schema parse errors.
- extraction source: `raw-html`.

If JSON-LD exists in raw HTML, the page should show schema as found from raw HTML.

### Rendered Extraction

Playwright or another rendered browser extraction should be used only when needed.

Run rendered extraction for:

- homepage.
- important pages.
- pages where schema rules are applicable.
- pages where raw HTML is thin but rendered/markdown content suggests client-side rendering.
- analyst-triggered "render this page".
- analyst-selected bulk rendered recrawl.
- sample pages in standard/full crawl modes where needed.

Do not crawl every page with Playwright by default.

### Schema Status Model

Store and display schema source clearly:

- `raw-html`: schema found in raw HTML.
- `rendered-html`: schema found only after rendered extraction.
- `both`: schema found in raw and rendered HTML.
- `none`: rendered extraction ran and schema is genuinely missing.
- `not-verified`: raw HTML did not contain schema and rendered extraction has not run.

Required stored fields:

- `rawHtmlSchema`
- `renderedHtmlSchema`
- `schemaTypes`
- `schemaParseErrors`
- `schemaSource`
- `schemaVerificationStatus`
- `schemaVerificationReason`
- `renderedExtractedAt`

Exact field names may differ, but the product must support this information.

### Rule Behaviour

Rules must respect extraction source.

- If raw schema is missing but rendered crawl was not run, schema rules must return `not_verified`, not `fail`.
- If rendered crawl was run and schema is still missing, schema rules can return `warning` or `fail` depending on applicability.
- If schema exists only after JavaScript render, show that clearly in the UI.
- If schema parse errors exist, show the exact parse error and source.

Do not create "missing schema" issues until rendered verification has happened where JavaScript-rendered schema is possible.

### Pages Table Behaviour

The Pages table Schema column must show:

- schema found.
- schema not verified.
- schema missing after rendered verification.
- schema parse error.
- schema source: raw HTML, rendered HTML, both, or not verified.

Required filters:

- Schema found.
- Schema not verified.
- No JSON-LD in raw HTML.
- Schema parse errors.
- Important pages with schema not verified.

### Bulk Rendered Recrawl

The Pages table should support analyst-controlled rendered verification.

Required controls:

- checkbox selection per page.
- bulk action: Run rendered recrawl.
- quick filter: Schema not verified.
- quick filter: No JSON-LD in raw HTML.
- quick filter: Important pages only.
- quick action: Run rendered recrawl for all schema-not-verified pages.

Rendered recrawl must:

- use Playwright only for selected URLs.
- re-extract rendered HTML.
- re-extract JSON-LD.
- re-extract rendered title/meta/headings if needed.
- update schema source and schema verification state.
- re-run only affected schema/content/render-sensitive rules.
- show job progress.
- warn when selected page count is high.
- support concurrency/cap settings where practical.

### Page Workspace Schema Tab Behaviour

The Schema tab must show:

- raw HTML JSON-LD.
- rendered HTML JSON-LD if available.
- schema source.
- schema types found.
- parse errors.
- last rendered extraction time.
- whether rendered verification has not run.
- action: Render this page.
- action: Run rendered recrawl for selected pages from the table.

### Issue Drawer Behaviour

Schema-related issues must show:

- whether the issue came from raw HTML or rendered HTML.
- whether rendered verification was missing.
- exact schema evidence.
- parse error details when relevant.
- why the rule is `not_verified`, `warning`, or `fail`.

### Data Gaps Behaviour

Missing rendered extraction must appear as a data gap, not a false SEO issue.

Example:

> Schema not verified because no JSON-LD was found in raw HTML and rendered extraction has not been run for this page.

### Validation Before Phase Acceptance

Before Phase 1 / Phase B is accepted, validate:

- A page with server-rendered JSON-LD is detected as `raw-html`.
- A page with no JSON-LD is not falsely failed until rendered verification runs.
- A JavaScript-rendered JSON-LD page is detected as `rendered-html` if available.
- Missing rendered crawl is shown as `not_verified`, not as a missing-schema issue.
- Schema tab shows source and parsed schema types.
- Pages table schema status and filters work.
- Data gaps card shows schema verification gaps.
- Schema issue drawer shows extraction source and evidence.

### Performance Tab

Show:

- LCP.
- INP.
- CLS.
- PSI performance score.
- trend over time.

### History Tab

Show:

- title changes.
- meta changes.
- H1 changes.
- word count changes.
- content hash changes.
- issue status changes.

## Backend Requirements

Pages API must return:

- issue count.
- severity counts.
- top issue.
- links out count.
- keyword counts.
- GSC summary.
- GA4 summary.
- CWV summary.
- schema source.
- schema types.
- schema parse errors.
- schema verification status.
- rendered extraction status/time.

Issues API must return:

- affected page URL.
- affected page title.
- page role.
- current finding evidence.
- first seen.
- last seen.
- owner.
- due date.
- validation method.
- extraction source for schema/render-sensitive issues.

## Info Icons Required In This Phase

Add info icons for:

- URL.
- Role.
- Status.
- Indexability.
- Issues.
- Severity.
- Links in.
- Links out.
- Canonical.
- Schema.
- CTR.
- Impressions.
- Position.
- LCP.
- INP.
- CLS.

Each info icon must explain the term in plain language.

## Completion Criteria

This phase is complete only when:

- Pages table shows issue counts.
- Issue severity popover works.
- Issues table shows affected URL.
- Issue drawer shows evidence.
- Page workspace shows page-specific issues.
- Analyst can move from page to issue and issue to page.
- Technical terms have info icons.
- Schema status distinguishes raw HTML, rendered HTML, both, none, and not verified.
- Missing raw JSON-LD without rendered verification is shown as `not_verified`, not as a false issue.
- Analyst can trigger rendered verification for one page or selected pages.
- Schema tab and issue drawer show extraction source and schema evidence.
