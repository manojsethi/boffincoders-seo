# Phase 10: Navigation, Project Workflow, Archive, And Reset Data

## Purpose

The current product has strong modules, but the navigation must now make the workflow feel like one connected SEO operating system.

This phase is not about adding more SEO functionality. It is about making the existing functionality easier to use, easier to teach, and harder to misuse.

The goal is:

> A first-time SEO analyst should understand what to do next, while an experienced analyst can still jump directly into the module they need.

This should improve usability for every analyst level:

- new analysts get structure.
- average analysts get process discipline.
- strong analysts get faster access.
- agency owners get consistent delivery across projects.

Do not treat this as a cosmetic sidebar change. Treat it as a workflow design pass.

## Current Problem

The current project navigation uses a long horizontal `ProjectSubNav`.

Current project items include:

- Overview
- Pages
- Dashboards
- Issues
- Opportunities
- Keywords
- Goals
- Briefs
- Fix plans
- Reports
- Jobs
- Profile
- Monitoring
- Settings

This works technically, but it creates a flat list of modules. A first-time analyst can see many destinations but not the process order.

The user may wonder:

- Do I start from Pages or Issues?
- Are Issues and Recommendations different?
- When do I use Opportunities vs Content Briefs?
- Are Goals required before keyword work?
- Is Fix Plan where I manage work?
- Are Dashboards for analysis or reporting?
- Do Reports come before or after validation?
- Do Jobs matter unless something is broken?
- Are Integrations one-time setup or part of regular workflow?

The navigation must answer these questions through structure.

## Reference From Old Project

Use the old project as inspiration, not as copy-paste.

Old project files:

- `/Users/boffincoders/Manoj/Projects/boffincoders-seo/apps/web/src/components/GlobalShell.tsx`
- `/Users/boffincoders/Manoj/Projects/boffincoders-seo/apps/web/src/components/ProjectShell.tsx`

Old project had useful ideas:

- global shell for workspace-level navigation.
- project shell for project-level workflow.
- grouped project navigation.
- project switcher in the header.
- performance links shown based on integration availability.

But do not copy the old UI exactly. The new product is larger and more execution-focused, so it needs a stronger structure.

## Final Product Decision

Use:

1. a compact global top navigation.
2. a persistent project-level left sidebar when inside a project.
3. a project overview page that shows next best action, blockers, and recent progress.
4. a floating guide/glossary overlay for help without navigation.

Do not keep the current long horizontal project submenu after the new project sidebar is implemented.

## Global Navigation

### Intent

Global navigation should help the user move between workspace-level areas. It should not contain every project module.

The top global bar should answer:

- Which workspace/app am I in?
- Which project am I working on?
- How do I switch project?
- How do I reach workspace/global operations?
- How do I open help?

### Recommended Global Top Bar Items

Desktop:

- Logo / Workspace link
- Projects
- Workspace Jobs
- Global Settings
- Project switcher
- Global search, if available now or later
- Theme toggle
- Floating help remains available

Mobile:

- Logo
- Project switcher
- Menu button
- Help icon

### What Must Not Go In Global Navigation

Do not put these in the global top bar:

- Pages
- Issues
- Recommendations
- Keywords
- Goals
- Briefs
- Fix Plans
- Dashboards
- Reports
- Project Settings

Those are project-level workflow modules and belong inside the project shell.

## Project-Level Sidebar

### Intent

Once the user enters a project, the project workflow matters more than global navigation.

The sidebar should show the project as a process:

Setup -> Audit Evidence -> Growth -> Execution -> Performance -> Reporting -> Settings

The sidebar should make the analyst feel:

> I know where I am, what type of work this area supports, and what the next logical area is.

### Recommended Sidebar Groups

#### 1. Command Center

Purpose:

Give the analyst the current project state and next action.

Items:

- Overview
- Next Actions, if implemented as a separate page later

Notes:

- Overview is the default landing page for a project.
- It should not be a passive dashboard only.
- It should show:
  - next best action.
  - blocked setup items.
  - top open issues.
  - approved recommendations ready for planning.
  - active fix plan.
  - recent validated improvements.
  - data freshness.

#### 2. Setup

Purpose:

Control how the project is understood and what data is available.

Items:

- Profile
- Goals
- Integrations
- Crawl Settings
- Monitoring

Why this grouping matters:

Profile, goals, integrations, crawl mode, and monitoring are not daily issue-triage screens. They define the foundation of the project.

Expected behavior:

- If GSC/GA4/CWV are missing, show setup blockers here and in Overview.
- If crawl settings are too restrictive or too expensive, show plain cost/speed guidance.
- Monitoring should control recurring crawl/audit/sync schedules, not manual one-off actions.

#### 3. Audit And Evidence

Purpose:

Show what the tool found and why it matters.

Items:

- Pages
- Issues
- Recommendations

Why this grouping matters:

Pages and Issues are evidence surfaces. Recommendations turn that evidence into actions. These should sit together.

Expected behavior:

- Pages should show issue counts, schema status, indexability, role, top issue, and crawl status.
- Issues should show affected URL clearly.
- Recommendations should be accessible from the issue drawer and as a list/work queue.
- `not_verified` should remain a data gap, not a false issue.

#### 4. Growth

Purpose:

Help the analyst find traffic and conversion opportunities.

Items:

- Keywords
- Opportunities
- Content Briefs

Why this grouping matters:

These modules turn search data and page context into growth work.

Expected behavior:

- Keywords should show mapped/unmapped/wrong-page/cannibalized states.
- Opportunities should explain why each opportunity exists.
- Content Briefs should be created from keyword, page, or opportunity context.

#### 5. Execution

Purpose:

Turn approved work into a weekly or monthly plan.

Items:

- Fix Plans
- Jobs

Why this grouping matters:

Fix Plans are where work gets scheduled and validated. Jobs are operational visibility, useful when crawls, audits, syncs, or AI tasks are running.

Expected behavior:

- Fix Plans should show planned, in progress, ready for validation, validated, failed validation, and deferred work.
- Jobs should show project-specific Agenda jobs by default.
- Jobs should not expose secrets, payloads, tokens, or API keys.

#### 6. Performance

Purpose:

Show actual movement after work has been done.

Items:

- Dashboards
- Search Performance
- Traffic
- Core Web Vitals

Implementation options:

Option A:

- Keep only `Dashboards` in the sidebar.
- Dashboards page contains Search, Traffic, and CWV tabs.

Option B:

- Show Search, Traffic, and Core Web Vitals as children under Performance.

Recommended:

Use Option B if sidebar nested groups are comfortable. Use Option A if the sidebar becomes visually heavy.

Do not duplicate both in a confusing way.

Expected behavior:

- If GSC is not connected, Search Performance should show a clear missing-data state.
- If GA4 is not connected, Traffic should show a clear missing-data state.
- If CWV is unavailable, Core Web Vitals should show a clear missing-data state.
- Data freshness must be visible.

#### 7. Reporting

Purpose:

Prepare internal and client-facing summaries.

Items:

- Reports

Expected behavior:

- Reports should be generated after validation or after a reporting period.
- Client view should hide internal notes.
- Internal view should include data gaps, rule coverage, and operational notes.

#### 8. Project Settings

Purpose:

Hold project-level configuration and dangerous actions.

Items:

- General Settings
- Danger Zone

Danger Zone contains:

- Archive Project
- Reset Project Data
- Delete Project, later if truly needed

Do not put Archive or Reset as top-level sidebar items.

## Recommended Visual Layout

Desktop layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Global Top Bar                                                     │
│ Logo | Projects | Workspace Jobs | Settings | Project Switcher | ? │
├───────────────┬────────────────────────────────────────────────────┤
│ Project       │ Page Content                                       │
│ Sidebar       │                                                    │
│               │ Overview / Pages / Issues / etc.                   │
│ Command       │                                                    │
│ Setup         │                                                    │
│ Audit         │                                                    │
│ Growth        │                                                    │
│ Execution     │                                                    │
│ Performance   │                                                    │
│ Reporting     │                                                    │
│ Settings      │                                                    │
└───────────────┴────────────────────────────────────────────────────┘
```

Mobile layout:

```text
┌─────────────────────────────────────┐
│ Top Bar: Logo | Project | Menu | ?  │
├─────────────────────────────────────┤
│ Page Content                        │
│                                     │
│ Project sidebar opens as drawer     │
└─────────────────────────────────────┘
```

## Navigation Behavior

### Active State

The active sidebar item must match the current route.

Examples:

- `/projects/:id/pages` -> Pages active.
- `/projects/:id/pages/:pageId` -> Pages active.
- `/projects/:id/issues?issue=abc` -> Issues active.
- `/projects/:id/dashboards/search` -> Search Performance active or Dashboards active, depending on chosen structure.

### Collapsible Behavior

Desktop sidebar should support collapsed state.

Collapsed state:

- show icons only.
- show tooltips on hover.
- persist state in local storage.

Expanded state:

- show group labels and item labels.

### Group Opening

The group containing the active route should open automatically.

User-opened groups may persist in local storage, but active route must never be hidden.

### Project Switcher

Project switcher should remain in the global top bar or project header.

It should show:

- project name.
- domain.
- archived badge if archived.
- quick switch to other active projects.

Archived projects should not be mixed into normal active switching unless the user enables "show archived".

## Right Workflow For Analysts

The navigation should support this workflow:

1. Open project.
2. Review Overview.
3. Resolve setup blockers.
4. Run or review crawl/audit.
5. Check Pages and Issues.
6. Open evidence drawer.
7. Approve/edit/reject Recommendations.
8. Review Keywords and Opportunities.
9. Create Content Briefs where needed.
10. Add approved work to Fix Plan.
11. Execute work.
12. Validate with crawl/audit/GSC/GA4/CWV.
13. Review Dashboards.
14. Generate Report.
15. Continue monitoring.

The product should not force this sequence rigidly. Strong analysts must still be able to jump directly to any module.

But the Overview page should always tell them the next best action.

## Archive Project

### Purpose

Archive is a safe way to remove inactive projects from daily work without deleting history.

Use cases:

- client paused.
- client churned but may return.
- project is completed.
- demo/test project should not appear in active work.

### Recommended Data Model

Add to Project:

- `status`: `active | archived`
- `archivedAt`
- `archivedReason`
- `archivedBy`, later when auth exists

Do not implement auth now. Leave fields nullable or system-generated until auth phase.

### Expected Archive Behavior

When a project is archived:

- hide it from active project lists by default.
- keep all project data.
- stop or pause recurring monitoring schedules.
- prevent new manual crawl/audit/sync/report generation unless restored.
- keep reports viewable.
- show an archived banner on project pages.
- allow unarchive/restore.

### UI Placement

Project Settings -> Danger Zone -> Archive Project.

Button copy:

- `Archive project`

Confirmation modal copy:

- "Archive this project?"
- "This hides the project from active work and pauses scheduled monitoring. Historical data and reports will remain available."

Required options:

- optional reason.
- confirm button.
- cancel button.

Do not require typing project name for archive. Archive is reversible.

## Reset Project Data

### Purpose

Reset is for starting fresh after bad setup, test crawls, wrong crawl settings, incorrect domain, or a new baseline.

This is useful, but dangerous.

Do not call it only "Delete Project Data" in the UI. Use:

- `Reset project data`
- or `Start fresh audit baseline`

### Recommended Reset Modes

#### Mode 1: Start Fresh Audit Baseline

Default and safest reset.

Deletes:

- crawl runs.
- page records.
- page content.
- page raw snapshots.
- internal links.
- audit runs.
- findings.
- issues.
- recommendations generated from those issues.
- opportunities generated from old crawl/audit/GSC data, only if they cannot remain valid.
- rendered extraction runs tied to old pages.

Keeps:

- project name.
- domain.
- project profile.
- goals.
- integrations and OAuth connections.
- crawl settings.
- monitoring settings, but pause schedules until the next baseline is created.
- manually approved strategic notes, if implemented later.

Use this when the analyst says:

> The project is right, but the data baseline is wrong.

#### Mode 2: Reset Performance Data

Deletes:

- imported GSC rows.
- imported GA4 rows.
- CWV snapshots.
- performance-derived opportunities.
- performance dashboard caches, if any.

Keeps:

- crawl/audit data.
- goals.
- project profile.
- integrations.

Use this when:

- wrong GSC property was selected.
- wrong GA4 property was selected.
- historical import was bad.

#### Mode 3: Reset Execution Data

Deletes:

- recommendations.
- content briefs.
- fix plans.
- validation history tied to fix plans.

Keeps:

- pages.
- audits.
- findings/issues.
- GSC/GA4/CWV.
- goals.

Use this when:

- the analyst wants to recreate the execution plan but keep evidence.

#### Mode 4: Full Project Reset

Deletes nearly everything except the project shell.

Keeps:

- project id.
- project name.
- domain.

Optional checkboxes:

- keep integrations.
- keep goals.
- keep crawl settings.

This should be rare.

### Reset Safety Rules

Reset must:

- show exactly what will be deleted.
- show exactly what will be kept.
- require typed confirmation: `RESET PROJECT`.
- block if important Agenda jobs are running, or offer to cancel them first.
- cancel queued/running project jobs only after explicit confirmation.
- write an activity/audit log entry, even before auth.
- invalidate frontend caches after completion.
- redirect to project overview after reset.
- show a clear empty state explaining the next action.

### Reset API Shape

Recommended endpoint:

`POST /projects/:id/reset`

Payload:

```json
{
  "mode": "fresh-audit-baseline",
  "confirmText": "RESET PROJECT",
  "cancelRunningJobs": true,
  "options": {
    "keepGoals": true,
    "keepIntegrations": true,
    "keepCrawlSettings": true,
    "keepMonitoringSettings": true
  }
}
```

Response:

```json
{
  "ok": true,
  "deleted": {
    "pages": 120,
    "crawlRuns": 3,
    "auditRuns": 3,
    "findings": 2400,
    "issues": 287,
    "recommendations": 287
  },
  "kept": [
    "project",
    "goals",
    "integrations",
    "crawlSettings"
  ],
  "nextAction": "Run a new crawl to create a fresh baseline."
}
```

### Hard Delete Project

Do not prioritize hard delete in this phase unless the user explicitly asks.

When implemented later, it must be separate from reset.

Hard delete should:

- delete the whole project.
- delete all related data.
- disconnect schedules.
- require typing the project name.
- be owner/admin only once auth exists.

## Implementation Direction

### Files To Inspect First

Current new project:

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/ProjectSubNav.tsx`
- `apps/web/src/app/projects/[id]/layout.tsx`
- `apps/web/src/app/projects/[id]/page.tsx`
- `apps/web/src/app/projects/[id]/settings/page.tsx`
- backend project routes and project model.
- Agenda schedule/job code for monitoring and project jobs.

Old project reference:

- `/Users/boffincoders/Manoj/Projects/boffincoders-seo/apps/web/src/components/GlobalShell.tsx`
- `/Users/boffincoders/Manoj/Projects/boffincoders-seo/apps/web/src/components/ProjectShell.tsx`

### Frontend Steps

1. Build a new project shell/sidebar component.
2. Move project-level navigation out of `ProjectSubNav`.
3. Keep global navigation compact at the top.
4. Categorize sidebar items into workflow groups.
5. Preserve current routes. Do not rename routes unless necessary.
6. Add active state and group auto-open behavior.
7. Add responsive mobile drawer behavior.
8. Add project archived banner state once backend supports archive.
9. Add Project Settings -> Danger Zone UI.
10. Add Archive and Reset flows with proper confirmation modals.
11. Keep the floating help/glossary icon available globally.

### Backend Steps

1. Add project archive fields.
2. Add archive/unarchive endpoints.
3. Ensure project list supports active/archived filtering.
4. Pause recurring monitoring schedules on archive.
5. Add reset endpoint with scoped reset modes.
6. Ensure reset removes derived data consistently.
7. Ensure reset cancels or blocks conflicting running jobs.
8. Add activity log records, or minimal internal event records if activity log does not exist yet.
9. Return deleted/kept summary from reset endpoint.

### Do Not Do

- Do not add authentication in this phase.
- Do not add client portal permissions in this phase.
- Do not redesign every page visually.
- Do not introduce a second routing pattern.
- Do not duplicate project modules in both top nav and sidebar.
- Do not leave old horizontal project nav visible after sidebar is accepted.
- Do not make Archive and Reset easy to click accidentally.

## Acceptance Criteria

### Navigation Acceptance

Pass only if:

- global navigation is compact and workspace-level.
- project modules are in a project-level sidebar.
- project sidebar is grouped by workflow.
- active item is correct on nested pages.
- sidebar works on mobile through drawer/menu.
- collapsed sidebar works on desktop.
- no long horizontal project nav remains.
- project switcher remains easy to access.
- floating help/glossary remains available.

### Workflow Acceptance

Pass only if:

- a new analyst can follow the sidebar top-to-bottom.
- a senior analyst can still jump directly to any module.
- Overview shows or preserves next best action logic.
- missing data/integration blockers still surface clearly.
- Jobs remain accessible but do not dominate normal SEO workflow.

### Archive Acceptance

Pass only if:

- archived projects hide from active lists by default.
- archived projects can be restored.
- archived projects keep data.
- scheduled monitoring is paused/stopped.
- archived project pages clearly show archived state.
- manual destructive or expensive actions are blocked or strongly warned.

### Reset Acceptance

Pass only if:

- reset modes are scoped.
- default reset is "fresh audit baseline", not full deletion.
- confirmation explains deleted and kept data.
- typed `RESET PROJECT` confirmation is required.
- running jobs are handled safely.
- deleted/kept counts are returned.
- frontend returns to a clear next action after reset.

## Self-Audit Required

After implementation, the AI/code writer must self-audit:

1. Navigate every project route and confirm active sidebar state.
2. Test collapsed sidebar.
3. Test mobile sidebar/drawer.
4. Confirm old horizontal project nav is gone.
5. Archive a project and verify it leaves active lists.
6. Restore the archived project.
7. Run fresh audit baseline reset on a test project.
8. Confirm kept data and deleted data match the selected mode.
9. Confirm jobs are blocked/cancelled safely during reset.
10. Confirm no secrets, tokens, or raw job payloads are exposed.

Do not mark this phase complete until both navigation and project operations are validated in the live UI.
