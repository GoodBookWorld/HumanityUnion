# Email Infrastructure Foundation

TASK-062 establishes provider-independent transactional email infrastructure for Humanity Union.

## Architecture

Email is platform infrastructure. Business modules never call SMTP, Resend, or other providers directly. All outbound email flows through `apps/api/src/modules/email/`.

```
Auth / future modules
        ↓
  email.service.ts
        ↓
  email.queue.ts (async delivery)
        ↓
  email.provider.ts → mock | smtp | resend
        ↓
  email.audit.ts (delivery record)
```

## Provider abstraction

`EmailProvider` exposes:

- `sendEmail()`
- `verifyConfiguration()`
- `health()`

Provider selection is environment-driven via `EMAIL_PROVIDER`:

| Mode     | Use case                     |
| -------- | ---------------------------- |
| `mock`   | Local development (default)  |
| `smtp`   | Generic SMTP via Nodemailer  |
| `resend` | Optional Resend HTTP adapter |

SendGrid and Mailgun adapters are deferred.

## Supported transactional templates (Phase 1)

- Registration verification
- Password reset
- Login notification (optional via `EMAIL_SEND_LOGIN_NOTIFICATIONS`)
- Email change verification
- Security alert

Templates use Humanity Design System branding (`#0174B0`, logo, footer, legal note, support link placeholder).

## Token lifecycle

Verification tokens support:

- `registration`
- `password_reset`
- `email_change`

Properties:

- Cryptographically secure raw token (32 bytes, base64url)
- Stored hashed (SHA-256)
- Expiration per purpose
- Single use (`usedAt` set on consume)

Raw tokens are never stored in audit records or logs.

## Audit model

`EmailAuditRecord` stores:

- `emailId`
- `template`
- `provider`
- `recipientHash` (SHA-256 of normalized email)
- `status` (`queued` | `sent` | `failed`)
- `createdAt`, `sentAt`, `errorSummary`

Never stored: passwords, tokens, verification codes, JWT, full message bodies.

## Authentication integration

Registration queues a verification email without blocking sign-in by default.

`AUTH_REQUIRE_EMAIL_VERIFICATION=false` (default) allows login while verification is pending.

When set to `true`, login is blocked until `emailVerificationStatus=verified`.

Password reset endpoints:

- `POST /api/v1/auth/password-reset/request`
- `GET /api/v1/auth/password-reset/validate?token=...`
- `POST /api/v1/auth/password-reset/reset`

Email endpoints:

- `GET /api/v1/email/verify?token=...`
- `POST /api/v1/email/resend-verification`
- `POST /api/v1/email/change-request`
- `GET /api/v1/email/change/confirm?token=...`
- `GET /api/v1/email/health`

API health (`GET /api/v1/health`) includes email provider health.

## Environment variables

```env
EMAIL_PROVIDER=mock
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=noreply@humanityunion.local
SMTP_SECURE=false
RESEND_API_KEY=
EMAIL_FROM_NAME=Humanity Union
EMAIL_REPLY_TO=
EMAIL_SEND_LOGIN_NOTIFICATIONS=false
AUTH_REQUIRE_EMAIL_VERIFICATION=false
EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES=1440
EMAIL_PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=60
EMAIL_CHANGE_TOKEN_EXPIRES_MINUTES=60
```

## Security

- Provider credentials remain in environment configuration only.
- Mock provider logs preview URLs, not secrets.
- Audit hashes recipient addresses.
- Token values appear only in outbound email links, never in persistence.

## Verification

```bash
npm run verify:email
```

Also run baseline gates:

```bash
npm run verify:auth
npm run verify:mongodb
npm run verify:deployment
npm run verify:staging
```

## Deferred work

Not implemented in TASK-062:

- Civic Action Package email delivery
- Official Response mailbox / IMAP parsing
- Marketing email / newsletters
- Bulk campaigns
- SendGrid / Mailgun providers
- Institution messaging
- Incoming mailbox parsing (POP3/IMAP)
- Spam scoring

These remain future constitutional workflows built on this foundation.
