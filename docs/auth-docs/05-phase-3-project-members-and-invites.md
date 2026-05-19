# 05. Phase 3: Project Members And Invites

## Phase Goal

Allow project-level access for internal team members, clients, developers, contractors, and external collaborators.

This is the most important auth phase for the agency product.

## Required Project Roles

| Role | Intended User |
|---|---|
| Project Owner | Senior owner for a specific client project |
| SEO Lead | Strategy and report review |
| SEO Analyst | Daily SEO execution |
| Content Strategist | Content-side execution |
| Developer | Technical implementation |
| Client Viewer | Client-side report access and feedback |
| External Collaborator | Custom scoped access |

## Required Screens

### Project Members

Route suggestion:

`/projects/:id/settings/members`

Show:

- name.
- email.
- role.
- source: workspace member / external invite / client.
- status.
- permissions summary.
- invited by.
- joined date.
- actions.

Actions:

- invite project member.
- change project role.
- edit custom permissions.
- remove project access.
- resend invite.
- revoke pending invite.

### Invite Project Member

Fields:

- email.
- role preset.
- permission preset.
- optional custom permissions.
- optional invite expiry.
- optional message.

Role presets:

- SEO Lead.
- SEO Analyst.
- Content Strategist.
- Developer.
- Client Viewer.
- External Collaborator.

## Permission Presets

### SEO Lead

- `project.view`
- `audit.view`
- `audit.run`
- `pages.view`
- `issues.view`
- `issues.manage`
- `opportunities.view`
- `opportunities.manage`
- `keywords.view`
- `keywords.manage`
- `goals.view`
- `goals.manage`
- `reports.view_internal`
- `reports.view_client`
- `reports.generate`
- `reports.publish`
- `reports.comment`
- `jobs.view`

### SEO Analyst

- `project.view`
- `audit.view`
- `audit.run`
- `pages.view`
- `issues.view`
- `issues.manage`
- `opportunities.view`
- `opportunities.manage`
- `keywords.view`
- `keywords.manage`
- `goals.view`
- `reports.view_internal`
- `reports.generate`
- `jobs.view`

### Content Strategist

- `project.view`
- `pages.view`
- `issues.view`
- `issues.manage`
- `opportunities.view`
- `opportunities.manage`
- `keywords.view`
- `reports.view_internal`
- `reports.comment`

### Developer

- `project.view`
- `audit.view`
- `pages.view`
- `issues.view`
- `issues.manage`
- `jobs.view`

Developer should primarily see technical issues, evidence, schema, CWV, indexing, crawl, and implementation tasks.

### Client Viewer

- `project.view_client`
- `reports.view_client`
- `reports.comment`

Client Viewer must not receive internal permissions.

### External Collaborator

Start with no default dangerous permissions.

Recommended default:

- `project.view`
- `issues.view`
- `reports.comment`

Then allow admin/lead to add more.

## Project Invite Flow

1. Admin/SEO Lead opens Project Members.
2. Enters email.
3. Chooses role.
4. Reviews permissions.
5. Sends invite.
6. Invite email goes through Resend.
7. Invitee accepts.
8. Project membership becomes active.
9. Invitee only sees permitted project.

## Client Isolation

Clients must not see:

- workspace dashboard.
- other projects.
- internal reports.
- internal issue comments.
- raw audit noise.
- integration settings.
- team management.
- AI prompts.
- jobs screen unless explicitly allowed.

## Backend Requirements

Add middleware:

- `requireProjectPermission(projectId, permission)`
- `requireClientSafeView(projectId)` for client areas.

Every project route must decide:

- internal data allowed.
- client-safe data only.
- denied.

## Data Filtering Requirement

For client users, report and dashboard APIs must filter:

- hidden report sections.
- internal notes.
- data gaps marked internal.
- raw evidence if not client-safe.
- unpublished drafts.
- issue fields not meant for clients.

## Validation Checklist

Do not mark complete until:

- project invite works for existing user.
- project invite works for new user.
- client viewer can only access client-safe project view.
- external collaborator only sees granted project.
- internal analyst can access assigned project.
- unassigned workspace member cannot access project unless workspace role allows it.
- backend denies unauthorized project API calls.
- frontend hides inaccessible navigation.
- self-audit is written.

