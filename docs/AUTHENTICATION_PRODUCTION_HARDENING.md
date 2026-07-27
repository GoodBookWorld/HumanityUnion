# Authentication Production Hardening

TASK-063 hardens Humanity Union authentication for closed beta and production-like deployments. It builds on TASK-052 (Authentication Foundation) and TASK-062 (Email Infrastructure Foundation).

## Closed beta behavior

Recommended settings:

```env
AUTH_REQUIRE_EMAIL_VERIFICATION=true
EMAIL_PROVIDER=smtp
```

When verification enforcement is enabled:

- Users may register and log in while email verification is pending.
- Workspace **write** actions are blocked until the email is verified.
- Read-only account access and public read pages continue to work.

## Email verification flow

1. Registration queues a verification email.
2. User opens `/verify-email?token=...` (frontend) which calls `GET /api/v1/auth/verify-email?token=...`.
3. Authenticated users may resend via `POST /api/v1/auth/resend-verification`.
4. Successful verification sets `emailVerificationStatus=verified` and `emailVerifiedAt`.

Legacy email routes under `/api/v1/email/*` remain for infrastructure compatibility.

## Password reset

| Endpoint                                          | Purpose                                     |
| ------------------------------------------------- | ------------------------------------------- |
| `POST /api/v1/auth/password-reset/request`        | Queue reset email (always generic response) |
| `GET /api/v1/auth/password-reset/validate?token=` | Check token validity                        |
| `POST /api/v1/auth/password-reset/confirm`        | Set new password                            |

Rules:

- Tokens are single-use, hashed, and expire per `PASSWORD_RESET_TOKEN_TTL_MINUTES`.
- Successful reset revokes **all** refresh sessions.
- Security alert email is sent after reset.

Frontend: `/password-reset` and `/password-reset/confirm?token=...`

## Password change

`POST /api/v1/auth/password/change`

Body: `{ currentPassword, newPassword }`

- Verifies current password.
- Revokes all other refresh sessions (current session preserved when refresh cookie is present).
- Sends security notification email.

## Email change

| Endpoint                                 | Purpose                            |
| ---------------------------------------- | ---------------------------------- |
| `POST /api/v1/auth/email-change/request` | Send confirmation to **new** email |
| `POST /api/v1/auth/email-change/confirm` | Confirm with token                 |

Rules:

- Email is not changed until confirmation.
- Duplicate emails are rejected for authenticated requests.
- Security notice sent to previous email when available.
- Confirmed email is marked verified.

Frontend: `/confirm-email-change?token=...`

## Session hardening

Refresh sessions store:

- `sessionId`, `userId`, `refreshTokenHash`, `createdAt`, `expiresAt`
- `revokedAt`, `lastUsedAt`, optional `userAgent`

Behavior:

- Refresh rotates the stored refresh token hash and updates `lastUsedAt`.
- Logout revokes the current refresh session.
- Password reset revokes all sessions.
- Password change revokes all sessions except the current one when identifiable.
- Disabled users cannot refresh.

`POST /api/v1/auth/sessions/revoke-all` revokes other sessions for the signed-in user.

## Rate limiting

In-memory rate limiter (development-safe; Redis deferred):

```env
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_ATTEMPTS=20
```

Protected endpoints:

- register, login
- resend verification
- password reset request
- email change request

Exceeded limits return: `Too many attempts. Please try again later.` (HTTP 429)

## Workspace write gate

`authenticatedWorkspaceWriteMiddleware` applies to main Capability 02 write routes:

- Initiatives
- Collaborative analysis
- Decision sessions
- Collective decision votes
- Member profile mutations

Deferred (legacy pre-C02 modules without auth middleware): petition, collective-decision, collaborative-analysis, implementation modules.

Unverified users receive HTTP 403:

`Please verify your email before creating or changing civic records.`

## Safer auth errors

- Login failures: `Invalid email or password.`
- Password reset request: always `If an account exists, a reset email has been sent.`
- Verification tokens: clear invalid/expired messages without account enumeration

## Production env checklist

- [ ] `AUTH_REQUIRE_EMAIL_VERIFICATION=true`
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` set to strong random values
- [ ] `AUTH_BOOTSTRAP_FALLBACK=false`
- [ ] `EMAIL_PROVIDER=smtp` or `resend` with valid credentials
- [ ] `SMTP_FROM` / `EMAIL_FROM_NAME` configured
- [ ] `WEB_ORIGIN` matches deployed frontend URL
- [ ] Rate limits tuned for expected traffic
- [ ] Token TTL values reviewed

## Verification

```bash
npm run verify:auth-production
npm run verify:auth
npm run verify:email
npm run verify:mongodb
```

## Deferred work

- Redis-backed distributed rate limiting
- SMS / phone verification
- OAuth / social login
- Authenticator app 2FA
- WebAuthn / passkeys
- Workspace gate on legacy unauthenticated modules
