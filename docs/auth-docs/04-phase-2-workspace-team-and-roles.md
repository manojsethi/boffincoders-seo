# 04. Phase 2: Workspace Team And Roles

## Phase Goal

Allow an agency owner/admin to invite internal team members to the workspace.

This phase is for internal agency team access, not clients.

## Required Internal Roles

| Role | Workspace Access |
|---|---|
| Agency Owner | Full control |
| Admin | Manage projects, users, settings, integrations |
| SEO Lead | Project strategy and reports across assigned projects |
| SEO Analyst | Project execution across assigned projects |
| Content Strategist | Content-side SEO work |
| Developer | Technical SEO implementation |

## Required Screens

### Workspace Members

Route suggestion:

`/settings/team`

Show:

- name.
- email.
- role.
- status.
- invited by.
- joined date.
- last active date if available.
- actions.

Actions:

- invite member.
- resend invite.
- revoke pending invite.
- change role.
- disable member.
- reactivate member.

### Invite Team Member

Fields:

- email.
- role.
- optional message.

Behavior:

- create invitation with `scope = workspace`.
- send Resend invite email.
- if user exists, invite links to accept.
- if user does not exist, invite links to create password and accept.

## Workspace Role Permissions

### Agency Owner

Can:

- manage workspace.
- manage all members.
- manage all projects.
- manage integrations.
- view all reports.
- manage all schedules/jobs.
- view audit log.

Cannot be removed unless ownership transfer exists.

### Admin

Can:

- manage projects.
- manage team except owner.
- manage integrations.
- manage reports.
- view audit log if allowed.

Cannot remove agency owner.

### SEO Lead

Can:

- view assigned projects.
- manage issues/opportunities/reports on assigned projects.
- invite project-level collaborators if granted.

### SEO Analyst

Can:

- view assigned projects.
- run audits/crawls if granted.
- manage issues/opportunities.
- create draft reports.

### Content Strategist

Can:

- view assigned projects.
- manage content issues/opportunities.
- comment on reports.

### Developer

Can:

- view assigned projects.
- manage technical issues.
- view evidence needed for implementation.
- should not manage integrations unless explicitly granted.

## Backend Requirements

Add permission middleware:

- `requireAuth`
- `requireWorkspacePermission(permission)`

Every workspace-level route must be protected.

## Invite Acceptance

Flow:

1. invited person clicks invite email.
2. token is validated.
3. if user does not exist, create password.
4. if user exists, ask login if not logged in.
5. accept invite.
6. create workspace membership.
7. mark invite accepted.

## Audit Log Events

Log:

- team invite sent.
- invite accepted.
- invite revoked.
- role changed.
- member disabled.
- member reactivated.

## Validation Checklist

Do not mark complete until:

- owner can invite internal member.
- invite email sends through Resend.
- existing user can accept.
- new user can create password and accept.
- role appears in workspace members.
- disabled user cannot access workspace.
- non-admin cannot invite workspace members.
- backend protects workspace routes.
- self-audit is written.

