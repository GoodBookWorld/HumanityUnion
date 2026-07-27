# Auth Navigation and Redirects

## Route responsibilities

### `/profile`

Public and member-facing profile information:

- avatar and display information
- skills, interests, and participation details
- public visibility preview

Use **Account & Security** (`/account`) for email, password, sessions, and Two-Step Login.

### `/account`

Account identity and security:

- email and verification state
- password and email change
- Two-Step Login settings
- active sessions

Use **Edit Profile** (`/profile`) for public-facing member information.

## Workspace navigation

Authenticated workspace navigation includes:

- Workspace
- Profile
- Preferences
- Membership
- Notifications
- Account

## Redirect policy

| Event                                   | Destination                             |
| --------------------------------------- | --------------------------------------- |
| Registration email confirmed            | `/account?confirmed=1`                  |
| Normal login                            | safe `returnTo`, otherwise `/workspace` |
| Two-Step login completed                | safe `returnTo`, otherwise `/workspace` |
| Old account recovery after confirmation | `/account`                              |

`returnTo` must be an internal path starting with `/`. External URLs, protocol-relative paths, and auth verification routes are rejected.

Implementation: `apps/web/src/features/auth/lib/resolve-safe-return-to.ts`

## Auth-code rate limits

Layered limits are enforced separately:

| Layer                  | Default                                   |
| ---------------------- | ----------------------------------------- |
| Per-challenge cooldown | 60 seconds between resends                |
| Per account            | 5 sends per rolling hour                  |
| Per IP                 | 20 sends per rolling hour (abuse ceiling) |
| Per challenge          | 5 resends                                 |

Two normal accounts on the same IP do not share account-level counters.

Blocked responses return:

```json
{
  "code": "AUTH_CODE_RATE_LIMITED",
  "retryAfterSeconds": 42,
  "limitType": "cooldown"
}
```

## Development reset

After repeated manual QA, reset send-log counters for one account:

```bash
cd apps/api
npm run dev:reset-auth-rate-limits -- --email test@example.org
```

Refused in production.

## Email branding

Transactional emails use:

- PNG: `/brand/humanity-union-logo-white-email.png`
- Local: `EMAIL_LOGO_URL=http://localhost:3000/brand/humanity-union-logo-white-email.png`
- Production: `EMAIL_LOGO_URL=https://huws.org/brand/humanity-union-logo-white-email.png`

Footer copyright is fixed at `© 2024 Humanity Union. All rights reserved.`
