# 09. Authentication Last

## Purpose

Authentication is important, but it should come after the product value loop is stronger.

Do not implement auth until explicitly asked.

## Why Auth Is Deferred

The product still needs:

- stronger recommendations.
- keyword-page fit analysis.
- content analysis.
- fix plans.
- validation workflow.
- better client-ready reports.

These are more important for product-market fit than login screens.

## When Auth Starts

Read:

- `docs/auth-docs/README.md`
- `docs/auth-docs/01-auth-product-principles.md`
- `docs/auth-docs/02-auth-domain-model.md`
- `docs/auth-docs/03-phase-1-email-password-and-verification.md`
- `docs/auth-docs/04-phase-2-workspace-team-and-roles.md`
- `docs/auth-docs/05-phase-3-project-members-and-invites.md`
- `docs/auth-docs/06-phase-4-client-report-portal-and-feedback.md`
- `docs/auth-docs/07-phase-5-permission-engine-and-audit-log.md`
- `docs/auth-docs/08-phase-6-security-hardening-and-admin-ops.md`
- `docs/auth-docs/09-auth-done-definition-and-self-audit.md`

## Auth Direction

Use:

- email/password.
- Resend email verification.
- password reset.
- workspace owner/admin/team roles.
- project members.
- client report viewers.
- external collaborators.
- project-scoped invites.
- permission checks on backend routes.

Avoid initially:

- Google login.
- SSO.
- magic-link-only auth.
- enterprise auth.
- frontend-only protection.

## Non-Negotiable

When auth starts, every protected backend route must check permissions server-side.

Do not rely on hidden frontend navigation.

