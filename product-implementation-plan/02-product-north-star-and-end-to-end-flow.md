# 02. Product North Star And End-To-End Flow

## Product North Star

Build an SEO operating system for analysts, agencies, and serious website owners.

The tool should help users:

- crawl a website.
- audit SEO health.
- understand technical problems.
- connect search, traffic, conversion, and crawl data.
- identify keyword and content opportunities.
- prioritize work.
- verify fixes.
- monitor progress.
- prepare client-ready in-tool reports.

The product should feel like a senior SEO analyst has organized all website evidence into one clear workspace.

## Primary Users

### Senior SEO Analyst

Needs:

- page-level evidence.
- issue prioritization.
- keyword/page mapping.
- GSC/GA4/CWV context.
- internal link opportunities.
- content gaps.
- report-ready summaries.
- ability to override AI.

### SEO Lead / Agency Owner

Needs:

- portfolio health.
- projects needing action.
- reports due.
- failed jobs/integrations.
- critical client risks.
- team workload.

### Self-Serve Website Owner

Needs:

- plain-language explanations.
- clear recommendations.
- no SEO jargon without explanation.
- visible progress.
- client/business goal alignment.

### Developer / Content Team

Needs:

- exact affected URL.
- exact issue.
- fix instructions.
- acceptance criteria.
- priority and impact.
- verification method.

## End-To-End Flow

### Step 1: Create Project

Ask only the basics:

- client name.
- site name.
- primary domain.
- allowed domains.
- include subdomains.

Do not ask for every SEO setting before the first crawl.

### Step 2: Define Goals

After project creation, collect business goals.

The goal setup must be dynamic.

Examples:

- lead generation.
- quote requests.
- consultation calls.
- ecommerce sales.
- donations.
- course applications.
- bookings.
- demo requests.
- trial signups.
- local visibility.
- organic traffic growth.
- AI/GEO visibility.

Each goal should have:

- priority.
- related conversion action.
- related pages.
- related audience.
- KPI.
- target.

### Step 3: Run First Crawl

Collect:

- URLs.
- status codes.
- indexability.
- canonicals.
- titles.
- meta descriptions.
- H1/headings.
- schema.
- images.
- internal links.
- markdown.
- clean text.
- raw HTML.
- crawl diagnostics.

The user should see:

- crawl progress.
- discovered/crawled/skipped/failed counts.
- sitemap status.
- robots status.
- markdown coverage.
- crawl health.
- failed/skipped reasons.

### Step 4: Run Initial Audit

Audit should evaluate:

- crawl/indexing.
- on-page SEO.
- content quality.
- internal links.
- structured data.
- performance.
- E-E-A-T/trust.
- GEO/AEO readiness.
- conversion.
- measurement.

The audit creates:

- findings.
- persistent issues.
- priority scores.
- evidence.
- fix guidance.
- validation method.

### Step 5: Run AI Analysis From Evidence

AI should run after crawl and audit.

AI reads:

- markdown.
- page metadata.
- audit findings.
- crawl diagnostics.
- GSC/GA4/CWV if connected.
- client goals.

AI suggests:

- website category.
- audience segments.
- conversion actions.
- entity groups.
- content sections.
- top priorities.
- content opportunities.
- internal link opportunities.
- GEO/AEO opportunities.

Analyst must approve or edit.

### Step 6: Review Website Profile

The profile screen should show:

- detected website category.
- confidence.
- evidence.
- goals.
- audience.
- conversion actions.
- entity groups.
- content sections.
- compliance context.
- markets/languages.

Actions:

- accept.
- edit.
- reject.
- rerun AI with notes.

### Step 7: Triage Pages

Pages table should show:

- issue count.
- severity breakdown.
- top issue.
- traffic.
- keywords.
- conversions.
- internal links.
- schema status.
- content quality.

Analyst should sort/filter pages to find the most important work.

### Step 8: Triage Issues

Issues table should show:

- affected URL.
- severity.
- priority.
- evidence.
- why it matters.
- how to fix.
- owner.
- status.
- validation method.

Clicking an issue opens an evidence drawer.

### Step 9: Analyze Keywords

Keyword workflow should show:

- GSC queries.
- seed keywords.
- mapped keywords.
- unmapped keywords.
- ranking page.
- target page.
- intent.
- clicks.
- impressions.
- CTR.
- position.
- opportunity score.
- cannibalization.

### Step 10: Analyze Opportunities

Opportunities should include:

- quick-win keywords.
- CTR improvements.
- content gaps.
- internal linking.
- schema.
- conversion.
- performance.
- GEO/AEO.

Every opportunity must show evidence and next action.

### Step 11: Create Work Plan

Issues and opportunities become work items:

- open.
- planned.
- in progress.
- fixed pending verification.
- verified.
- ignored.
- not applicable.

Work item fields:

- owner.
- due date.
- effort.
- priority.
- evidence.
- acceptance criteria.

### Step 12: Verify Fixes

After fixes:

- re-crawl affected pages.
- re-run relevant rules.
- compare old vs new findings.
- auto-mark verified when rule passes.
- keep analyst override.

### Step 13: Report Internally

Reports are in-tool first.

Reports should include:

- executive summary.
- current health.
- major issues.
- opportunities.
- completed work.
- progress over time.
- next steps.
- data limitations.

### Step 14: Monitor Weekly/Monthly

Monitoring should include:

- scheduled crawls.
- scheduled audits.
- scheduled integrations sync.
- weekly progress report.
- monthly progress report.
- alerts for drops/failures/critical issues.

## Daily Analyst Workflow

Analyst opens workspace and sees:

- failed crawls/audits.
- projects needing profile approval.
- critical/high issues.
- fixes pending verification.
- traffic/ranking drops.
- reports due.
- top opportunities.

They should not need a spreadsheet to know what to do.

## Monthly Client Workflow

Client or account manager should see:

- what improved.
- what was fixed.
- what still matters.
- what work is planned.
- what KPI movement occurred.
- what data sources were used.

## Mandatory Info Icons

Every technical term in these workflows must include an info icon with plain-language explanation.

