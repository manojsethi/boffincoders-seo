# 10. Implementation Done Definition And Self-Audit

## Purpose

This document defines what "done" means for this rebuild.

The project must not be marked complete because a model, API route, table, or chart exists. A phase is complete only when the real SEO analyst workflow works from start to finish.

The goal is not to build disconnected features. The goal is to build a product that an SEO analyst can use daily for real clients.

## Core Done Rule

A phase is done only when:

1. The analyst can complete the intended workflow in the UI.
2. The backend stores the required data.
3. The frontend displays the data clearly.
4. The user can understand what the data means.
5. The user can take action from the screen.
6. Missing data is explained clearly.
7. The feature works for different website types.
8. The feature has empty, loading, error, success, and partial-data states.
9. Technical terms have info icons.
10. The implementer has performed a self-audit and written what was validated.

## No Legacy Rule

This is a fresh rebuild. Do not keep irrelevant legacy code, schema, routes, files, placeholders, old assumptions, or old UI flows.

Code can be copied from the old project only when it is still useful and fits the new product flow.

Do not preserve:

- Old website type assumptions that only fit service/company websites.
- Old fixed entity group logic.
- Dead routes.
- Dead schemas.
- Unused UI components.
- Placeholder screens that look complete but do not support workflow.
- Old worker/BullMQ concepts if Agenda is the selected job system.
- PDF generation code while PDF is intentionally deferred.
- Hardcoded SEO assumptions that block NGOs, schools, publishers, ecommerce, marketplaces, SaaS, healthcare, local businesses, communities, directories, or personal brands.

The product can be phased, but each phase must be clean.

## Do Not Mark Complete If

Do not mark any phase complete if:

- Data is stored but not visible in the UI.
- A table exists but cannot answer the analyst's next question.
- An issue exists but does not show affected URL.
- An issue exists but does not show evidence.
- A chart exists but does not explain source, date range, or meaning.
- A report exists but does not tell what changed or what to do next.
- A crawl runs but the user cannot tell whether the crawl was healthy.
- Rules run but there is no page-level detail.
- AI generates text without showing source evidence.
- GSC/GA4/CWV is connected but not used in decisions.
- Keywords are stored but not mapped to pages.
- Goals are stored but not used for prioritization.
- Technical terms appear without info icons.
- There is no empty state for missing integrations.
- There is no error state for failed crawl/sync/audit.
- The flow only works for service-business websites.
- The implementer cannot explain how the user validates the feature.

## Required Implementation Response Format

After each implementation pass, the developer or AI agent must respond with this structure:

```md
## Implemented

- ...

## Copied Or Adapted From Old Project

- ...

## Missing Or Deferred

- ...

## Data Model / API Changes

- ...

## UI Flow Implemented

- ...

## How I Validated The Flow

- ...

## Self-Audit Result

Pass / Partial / Fail

## Remaining Questions

- ...
```

If the self-audit result is Partial or Fail, the phase is not complete.

## Product Owner Question Rule

If a requirement is unclear or could significantly affect SEO workflow, ask before building.

Ask questions for:

- Goal model decisions.
- Website type flexibility.
- Data source priority.
- Report audience.
- AI cost/model decisions.
- External integration limits.
- Crawl limits.
- Rule severity scoring.
- Client-facing workflow.

Do not ask questions for small UI details that can be solved with sensible product judgment.

## Phase 1 Done Definition: Pages, Issues, Evidence And Triage

### Intended User Flow

The SEO analyst opens a project after a crawl and audit.

They should be able to:

1. See total crawled pages.
2. See which pages have issues.
3. See issue count per page.
4. Hover/click issue count and see high/medium/low breakdown.
5. Open a page workspace.
6. See all issues affecting that page.
7. Open an issue.
8. Understand what is wrong.
9. See evidence from the crawl.
10. See why it matters.
11. See how to fix it.
12. Assign lifecycle status.
13. Re-audit later and verify whether the issue is resolved.

### Required Screens

- Pages list.
- Page detail/workspace.
- Issues list.
- Issue drawer/detail.
- Project overview with top issue summary.

### Required Pages Table Behavior

The Pages table must include:

- URL
- Page role
- HTTP status
- Indexability
- Canonical status
- Title
- H1
- Word count
- Internal links in
- Internal links out
- Organic clicks if GSC connected
- Organic impressions if GSC connected
- Issue count
- High issue count
- Medium issue count
- Low issue count
- Last crawled date

Issue count behavior:

- The count must be visible per URL.
- Popover must show high, medium, low counts.
- Clicking the count must filter issues for that page.
- If zero issues, show a clear zero state.

### Required Issues Table Behavior

The Issues table must include:

- Severity
- Title
- Affected URL
- Rule ID
- Category
- Status
- Lifecycle status
- Priority
- Impact
- Effort
- Evidence
- Last detected

The user must never wonder "which page has this issue?"

### Required Issue Detail Behavior

Each issue detail must show:

- Rule name.
- Affected URL.
- Severity.
- Priority.
- Why it matters.
- Exact evidence.
- Recommended fix.
- Data source.
- First detected.
- Last detected.
- Lifecycle status.
- Related issues.
- Re-audit verification state.

### Required Filters

- Severity.
- Category.
- Page role.
- Issue status.
- Lifecycle status.
- Page URL.
- Rule ID.
- Impact.
- Effort.
- Search.

### Validation Checklist

Mark complete only if:

- The analyst can move from project overview to page to issue without losing context.
- Every issue shows affected URL.
- Every issue has evidence.
- Pages show issue counts.
- Issue count popover works.
- Issue count click filters correctly.
- Page detail shows page-level issue list.
- Issue lifecycle status is visible and editable if implemented.
- Empty states exist.
- Loading states exist.
- Error states exist.
- Technical terms have info icons.
- Cheerio extracts JSON-LD from raw HTML when it exists.
- Schema extraction source is visible in Pages, Page Workspace, and Issue Drawer.
- Schema status distinguishes `raw-html`, `rendered-html`, `both`, `none`, and `not-verified`.
- Missing raw JSON-LD without rendered extraction is shown as `not_verified`, not a missing-schema failure.
- Analyst can trigger rendered verification for one page or selected pages before schema rules create hard failures.
- Data gaps show rendered/schema verification gaps separately from SEO issues.

## Phase 2 Done Definition: Audit Rule Expansion

### Intended User Flow

The analyst runs an audit and receives broad, meaningful coverage across technical SEO, content, schema, AI visibility, conversions, and site quality.

They should not receive only a tiny list of generic issues.

Before starting this phase, read `11-rule-engine-and-audit-behaviour.md`.

Phase 2 is not complete unless the rule behaviour model is implemented. Adding more rules is not enough.

Early in this phase, add project-level crawl/render settings:

- `cheerio-only`
- `cheerio-with-playwright-fallback`
- `playwright-only`

The default must be `cheerio-with-playwright-fallback`. This setting prevents rule expansion from producing false render-sensitive issues on JavaScript-heavy websites.

### Required Rule Coverage

Short-term target:

- 60-80 useful rules.

Medium-term target:

- 90-110 useful rules.

Long-term target:

- 150-250 useful checks only if they create real analyst value.

Do not chase rule count for vanity.

### Required Rule Categories

- Crawl and indexability.
- Metadata.
- Headings.
- Content quality.
- Duplicate content signals.
- Internal linking.
- Structured data.
- Core Web Vitals.
- Accessibility-related SEO signals.
- Image SEO.
- E-E-A-T.
- AEO.
- GEO.
- Conversion readiness.
- GSC-driven opportunities.
- GA4-driven engagement issues.
- Content decay.
- Traffic/ranking drift.
- Site architecture.

### Required Rule Contract

Every rule must define:

- Rule ID.
- Title.
- Category.
- Severity logic.
- Applicability logic.
- Required data sources.
- Evidence fields.
- Recommendation.
- Why it matters.
- Effort estimate.
- Impact estimate.
- Confidence.
- Not-applicable behavior.
- Not-verified behavior.
- Needs-review behavior.

### Required Applicability Behavior

Rules must not be blindly applied to every website.

Examples:

- Product schema should not be required for NGO donation pages unless product content exists.
- Local SEO rules should only apply when the site has local business intent.
- Author bio rules should apply to articles or expert content, not contact pages.
- Service page rules should apply only when service pages exist.
- Ecommerce rules should apply only when ecommerce patterns exist.

### Validation Checklist

Mark complete only if:

- Current rule count is clearly visible in developer notes.
- Project-level crawl/render mode exists and is visible before crawl/audit.
- Hybrid Cheerio + selective Playwright fallback is the default mode.
- Cheerio-only and Playwright-only modes are available with clear speed/cost explanation.
- Useful old project rules were reviewed and ported where still relevant.
- Old rules were audited for strictness before porting.
- Open-source rule ideas were adapted to this product's workflow.
- Rules support multiple website types.
- Rules return pass/fail/warning/not-applicable/not-verified where appropriate.
- Rules return needs-review for low-confidence contextual findings.
- Each failed rule produces evidence.
- Issues created from rules appear in UI.
- Rule categories are filterable.
- Rule output can drive reports.
- Rules do not produce noisy false positives on non-service websites.
- E-E-A-T, GEO, AEO, content-quality, and conversion-readiness rules are contextual and not harsh universal failures.
- Missing external data is shown as not verified, not as a failure.

## Phase 3 Done Definition: GSC, GA4 And Core Web Vitals Integrations

### Intended User Flow

The analyst connects real performance data and sees how technical/content problems affect search and business outcomes.

They should be able to answer:

- Which pages get organic traffic?
- Which pages are declining?
- Which queries have opportunity?
- Which pages have high impressions but low CTR?
- Which pages convert?
- Which SEO pages bring engaged users?
- Which pages are slow or failing Core Web Vitals?

### Google Search Console Requirements

The user must be able to:

- Connect GSC.
- Select a property.
- Sync date ranges.
- See last sync time.
- See clicks.
- See impressions.
- See CTR.
- See average position.
- See page-query mapping.
- See query trends.
- See page trends.
- Detect cannibalization.
- Detect low CTR opportunities.
- Detect ranking drops.
- Detect high-impression low-click opportunities.

### GA4 Requirements

The user must be able to:

- Connect GA4.
- Select property.
- Sync landing page data.
- See organic sessions.
- See engaged sessions.
- See engagement rate.
- See conversions/events.
- See page contribution to goals.
- Compare SEO traffic and engagement by page.
- Identify high-traffic low-conversion pages.
- Identify low-traffic high-conversion pages.

### Core Web Vitals Requirements

The user must be able to:

- See CWV field data where available.
- See LCP.
- See INP.
- See CLS.
- See pass/fail status.
- See URL-level performance.
- Understand when data is unavailable.

### Missing Data States

If GSC is not connected:

> Connect Google Search Console to see search queries, clicks, impressions, CTR, average position, cannibalization, and ranking opportunities.

If GA4 is not connected:

> Connect GA4 to understand which SEO pages drive engagement and conversions.

If CWV is unavailable:

> Core Web Vitals field data is unavailable for this URL. This may happen when the URL does not have enough Chrome user data.

### Validation Checklist

Mark complete only if:

- Integrations can be connected from UI.
- Property selection works.
- Sync status is visible.
- Last sync time is visible.
- Synced data appears on project overview.
- Synced data appears on page detail.
- Synced data influences opportunity scoring.
- Missing integration states are useful.
- Technical terms have info icons.
- Integration failures show actionable errors.

## Phase 4 Done Definition: Goals, Keywords And Opportunities

### Intended User Flow

The analyst defines what the client wants and the product prioritizes SEO work accordingly.

SEO goals must be dynamic. Not every website wants "more leads". Some want:

- Donations.
- Applications.
- Course enrollments.
- Store sales.
- Bookings.
- Newsletter subscribers.
- Membership growth.
- Event registrations.
- Support deflection.
- Brand visibility.
- Local calls.
- Demo requests.
- More qualified enterprise leads.

### Required Goal Behavior

The project must support:

- Multiple goals.
- Goal priority.
- Goal type.
- Conversion action.
- Target pages.
- Target audience.
- Target geography.
- Notes.
- Measurement source.

The UI must not force every website into service/technology/industry structure.

### Required Keyword Behavior

The product must support:

- Seed keyword entry.
- Import from GSC queries.
- Keyword clustering.
- Search intent classification.
- Funnel stage.
- Branded/non-branded.
- Target page mapping.
- Current ranking page.
- Cannibalization detection.
- Keyword opportunity scoring.
- Content gap detection.

External keyword volume/difficulty can be added later, but the product must still use GSC queries meaningfully when available.

### Required Opportunity Behavior

Each opportunity must show:

- Opportunity title.
- Related goal.
- Affected page.
- Related query/keyword/topic.
- Expected impact.
- Effort.
- Confidence.
- Evidence.
- Recommended action.
- Owner/status.

### AI Behavior

AI may help with:

- Intent classification.
- Topic clustering.
- Page purpose summaries.
- Opportunity wording.
- Content gap summaries.
- Report narratives.

AI must not replace evidence.

Every AI insight must show:

- Source pages.
- Source metrics.
- Confidence.
- Whether analyst review is required.

### Validation Checklist

Mark complete only if:

- User can create goals for different website types.
- Goals influence dashboard and priority scoring.
- GSC queries can become keyword opportunities.
- Keywords can be mapped to pages.
- Opportunities show evidence.
- AI outputs are grounded in data.
- The analyst can decide what to work on next.
- Technical terms have info icons.

## Phase 5 Done Definition: Reporting, Dashboards And Graphs

### Intended User Flow

The analyst can explain project status, progress, wins, risks, and next actions without manually building Excel reports.

Reports are internal in-tool first. PDF is deferred.

### Required Report Types

- Initial audit report.
- Weekly progress report.
- Monthly SEO performance report.
- Technical issue report.
- Content opportunity report.
- GSC opportunity report.
- GA4 conversion insight report.
- Fix verification report.

### Required Report Sections

Every report should include:

- Executive summary.
- What changed.
- Wins.
- Risks.
- Priority fixes.
- Pages needing attention.
- Search performance.
- Engagement/conversion performance.
- Technical health.
- Content opportunities.
- Next action plan.
- Data freshness.
- Missing data warnings.

### Required Graphs

Project dashboard graphs:

- Health score trend.
- Issues by severity.
- Issues by category.
- Fixed vs new issues.
- Organic clicks trend.
- Organic impressions trend.
- CTR trend.
- Average position trend.
- Organic sessions trend.
- Conversions from organic trend.
- CWV pass/fail trend.
- Top gaining pages.
- Top declining pages.
- Keyword/query opportunity trend.

Page detail graphs:

- Clicks over time.
- Impressions over time.
- CTR over time.
- Average position over time.
- Organic sessions over time.
- Engagement/conversion over time.
- Issue history.
- CWV history where available.

Reports must pair charts with tables. Analysts need both visual trend and exact data.

### Chart Rules

Every chart must show:

- Title.
- Date range.
- Data source.
- Last updated.
- Empty state.
- Info icon.
- Table view or export-ready data.

### Validation Checklist

Mark complete only if:

- Reports are generated from real stored data.
- Reports show trend/change, not only current snapshot.
- Reports explain why items matter.
- Reports give next actions.
- Reports warn about missing integrations.
- Charts have data source and date range.
- Charts do not hide important table data.
- Technical terms have info icons.

## Phase 6 Done Definition: Agency Scale And Advanced Product

### Intended User Flow

An agency owner or senior SEO lead can manage many clients without opening every project manually.

They should know:

- Which clients are in trouble.
- Which clients improved.
- Which audits failed.
- Which integrations broke.
- Which projects need attention this week.
- Which fixes were verified.
- Which reports are ready.
- Which opportunities are highest value.

### Required Agency Dashboard

The dashboard must include:

- Client/project list.
- Health score.
- Trend.
- Last crawl.
- Last audit.
- Last GSC sync.
- Last GA4 sync.
- Open high-priority issues.
- New issues.
- Fixed issues.
- Traffic trend.
- Conversion trend.
- Report status.
- Attention required flag.

### Required Work Queues

Queues should include:

- High priority technical fixes.
- Pages losing traffic.
- Pages with high impressions and low CTR.
- Pages with high traffic and low conversion.
- Broken pages.
- Missing schema opportunities.
- Content refresh opportunities.
- Internal linking opportunities.
- Reports due.
- Integrations requiring attention.

### Required Monitoring

Agenda jobs should support:

- Scheduled crawls.
- Scheduled audits.
- GSC sync.
- GA4 sync.
- CWV refresh.
- Report generation.
- Alert creation.

Progress should be visible in the frontend through stored job/run status and realtime updates if implemented.

### Advanced Product Areas

Future advanced modules:

- Rank tracking.
- Backlink/referring domain data.
- SERP competitor tracking.
- Local SEO citation tracking.
- Content inventory.
- Internal link graph visualization.
- GEO/AEO visibility checks.
- AI answer readiness.
- Competitor content gap analysis.
- Client sharing portal.
- Team roles and permissions.

### Validation Checklist

Mark complete only if:

- Multi-client overview is useful without opening projects.
- Alerts are actionable.
- Scheduled jobs show status.
- Reports can be reviewed internally.
- Work queues help analysts decide what to do.
- Advanced modules do not clutter core workflow.
- Technical terms have info icons.

## Data Quality Self-Audit

Before marking any feature complete, check:

1. Is the data real or placeholder?
2. Is the source visible?
3. Is the last updated time visible?
4. Is the date range visible?
5. Is missing data explained?
6. Can the user drill down to affected URLs?
7. Can the user see evidence?
8. Can the user take action?
9. Can the user verify the action later?
10. Does this work for multiple website types?

## UI Self-Audit

Before marking any UI complete, check:

1. Is the screen useful to a real SEO analyst?
2. Is the next action obvious?
3. Are filters available where needed?
4. Is the table sortable?
5. Does the screen have empty/loading/error states?
6. Does it work on laptop and desktop sizes?
7. Does it avoid cramped layouts?
8. Are technical terms explained?
9. Are charts paired with tables?
10. Can the user drill down from summary to detail?

## SEO Analyst Self-Audit

Ask these questions:

1. Can I use this to diagnose a client website faster than manual spreadsheet work?
2. Can I explain the issue to a developer?
3. Can I explain the issue to a client?
4. Can I prioritize what matters most?
5. Can I track progress over time?
6. Can I prove fixes were completed?
7. Can I find growth opportunities, not only errors?
8. Can I connect SEO work to goals?
9. Can I trust the data source?
10. Would I use this every week for 200-300 clients?

If the answer is no, the phase is not done.

## AI Self-Audit

AI features must be audited carefully.

Ask:

1. Is the AI using crawl/GSC/GA4/CWV/keyword data?
2. Are source pages shown?
3. Are metrics shown?
4. Is confidence shown?
5. Is analyst review required where needed?
6. Is the output specific to the website?
7. Does the AI avoid generic SEO advice?
8. Does it help decision-making?
9. Does it reduce analyst time?
10. Is the model choice cost-appropriate?

Do not mark AI complete if it only generates generic text.

## Report Self-Audit

A report is complete only if it helps the analyst communicate.

Ask:

1. Does it show what changed?
2. Does it show what matters?
3. Does it show why it matters?
4. Does it show what to do next?
5. Does it include supporting data?
6. Does it include affected pages?
7. Does it include progress over time?
8. Does it warn about missing data?
9. Does it use client-friendly language?
10. Could this replace manual report preparation?

## Integration Self-Audit

For GSC, GA4, CWV, and future integrations:

1. Can the user connect the integration?
2. Can the user select the correct property?
3. Can the user see sync status?
4. Can the user see sync errors?
5. Can the user retry sync?
6. Can the user see last synced time?
7. Is the data visible in dashboards?
8. Is the data visible on page detail?
9. Is the data used in opportunities/reports?
10. Is missing data explained?

## Crawl And Audit Self-Audit

Ask:

1. Did the crawl discover enough pages?
2. Were blocked/failed pages recorded?
3. Is crawl health visible?
4. Are pages classified flexibly?
5. Are page roles editable or reviewable?
6. Are crawl limits visible?
7. Are audit rules applied only when relevant?
8. Are false positives controlled?
9. Are issue counts understandable?
10. Can the user re-audit and compare results?
11. Does raw extraction identify JSON-LD from server HTML?
12. Does rendered extraction exist for pages that need verification?
13. Are missing rendered checks shown as `not_verified`, not false failures?
14. Can analysts bulk-select pages for rendered recrawl?

## Website Type Flexibility Self-Audit

The product must support different website types.

Validate against:

- Service agency.
- SaaS.
- Ecommerce.
- NGO.
- Educational institution.
- Healthcare site.
- Local business.
- Publisher/blog.
- Directory.
- Marketplace.
- Personal brand.
- Community website.

Ask:

1. Does onboarding force wrong categories?
2. Are goals flexible?
3. Are page roles flexible?
4. Are rules conditionally applied?
5. Does AI infer but not hard-lock classification?
6. Can analyst override assumptions?
7. Does reporting language adapt?

## Definition Of Ready Before Starting A Phase

Before starting a phase, confirm:

- The phase file has been read end-to-end.
- Open product questions are listed.
- Existing old-project code to reuse has been identified.
- Data model impact is understood.
- UI screens are understood.
- Validation checklist is understood.
- No unnecessary legacy assumptions are being carried forward.

## Definition Of Done For Any Phase

A phase is complete only when all of these are true:

- Product flow works.
- UI supports the flow.
- Backend supports the flow.
- Data is real.
- Missing states are handled.
- Technical terms are explained.
- Analyst can act on the output.
- Reports or summaries use the data where relevant.
- The implementer completed self-audit.
- The implementer marked the phase as done only after validation.

## Final Instruction To Implementers

Do not optimize for speed of marking tasks complete.

Optimize for building a tool that a senior SEO analyst would actually trust.

If a feature is incomplete, say it is incomplete.

If a flow is not validated, do not mark it done.

If a requirement is unclear, ask.

If the implementation becomes too large, split the phase into smaller slices, but each slice must still deliver a working user flow.
