# 02. Phase 1: Foundation Hardening

## Purpose

Before building recommendation modules, finish the small correctness gaps in the current foundation.

This phase is not a new product module.

It is a hardening pass.

## Must Read

- `product-implementation-plan/12-agenda-job-monitor-and-operations.md`
- `product-implementation-plan/10-implementation-done-definition.md`
- `product-implementation-plan/05-phase-3-integrations-gsc-ga4-cwv.md`

## Current Known Gap

Settings → Integrations mostly supports duplicate sync protection and CWV virtual state, but the UI can still briefly show `Sync now` after a provider sync is queued.

Reason:

- latest job selection can prefer an older completed job over a newly queued job.
- queued job may not have `startedAt` or `finishedAt`.
- mutation success does not immediately refetch job state.
- provider-level pending state is not strict enough.

## Required Fixes

### 1. Sync Now Duplicate Protection

Settings UI must:

- disable the clicked provider immediately when mutation starts.
- track pending provider separately.
- show `Sync queued` or `Sync running...` while active.
- invalidate/refetch integration jobs immediately after queueing.
- prioritize active jobs over historical jobs.

Job priority order:

1. running.
2. queued.
3. scheduled.
4. failed.
5. completed.

Do not let an older completed job hide a newer queued job.

### 2. Backend Duplicate Guard

Backend must reject duplicate manual one-off syncs for same:

- project.
- provider.

Reject when existing manual job is:

- queued.
- running.
- locked and unfinished.

Do not block recurring Monitoring schedule ticks unless an actual provider sync is already running.

Return:

- HTTP `409`.
- provider.
- current status.
- human-readable message.

### 3. CWV State

CWV is not OAuth-backed.

Settings must show:

- `available` when PageSpeed API key is configured.
- `limited` when no API key exists but PSI unauthenticated access can run.
- `error` when latest CWV sync failed.

Do not show plain `Not connected` for CWV when CWV is usable.

Do not show OAuth connect/disconnect for CWV.

### 4. Validation

Validate:

- click GSC sync once: button disables immediately.
- click GSC sync repeatedly: only one manual one-off job exists.
- direct duplicate API request returns `409`.
- completed sync re-enables button.
- failed sync shows failure reason.
- CWV displays `available`, `limited`, or `error`.
- scheduled sync jobs remain separate from manual sync jobs.

## Done Definition

Phase is done only when:

- UI behavior is correct.
- backend duplicate guard is correct.
- CWV state is correct.
- project jobs still show sync status.
- no secrets are exposed in jobs/integration responses.
- self-audit is written with exact validation performed.

