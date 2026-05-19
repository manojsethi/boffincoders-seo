# 08. Phase 5: Fix Plans Workflows And Validation

## Phase Goal

Turn recommendations into an execution workflow.

This is where the product becomes useful for daily agency operations.

## Fix Plan

A fix plan is a grouped set of approved recommendations for a time period.

Examples:

- Week 1 Technical Fixes.
- June Content Improvements.
- Service Page CTR Sprint.
- Core Web Vitals Recovery Plan.
- Client Launch Audit Fixes.

## Fix Plan UI

Show:

- plan title.
- period.
- owner.
- status.
- recommendation list.
- expected impact.
- completed count.
- verified count.
- blocked count.

## Recommendation Workflow

Statuses:

1. proposed.
2. approved.
3. planned.
4. in_progress.
5. implemented.
6. verified.
7. rejected.

## Owner Types

- SEO.
- Content.
- Developer.
- Analyst.
- Client.

## Validation Methods

Each recommendation must define one:

- re-crawl confirms.
- re-audit confirms.
- GSC metric movement.
- GA4 metric movement.
- CWV snapshot improves.
- analyst manual review.
- client approval.

## Verification Loop

Flow:

1. recommendation marked implemented.
2. product queues validation run if possible.
3. validation checks linked rule/metric.
4. if pass, mark verified.
5. if fail, re-open with reason.

## Work Queues

Add queues:

- Critical fixes.
- Developer tasks.
- Content tasks.
- SEO analyst tasks.
- Client approvals.
- Verification needed.
- Overdue recommendations.

## Validation Checklist

Do not mark complete until:

- recommendations can be assigned.
- recommendations can be grouped into fix plans.
- implemented recommendations can be validated.
- failed validation reopens work.
- work queues are usable.
- reports can mention completed/verified fixes.
- self-audit is written.

