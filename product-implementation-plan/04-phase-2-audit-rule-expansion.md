# 04. Phase 2: Audit Rule Expansion

## Phase Goal

Restore and improve audit intelligence from the old project.

Current V1 has about 14 rules. That is too small for a serious SEO product.

The target is not to create noise. The target is to create strong evidence-backed findings, grouped into persistent issues.

Before expanding schema, JavaScript-rendering, GEO, AEO, and content-quality rules, add project-level crawl/render settings so analysts can decide how aggressively the crawler should render pages.

This phase must be implemented together with:

- `11-rule-engine-and-audit-behaviour.md`
- the Phase 2 done definition in `10-implementation-done-definition.md`

Do not simply copy old project rules.

Do not simply copy open-source rules.

Old rules and open-source projects should be used as a reference library. The final product rules must be applicability-first, evidence-first, and useful for many website types.

## Rule Count Direction

| Stage | Target |
|---|---:|
| Current V1 | 14 rules |
| After old-rule port | 60-80 useful rules |
| After data-driven rules | 90-110 useful rules |
| Mature product | 150-250 useful rules |

Do not chase rule count blindly. Every rule must help analysts make decisions.

Rule count is secondary. A smaller set of contextual, evidence-backed rules is better than a large noisy set.

Use open-source projects as inspiration:

- `context-dot-dev/ai-seo-audit` for category-driven AI/GEO checks, markdown-driven audits, `pass/partial/fail/na` style thinking, and agent-ready fix prompts.
- `seo-skills/seo-audit-skill` for broad coverage across technical SEO, performance, links, images, security, schema, JavaScript rendering, accessibility, content, E-E-A-T, redirects, mobile, i18n, HTML validation, and AI/GEO readiness.
- `dageno-agents/seo-geo-audit` for senior-auditor workflow thinking: observed vs assessment vs not verified, P0/P1/P2 prioritization, executive/operator/specialist reporting modes, and page-capped crawl strategy.

Adapt these ideas. Do not paste them into the product without SEO analyst judgment.

## Project-Level Crawl And Render Settings

Add this early in this phase, before large rule expansion.

Every project should allow the analyst to choose a crawl/render mode:

| Mode | Default? | Use Case | Behaviour |
|---|---:|---|---|
| `cheerio-only` | No | Static/simple sites, fast checks, low-cost audit runs | Fetch raw HTML only. If raw HTML lacks render-sensitive signals, rules return `not_verified` where appropriate. |
| `cheerio-with-playwright-fallback` | Yes | Most agency/client websites | Use Cheerio first. Trigger Playwright selectively for important pages, schema-not-verified pages, JS-suspected pages, analyst-selected pages, and sample pages in larger crawl modes. |
| `playwright-only` | No | JS-heavy websites where raw HTML is empty, misleading, or consistently missing metadata/schema/content | Render every crawled page with Playwright. Slower and more expensive, but gives the most accurate rendered evidence. |

The default must be `cheerio-with-playwright-fallback`.

Do not make Playwright-only the global default.

### Required Settings UI

Project settings should include:

- Crawl/render mode.
- Playwright fallback enabled/disabled.
- Render important pages automatically.
- Render schema-not-verified pages automatically.
- Render JS-suspected pages automatically.
- Render sample size for standard/full crawl.
- Max rendered pages per crawl.
- Render concurrency.
- Render timeout.
- Analyst note explaining cost/speed tradeoff.

### Required Rule Behaviour

Rules must read the project crawl/render mode.

- In `cheerio-only`, missing render-sensitive evidence should become `not_verified`, not `fail`.
- In `cheerio-with-playwright-fallback`, missing raw evidence should trigger selective rendered verification or remain `not_verified` until rendered.
- In `playwright-only`, rendered evidence is considered the primary evidence source.

### Required UX Behaviour

The UI must explain the tradeoff:

- Cheerio is fast and cheap, but may miss JavaScript-injected schema/content.
- Hybrid is recommended for most projects.
- Playwright-only is slower and should be used for JavaScript-heavy sites.

This setting should appear in project settings and be visible near crawl start controls.

## Rule Contract Requirements

Every rule must produce:

- rule ID.
- category.
- status.
- severity.
- title.
- observed.
- why it matters.
- recommendation.
- how to fix.
- evidence.
- evidence sources.
- confidence.
- impact score.
- effort estimate.
- report visibility.
- page ID where relevant.
- canonical issue key.
- validation method.

Every rule must also support the behaviour model from `11-rule-engine-and-audit-behaviour.md`.

Minimum required statuses:

| Status | Meaning |
|---|---|
| `pass` | Rule applies and passes. |
| `warning` | Rule applies and there is moderate concern. |
| `fail` | Rule applies and there is a clear issue. |
| `opportunity` | No strict error, but there is meaningful SEO upside. |
| `not_applicable` | Rule does not apply to this page/site. |
| `not_verified` | Required data is missing. |
| `needs_review` | Tool confidence is low and analyst review is required. |

## Applicability Requirements

Rules must support:

- applicable.
- not applicable.
- not verified.
- needs review.

Examples:

- Product schema rule is not applicable to a non-commerce NGO.
- Local citation rule is not verified if local SEO data source is missing.
- GA4 conversion rule is not verified if GA4 is not connected.
- Blog author rule is not applicable if there are no article pages.
- E-E-A-T author/reviewer rule is needs-review or not-applicable unless the page is expert, editorial, YMYL, or advice-led content.

## Rule Packs To Restore From Old Project

### SEO Rules

Port useful rules:

- title present.
- title length.
- meta description present.
- meta description length.
- H1 present.
- single H1.
- H1 distinct from title.
- canonical present.
- canonical self-reference.
- noindex.
- thin content.
- image alt.
- open graph.
- Twitter card.
- HTTPS.
- language.
- internal links minimum.

### Schema Rules

Port and expand:

- any schema present.
- Organization/WebSite schema.
- Breadcrumb schema.
- Article schema.
- FAQ schema.
- HowTo schema.
- Service schema.
- Product schema.
- Course schema.
- Event schema.
- LocalBusiness schema where applicable.

Schema rules must respect raw vs rendered extraction:

- If schema is found in raw HTML, evaluate normally.
- If raw HTML has no JSON-LD and rendered extraction has not run, return `not_verified`.
- If rendered extraction has run and no schema exists, then return `warning` or `fail` depending on applicability.
- If schema exists only after JavaScript render, show source as `rendered-html`.
- If schema parse errors exist, include source and parse error evidence.

Do not create hard missing-schema issues from Cheerio-only absence.

### GEO Rules

Port and adapt:

- answer-first structure.
- data points.
- extractable paragraphs.
- entity coverage.
- authority citations.
- updated date.
- author signal.

GEO rules should often be opportunity-style, not strict failure-style.

### AEO Rules

Port and adapt:

- question headings.
- FAQ schema.
- HowTo schema.
- lists and tables.
- concise answers.
- answer blocks.
- comparison sections.

### Conversion Rules

Port and make dynamic by goal:

- CTA presence.
- proof points.
- pricing/quote clarity.
- service keyword mapping.
- form/contact path clarity.
- trust near CTA.
- product purchase clarity.
- donation action clarity.
- course/application CTA clarity.

### E-E-A-T / Trust Rules

Port:

- server-rendered content.
- heading hierarchy.
- self-contained content chunks.
- expert quotes.
- definitional pattern.
- readability.
- detailed organization schema.
- author/person schema.
- server-rendered schema.
- about/trust links.
- legal links.
- original research.
- brand consistency.
- review/citation platforms.
- sameAs disambiguation.

Make these context-aware. Do not force author rules on every page.

### Data-Driven Rules

Port after integrations:

- robots blocked important page.
- sitemap unavailable.
- redirect chains.
- canonical target invalid.
- broken URLs.
- broken internal links.
- important page weakly linked.
- high impressions low CTR.
- position 11-20 quick win.
- query missing from title/H1.
- declining clicks.
- high traffic zero conversions.
- poor LCP top page.
- poor INP conversion page.
- poor CLS organic landing.
- query cannibalization.

### Drift Rules

Port:

- title changed.
- meta changed.
- word count drop.
- H1 changed.
- canonical changed.
- important content changed.

### Site Rules

Port:

- orphan pages.
- duplicate titles.
- duplicate meta descriptions.
- weak internal link coverage.
- sitemap health.
- robots health.

## New Rule Packs To Add

### Keyword Rules

- target keyword missing from title.
- target keyword missing from H1.
- target keyword weakly represented in body.
- important query has no mapped page.
- page ranking for unintended query.
- multiple pages ranking for same query.
- no target keyword assigned to important page.

### Content Strategy Rules

- page does not satisfy intent.
- missing comparison content.
- missing pricing/cost guidance where useful.
- missing trust proof.
- missing FAQ section.
- stale content.
- thin section on important page.

### Internal Linking Rules

- important page weakly linked.
- contextual links missing.
- hub page missing.
- cluster pages not linked.
- anchor text too generic.
- orphan page with impressions.

### Report Readiness Rules

- crawl unreliable.
- profile not approved.
- integrations missing.
- too many critical issues unresolved.
- report lacks business goal data.

## Rule UI Requirements

Each rule/finding must show:

- technical term info icon.
- evidence.
- affected pages.
- why it matters.
- how to fix.
- who should fix it.
- validation method.
- first seen.
- last seen.
- data source.

## Completion Criteria

This phase is complete only when:

- at least 60 useful rules are implemented.
- old useful rules are reviewed, adapted, and ported only where relevant.
- old strict rules are softened with applicability, not-applicable, not-verified, and needs-review logic.
- open-source rule ideas are adapted to this product's workflow.
- not-applicable and not-verified are supported.
- needs-review is supported.
- data-driven rules wait for source availability.
- rule output is evidence-rich.
- issue grouping prevents overwhelming noise.
- `11-rule-engine-and-audit-behaviour.md` has been followed.
