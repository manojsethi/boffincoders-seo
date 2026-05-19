# 11. Rule Engine And Audit Behaviour

## Purpose

This document defines how SEO audit rules must work in the rebuilt product.

The rule engine is the heart of the tool. If rules are too strict, generic, noisy, or wrongly applied, the product will frustrate SEO analysts instead of helping them.

The old project rules must be treated as a reference library, not as final product truth.

Do not blindly copy old rules.

Do not blindly copy open-source rules.

Do not chase the highest number of checks.

Build a rule system that a senior SEO analyst managing 300 active clients would actually trust.

## Sources Reviewed For Inspiration

These projects are useful as inspiration, but not as direct blueprints:

- [context-dot-dev/ai-seo-audit](https://github.com/context-dot-dev/ai-seo-audit)
- [seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill)
- [dageno-agents/seo-geo-audit](https://github.com/dageno-agents/seo-geo-audit)

### Useful Ideas From context-dot-dev/ai-seo-audit

This project is strong because it keeps the audit lightweight and focused on AI/GEO readiness.

Useful ideas:

- Rules are category-driven.
- Rules can return `pass`, `partial`, `fail`, or `na`.
- Rules declare dependencies.
- Scoring and UI derive from the rule definitions.
- The audit produces agent-ready fix prompts.
- Markdown extraction is treated as a first-class input.

What not to copy blindly:

- It is mostly page-level and AI-readability focused.
- It is not a full agency SEO operating system.
- Its category labels like A/B/C may be useful internally, but our UI should translate them into plain analyst/client language.

### Useful Ideas From seo-skills/seo-audit-skill

This project is useful because it has broad rule coverage across technical SEO, Core Web Vitals, links, images, security, structured data, JavaScript rendering, accessibility, content, social, E-E-A-T, URL structure, redirects, mobile, internationalization, HTML validation, AI/GEO readiness, and legal checks.

Useful ideas:

- Broad rule catalog.
- Category weights.
- Single-page and crawl modes.
- Configurable crawl limits.
- JSON, HTML, Markdown, and LLM-oriented outputs.
- Interactive results with expandable rule cards.
- Affected item details.
- Score history.
- Cross-page checks such as duplicate titles, duplicate content, orphan pages, redirect chains, and pagination.

What not to copy blindly:

- A large rule count can create noise.
- Some rules are compliance/dev-quality checks more than SEO business priorities.
- Hard thresholds must be adapted by page type, website type, and goal.
- A senior analyst does not need 250 raw findings. They need a clear decision system.

### Useful Ideas From dageno-agents/seo-geo-audit

This project is especially useful for product thinking because it frames SEO + GEO as a decision system rather than a raw checklist.

Useful ideas:

- Technical, content, GEO, trust, entity, authority, and platform-fit signals are unified.
- Findings are separated into `Observed`, `Assessment`, and `Not verified`.
- Priorities are simplified into P0, P1, and P2.
- Reports can adapt for leadership, operator, and specialist audiences.
- Crawls are page-capped, not fixed-depth.
- Missing data must be clearly marked as not verified.
- The audit should continue from observable site evidence when external integrations are missing.
- It should not imply access to private analytics, Search Console, backlink, or citation data unless connected.

What not to copy blindly:

- It is more of a workflow/reporting framework than a detailed persisted SaaS data model.
- The product still needs concrete page-level issues, rule evidence, verification, trends, integrations, and UI drilldowns.

## Senior Analyst Principle

Rules must help answer these questions:

1. What is actually wrong?
2. Where is it wrong?
3. Why does it matter?
4. How serious is it?
5. Is it relevant to this website?
6. Is it relevant to this page?
7. What data proves it?
8. What should be done next?
9. Can the fix be verified later?
10. Is this worth doing before other work?

If a rule cannot answer these questions, it should not create a noisy issue.

## The Biggest Mistake To Avoid

The biggest mistake is treating every SEO best practice as a universal requirement.

Examples:

- Not every website needs product schema.
- Not every website needs local business schema.
- Not every website needs author bylines on every page.
- Not every page needs 300+ words.
- Not every page needs social sharing metadata to be a priority.
- Not every site should expose all AI crawlers.
- Not every noindex page is a problem.
- Not every low word count page is thin content.
- Not every page without FAQ content should be asked to add FAQ schema.
- Not every NGO, school, local clinic, ecommerce store, marketplace, SaaS, directory, or publication should be judged by the same rule set.

Rules must be dynamic, controlled, explainable, and evidence-based.

## Required Rule Philosophy

### 1. Applicability First

Before a rule checks pass/fail, it must decide whether it applies.

The engine must support:

- Applies.
- Does not apply.
- Not enough data.
- Needs analyst review.

Example:

`Product schema missing` should not fail on a nonprofit donation page unless the page actually represents a product or offer that should use Product schema.

Example:

`Author bio missing` should not fail on a contact page, pricing page, homepage, or product listing page.

Example:

`LocalBusiness schema missing` should not fail on a global SaaS company unless local business intent is detected or configured.

### 2. Evidence Before Opinion

Every issue must include the exact evidence used.

Good evidence:

- URL.
- HTML snippet.
- Extracted title.
- Extracted H1.
- Canonical value.
- Status code.
- Robots directive.
- Schema type found.
- Missing schema property.
- GSC query data.
- GA4 conversion data.
- CWV metric value.
- Source page count.
- Duplicate group.
- Internal link count.

Bad evidence:

- "This page may not be optimized."
- "Improve SEO."
- "Content seems weak."
- "Add more trust signals."

### 3. Observed vs Assessment vs Not Verified

Rules must separate factual findings from strategic interpretation.

#### Observed

Facts the tool can prove from available data.

Examples:

- Page returns 404.
- Page has no title tag.
- Page has meta robots noindex.
- Page canonical points to another URL.
- Page has no H1.
- GSC shows 10,000 impressions and 0.6% CTR.

#### Assessment

Analyst-style interpretation based on observed signals.

Examples:

- This page may be underperforming because it has high impressions and low CTR.
- This service page is weak because it lacks proof, outcomes, and conversion clarity.
- This content cluster is thin compared with the apparent topic scope.

#### Not Verified

Signals that cannot be confirmed because the tool lacks data.

Examples:

- Backlink strength not verified because no backlink provider is connected.
- Local citation consistency not verified because no citation source is connected.
- AI citation visibility not verified because no AI visibility tracking source is connected.
- Conversion quality not verified because GA4 is not connected.
- Schema presence not verified because JSON-LD was not found in raw HTML and rendered extraction has not run.

The UI must show these states clearly.

Never convert unknowns into failures.

## Raw Vs Rendered Evidence

The rule engine must understand the difference between raw HTML evidence and rendered HTML evidence.

Cheerio/raw extraction is fast and should remain the default crawler path.

Rendered extraction should be selective and used for verification when raw HTML does not contain the signals needed for a confident audit.

## Project Crawl / Render Modes

Rules must understand the project's crawl/render mode.

Recommended project-level modes:

### Cheerio Only

Use raw HTML only.

Best for:

- Static websites.
- Fast technical checks.
- Low-cost exploratory audits.
- Sites where server-rendered HTML contains metadata, headings, schema, and content.

Rule behaviour:

- Do not fail render-sensitive rules when raw evidence is missing.
- Return `not_verified` for checks that require rendered evidence.

### Cheerio With Playwright Fallback

Use Cheerio first, then selective Playwright verification.

This is the default mode.

Best for:

- Most agency/client websites.
- Sites where most pages are server-rendered but some schema/content may be injected by JavaScript.
- Audits where speed matters but false missing-schema/content issues must be avoided.

Fallback should run for:

- homepage.
- important pages.
- schema-not-verified pages.
- JavaScript-suspected pages.
- analyst-selected pages.
- sampled pages in standard/full crawl modes.

Rule behaviour:

- Evaluate raw evidence first.
- Trigger or request rendered verification where needed.
- Return `not_verified` until rendered verification exists for render-sensitive checks.

### Playwright Only

Render every crawled page.

Best for:

- JavaScript-heavy websites.
- SPAs where raw HTML is almost empty.
- Sites where metadata, schema, headings, or main content are injected after render.

Rule behaviour:

- Treat rendered HTML as primary evidence.
- Still keep raw evidence where available for comparison.
- Warn analysts that crawl time and resource usage will increase.

Do not make Playwright-only the global default.

### Required Extraction Sources

Evidence must be able to identify its source:

- `raw-html`
- `rendered-html`
- `both`
- `none`
- `not-verified`

Examples:

- JSON-LD found in server HTML: `raw-html`.
- JSON-LD injected by JavaScript after render: `rendered-html`.
- JSON-LD found in both raw and rendered HTML: `both`.
- Rendered extraction ran and schema is still missing: `none`.
- Raw HTML has no JSON-LD and rendered extraction did not run: `not-verified`.

### Schema Rule Behaviour

Schema rules must not fail a page only because Cheerio/raw HTML did not find JSON-LD.

Required behaviour:

- If raw HTML has schema, evaluate normally.
- If raw HTML has no schema and rendered extraction has not run, return `not_verified`.
- If rendered extraction finds schema, evaluate using rendered evidence.
- If rendered extraction runs and still no schema exists, then return `warning` or `fail` depending on rule applicability.
- If schema parsing fails, return evidence with parse error and source.

### Rendered Verification Controls

Rendered extraction should be analyst-controlled and selective.

Supported triggers:

- homepage verification.
- important-page verification.
- schema-applicable page verification.
- analyst-triggered "render this page".
- analyst-selected bulk rendered recrawl.
- sample pages in larger crawl modes.

Do not make Playwright the default for every URL.

### Rule Evidence Requirements For Render-Sensitive Checks

Render-sensitive rule evidence must include:

- extraction source.
- raw value.
- rendered value where available.
- whether rendered extraction ran.
- rendered extraction timestamp.
- parse errors if any.
- reason for `not_verified` if rendered extraction has not run.

### UI Requirements For Render-Sensitive Rules

The UI must show source and verification state in:

- Pages table.
- Page workspace Schema tab.
- Issue drawer evidence.
- Data gaps card.
- Reports when schema/render-sensitive issues are mentioned.

## Required Rule Result Statuses

Each rule execution should return one of these statuses:

| Status | Meaning | Creates Issue? | Example |
|---|---|---:|---|
| `pass` | The rule applies and the page/site passes | No | Important page is indexable |
| `warning` | The rule applies and there is moderate concern | Yes | Title is slightly too long |
| `fail` | The rule applies and there is a clear problem | Yes | Important page is noindex |
| `opportunity` | No error, but meaningful SEO upside exists | Yes, as opportunity | High impressions, low CTR |
| `not_applicable` | Rule does not apply to this page/site | No | Product schema check on blog article |
| `not_verified` | Required data is missing | No issue, but show data gap | Backlink quality without backlink data |
| `needs_review` | Tool is unsure and analyst should decide | Optional review item | AI inferred page role with low confidence |

Do not use only pass/fail.

SEO work is not binary.

## Required Rule Object

Every rule should be defined using a structured contract.

```ts
type AuditRule = {
  id: string;
  name: string;
  category: RuleCategory;
  layer: AuditLayer;
  description: string;
  whyItMatters: string;
  appliesTo: RuleApplicabilityDefinition;
  requiredInputs: RuleInput[];
  optionalInputs: RuleInput[];
  evaluate: RuleEvaluator;
  evidenceSchema: EvidenceSchema;
  recommendationTemplate: RecommendationTemplate;
  defaultSeverity: Severity;
  defaultImpact: Impact;
  defaultEffort: Effort;
  confidencePolicy: ConfidencePolicy;
  scoringPolicy: ScoringPolicy;
  reportVisibility: ReportVisibility;
  ownerHint: OwnerHint;
};
```

This does not mean the exact code must use this TypeScript shape, but the product logic must support this level of detail.

## Required Rule Fields

### Rule ID

Stable, readable, and version-safe.

Examples:

- `indexability.noindex-important-page`
- `metadata.title.missing`
- `schema.organization.missing-homepage`
- `gsc.ctr.high-impression-low-click`
- `geo.answer-format.missing-direct-answer`

Bad:

- `rule1`
- `seo-check-a`
- `missingThing`

### Rule Name

Human-readable.

Example:

> Important page is blocked from indexing

### Category

Used for filtering and reporting.

Recommended categories:

- Crawl and indexability
- Metadata
- Content quality
- Internal linking
- Structured data
- Performance
- JavaScript rendering
- Images
- Accessibility-related SEO
- Security and trust
- E-E-A-T
- AEO
- GEO
- Entity clarity
- Conversion readiness
- GSC opportunities
- GA4 engagement and conversion
- Content decay
- Local SEO
- International SEO
- Site architecture

### Layer

Used for strategy-level dashboards.

Recommended layers:

- Technical foundation
- Content and relevance
- Trust and entity
- Search performance
- Business outcomes
- AI visibility
- Monitoring and drift

### Applies To

Defines when the rule should run.

Inputs may include:

- Website type.
- Page role.
- Page template.
- URL pattern.
- Content signals.
- Schema signals.
- GSC data presence.
- GA4 data presence.
- User-defined goals.
- Analyst settings.
- Crawl scope.

### Required Inputs

The rule must declare what it needs.

Examples:

- HTML.
- Rendered HTML.
- Markdown.
- Status code.
- Headers.
- Robots rules.
- Sitemap URLs.
- Internal links.
- Schema extraction.
- GSC page data.
- GSC query data.
- GA4 landing page data.
- CWV data.
- Page role.
- Project goals.

If required inputs are missing, return `not_verified`, not `fail`.

### Evidence Schema

The rule must define what evidence it returns.

Example:

```json
{
  "url": "/services/seo",
  "metaRobots": "noindex,follow",
  "pageRole": "commercial landing page",
  "source": "rendered-html"
}
```

### Recommendation

Recommendations must be specific.

Bad:

> Improve content.

Good:

> This page targets a commercial service query but has no proof section, no case study links, and no clear conversion action. Add outcome-focused proof, 2-3 internal links to relevant case studies, and a primary consultation CTA.

### Confidence

Rules must express confidence.

Examples:

- High confidence: title tag missing.
- Medium confidence: page appears to be a commercial landing page.
- Low confidence: content may lack enough first-party experience evidence.

Low confidence findings should usually become `needs_review`, not hard failures.

## Applicability Model

The rule engine must evaluate applicability before evaluating quality.

### Website-Level Applicability

Examples:

| Website Signal | Rules That May Apply |
|---|---|
| Ecommerce | Product schema, category page optimization, faceted navigation, product image checks |
| NGO | Donation flow, trust transparency, program pages, impact proof, annual report links |
| Education | Course/program pages, admissions intent, faculty credibility, location/campus schema |
| SaaS | Feature pages, comparison pages, demo CTA, integration pages, docs visibility |
| Local business | LocalBusiness schema, NAP consistency, location pages, local intent queries |
| Publisher | Article schema, author pages, editorial policy, freshness, topical clusters |
| Healthcare | YMYL trust, medical reviewer, disclaimers, author credentials |
| Marketplace | Indexation strategy, duplicate/faceted pages, category depth, seller/profile pages |

### Page-Level Applicability

Examples:

| Page Role | Rules That May Apply |
|---|---|
| Home | Organization/WebSite schema, core positioning, primary CTA, internal hub links |
| Service | Commercial intent match, proof, CTA, internal links to case studies/blogs |
| Product | Product schema, pricing/availability where relevant, images, reviews |
| Blog/article | Article schema, author/date, answer clarity, citations, related links |
| Category/hub | Internal linking, crawl depth, topic coverage, duplicate title risk |
| Contact | NAP clarity, form availability, local trust, no requirement for long content |
| Legal/privacy | Indexability may be optional, content length rules should not create noise |
| Donation | Trust, payment path, impact proof, NGO credibility, conversion clarity |
| Course/program | Admissions intent, eligibility, outcomes, curriculum, faculty/authority |

### Data-Level Applicability

Examples:

- GSC CTR rules apply only when GSC is connected and enough impressions exist.
- GA4 conversion rules apply only when GA4 is connected and conversion events are mapped.
- CWV field-data rules apply only when CWV data exists.
- Backlink rules apply only when backlink data is connected.
- Local citation rules apply only when local business scope exists and citation data is connected.

## E-E-A-T Rules Must Be Softer Than Technical Rules

E-E-A-T is not like status code checking.

A 404 is factual.

Missing author expertise is contextual.

The rule engine must treat trust and E-E-A-T as layered signals, not rigid universal failures.

### Bad E-E-A-T Rule

> Fail every page without author byline.

Why this is bad:

- Homepages do not need author bylines.
- Service pages usually do not need author bylines.
- Product pages may not need author bylines.
- Contact pages do not need author bylines.
- Some institutional pages are authored by an organization, not an individual.

### Better E-E-A-T Rule

Rule:

> Expert content lacks visible authorship or review signal.

Applicability:

- Applies to article, guide, medical, financial, legal, educational, research, or advisory content.
- Applies more strongly to YMYL topics.
- Does not apply to basic navigation, contact, legal, product listing, or homepage content unless the page makes expert claims.

Evidence:

- Page role.
- Topic risk.
- Missing author name.
- Missing reviewer.
- Missing publication/update date.
- Missing citation/source references.

Output:

- `fail` only when page is YMYL/expert content and missing critical trust signals.
- `warning` when page is informational but lower risk.
- `needs_review` when page role/topic risk is uncertain.
- `not_applicable` for pages where authorship is not expected.

### E-E-A-T Signal Groups

Do not create one harsh E-E-A-T score.

Use signal groups:

- Identity transparency.
- Author/editor clarity.
- Evidence and citations.
- Policy/legal transparency.
- First-party experience.
- Organization trust.
- External validation.
- Freshness.
- YMYL risk.

Each group should produce observations and recommendations, not just a pass/fail.

## Rule Severity Model

Severity must reflect SEO/business risk, not just best-practice violation.

### Severity Levels

| Severity | Meaning | Example |
|---|---|---|
| Critical | Blocks crawling, indexing, major revenue, or client trust | Important pages noindex, sitewide 5xx, robots blocks site |
| High | Likely suppresses organic performance or conversions | Duplicate titles across many important pages, broken canonical strategy |
| Medium | Meaningful improvement opportunity | Missing meta descriptions on important pages, weak internal links |
| Low | Cleanup or polish | Slight title length issue, missing image dimensions on low-traffic page |

### Priority Is Not The Same As Severity

Priority must combine:

- Severity.
- Page importance.
- Goal relevance.
- Traffic potential.
- Conversion relevance.
- Effort.
- Confidence.
- Data freshness.

Example:

A missing H1 on a high-converting service page may be higher priority than 100 missing alt texts on low-value decorative images.

## P0 / P1 / P2 Priority Model

Use P0/P1/P2 for action planning.

### P0

Fix immediately.

Criteria:

- Indexing/crawl blockers on important pages.
- Sitewide technical failures.
- Important pages unavailable.
- Major tracking/integration failures.
- Severe conversion path breakage.
- Security/trust blockers affecting users.

### P1

Fix in the current work cycle.

Criteria:

- High-value pages with optimization gaps.
- GSC opportunities with strong impressions.
- Duplicate/canonical/internal link issues affecting clusters.
- Important schema gaps.
- Page speed issues on traffic/conversion pages.

### P2

Plan, batch, or monitor.

Criteria:

- Lower-impact cleanup.
- Nice-to-have enhancements.
- Low-confidence observations.
- Non-critical template improvements.

## Scoring Model

Scores must guide decisions, not become vanity numbers.

### Use Separate Scores

Avoid one magical score as the only product output.

Use:

- Technical health score.
- Content quality score.
- Search performance score.
- Conversion readiness score.
- Trust/entity score.
- AI visibility readiness score.
- Integration health score.

### Score Must Be Explainable

Every score must show:

- Which categories contributed.
- Which high-impact issues reduced score.
- Which missing data was excluded.
- Which issues are not applicable.
- How the score changed since last audit.

### Missing Data Must Not Penalize Blindly

If backlink data is missing, do not reduce authority score as if backlinks are poor.

Instead show:

> Authority signals: Not verified because backlink/referring domain data is not connected.

### N/A Should Not Create Penalty

If Product schema does not apply, it must not reduce score.

## Rule Output Must Serve Multiple Audiences

Each rule should support three output layers.

### Boss / Client Summary

Plain language, outcome-focused.

Example:

> Several important pages can appear in Google, but their titles are duplicated. This makes it harder for Google and users to understand which page should rank for each service.

### Operator / SEO Analyst View

Diagnostic and prioritized.

Example:

> 7 indexable commercial pages share the same title template. Prioritize pages with impressions or conversion goals first.

### Specialist / Developer View

Technical fix detail.

Example:

> Update `<title>` values on affected URLs. Keep titles unique, descriptive, and aligned with page intent. Avoid changing canonical targets unless separately reviewed.

## Rule Categories To Build

The goal is not to build all categories at once. But the rule engine should be shaped so all can be added later without breaking the product.

### Phase 1 Rule Categories

Must support:

- Crawl/indexability.
- Metadata.
- Headings.
- Canonical.
- Internal links.
- Structured data basics.
- Content basics.
- Image basics.
- Site health.

### Phase 2 Rule Categories

Add:

- Duplicate content.
- Redirect chains.
- Orphan pages.
- Sitemap/robots validation.
- JavaScript rendering differences.
- Core Web Vitals.
- Accessibility-related SEO.
- Security/trust basics.
- E-E-A-T contextual checks.
- Conversion readiness.

### Phase 3 Rule Categories

Add:

- GSC opportunities.
- GA4 engagement/conversion.
- Content decay.
- Query-page mapping.
- Cannibalization.
- Topic cluster gaps.
- AI/GEO readiness.
- AEO answer clarity.
- Entity clarity.

### Phase 4 Rule Categories

Add:

- Backlink/referring domain analysis.
- SERP competitor comparisons.
- Local SEO citations.
- International SEO/hreflang.
- Advanced ecommerce/faceted navigation.
- Advanced publisher/news freshness.
- AI citation/LLM visibility monitoring.

## Rule Examples

### Example 1: Important Page Is Noindex

Category:

> Crawl and indexability

Applicability:

- Applies to pages marked as important, commercial, informational, goal-related, or receiving GSC impressions/clicks.
- Does not apply to legal/privacy/admin/search/filter pages unless analyst marks them important.

Inputs:

- HTML/rendered HTML.
- Meta robots.
- X-Robots-Tag.
- Page role.
- Goal mapping.
- GSC page data if available.

Status logic:

- `fail`: important page is noindex.
- `warning`: uncertain page role and page is noindex.
- `not_applicable`: intentionally non-indexable page.
- `needs_review`: tool cannot determine importance.

Evidence:

- URL.
- Meta robots value.
- Header robots value.
- Page role.
- Importance reason.

Recommendation:

> If this page should appear in Google, remove the noindex directive and re-audit. If it is intentionally private, mark it as intentionally non-indexable so it does not appear as an issue.

### Example 2: High Impressions, Low CTR

Category:

> GSC opportunities

Applicability:

- Requires GSC.
- Requires minimum impressions threshold.
- Applies to indexable pages only.

Inputs:

- GSC clicks.
- GSC impressions.
- CTR.
- Average position.
- Query/page mapping.
- Title.
- Meta description.

Status logic:

- `opportunity`: impressions are meaningful and CTR is below expected range for position/query type.
- `not_verified`: GSC missing.
- `not_applicable`: impressions too low.

Evidence:

- Query.
- Page.
- Impressions.
- Clicks.
- CTR.
- Average position.
- Date range.

Recommendation:

> Review SERP intent, title tag, meta description, and competing result angles. Rewrite snippet for the primary query group and monitor CTR change over the next 2-4 weeks.

### Example 3: Thin Content

Category:

> Content quality

Applicability:

- Applies to pages expected to satisfy informational, commercial, or decision-making intent.
- Does not apply to contact, legal, login, utility, thin confirmation, or simple navigation pages.

Inputs:

- Markdown.
- Word count.
- Page role.
- Headings.
- Internal links.
- GSC query data if available.

Status logic:

- `fail`: important content/commercial page has insufficient useful information.
- `warning`: content appears light but page role is uncertain.
- `not_applicable`: page purpose does not require depth.

Evidence:

- Word count.
- Page role.
- Missing sections.
- Query/topic target if known.

Recommendation:

> Add content that satisfies the page purpose: who it is for, what problem it solves, proof, process, FAQs, related internal links, and a next action.

### Example 4: E-E-A-T Author Signal Missing

Category:

> E-E-A-T

Applicability:

- Applies to articles, advice, research, medical, financial, legal, education, or high-trust topics.
- Does not apply to most product/service landing pages unless they make expert claims.

Inputs:

- Markdown.
- Author extraction.
- Date extraction.
- Page role.
- Topic risk classification.
- Schema.

Status logic:

- `fail`: YMYL/expert content lacks author/reviewer and trust context.
- `warning`: informational content lacks author/date.
- `needs_review`: page looks like advice but confidence is low.
- `not_applicable`: page does not require authorship.

Evidence:

- Page role.
- Topic risk.
- Author found/not found.
- Date found/not found.
- Schema author field.

Recommendation:

> Add visible author/reviewer information where expert accountability matters. For organization-authored content, add editorial ownership, review process, and supporting citations.

### Example 5: Product Schema Missing

Category:

> Structured data

Applicability:

- Applies to product detail pages.
- Applies to ecommerce pages with clear product entity.
- Does not apply to service pages, blog posts, NGO donation pages, generic landing pages, or category pages unless product entity is clear.

Inputs:

- Page role.
- URL pattern.
- Product signals.
- Existing schema.

Status logic:

- `warning`: product page lacks Product schema.
- `not_applicable`: page is not a product page.
- `needs_review`: product/service ambiguity.

Evidence:

- Product signals.
- Schema types found.
- Page role confidence.

Recommendation:

> Add valid Product schema only if the page represents a specific product with required visible information.

## Rule Lifecycle

Rules themselves need lifecycle management.

### Draft

Rule idea exists but is not ready.

### Experimental

Rule runs but outputs are marked low confidence or internal-only.

### Active

Rule is trusted and can create normal issues.

### Deprecated

Rule is being phased out.

### Disabled

Rule is not executed.

## Rule Versioning

Every rule should have a version.

Why:

- Scoring may change.
- Thresholds may change.
- Applicability may improve.
- Historical comparison must remain understandable.

When a rule changes meaningfully:

- Keep old audit results tied to old rule version.
- New audits use new rule version.
- Reports should not falsely imply improvement/decline if scoring changed.

## Analyst Controls

The SEO analyst must have controlled flexibility.

### Project-Level Controls

Analyst can configure:

- Website type.
- Goals.
- Important page groups.
- Excluded page patterns.
- Included page patterns.
- Crawl cap.
- Rule packs.
- Disabled rules.
- Intent assumptions.
- Local/international scope.
- Ecommerce/SaaS/publisher/NGO/education flags where relevant.

### Rule-Level Controls

Analyst can:

- Disable a noisy rule for a project.
- Mark a specific finding as intentional.
- Mark a page as intentionally non-indexable.
- Override page role.
- Mark an issue as false positive.
- Add analyst notes.

### Controlled, Not Chaotic

The analyst should not have to configure everything manually.

Defaults should work well.

But the analyst must be able to correct wrong assumptions.

## Crawl Scope And Rule Behaviour

Rules must understand crawl scope.

### Crawl Modes

Recommended modes:

- Single page check.
- Template sample crawl.
- Standard site crawl.
- Full site crawl.
- Deep investigation.

### Page-Capped Crawling

For large websites, use page caps and sampling strategy, not endless crawling.

The product should allow:

- Crawl key pages.
- Crawl templates.
- Crawl sitemap sample.
- Crawl top GSC pages.
- Crawl high-priority goal pages.
- Crawl changed pages.
- Crawl issue-affected pages.

### Rule Interpretation By Crawl Mode

If the crawl is a 20-page sample, do not say:

> Site has only 20 pages.

Say:

> This audit reviewed a 20-page sample. Sitewide conclusions are directional.

If duplicate title is found in a sample, say:

> Duplicate title detected in crawled sample.

Not:

> Entire site has duplicate titles.

## AI Usage In Rules

AI can improve rule usefulness, but must not become a generic text generator.

### Good AI Uses

- Page role inference.
- Website type inference.
- Search intent inference.
- Topic cluster grouping.
- Content quality assessment.
- E-E-A-T contextual assessment.
- Conversion clarity assessment.
- GEO/AEO answer readiness assessment.
- Recommendation wording.
- Report summarization.

### Bad AI Uses

- Replacing factual extraction.
- Creating failures without evidence.
- Guessing GSC/GA4/backlink data.
- Making every page fit a service-company model.
- Generating generic SEO advice.
- Producing long recommendations that do not map to affected URLs.

### AI Rule Output Requirements

Any AI-assisted finding must include:

- Source pages.
- Source extracted text.
- Reasoning summary.
- Confidence.
- Data used.
- Data missing.
- Analyst review flag if confidence is low.

## Rule Engine Data Flow

The recommended flow:

1. Crawl pages.
2. Extract raw HTML, rendered HTML, headers, status, links, metadata, schema, and markdown.
3. Normalize page records.
4. Infer page roles using heuristics and optional AI.
5. Allow analyst review/override where confidence is low.
6. Build rule context.
7. Run applicability checks.
8. Run applicable rule evaluations.
9. Store rule results.
10. Convert failures/warnings/opportunities into issues.
11. Attach evidence.
12. Prioritize issues.
13. Show page-level and project-level summaries.
14. Generate reports.
15. Re-audit and verify fixes.

## Rule Result To Issue Conversion

Not every rule result becomes an issue.

### Create Issue

Create issue for:

- `fail`
- `warning`
- `opportunity`
- `needs_review` when analyst action is useful

### Do Not Create Issue

Do not create issue for:

- `pass`
- `not_applicable`
- `not_verified`

But `not_verified` should appear in integration/data quality sections.

Example:

> Backlink authority not verified because no backlink provider is connected.

This is a data gap, not an SEO issue.

## Issue Grouping

Rules must support grouping.

Examples:

- One issue affecting many URLs.
- One URL with many issues.
- One template causing repeated issues.
- One query causing multiple page conflicts.
- One canonical pattern affecting multiple pages.

The UI must allow:

- View grouped issue.
- Expand affected URLs.
- Filter by page.
- Filter by template.
- Filter by severity.
- Export affected URLs.

## Cross-Page Rules

Some rules require multiple pages.

Examples:

- Duplicate titles.
- Duplicate meta descriptions.
- Near-duplicate content.
- Orphan pages.
- Internal link depth.
- Cannibalization.
- Sitemap URL not linked internally.
- Canonical chains.
- Pagination loops.
- Template-wide missing schema.

Cross-page rules must store:

- Group ID.
- Affected URLs.
- Representative examples.
- Pattern detected.
- Suggested template-level fix where relevant.

## Rule Packs

Rules should be organized into packs.

### Core Pack

Runs for almost every project.

Includes:

- Indexability.
- Status codes.
- Metadata basics.
- Canonical.
- H1.
- Internal links.
- Basic schema.
- Broken links.

### Business Goal Pack

Depends on project goals.

Includes:

- Conversion actions.
- CTA clarity.
- Lead form path.
- Donation path.
- Booking path.
- Application path.
- Product purchase path.

### Website Type Packs

Examples:

- Ecommerce.
- SaaS.
- NGO.
- Education.
- Healthcare.
- Local business.
- Publisher.
- Marketplace.

### Integration Packs

Require external data.

Examples:

- GSC opportunities.
- GA4 conversion insights.
- CWV field data.
- Backlinks.
- SERP competitors.
- Local citations.

### AI Visibility Pack

Includes:

- AEO answer clarity.
- GEO extractability.
- Entity clarity.
- AI crawler access.
- Citation-friendly formatting.
- llms.txt presence where strategically relevant.

## Rules And Reports

Every rule should define report behavior.

Some findings belong in:

- Executive summary.
- Technical appendix.
- Developer fix list.
- Content team plan.
- Opportunity backlog.
- Monitoring alerts.

Example:

Missing favicon is probably not executive-summary material.

Important pages noindex is executive-summary material.

High-impression low-CTR query group is opportunity report material.

## Validation Requirements For Rule Implementation

A rule is complete only when:

- Applicability is implemented.
- Required inputs are declared.
- Missing inputs return `not_verified`.
- Rule produces evidence.
- Rule produces specific recommendation.
- Rule maps to severity and priority.
- Rule can be filtered in UI.
- Rule can appear in page detail.
- Rule can appear in report if relevant.
- Rule has at least one test case or validation example.
- Rule has false-positive considerations documented.

## Rule Documentation Template

Every new rule should have documentation like this:

```md
## Rule: Important page is noindex

ID:
indexability.noindex-important-page

Category:
Crawl and indexability

Layer:
Technical foundation

Purpose:
Detect important pages that are blocked from search indexing.

Applies when:
- Page is commercial, informational, goal-related, or has GSC visibility.

Does not apply when:
- Page is legal/privacy/admin/search/filter/utility and intentionally non-indexable.

Required inputs:
- Meta robots
- X-Robots-Tag
- Page role
- Indexability

Optional inputs:
- GSC clicks/impressions
- Goal mapping

Status logic:
- fail: important page is noindex
- warning: uncertain importance and noindex
- not_applicable: intentionally non-indexable
- not_verified: missing crawl data

Evidence:
- URL
- Robots directive
- Page role
- Importance reason

Recommendation:
Remove noindex if the page should rank. Otherwise mark as intentionally non-indexable.

False positive risks:
- Legal pages, thank-you pages, filtered pages, internal search pages.

Report visibility:
Executive if important page affected, otherwise technical appendix.
```

## Old Project Rule Review Policy

When reviewing old project rules:

1. Read the rule intent.
2. Decide whether the SEO concept is still valuable.
3. Check whether the rule is too strict.
4. Add applicability conditions.
5. Add `not_applicable` and `not_verified` handling.
6. Add evidence schema.
7. Rewrite recommendation in analyst-friendly language.
8. Decide whether it belongs in core, website-type, integration, or AI visibility pack.
9. Decide whether it should create issue, opportunity, or review item.
10. Only then port it.

Do not copy old E-E-A-T or content quality rules directly if they force one website model.

## Open-Source Rule Review Policy

When reviewing rules from open-source tools:

1. Use them as a checklist of possible audit areas.
2. Identify which checks matter for real client SEO.
3. Remove low-value checks or keep them as low-priority technical appendix checks.
4. Add page-role and website-type applicability.
5. Add evidence.
6. Add data-source requirements.
7. Add missing-data behavior.
8. Convert raw findings into workflow-friendly issues.

The product should be inspired by the best open-source coverage, but should be better at workflow, prioritization, reporting, and analyst control.

## Minimum Rule Engine To Build First

The first useful rule engine should support:

- Rule registry.
- Rule categories.
- Rule packs.
- Rule statuses.
- Applicability checks.
- Evidence storage.
- Recommendation templates.
- Issue creation.
- Page-level issue mapping.
- Project-level summaries.
- Missing data states.
- Analyst overrides.

Do not wait for all 250 rules.

Build the engine correctly, then add rules safely.

## First 50 High-Value Rules

These are not final IDs, but they represent the first practical coverage set.

### Crawl And Indexability

1. Important page is noindex.
2. Important page blocked by robots.txt.
3. Important page returns non-200 status.
4. Important page redirects unexpectedly.
5. Canonical missing on important indexable page.
6. Canonical points to non-indexable page.
7. Canonical points through redirect.
8. Canonical always points to homepage.
9. Sitemap contains noindex URL.
10. Sitemap URL is not internally linked.

### Metadata

11. Missing title tag.
12. Duplicate title across important pages.
13. Title does not describe page purpose.
14. Missing meta description on important page.
15. Duplicate meta description across important pages.
16. SERP snippet weak for high-impression page.

### Headings And Content

17. Missing H1.
18. Multiple conflicting H1s.
19. Heading structure unclear.
20. Thin content on intent-heavy page.
21. Content does not match inferred intent.
22. Important page lacks clear next action.
23. Important page lacks internal links to related pages.
24. Important page receives too few internal links.

### Structured Data

25. Homepage missing Organization/WebSite schema where applicable.
26. Article page missing Article schema where applicable.
27. Product page missing Product schema where applicable.
28. Breadcrumb schema missing on deep pages.
29. Schema invalid JSON-LD.
30. Schema does not match visible content.

### Site Architecture

31. Orphan important page.
32. Important page too deep.
33. Broken internal link.
34. Redirect chain on internal link.
35. Dead-end important page.

### Performance And Rendering

36. Important page fails LCP threshold where CWV available.
37. Important page fails INP threshold where CWV available.
38. Important page fails CLS threshold where CWV available.
39. Rendered title differs from raw title.
40. Rendered content missing critical text.

### Search Performance

41. High impressions, low CTR.
42. Ranking drop on important query.
43. Traffic decline on important page.
44. Query cannibalization.
45. Page gets impressions for mismatched intent.

### Trust, Entity, AEO, GEO

46. Organization identity unclear.
47. Expert/YMYL content lacks trust signals.
48. Important informational page lacks direct answer.
49. Important page lacks citation-friendly structure.
50. Entity/profile links missing where strategically relevant.

## When To Add More Rules

Add more rules when:

- Analysts repeatedly ask for the check.
- It improves prioritization.
- It helps reports.
- It reduces manual review.
- It supports a website type.
- It uses available data well.
- It can provide evidence.

Do not add rules when:

- The finding is mostly cosmetic.
- The rule creates many false positives.
- The recommendation is generic.
- The rule cannot determine applicability.
- The rule depends on unavailable data.
- The issue cannot be acted on.

## Rule UI Requirements

The UI must make rules understandable.

### Rule Detail Must Show

- Rule name.
- Status.
- Severity.
- Priority.
- Category.
- Layer.
- Affected URL.
- Applicability reason.
- Evidence.
- Data source.
- Recommendation.
- False-positive guidance.
- Related pages.
- Related integrations.
- Verification status.

### Rule Library Screen

The product should eventually include a rule library screen.

It should show:

- All rules.
- Enabled/disabled status.
- Rule pack.
- Category.
- Applies to.
- Required data.
- Issue count.
- False positive rate if tracked.
- Last updated.

### Analyst Review Queue

Rules with `needs_review` should appear in a review queue.

Examples:

- Page role uncertain.
- AI inferred YMYL topic but confidence is low.
- Product/service ambiguity.
- Local business applicability unclear.
- Intent mismatch suspected.

## Final Product Standard

The best version of this product should feel like this:

> The tool does not just run SEO checks. It understands what kind of website this is, what the client wants, which pages matter, what data is available, what is proven, what is uncertain, and what the analyst should do next.

That is the rule engine standard.

## Completion Checklist

Do not mark the rule-engine phase complete unless:

- Rules support more than pass/fail.
- Applicability is implemented.
- `not_applicable` exists.
- `not_verified` exists.
- `needs_review` exists.
- Evidence is stored.
- Recommendations are specific.
- Rules are grouped into packs.
- Old rules are reviewed before porting.
- Open-source rules are adapted, not copied.
- E-E-A-T rules are contextual.
- Scores explain missing data.
- Issues map to pages.
- Cross-page issues show affected URL groups.
- Reports can use rule output.
- Analysts can override false positives.
- The product works for different website types.
