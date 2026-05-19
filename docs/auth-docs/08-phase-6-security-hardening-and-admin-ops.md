# 08. Phase 6: Security Hardening And Admin Ops

## Phase Goal

Harden auth after the main access model works.

Do not start here. This phase comes after email/password, team invites, project invites, client portal, permissions, and audit logs work.

## Security Hardening

Add:

- login rate limiting.
- password reset rate limiting.
- invite send rate limiting.
- resend verification rate limiting.
- session rotation after login.
- session invalidation after password reset.
- suspicious login detection later.
- optional two-factor authentication later.

## Admin Operations

Agency owner/admin should be able to:

- view users.
- disable users.
- reset invite.
- transfer project ownership.
- transfer workspace ownership.
- review audit log.
- revoke all sessions for a user.

## Session Management

User settings should show:

- active sessions.
- current session.
- last login time.
- revoke other sessions.

This is not required in Phase 1, but it becomes useful before real client usage.

## Ownership Transfer

Agency Owner cannot simply be deleted.

Required behavior:

- owner can transfer ownership to another active admin.
- transfer creates audit log.
- old owner becomes admin or remains owner depending on selected option.
- workspace must always have at least one owner.

## Production Readiness

Before serious client rollout:

- cookies must be secure.
- secrets must come from environment variables.
- Resend domain should be verified.
- password hashes must be strong.
- database indexes must exist for email, tokens, membership lookup.
- backend route tests should cover permission failures.

## Optional Later Features

Only add later if needed:

- two-factor authentication.
- SSO.
- client-specific branded login.
- public share links with expiry.
- IP allowlisting for agency admins.

## Validation Checklist

Do not mark complete until:

- rate limits exist.
- sessions can be revoked.
- user disable blocks access.
- ownership transfer works.
- audit log captures admin operations.
- production cookie settings are correct.
- self-audit is written.

