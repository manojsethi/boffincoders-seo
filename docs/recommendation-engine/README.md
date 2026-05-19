# Recommendation Engine And SEO Execution System

This folder defines the next major product layer after audit, dashboards, jobs, auth, and local AI planning.

The current product can find issues. The next layer must tell analysts exactly what to do, why, in what order, who should do it, and how to validate that it worked.

Think of this module as the SEO execution layer:

- audit rules and integrations identify signals and findings.
- data explains severity and opportunity.
- AI helps interpret and write clearly.
- recommendation engine creates prioritized action recommendations.
- analysts approve and assign work.
- follow-up crawls/audits/GSC/GA4/CWV validate results.

## File Sequence

Read and implement in this order:

1. `01-product-principles-seo-action-system.md`
2. `02-complete-seo-ecosystem-map.md`
3. `03-recommendation-data-model.md`
4. `04-phase-1-issue-recommendations.md`
5. `05-phase-2-keyword-page-fit-analysis.md`
6. `06-phase-3-page-content-analysis.md`
7. `07-phase-4-content-briefs-and-external-ai-writing.md`
8. `08-phase-5-fix-plans-workflows-and-validation.md`
9. `09-phase-6-client-strategy-reports-and-progress.md`
10. `10-done-definition-and-self-audit.md`

## Non-Negotiables

- Do not generate generic advice.
- Every recommendation must be backed by evidence.
- Every `must_change` verdict must explain the hard reason.
- AI can draft language, but data/rules must prove the problem.
- Final content writing should use premium external AI models, not local tiny models.
- Analysts must be able to approve, edit, reject, assign, and validate recommendations.
- Recommendations must connect to project goals, keywords, pages, issues, reports, and monitoring.

## Existing Product Alignment Rule

The current product already has:

- audit findings.
- issues.
- opportunities.
- goals.
- keywords.
- reports.
- monitoring.
- Agenda jobs.
- AI project analysis.

The recommendation engine must connect these existing objects. It must not create a parallel product universe.

Recommended implementation direction:

- create recommendations from existing issues, findings, keywords, opportunities, goals, and page data.
- keep issue lifecycle and recommendation lifecycle connected.
- let AI rewrite, group, summarize, and draft, but never let AI become the only evidence source.
- show recommendations inside the existing issue drawer, page workspace, opportunities screen, reports, and monitoring views.
- use one shared validation method model so an issue fix, recommendation, and report all explain verification the same way.
- avoid duplicate "AI opportunities" that are not linked to real pages, queries, issues, goals, or evidence.

The product-market-fit version should optimize for usefulness before pricing:

- fewer generic insights.
- more exact recommendations.
- less manual Excel/reporting work.
- clear client-ready progress.
- strong internal workflow for analysts, writers, developers, and clients.
