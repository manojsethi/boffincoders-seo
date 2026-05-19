# 07. Phase 5: Permission Engine And Audit Log

## Phase Goal

Make authorization reliable, testable, and visible.

By this phase, role checks should be replaced or backed by explicit permission checks.

## Permission Engine Requirements

Create one central permission service.

It should answer:

```text
Can user X perform action Y on resource Z?
```

Inputs:

- user id.
- workspace id.
- project id if applicable.
- permission key.
- resource ownership/status if needed.

Outputs:

- allowed true/false.
- reason for denial.
- source: workspace role, project role, explicit override.

## Permission Resolution Order

Recommended:

1. Agency Owner always allowed within owned workspace.
2. Workspace Admin permissions.
3. Project membership permissions.
4. Explicit project permission overrides.
5. Client-safe restrictions.
6. Deny by default.

## Backend Middleware

Required helpers:

- `requireAuth`
- `requireWorkspacePermission(permission)`
- `requireProjectPermission(permission)`
- `requireAnyProjectPermission([...permissions])`
- `requireClientReportAccess`

## Frontend Helpers

Frontend should use permission-aware UI:

- hide unavailable nav.
- disable unavailable actions.
- show helpful "Ask admin for access" messages.

But frontend checks are convenience only. Backend checks are mandatory.

## Audit Log

Log sensitive events:

- login success.
- login failure if useful for security review.
- logout.
- password changed.
- email verified.
- invite sent.
- invite accepted.
- invite revoked.
- role changed.
- permissions changed.
- member disabled.
- integration connected.
- integration disconnected.
- report published.
- report unpublished.
- schedule created.
- schedule disabled.
- job cancelled.
- project deleted or archived.

## Audit Log UI

Route suggestion:

`/settings/audit-log`

Show:

- action.
- actor.
- target.
- workspace/project.
- timestamp.
- safe metadata.

Filters:

- actor.
- action.
- project.
- date.

## Security Rule

Never log:

- passwords.
- tokens.
- raw OAuth credentials.
- email verification token.
- password reset token.
- invite raw token.
- API keys.

## Validation Checklist

Do not mark complete until:

- every important backend route has permission middleware.
- forbidden API calls return 403.
- clients cannot access internal routes.
- permission decisions are centralized.
- audit log records sensitive events.
- audit log does not expose secrets.
- self-audit is written.

