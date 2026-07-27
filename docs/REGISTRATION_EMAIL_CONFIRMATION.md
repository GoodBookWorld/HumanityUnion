# Registration Email Confirmation

Humanity Union requires **Email Confirmation** after account registration. Participants must prove access to their supplied email address with a six-digit **Email Confirmation Code** before receiving full authenticated workspace access.

## Terminology

Use:

- Email Confirmation
- Email Confirmation Code
- Email Confirmed
- Confirm Email
- Resend Code

Do not use identity-verification or membership language for this flow. Email confirmation proves only that the participant can access the supplied email address.

## Account state

Auth users reuse existing fields:

- `emailVerificationStatus`: `pending` | `verified`
- `emailVerifiedAt`: ISO timestamp when confirmed, otherwise unset

New registrations start with `emailVerificationStatus = pending` and no `emailVerifiedAt`.

## Registration flow

1. `POST /api/v1/auth/register` creates the account and queues a confirmation code email.
2. The API returns `emailConfirmationRequired: true`, a masked email, resend availability, and a short-lived pending-confirmation token (also stored in an httpOnly cookie).
3. The participant opens `/confirm-email` and submits the six-digit code.
4. `POST /api/v1/auth/email-confirmation/confirm` validates the code, marks the email confirmed, sends the welcome email once, and issues a normal authenticated session.
5. The participant continues to profile/onboarding.

Login for an unconfirmed account follows the same pending-confirmation path instead of issuing workspace tokens.

## Code security

- Codes are exactly six numeric digits (leading zeros allowed).
- Plain codes are never stored in MongoDB or application logs.
- Codes are hashed with SHA-256 over `userId:code`, consistent with other email token hashing.
- Records live in `email_confirmation_codes` with purpose `registration_email_confirmation`.

## Expiry and attempts

| Setting             | Default env var                              | Default             |
| ------------------- | -------------------------------------------- | ------------------- |
| Code TTL            | `EMAIL_CONFIRMATION_CODE_TTL_MINUTES`        | 15 minutes          |
| Max failed attempts | `EMAIL_CONFIRMATION_MAX_ATTEMPTS`            | 5                   |
| Resend cooldown     | `EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS` | 60 seconds          |
| Max sends per hour  | `EMAIL_CONFIRMATION_MAX_SENDS_PER_HOUR`      | 5 per user/email/IP |

After the attempt limit, the active code is revoked and a new code must be requested.

## Resend policy

`POST /api/v1/auth/email-confirmation/resend`:

- Requires the pending-confirmation cookie or bearer token (never a client-supplied `userId`).
- Revokes the previous active code, issues a new code, and resets attempts.
- Enforces cooldown and hourly send limits.

## Access before confirmation

Allowed:

- Email confirmation status, confirm, resend, cancel
- Logout/cancel pending registration
- Legal/privacy pages

Not allowed:

- Workspace civic actions, initiative creation, voting, nominations, notifications, and other authenticated participant features

Unconfirmed accounts do not receive normal access/refresh tokens at registration or login. Refresh is rejected for legacy unconfirmed sessions.

## API routes

| Route                                          | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| `POST /api/v1/auth/register`                   | Create account; return pending confirmation context |
| `POST /api/v1/auth/login`                      | Sign in; pending users return confirmation context  |
| `GET /api/v1/auth/email-confirmation/status`   | Safe pending/confirmed/expired status               |
| `POST /api/v1/auth/email-confirmation/confirm` | Submit six-digit code                               |
| `POST /api/v1/auth/email-confirmation/resend`  | Resend code                                         |
| `POST /api/v1/auth/email-confirmation/cancel`  | Clear pending confirmation session                  |

Legacy link verification at `/api/v1/auth/verify-email` remains for backward compatibility.

## Email templates

**Confirmation code** — subject: `Confirm your Humanity Union email`

Includes the six-digit code, 15-minute expiry, do-not-share warning, and ignore-if-not-you notice.

**Welcome** — subject: `Welcome to Humanity Union`

Sent once after successful confirmation. Describes participant capabilities and optional membership disclaimer.

## Existing-account migration

Production must not silently auto-confirm accounts.

Development/staging may mark existing unverified accounts as confirmed:

```bash
EMAIL_CONFIRMATION_MIGRATE_EXISTING=true npm run migrate:email-confirmation-status
```

Requires MongoDB and refuses to run against production platform mode.

## Privacy and retention

- Confirmation codes are stored hashed.
- Consumed/revoked records may be retained briefly for audit; send logs support resend rate limiting.
- Pending-confirmation tokens are short-lived JWTs scoped to confirmation APIs only.

## Verification

```bash
npm run verify:registration-email-confirmation
```

Also run `verify:auth`, `verify:auth-production`, and `verify:email` as part of the standard quality gates.
