# 08. Phase 7: Optional Paid Data Providers

## Purpose

Add external SEO data only after the core workflow is valuable.

The product should not depend on expensive enterprise APIs for product-market-fit.

## Recommended Provider Order

### 1. DataForSEO SERP And Keyword Data

Use for:

- keyword volume.
- keyword difficulty if available.
- SERP competitors.
- rank checks.
- search intent enrichment.

Reason:

- usage-based.
- lower barrier than Semrush/Ahrefs APIs.
- enough for PMF testing.

### 2. Rank Tracking

Use after keyword mapping and recommendations are valuable.

Track:

- selected keywords.
- target URL.
- actual ranking URL.
- movement.
- local/device where relevant.

### 3. Backlinks / Referring Domains

Add only when users ask for authority/link analysis.

Do not block core product on this.

### 4. Local SEO Citations

Add only if target customers include local SEO agencies.

## Required Design

Paid providers must be modular:

- integration settings.
- usage estimate.
- per-project enable/disable.
- clear missing-data state.
- no hard dependency for normal audit/recommendation flow.

## Validation

Validate:

- no paid API call happens accidentally.
- usage is visible.
- missing provider does not break dashboards.
- recommendations clearly say when external data is unavailable.

