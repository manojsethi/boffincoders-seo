# 03. Phase 1: Email Password And Verification

## Phase Goal

Add basic authentication without roles complexity.

At the end of this phase:

- a user can sign up.
- the user receives a Resend verification email.
- the user verifies their email.
- the user can log in and log out.
- the first verified user can become Agency Owner.
- unverified users cannot access the product.

## Required Screens

### Sign Up

Fields:

- name.
- email.
- password.
- confirm password.

Behavior:

- lowercase and trim email.
- validate password strength.
- create user as `pending_verification`.
- send verification email through Resend.
- show "Check your email" state.

### Verify Email

Route example:

`/auth/verify-email?token=...`

Behavior:

- validate token hash.
- check expiry.
- mark token used.
- mark user active.
- if no workspace exists, create workspace setup path.
- if invited, continue invite acceptance path.

### Login

Fields:

- email.
- password.

Behavior:

- reject unknown user with generic error.
- reject unverified user and allow resend verification email.
- create session.
- redirect to workspace overview.

### Logout

Behavior:

- invalidate session or clear session cookie.
- redirect to login.

### Forgot Password

Fields:

- email.

Behavior:

- always show generic success message.
- send reset email if user exists.
- token expires.

### Reset Password

Fields:

- new password.
- confirm password.

Behavior:

- validate token.
- update password hash.
- invalidate old sessions.
- mark reset token used.

## Backend Requirements

Add routes:

- `POST /auth/signup`
- `POST /auth/resend-verification`
- `GET /auth/verify-email`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## Session Recommendation

Use secure HTTP-only cookies.

Suggested:

- access/session cookie.
- signed or server-stored session.
- `httpOnly: true`.
- `sameSite: lax`.
- `secure: true` in production.

Avoid storing auth tokens in localStorage.

## Password Hashing

Use Argon2 if available, otherwise bcrypt.

Do not invent custom hashing.

## Resend Emails

Required email templates:

- Verify email.
- Resend verification.
- Password reset.

Emails must include:

- product name.
- agency/workspace name if known.
- clear CTA button.
- expiry note.
- "If you did not request this, ignore this email."

## First User Flow

If there is no workspace:

1. first verified user logs in.
2. show workspace setup screen.
3. user enters agency name.
4. create workspace.
5. create workspace membership as `agency_owner`.
6. redirect to workspace overview.

## Security Requirements

- Verification token must be random and long.
- Store token hash only.
- Token must expire.
- Token must be one-time use.
- Login errors must not reveal whether email exists.
- Rate limit signup, login, resend verification, and password reset.

## Validation Checklist

Do not mark this phase complete until:

- signup creates pending user.
- verification email is sent through Resend.
- verification activates user.
- unverified user cannot access app.
- verified user can log in.
- logout works.
- password reset works.
- first verified user becomes agency owner after workspace setup.
- backend typecheck passes.
- web typecheck passes.
- self-audit is written.

