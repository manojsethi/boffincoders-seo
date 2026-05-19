# 09. Auth Done Definition And Self-Audit

## Done Definition

No auth phase is complete just because screens or models exist.

A phase is complete only when the real user flow works end to end and backend authorization prevents bypassing the UI.

## General Done Criteria

Every auth phase must include:

- backend typecheck.
- web typecheck.
- successful happy-path flow.
- failed/unauthorized flow.
- server-side permission checks.
- no secret leakage.
- clear UI states.
- self-audit report.

## Required Self-Audit Format

After each auth phase, write:

```markdown
# Auth Phase X Self-Audit

## Implemented

- ...

## Files Changed

- ...

## Flow Validated

- ...

## Security Validated

- ...

## Permission Checks Validated

- ...

## Remaining Gaps

- ...

## Verdict

Pass / Partial / Fail
```

If verdict is Partial or Fail, redo the work before asking for acceptance.

## Phase 1 Acceptance

Email/password phase is complete only when:

- signup works.
- verification email sends.
- verification activates user.
- unverified user cannot access product.
- login works.
- logout works.
- forgot/reset password works.
- first user can become agency owner.

## Phase 2 Acceptance

Workspace team phase is complete only when:

- owner/admin can invite internal team member.
- invite email sends.
- invite can be accepted by new user.
- invite can be accepted by existing user.
- member appears in team list.
- role can be changed.
- disabled member loses access.
- non-admin cannot manage workspace team.

## Phase 3 Acceptance

Project access phase is complete only when:

- project invite works.
- client invite works.
- external collaborator invite works.
- project permissions are enforced server-side.
- client cannot see internal project data.
- unassigned user cannot access project by URL.

## Phase 4 Acceptance

Client portal phase is complete only when:

- client can log in.
- client sees only assigned projects.
- client sees only published client reports.
- internal reports and notes are hidden.
- client can submit feedback.
- analyst can see feedback.

## Phase 5 Acceptance

Permission engine and audit log phase is complete only when:

- permission checks are centralized.
- protected routes use middleware.
- denied API calls return 403.
- audit log records important events.
- audit log exposes no secrets.

## Phase 6 Acceptance

Security hardening phase is complete only when:

- rate limiting exists.
- sessions can be revoked.
- disabled user cannot access product.
- ownership transfer works.
- production cookie settings are safe.

## Final Auth Acceptance Questions

Before auth is considered product-ready, answer:

1. Can an agency owner safely invite their team?
2. Can a client log in without seeing internal data?
3. Can an external collaborator access only one project?
4. Can a developer see implementation tasks without integration settings?
5. Can a content strategist work without seeing unrelated admin screens?
6. Are all sensitive backend routes permission-checked?
7. Are all auth tokens hashed or encrypted as appropriate?
8. Are email verification and password reset flows safe?
9. Is every denied state understandable to the user?
10. Would this be safe enough for real agency clients?

If any answer is no, auth is not complete.

