# Auth And Access Control Implementation Plan

This folder defines the authentication, agency membership, project access, client viewing, invite, and permission model for the SEO Analyst product.

The goal is simple authentication with serious authorization.

Authentication should stay easy:

- email and password.
- first-time email verification through Resend.
- password reset through Resend.
- no Google login, SSO, magic-link-only auth, or enterprise complexity in the first version.

Authorization must be strong:

- agency owners must control who can access the workspace.
- clients must only see their own approved project/report views.
- external collaborators must have project-scoped permissions.
- integration credentials, internal notes, AI prompts, raw audit evidence, and other-client data must never leak.

## File Sequence

Read and implement in this order:

1. `01-auth-product-principles.md`
2. `02-auth-domain-model.md`
3. `03-phase-1-email-password-and-verification.md`
4. `04-phase-2-workspace-team-and-roles.md`
5. `05-phase-3-project-members-and-invites.md`
6. `06-phase-4-client-report-portal-and-feedback.md`
7. `07-phase-5-permission-engine-and-audit-log.md`
8. `08-phase-6-security-hardening-and-admin-ops.md`
9. `09-auth-done-definition-and-self-audit.md`

## Non-Negotiables

- Do not add auth casually route by route.
- Do not rely on frontend hiding as security.
- Every protected backend route must check the authenticated user and permission server-side.
- Do not keep legacy placeholder auth code once real auth starts.
- Do not leave unused auth schemas, fake users, mock sessions, or irrelevant files.
- Client access must be separate from the analyst cockpit experience.
- Invites must be one-time, expiring, and scoped.
- Email verification must happen before useful product access.

## Product North Star

An agency owner should be able to safely run 200-300 client SEO projects with:

- internal team members.
- contractors.
- developers.
- clients.
- report reviewers.
- external collaborators.

Each person should see only what they need, do only what they are allowed to do, and understand why access is restricted.

