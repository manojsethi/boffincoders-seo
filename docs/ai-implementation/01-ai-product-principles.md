# 01. AI Product Principles

## Goal

Use small local AI models to make the SEO Analyst tool more useful, flexible, and faster for real analysts.

The goal is not to add AI for decoration. The goal is to reduce manual interpretation of crawled pages, markdown, audit findings, keywords, and reports.

## Core Principle

Rules detect. Data proves. AI explains, classifies, summarizes, and assists.

AI should not replace:

- crawl/indexability checks.
- schema extraction.
- GSC data.
- GA4 data.
- Core Web Vitals data.
- deterministic rule evidence.
- analyst judgment.

AI should improve:

- flexibility for different website types.
- understanding of page purpose.
- issue explanation quality.
- internal analyst productivity.
- client-friendly language.
- grouping and prioritization clarity.

## Why Local AI

Local AI is useful because the product already has crawled markdown, metadata, headings, page roles, audit findings, GSC rows, GA4 rows, and CWV rows.

For many tasks, sending this data to a premium model is unnecessary.

Local models can cheaply handle:

- repeated page classification.
- summaries.
- topic extraction.
- issue rewrite.
- intent detection.
- structured JSON enrichment.

## What Local AI Should Not Do

Do not let local AI:

- invent facts.
- claim ranking impact without evidence.
- invent keyword volume.
- invent backlinks.
- invent competitors.
- publish client reports without review.
- silently overwrite analyst decisions.
- decide critical severity without deterministic evidence.

## Required Analyst Control

Every AI-generated result that affects workflow should be:

- visible.
- reviewable.
- overridable.
- traceable to source pages/findings.

Examples:

- page role inferred by AI should show confidence and allow analyst override.
- website type inferred by AI should be editable in profile/settings.
- rewritten recommendations should be draft text, not hidden truth.
- issue grouping should show affected rules/pages.

## AI Output Categories

### Stored As Suggestion

Use for:

- website profile suggestion.
- page role suggestion.
- entity/topic extraction.
- intent classification.

### Stored As Draft Text

Use for:

- report paragraph draft.
- issue explanation rewrite.
- client-friendly summary.

### Stored As Evidence-Linked Enrichment

Use for:

- content summary.
- page purpose.
- AEO/GEO readiness explanation.

### Never Stored As Final Truth

Avoid for:

- rankings.
- keyword volume.
- competitor claims.
- medical/legal correctness.
- final report conclusion without analyst review.

## Product Success Criteria

Local AI is successful if:

- analysts review pages faster.
- page roles work for NGOs, education, SaaS, ecommerce, agencies, publishers, healthcare, and local sites.
- reports become clearer.
- issue tables become less noisy.
- AI cost stays low.
- data remains explainable.

