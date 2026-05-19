# 12. Agenda Job Monitor And Operations

## Why This Module Exists

The product uses Agenda for background work. Once crawls, audits, rendered recrawls, GSC syncs, GA4 syncs, Core Web Vitals checks, reports, and scheduled monitoring exist, the SEO analyst must be able to see what the system is doing.

If jobs are invisible, the analyst cannot trust the tool.

They will not know:

- whether a sync is queued.
- whether a crawl is still running.
- whether an audit failed.
- whether CWV data is old because PageSpeed failed.
- whether a weekly report is waiting, running, completed, or broken.
- whether a client project is stuck.

Agenda visibility is not only a developer feature. It is a product requirement for SEO operations.

## Product Principle

Every long-running action must be visible to the analyst.

The analyst should never need to ask:

```txt
Did the system actually do anything?
```

They should see:

- what is running.
- what is queued.
- what finished.
- what failed.
- when it started.
- how long it took.
- what project it belongs to.
- what data or screen it affects.
- what action they can take next.

## Implementation Timing

This module has two levels.

### Level 1: Required During Integrations / Phase D Hardening

This is the minimal version that must exist while GSC, GA4, and CWV integrations are being built.

It should show project-level visibility for:

- GSC sync.
- GA4 sync.
- CWV sync.

This level is required because integrations run in the background. Without basic sync job visibility, Phase D is not product-complete.

### Level 2: Full Operations Module

This can be implemented after the core integrations and reporting flows are working.

It should cover:

- all projects.
- all job types.
- retry actions.
- cancel actions.
- recurring schedules.
- stuck job detection.
- queue health.
- long-term job history.

This is an agency-operations feature and belongs before serious multi-client monitoring.

## Job Types To Support

The monitor must eventually support these job types:

| Job Type | Product Meaning | User-Facing Label |
|---|---|---|
| `project.runFirstCrawl` | Initial crawl for a new project | First crawl |
| `project.runCrawl` | Manual or scheduled crawl | Crawl |
| `project.runAudit` | Audit rule evaluation | Audit |
| `project.runAIAnalysis` | AI profile / insight generation | AI analysis |
| `project.renderRecrawl` | Playwright/rendered recrawl | Rendered recrawl |
| `project.syncGSC` | Search Console sync | GSC sync |
| `project.syncGA4` | GA4 sync | GA4 sync |
| `project.syncCWV` | Core Web Vitals / PageSpeed sync | CWV sync |
| `project.generateReport` | Report generation | Report generation |
| `project.verifyFixes` | Re-audit for fixed issues | Fix verification |
| `project.monitorWeekly` | Weekly monitoring workflow | Weekly monitor |
| `project.monitorMonthly` | Monthly monitoring workflow | Monthly monitor |

## Level 1: Project Integration Job Visibility

### Where It Should Appear

Show minimal sync job visibility on:

- Project Settings > Integrations.
- Project Monitoring page, if the page already exists.

### Required UI In Project Settings

Each integration card should show:

- connection status.
- selected property/site.
- connected Google account email where available.
- last successful sync time.
- latest job status.
- latest job started time.
- latest job finished time.
- latest job duration.
- failure reason when failed.

Use simple labels:

- `Queued`
- `Running`
- `Completed`
- `Failed`

Do not show raw Agenda names as the primary label. Use analyst-friendly labels like `GSC sync` or `CWV sync`.

### Required Backend Endpoint

Create or keep a lightweight endpoint:

```txt
GET /projects/:id/jobs?types=gsc-sync,ga4-sync,cwv-sync
```

It should return safe metadata only.

Required response fields:

```ts
{
  id: string;
  type: string;
  label: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  nextRunAt: string | null;
  durationMs: number | null;
  failReason: string | null;
  failCount: number;
  relatedRunId?: string | null;
}
```

Do not return:

- raw Agenda `data` payload.
- OAuth tokens.
- encrypted token blobs.
- API keys.
- full stack traces.
- provider secrets.

### Required Status Logic

Derive status carefully:

- `failed` when Agenda has `failedAt` or `failReason`.
- `running` when job has `lockedAt` and no `lastFinishedAt`.
- `completed` when job has `lastFinishedAt` and no current failure.
- `queued` when job has `nextRunAt` but has not started.

If the implementation also has app-level run models, prefer app-level status when it is more accurate.

Example:

- crawl runs should use `CrawlRunModel.status`.
- audit runs should use `AuditRunModel.status`.
- render recrawls should use `RenderRunModel.status`.
- integration sync jobs can initially use Agenda status.

### Required Sync Handler Improvements

For GSC, GA4, and CWV sync jobs, store enough progress for the UI to be meaningful.

At minimum:

- sync started.
- sync completed.
- sync failed.
- rows fetched.
- rows persisted.
- error message.

For CWV:

- total URLs planned.
- completed URLs.
- failed URLs.
- current URL, if available.

This can be stored either in:

- Agenda job metadata.
- a dedicated sync run collection.
- existing integration connection fields, if the data is small.

Preferred long-term direction: use a dedicated `JobRun` or `IntegrationSyncRun` collection instead of relying only on raw Agenda documents. Agenda is the executor; the product database should hold analyst-facing history.

## Level 2: Project Job Monitor

### Page Location

Add a project-level jobs page:

```txt
/projects/:id/jobs
```

Also show a compact widget on:

- Project Overview.
- Project Monitoring.
- Project Settings > Integrations.

### Required Table Columns

The project job table should include:

| Column | Meaning |
|---|---|
| Job | Analyst-friendly job label |
| Status | Queued / Running / Completed / Failed |
| Source | Manual / Scheduled / System / Analyst |
| Started | Start time |
| Finished | Finish time |
| Duration | How long it took |
| Progress | Percent or current step |
| Related Item | Crawl run / audit run / report / integration |
| Error | Failure reason |
| Actions | View / Retry / Cancel where safe |

### Filters

Add filters for:

- job type.
- status.
- source.
- date range.
- failed only.
- running only.

### Actions

Supported actions:

- open related run.
- retry failed job.
- cancel queued job.
- cancel running job only when safe.

Cancellation must be conservative.

Do not cancel a job if it could leave partial data in a misleading state unless the handler supports safe cancellation.

Examples:

- Cancel queued GSC sync: safe.
- Cancel running CWV sync: probably safe if partial rows are allowed and marked with timestamp.
- Cancel running audit: risky unless the audit runner handles interrupted status correctly.
- Cancel running crawl: risky unless the crawler cleans up and marks the crawl as failed/cancelled.

## Level 3: Global Agency Job Dashboard

### Page Location

Add a global workspace-level jobs page:

```txt
/jobs
```

or inside workspace:

```txt
/workspace/jobs
```

### Purpose

This is for the agency owner or senior analyst managing many clients.

They should see:

- which client jobs are currently running.
- which projects are stuck.
- which integrations are failing repeatedly.
- whether scheduled monitoring is healthy.
- whether report generation is delayed.

### Required Widgets

Add dashboard cards:

- Running jobs.
- Failed jobs in last 24 hours.
- Failed jobs in last 7 days.
- Long-running jobs.
- Stuck jobs.
- Scheduled jobs due today.
- Reports due today.
- Integrations requiring attention.

### Required Table Columns

| Column | Meaning |
|---|---|
| Project | Client/project name |
| Job | Job label |
| Status | Current status |
| Started | Start time |
| Duration | Runtime |
| Queue | Agenda job name or category |
| Trigger | Manual / schedule / system |
| Error | Failure reason |
| Action | Open project / retry / cancel |

## Recurring Jobs And Schedules

The job monitor must distinguish between:

- a schedule.
- a queued execution.
- a running execution.
- a completed execution.

Example:

```txt
Monthly audit schedule exists.
Next run: June 1, 2026.
Last execution: completed May 1, 2026.
Latest job: not currently running.
```

Do not show schedules as if they are currently running jobs.

## Job History

Keep enough history for SEO operations.

Minimum:

- last 50 jobs per project.
- last 200 jobs globally.

Better:

- 90 days of job history.

For very large usage, archive older records or aggregate them.

## Error Handling UX

Errors must be analyst-readable.

Bad:

```txt
Request failed with status 403
```

Better:

```txt
GSC sync failed because the connected Google account does not have access to the selected Search Console property.
Reconnect GSC or choose a different property.
```

For each common failure, show a useful next step:

| Failure | Recommended Message |
|---|---|
| OAuth token expired | Re-authenticate the integration |
| Property access denied | Choose another property or use the correct Google account |
| PageSpeed quota exceeded | Wait for quota reset or add a valid API key |
| Crawl blocked | Check robots.txt, firewall, or crawl settings |
| Render timeout | Reduce rendered page count or increase timeout |
| Audit failed | Open audit error and retry after data issue is fixed |

## Data Model Recommendation

Do not rely forever on raw Agenda documents as the product-facing history layer.

Agenda is good for execution, but product UI needs clean, stable data.

Recommended model:

```ts
JobRun {
  projectId?: ObjectId;
  agendaJobId?: string;
  jobName: string;
  jobType: string;
  label: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger: 'manual' | 'scheduled' | 'system';
  provider?: 'gsc' | 'ga4' | 'cwv';
  relatedRunType?: 'crawl' | 'audit' | 'render' | 'report' | 'sync';
  relatedRunId?: ObjectId;
  progressPercent?: number;
  currentStep?: string;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  error?: string;
  safeError?: string;
  retryOfJobRunId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

For Level 1, it is acceptable to read Agenda directly.

For Level 2 and Level 3, use a product-level job history model.

## Security Requirements

Never expose:

- raw Agenda job payload if it may contain secrets.
- OAuth tokens.
- encrypted token blobs.
- API keys.
- cookies.
- authorization headers.
- stack traces.

Always sanitize job data before returning it to the frontend.

## Info Icons Required

Add info icons for these terms:

- Job.
- Queue.
- Scheduled job.
- Running job.
- Failed job.
- Retry.
- Cancel.
- Sync.
- Crawl.
- Audit.
- Core Web Vitals sync.
- Search Console sync.
- GA4 sync.

Each info icon should explain:

- what the term means.
- why it matters.
- what the analyst should do if it fails.

## Completion Criteria

### Level 1 Is Complete When

- Project Settings > Integrations shows latest GSC/GA4/CWV sync status.
- The backend has a safe project jobs endpoint.
- GSC/GA4/CWV sync jobs are visible after manual sync.
- Failed sync jobs show a readable failure reason.
- No raw token or secret data is exposed.
- Typecheck passes.
- A real project has been tested with at least one sync job.

### Level 2 Is Complete When

- `/projects/:id/jobs` exists.
- Crawl, audit, render, integration, report, and verification jobs are visible.
- Filters work.
- Related run links work.
- Retry failed job works for safe job types.
- Cancel queued job works.
- Running job cancellation is only available where safe.
- Long-running jobs are visually obvious.

### Level 3 Is Complete When

- Global job dashboard exists.
- All projects can be filtered by job status and type.
- Failed jobs across clients are easy to find.
- Stuck jobs are easy to find.
- Repeated integration failures are visible.
- Senior analyst can monitor agency operations without checking logs.

## Self-Audit Requirement

After implementation, the AI/code writer must self-audit:

1. Trigger a GSC sync and confirm it appears in the UI.
2. Trigger a GA4 sync and confirm it appears in the UI.
3. Trigger a CWV sync and confirm it appears in the UI.
4. Confirm failed jobs show useful errors.
5. Confirm completed jobs show start, finish, and duration.
6. Confirm no secrets are returned by the jobs endpoint.
7. Confirm project-level filtering works.
8. Confirm global view is not marked done unless it actually exists.

Do not mark this module complete unless the user can visually understand what background jobs are doing.

