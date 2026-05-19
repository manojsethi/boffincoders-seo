# 06. Phase 4: Client Report Portal And Feedback

## Phase Goal

Give clients a clean place to view approved reports and leave feedback without exposing the analyst cockpit.

## Product Principle

Clients should not be forced to understand the internal SEO operating system.

They need:

- what changed.
- why it matters.
- what was fixed.
- what is still open.
- what needs their approval.
- what the agency recommends next.

## Client Portal Scope

Route suggestion:

`/client/projects/:projectId`

or:

`/portal/projects/:projectId`

The client portal should be visually simpler than the analyst workspace.

## Client Portal Navigation

Suggested tabs:

- Overview.
- Reports.
- Progress.
- Feedback.
- Approved Actions.

Do not show:

- raw Pages tab.
- raw Issues tab.
- Jobs tab.
- Settings.
- Integrations.
- Internal dashboards unless explicitly published.

## Reports

Client should see only reports that are:

- published.
- client-visible.
- attached to their project.

Report detail should hide:

- internal notes.
- raw rule coverage.
- internal data gaps.
- raw JSON evidence.
- AI prompt/debug text.
- hidden sections.

## Feedback

Clients should be able to:

- comment on a report.
- ask a question.
- approve a recommendation.
- request clarification.
- mark a business detail as incorrect.

Feedback should create internal notifications/tasks later.

## Feedback Model

Suggested fields:

| Field | Purpose |
|---|---|
| `projectId` | Project |
| `reportId` | Optional report |
| `userId` | Client user |
| `message` | Feedback |
| `status` | `open`, `reviewed`, `resolved` |
| `assignedToUserId` | Optional internal owner |
| `createdAt` | Timestamp |

## Client-Safe Dashboard Cards

Good client cards:

- Organic clicks trend.
- Organic traffic trend.
- Critical issues fixed.
- Open high-priority items.
- Core Web Vitals summary.
- Keyword opportunity summary.
- Next recommended actions.

Avoid:

- huge issue tables.
- raw crawl errors without explanation.
- technical acronyms without explanation.
- internal priority math.

## Email Notifications

Use Resend for:

- client invited.
- report published.
- feedback reply.
- approval requested.

## Permissions

Client portal access requires:

- active user.
- verified email.
- active project membership.
- `reports.view_client` permission.

Feedback requires:

- `reports.comment`.

## Validation Checklist

Do not mark complete until:

- client user can log in.
- client sees only assigned project.
- client sees only published client reports.
- internal reports are hidden.
- client can submit feedback.
- analyst can see feedback internally.
- unauthorized client cannot access another project by URL.
- self-audit is written.

