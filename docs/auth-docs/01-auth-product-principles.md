# 01. Auth Product Principles

## Goal

Build a simple, trustworthy access system for an SEO agency product.

The auth system should not become a distraction, but it must protect:

- client data.
- reports.
- Google integration access.
- internal notes.
- issue assignments.
- project settings.
- AI-generated strategy.
- billing-related ownership later.

## Recommended Direction

Use email and password authentication with Resend email verification.

Do not add social login, SSO, magic links, or multi-provider auth in the first implementation. Those can come later if the agency product reaches a scale where clients request them.

## Core Product Rules

### Rule 1: Authentication Is Simple

Users can:

- sign up with email and password.
- verify email.
- log in.
- log out.
- reset password.
- accept invitations.

No complex identity provider is needed initially.

### Rule 2: Authorization Is Product-Critical

Permissions are not just technical security. They shape the product.

An SEO analyst should see audit evidence, internal comments, and technical settings.

A client should see progress, reports, selected dashboards, and feedback areas.

A developer should see technical issues, schema/CWV/indexing tasks, and evidence.

A content strategist should see content opportunities, metadata issues, content briefs, and page-level content signals.

### Rule 3: Workspace And Project Access Are Different

Workspace access means access to the agency business.

Project access means access to one client/site.

Do not give project collaborators workspace-wide access unless explicitly invited by the agency owner or admin.

### Rule 4: Roles Are Presets, Permissions Are Source Of Truth

Roles should be easy for the UI:

- Agency Owner.
- Admin.
- SEO Lead.
- SEO Analyst.
- Content Strategist.
- Developer.
- Client Viewer.
- External Collaborator.

But the backend should check permissions, not role names only.

This avoids future pain when a client needs report comments but not dashboards, or a developer needs technical issues but not revenue dashboards.

### Rule 5: Client Experience Must Be Filtered

Client users should not enter the full analyst app by default.

They should get a client-friendly view:

- published reports.
- progress summaries.
- approved dashboards.
- comments and feedback.
- next actions.
- fixed/verified items.

They should not see:

- raw crawl noise.
- internal issue notes.
- unpublished reports.
- AI prompts.
- integration settings.
- token/account details.
- all agency projects.
- other client data.

## What This System Is Not

In the first version, do not build:

- SSO.
- enterprise SCIM.
- billing ownership.
- fine-grained row-level custom roles UI for every permission.
- complex organization hierarchy.
- public report links without access control.
- temporary hack auth.

## Required User Types

| User Type | Product Need |
|---|---|
| Agency Owner | Owns workspace, manages all projects and users |
| Admin | Manages agency operations without billing ownership |
| SEO Lead | Oversees projects, strategy, reports, assignments |
| SEO Analyst | Works daily on audits, issues, opportunities, reports |
| Content Strategist | Handles content recommendations and content tasks |
| Developer | Handles technical SEO implementation tasks |
| Client Viewer | Views approved reports and leaves feedback |
| External Collaborator | Project-scoped invited partner with configurable access |

## Access Design Principle

Default to least privilege.

If unsure whether a role should see a thing, hide it until a permission is explicitly granted.

## Questions To Discuss Before Coding

- Should the first verified user automatically become Agency Owner?
- Should a workspace be required before projects can be created?
- Should clients log into the same app shell or a separate `/client` area?
- Should project invites allow custom permission overrides in version 1, or only role presets?

