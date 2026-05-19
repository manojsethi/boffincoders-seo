# 06. Phase 4: Goals, Keywords And Opportunity Engine

## Phase Goal

Connect SEO work to business outcomes.

SEO is not only about technical errors. A serious SEO tool must help analysts answer:

- Which keywords matter?
- Which pages should rank?
- Which pages already get impressions?
- Which pages have traffic but no conversions?
- Which topics are missing?
- Which opportunities support the client goal?
- What should the team work on next?

## Client Goal System

Every project needs dynamic business goals.

Do not assume every website wants leads.

### Supported Goal Types

Support:

- generate leads.
- win more projects.
- get consultation calls.
- get quote requests.
- sell products.
- increase donations.
- increase volunteers.
- grow course applications.
- increase bookings.
- increase subscriptions.
- increase demo requests.
- increase trial signups.
- improve documentation adoption.
- grow organic traffic.
- improve branded trust.
- grow local visibility.
- improve AI/GEO visibility.

### Goal Fields

Each goal should store:

- goal type.
- custom label.
- priority.
- related conversion action.
- related page or page group.
- target audience.
- target geography.
- KPI.
- baseline.
- target value.
- deadline.
- notes.

### Goal UX

In project setup/profile, ask:

- What does success mean for this website?
- Which user actions matter most?
- Which pages drive business value?
- Which audience segments matter?
- Which geographies or languages matter?
- Are there compliance or trust requirements?

Use website-type presets, but allow full customization.

## Website-Type Goal Examples

| Website Type | Goal Examples |
|---|---|
| Service business | leads, calls, consultations, quote requests |
| SaaS | demos, trials, signups, documentation adoption |
| Ecommerce | purchases, category growth, product visibility |
| NGO | donations, volunteers, campaign signups, awareness |
| Education | applications, course inquiries, admissions, downloads |
| Publisher | traffic, subscriptions, topical authority |
| Healthcare | appointment requests, trust, local visibility |
| Government | service completion, accessibility, discoverability |
| Documentation | developer success, support reduction, answer visibility |

## Keyword Model

Create keyword entities.

Fields:

- project ID.
- keyword.
- source: manual, GSC, AI, import, external provider.
- intent: informational, commercial, transactional, navigational, local, support.
- funnel stage: TOFU, MOFU, BOFU, retention.
- mapped page ID.
- preferred target URL.
- current ranking URL from GSC.
- clicks.
- impressions.
- CTR.
- average position.
- previous period metrics.
- opportunity score.
- goal alignment.
- priority.
- status.
- notes.

## Keyword Workflows

### Seed Keywords

Analyst can add:

- services.
- products.
- topics.
- brand terms.
- problem terms.
- competitor terms.
- location terms.

AI may suggest themes after crawl and audit, but analyst approves them.

### GSC Query Import

Convert GSC queries into keyword candidates.

For each query, show:

- query.
- ranking page.
- clicks.
- impressions.
- CTR.
- position.
- trend.
- page count.
- mapped or unmapped.

### Keyword Mapping

Analyst maps:

- keyword to target page.
- keyword cluster to hub page.
- supporting keywords to same page.

UI states:

- mapped.
- unmapped.
- wrong page ranking.
- multiple pages competing.
- no suitable page.

### Search Intent

Intent options:

- informational.
- commercial.
- transactional.
- navigational.
- local.
- support.

AI can suggest intent, but analyst can override.

## Opportunity Engine

Create an Opportunities screen.

Opportunity types:

- keyword quick win.
- CTR improvement.
- content gap.
- cannibalization.
- internal link opportunity.
- schema opportunity.
- conversion opportunity.
- performance opportunity.
- E-E-A-T/trust opportunity.
- GEO/AEO opportunity.

### Opportunity Fields

Each opportunity should include:

- title.
- type.
- affected page.
- related keyword.
- related goal.
- evidence.
- expected impact.
- effort.
- confidence.
- owner.
- suggested action.
- status.

### Quick Win Opportunity

Definition:

Keyword is ranking near page one or page two, has meaningful impressions, and can improve with targeted optimization.

Signals:

- position 4-20.
- impressions above threshold.
- page is relevant.
- title/meta/content/internal links can be improved.

### CTR Opportunity

Definition:

Page has high impressions but low CTR.

Recommended actions:

- improve title.
- improve meta description.
- add schema.
- align snippet with intent.
- improve brand trust in SERP.

### Content Gap

Definition:

Important keyword/topic does not have a strong target page.

Recommended actions:

- create page.
- expand existing page.
- add FAQ.
- add comparison.
- add guide.

### Cannibalization

Definition:

Multiple pages compete for same query or intent.

Recommended actions:

- choose primary page.
- consolidate content.
- update internal links.
- adjust titles/H1.
- canonicalize only when appropriate.

### Conversion Opportunity

Definition:

Page gets traffic but does not produce desired user action.

Recommended actions:

- improve CTA.
- add proof.
- improve form path.
- clarify offer.
- add trust signals.

## AI Role

AI should help:

- cluster keywords.
- infer intent.
- suggest content gaps.
- suggest internal links.
- explain opportunities.
- draft report summaries.

AI must not:

- invent search volume.
- invent keyword difficulty.
- invent competitor rankings.
- overwrite analyst mappings silently.

## External Keyword Data Later

Potential providers:

- DataForSEO.
- Semrush.
- Ahrefs.
- SerpApi.
- Google Ads Keyword Planner.

Without external providers, use:

- GSC queries.
- manual seed keywords.
- AI clustering.
- crawl content.

Mark search volume/difficulty as unavailable until a real source exists.

## Info Icons Required

Add info icons for:

- keyword.
- search intent.
- funnel stage.
- CTR.
- impressions.
- average position.
- quick win.
- cannibalization.
- content gap.
- opportunity score.
- search volume.
- keyword difficulty.

## Completion Criteria

This phase is complete only when:

- goals are dynamic and editable.
- keywords can be created/imported.
- GSC queries become keyword candidates.
- keywords can be mapped to pages.
- opportunities are generated from evidence.
- opportunities can become tasks/issues.
- all technical terms have info icons.

