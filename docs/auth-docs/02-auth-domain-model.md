# 02. Auth Domain Model

## Goal

Define the data model before implementation so auth does not become scattered across controllers and UI checks.

## Required Models

### User

Represents a person who can log in.

Suggested fields:

| Field | Purpose |
|---|---|
| `id` | Unique user id |
| `email` | Login identity, lowercase unique |
| `passwordHash` | Argon2 or bcrypt hash |
| `name` | Display name |
| `status` | `pending_verification`, `active`, `disabled` |
| `emailVerifiedAt` | Verification timestamp |
| `lastLoginAt` | Last successful login |
| `passwordChangedAt` | Used to invalidate old sessions later |
| `createdAt` / `updatedAt` | Auditing |

Do not store plaintext passwords.

### Workspace

Represents the agency account.

Suggested fields:

| Field | Purpose |
|---|---|
| `id` | Unique workspace id |
| `name` | Agency name |
| `ownerUserId` | Primary owner |
| `status` | `active`, `disabled` |
| `createdAt` / `updatedAt` | Auditing |

The current product can support one workspace at first, but the schema should not block multiple workspaces later.

### WorkspaceMembership

Connects users to the agency workspace.

Suggested fields:

| Field | Purpose |
|---|---|
| `workspaceId` | Workspace |
| `userId` | User |
| `role` | Role preset |
| `permissions` | Optional permission overrides |
| `status` | `active`, `invited`, `disabled` |
| `invitedByUserId` | Who invited them |
| `joinedAt` | When accepted |

Workspace membership allows access to agency-level areas.

### ProjectMembership

Connects users to a specific SEO project.

Suggested fields:

| Field | Purpose |
|---|---|
| `projectId` | Project |
| `userId` | User |
| `role` | Project role preset |
| `permissions` | Optional overrides |
| `status` | `active`, `invited`, `disabled` |
| `invitedByUserId` | Who invited them |
| `joinedAt` | When accepted |

Project membership is required for clients and external collaborators.

### Invitation

Represents a pending invite.

Suggested fields:

| Field | Purpose |
|---|---|
| `email` | Invited email |
| `scope` | `workspace` or `project` |
| `workspaceId` | Workspace invite target |
| `projectId` | Project invite target when scoped to project |
| `role` | Proposed role |
| `permissions` | Optional explicit permission list |
| `tokenHash` | Hashed invite token |
| `expiresAt` | Expiry |
| `acceptedAt` | Acceptance timestamp |
| `revokedAt` | Revocation timestamp |
| `invitedByUserId` | Sender |

Store only a hash of the token, not the raw token.

### EmailVerificationToken

Used for first-time email verification.

Suggested fields:

| Field | Purpose |
|---|---|
| `userId` | User being verified |
| `tokenHash` | Hashed token |
| `expiresAt` | Expiry |
| `usedAt` | One-time usage |
| `createdAt` | Rate limiting/audit |

### PasswordResetToken

Used for password resets.

Suggested fields:

| Field | Purpose |
|---|---|
| `userId` | User |
| `tokenHash` | Hashed reset token |
| `expiresAt` | Expiry |
| `usedAt` | One-time usage |
| `createdAt` | Rate limiting/audit |

### AuditLog

Stores sensitive account and access events.

Suggested fields:

| Field | Purpose |
|---|---|
| `workspaceId` | Workspace context |
| `projectId` | Optional project context |
| `actorUserId` | Who performed action |
| `action` | Event type |
| `targetType` | User, project, invitation, integration, report |
| `targetId` | Target id |
| `metadata` | Safe metadata only |
| `createdAt` | Timestamp |

Never store tokens or passwords in audit metadata.

## Role Presets

### Workspace Roles

| Role | Description |
|---|---|
| `agency_owner` | Full access, owns workspace |
| `admin` | Manage projects, users, settings, integrations |
| `seo_lead` | Manage strategy, reports, work assignment |
| `seo_analyst` | Work on projects assigned to them |
| `content_strategist` | Content-side work |
| `developer` | Technical implementation work |

### Project Roles

| Role | Description |
|---|---|
| `project_owner` | Full project control |
| `seo_lead` | Strategy, audit, reports, assignment |
| `seo_analyst` | Audit and SEO work |
| `content_strategist` | Content tasks/opportunities |
| `developer` | Technical issues and evidence |
| `client_viewer` | Client-safe report viewing and feedback |
| `external_collaborator` | Configurable project-scoped access |

## Permission Names

Use stable permission keys.

Suggested workspace permissions:

- `workspace.view`
- `workspace.manage`
- `workspace.members.manage`
- `workspace.settings.manage`
- `workspace.jobs.view`
- `workspace.audit_log.view`

Suggested project permissions:

- `project.view`
- `project.manage`
- `project.members.manage`
- `project.settings.manage`
- `integrations.view`
- `integrations.manage`
- `crawl.run`
- `audit.run`
- `audit.view`
- `pages.view`
- `issues.view`
- `issues.manage`
- `opportunities.view`
- `opportunities.manage`
- `keywords.view`
- `keywords.manage`
- `goals.view`
- `goals.manage`
- `reports.view_client`
- `reports.view_internal`
- `reports.generate`
- `reports.publish`
- `reports.comment`
- `jobs.view`
- `jobs.manage`

## Permission Rule

Backend checks must answer:

1. Who is the user?
2. Which workspace/project are they accessing?
3. Do they have the required permission?
4. Is the route returning client-safe or internal data?

The frontend can hide UI, but the backend must enforce access.

