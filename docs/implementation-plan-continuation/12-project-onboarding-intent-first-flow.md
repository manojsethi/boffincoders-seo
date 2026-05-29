# Phase 12: Project Onboarding, Intent Capture, And First Crawl Readiness

## Purpose

Project onboarding should not be only:

1. client name.
2. project name.
3. website URL.
4. create project.

That flow creates a project record, but it does not create an SEO engagement context.

The goal of this phase is:

> Turn project creation into a guided SEO intake flow that captures enough business intent, target keywords, important pages, and crawl policy before the first crawl, without making onboarding feel heavy.

This phase should make the first crawl and first audit more relevant from day one.

## Product Problem

The product now has many powerful modules:

- profile.
- goals.
- crawl settings.
- crawl scope rules.
- keywords.
- audits.
- pages.
- issues.
- recommendations.
- opportunities.
- content briefs.
- fix plans.
- dashboards.
- reports.

But the current project creation flow starts with almost no context.

That causes problems:

- the audit starts like a generic crawler.
- page importance is guessed too late.
- keyword relevance is discovered later instead of guiding the first analysis.
- crawl scope is configured after project creation, so analysts may forget to set it before the first crawl.
- recommendations cannot strongly connect to the client's objective.
- first-time analysts may not know what to do next after creating a project.

For a serious SEO product, the first project setup must answer:

- What kind of website is this?
- What does the client want from SEO?
- Which keywords matter first?
- Which pages matter first?
- How deep should we crawl?
- Which repeated URL sections should be sampled or ignored?
- Which integrations are available now?
- What is the next best action?

## Senior SEO Analyst Principle

Do not ask for everything during onboarding.

Ask for the minimum context that materially improves the first crawl, first audit, and first recommendations.

The onboarding flow should feel like an SEO analyst briefing, not a database form.

Good onboarding should:

- reduce later confusion.
- improve audit relevance.
- prevent noisy crawls.
- give the analyst confidence before starting the first crawl.
- help the system prioritize pages and findings.
- avoid forcing complex configuration too early.

## Final Product Decision

Replace the single-step project creation modal/page with a stepped onboarding flow.

The flow should capture:

1. project basics.
2. website profile.
3. simple client objective.
4. seed keywords.
5. important pages.
6. crawl mode and scope.
7. optional integrations.
8. review and start first crawl.

Do not use the full Goals module during onboarding.

Instead, onboarding should create a lightweight initial objective that can later become one or more full goals.

## Required Onboarding Flow

### Step 1: Project Basics

Purpose:

Create the project identity and normalize the website URL.

Fields:

| Field | Required | Notes |
|---|---:|---|
| Client name | Yes | Agency/client label. |
| Project/site name | Yes | Display name inside product. |
| Website URL | Yes | Normalize to primary domain. |
| Country/market | Recommended | Default to analyst locale if empty. |
| Primary language | Recommended | Default to detected/browser language if empty. |

Behavior:

- Validate URL before continuing.
- Normalize protocol/domain.
- Show primary domain preview.
- Do not start crawl automatically.
- Do not ask for advanced settings here.

Expected UI:

- clean step card.
- simple form.
- CTA: `Continue`.

### Step 2: Website Profile

Purpose:

Give the system enough website context to avoid strict or wrong assumptions.

Fields:

| Field | Required | Notes |
|---|---:|---|
| Website type | Recommended | Analyst-selected broad type. |
| Website description | Optional | One or two lines: what the site does. |
| Primary audience | Optional | Customers, students, donors, patients, developers, etc. |

Website type options:

- Service business.
- SaaS/product.
- Ecommerce.
- Local business.
- NGO/nonprofit.
- Education.
- Publisher/blog.
- Healthcare.
- Government/public sector.
- B2B company.
- Documentation/knowledge base.
- Marketplace.
- Other/custom.

Important behavior:

- Website type must be broad and editable.
- Do not force service/technology/industry fields for every website.
- If the analyst chooses `Other/custom`, allow free-text label.
- Store as an initial website profile suggestion or draft profile.
- Later AI analysis may refine it after first crawl.

Expected UI:

- tiles or select list.
- optional description textarea.
- small helper text: "This helps rules and recommendations understand which pages matter."

### Step 3: Client Objective

Purpose:

Capture why the client wants SEO work before generating audit priorities.

This should not be the complex Goals module.

Use a simple objective selector.

Objective options:

- Get more leads.
- Improve rankings.
- Increase organic traffic.
- Fix technical SEO.
- Improve local visibility.
- Improve content quality.
- Recover lost traffic.
- Prepare SEO roadmap.
- Improve conversion from organic traffic.
- Improve AI/AEO/GEO visibility.
- Custom objective.

Fields:

| Field | Required | Notes |
|---|---:|---|
| Primary objective | Yes | One required. |
| Secondary objectives | Optional | Multi-select. |
| Notes | Optional | Client context from kickoff call. |

Behavior:

- Store this as onboarding objective.
- Do not force KPI/baseline/target/deadline here.
- Later, the Goals module can convert this into structured goals.
- Recommendations and reports should be able to reference this objective.

Example:

```text
Primary objective: Get more leads
Secondary objective: Improve rankings
Notes: Client wants more qualified B2B leads for Node.js and AI automation services.
```

### Step 4: Seed Keywords

Purpose:

Capture the client's known target keywords before GSC import exists or before GSC is connected.

Fields:

| Field | Required | Notes |
|---|---:|---|
| Seed keywords | Optional but strongly encouraged | Textarea or tag input. |
| Priority keyword marker | Optional | Analyst can mark top keywords. |
| Keyword notes | Optional | Region, service, intent notes. |

Behavior:

- Allow paste of comma-separated or line-separated keywords.
- Deduplicate case-insensitively.
- Store as `source: onboarding`.
- Status should be `seed` or `candidate`, not fully mapped yet.
- Do not require volume/difficulty.
- Do not require GSC.
- If GSC is later connected, merge/dedupe with GSC queries.

Suggested UI:

- textarea with examples.
- parsed keyword chips below.
- optional priority star/toggle.

Example placeholder:

```text
technical seo audit
node.js development company
ai automation agency
react native app development
```

### Step 5: Important Pages

Purpose:

Let analysts identify known money pages or strategically important URLs before the first crawl.

Fields:

| Field | Required | Notes |
|---|---:|---|
| Important URLs | Optional | One per line or paste list. |
| Page label/role | Optional | Service, product, location, conversion, campaign, article, etc. |
| Notes | Optional | Why this page matters. |

Behavior:

- URLs must belong to the project domain unless explicitly allowed.
- Store as important page patterns or important URL seeds.
- These URLs should be force-included in the first crawl.
- These pages should be marked `isImportant` after crawl if matched.
- Page importance should influence recommendation prioritization.

Expected UI:

- optional page list input.
- "Add homepage automatically" default.
- "Add common important paths if found" suggestion:
  - `/services`
  - `/products`
  - `/pricing`
  - `/contact`
  - `/locations`
  - `/donate`
  - `/courses`

Do not require the analyst to know all URLs.

This step should say:

> Add known important pages if you have them. The crawler will also discover more.

### Step 6: Crawl Mode And Crawl Scope

Purpose:

Make crawl behavior effective before the first crawl.

This step is critical.

The analyst should decide how serious the first crawl should be and how repeated URL families should be handled.

#### Crawl Mode Presets

Provide simple presets:

| Preset | What It Does | Best For |
|---|---|---|
| Light audit | Homepage, nav, important pages, small sample | Quick first look |
| Standard audit | Core pages + sampled repeated sections | Default for most projects |
| Full crawl | Crawl as much as allowed by cap | Small/medium sites or deep audit |
| Custom | Analyst controls caps and rules | Senior analyst workflow |

Default:

Use `Standard audit`.

#### Crawl Settings

Fields:

| Field | Required | Default |
|---|---:|---|
| Max pages | Yes | 200 |
| Render mode | Yes | Cheerio with Playwright fallback |
| Max rendered pages | Yes | 25 |
| Auto-render important pages | Yes | On |
| Auto-render schema-not-verified pages | Optional | Off |
| Auto-render JS-suspected pages | Optional | On for JS-heavy sites |

#### Crawl Scope Rules

Show analyst-facing rules only.

Do not show internal crawler guards like:

- `**/*.css`
- `**/*.js`
- `**/*.jpg`
- `**/*.png`
- `**/*.webp`
- `**/*.woff`
- `**/*.woff2`
- other static asset file rules.

Those should be handled internally as crawler hygiene, not SEO workflow rules.

Visible scope rule examples:

| URL Pattern | Behavior | Why |
|---|---|---|
| `/blog/**` | Sample 5 | Blog templates can repeat issues. |
| `/case-studies/**` | Sample 5 | Repeated case-study template. |
| `/tag/**` | Exclude | Usually duplicate archive pages. |
| `/search/**` | Exclude | Internal search pages are usually low-value/noindex. |
| `/locations/**` | Crawl all or sample carefully | Depends on local SEO objective. |
| `/products/**` | Crawl all or sample | Depends on ecommerce/catalog size. |
| `/resources/**` | Sample 5 | Repeated resource template. |

Behavior:

- Show default suggested rules based on website type.
- AI may suggest rules only as pending suggestions.
- Analyst must approve suggestions before they affect crawl.
- Important pages should force-include even if they match a sampled pattern.
- Show pre-crawl estimate before final start.

Pre-crawl estimate should show:

- discovered URLs.
- selected URLs.
- sampled URLs.
- excluded URLs.
- force-included URLs.
- normalized duplicates.
- warnings.

### Step 7: Integrations

Purpose:

Offer GSC/GA4/CWV early, but do not block onboarding.

Integrations:

- Google Search Console.
- Google Analytics 4.
- Core Web Vitals/PageSpeed.

Behavior:

- GSC and GA4 can be connected during onboarding or later.
- If skipped, show which features will be limited:
  - no real query data.
  - no click/impression/CTR/position.
  - no organic traffic/conversion analysis.
  - fewer data-backed opportunities.
- CWV/PageSpeed can be available through API key or public PSI where possible.
- Do not force OAuth before first crawl.

Expected UI:

- cards with `Connect now` and `Skip for now`.
- explain impact in one sentence.

### Step 8: Review And Start First Crawl

Purpose:

Give analyst confidence that the project is ready before crawl starts.

Show summary:

| Section | Example |
|---|---|
| Website | Boffin Coders, service business, India/English |
| Objective | Get more qualified leads |
| Seed keywords | 12 entered |
| Important pages | 6 force-included |
| Crawl preset | Standard audit |
| Crawl scope | Blog sample 5, tag exclude, services crawl all |
| Integrations | GSC skipped, GA4 connected, CWV available |

Primary CTA:

`Start first crawl`

Secondary CTA:

`Save and start later`

After starting crawl:

- go to project overview.
- show crawl progress.
- show next step after crawl: `Run audit`.
- if audit can run automatically after crawl in future, make that an explicit setting.

## Data Model Direction

Do not create a disconnected onboarding-only model unless necessary.

Prefer storing onboarding data in existing product concepts:

| Onboarding Data | Target Storage |
|---|---|
| Client/site/domain | Project |
| Website type/description/audience | WebsiteProfile draft |
| Client objective | Project onboarding objective or lightweight Goal draft |
| Seed keywords | Keyword collection with source `onboarding` |
| Important URLs | Crawl scope force-include rules and/or page importance seeds |
| Crawl preset/settings | Project crawlSettings + crawlScopeSettings |
| Scope rules | CrawlScopeRuleModel |
| Integration decisions | SiteConnection / onboarding checklist state |

If a new model is needed, use a small `ProjectOnboardingState` or embedded project field only for:

- current step.
- completed steps.
- skipped integrations.
- onboarding notes.
- draft objective.

Avoid creating a parallel "goals", "keywords", or "profile" system.

## UI Direction

### Navigation

On project creation, send the analyst into onboarding, not directly to a blank project dashboard.

Suggested route:

```text
/projects/new
```

or:

```text
/projects/onboarding
```

After project exists:

```text
/projects/:id/onboarding
```

This allows saving progress after step 1.

### Layout

Use a clear stepper:

1. Basics
2. Profile
3. Objective
4. Keywords
5. Important pages
6. Crawl setup
7. Integrations
8. Review

Each step should have:

- short title.
- one-sentence purpose.
- form controls.
- back/continue buttons.
- "Skip for now" only where safe.

Do not show every module name during onboarding.

The user should not see:

- recommendations.
- fix plans.
- content briefs.
- reports.
- jobs.
- dashboards.

Those belong after crawl/audit data exists.

### Help Text

Each step should explain why the information matters.

Examples:

- Website type: "Helps the audit avoid treating every site like a service business."
- Objective: "Helps prioritize findings by the client's actual business need."
- Keywords: "Helps map crawled pages to topics the client already cares about."
- Crawl scope: "Avoids wasting crawl budget on repeated low-value URLs."

Keep help short.

Use info icons for technical terms.

## First-Time Analyst Flow

The ideal first-time analyst experience:

1. Analyst creates project.
2. Analyst selects website type.
3. Analyst chooses a simple client objective.
4. Analyst pastes 5-20 keywords from client call.
5. Analyst adds any known important URLs.
6. Analyst chooses Standard audit.
7. Analyst reviews crawl scope suggestions.
8. Analyst starts first crawl.
9. Tool shows crawl progress.
10. Tool guides them to run audit.
11. Tool shows prioritized issues and recommendations.

The analyst should never wonder:

- what to do next.
- whether crawl settings were applied.
- why the audit priorities look generic.
- where to add keywords.
- why the product has many modules before any data exists.

## Senior Analyst Flow

Senior analysts should still have control.

They should be able to:

- choose custom crawl mode.
- edit crawl scope rules before first crawl.
- add regex/prefix/glob rules if needed.
- force-include important URLs.
- skip integrations.
- create project quickly with minimal fields.
- save onboarding as draft.

Do not make the beginner flow slower for senior users.

Add:

- `Use quick setup` option.
- `Advanced crawl controls` collapsible section.
- `Save and start later`.

## What Not To Do

Do not:

- ask for full goal KPI/baseline/target/deadline during onboarding.
- force GSC/GA4 connection before crawl.
- auto-apply AI crawl exclusions.
- show internal asset glob rules to analysts.
- make onboarding a 30-field form.
- duplicate existing goals/keywords/profile models.
- start crawl automatically before crawl settings are reviewed.
- bury crawl scope after the first crawl.

## Required Backend Behavior

Backend must support:

- creating project without auto-crawl.
- saving onboarding progress.
- creating initial website profile draft.
- creating seed keywords from onboarding input.
- creating force-include rules for important URLs.
- saving crawl settings before first crawl.
- saving crawl scope rules before first crawl.
- starting crawl only after review step.
- returning onboarding status to frontend.

Suggested endpoints:

```text
POST /projects/onboarding/start
PATCH /projects/:id/onboarding
POST /projects/:id/onboarding/complete
POST /projects/:id/crawl
```

Alternative:

Use existing project/profile/keyword/crawl-scope endpoints if clean.

Do not create endpoints that bypass existing models.

## Required Frontend Behavior

Frontend must support:

- stepper onboarding.
- autosave or save-on-continue.
- skip-safe steps.
- review screen.
- visible crawl estimate.
- start first crawl from review.
- redirect to project overview after crawl starts.

Frontend must not:

- show advanced project modules before setup is complete.
- force analyst into Settings to configure crawl before first crawl.
- hide crawl scope behind a secondary screen during onboarding.

## Empty And Error States

Handle:

- invalid website URL.
- website already exists.
- no keywords entered.
- invalid important URL.
- scope estimate fails.
- GSC/GA4 skipped.
- crawler cannot reach homepage.
- no sitemap found.
- no URLs discovered.

The user should always get a next action.

Examples:

- "No sitemap found. We can still crawl homepage and discovered navigation links."
- "No keywords added. You can import from GSC later or continue without keywords."
- "This URL is outside the project domain. Add it as an allowed domain or remove it."

## Reporting And Recommendation Impact

Onboarding context should affect later product behavior.

Examples:

- If objective is `Get more leads`, prioritize important service/contact/conversion pages.
- If objective is `Improve local visibility`, warn before sampling `/locations/**`.
- If keywords are entered, surface keyword-page fit after crawl.
- If important pages are entered, make their technical/content issues higher priority.
- If GSC is skipped, dashboards should show data gap but not fail the setup.

## AI Usage

AI may assist onboarding, but should not control it silently.

Allowed AI assists:

- suggest website type after URL/homepage fetch.
- suggest crawl scope rules from discovered URL patterns.
- classify seed keyword intent.
- suggest important page candidates from nav/sitemap.
- summarize the entered objective into a clean internal project brief.

AI must not:

- auto-exclude URL groups without approval.
- invent client goals.
- invent keywords.
- pretend integrations are connected.
- produce recommendations before crawl/audit evidence exists.

## Done Criteria

Do not mark this phase complete unless:

- project creation is stepped, not single-form only.
- analyst can add basic objective before first crawl.
- analyst can add seed keywords before first crawl.
- analyst can add important pages before first crawl.
- crawl settings are editable before first crawl.
- crawl scope rules are visible before first crawl.
- internal asset glob rules are hidden from analyst-facing scope table.
- review screen accurately summarizes choices.
- first crawl starts only after analyst confirms review.
- skipped onboarding items show clear later next actions.
- data lands in existing project/profile/keyword/scope models.
- no duplicate onboarding-only data system is created.
- typecheck passes.
- live UI flow is tested end-to-end.

## Validation Checklist

Validate these flows:

1. Create service business project with lead-generation objective.
2. Add 10 seed keywords.
3. Add 3 important service URLs.
4. Choose Standard audit.
5. Approve `/blog/** sample 5`.
6. Exclude `/tag/**`.
7. Skip GSC/GA4.
8. Review summary.
9. Start crawl.
10. Confirm crawl uses selected settings and force-includes important URLs.
11. Confirm project overview next action is clear.
12. Confirm keywords exist with source `onboarding`.
13. Confirm website profile draft exists.
14. Confirm crawl scope internal asset rules are not shown to analyst.
15. Confirm missing integrations are shown as data gaps, not errors.

Also validate:

1. NGO/nonprofit project.
2. Education project with PDF/document URLs.
3. Ecommerce project with products/categories.
4. Local business project with location pages.
5. Custom/other website type.

## Self-Audit Requirement

After implementation, perform a self-audit.

The implementation is not done if:

- onboarding feels like generic SaaS setup instead of SEO intake.
- first crawl can start before crawl scope is reviewed.
- objective/keywords are captured but not used anywhere later.
- internal technical crawler rules are visible to analysts.
- user lands on a module-heavy dashboard without next guidance.
- a beginner analyst cannot understand what to do next.

Redo the work until the flow feels like:

> I know what kind of SEO project this is, what the client wants, which keywords/pages matter, and how the first crawl will behave.

