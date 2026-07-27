# Optional Email Two-Step Login

Humanity Union Participants with a **confirmed email** may optionally enable **Two-Step Login by Email**. When enabled, signing in requires the account password plus a six-digit **Email Code** sent to the confirmed address.

This is **Additional Login Security** for ordinary Participants. It is separate from registration **Email Confirmation** and is not identity verification, member verification, KYC, or payment verification.

## Terminology

Use:

- Two-Step Login
- Email Code
- Additional Login Security
- Enable Two-Step Login
- Disable Two-Step Login

Do not use identity-verification or membership language for this feature.

## Distinction from email confirmation

| Flow               | When                               | Purpose                                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------- |
| Email Confirmation | Registration / unconfirmed login   | Prove ownership of the supplied email before first workspace access |
| Two-Step Login     | Optional, after email is confirmed | Add a second factor when establishing a new login session           |

Registration confirmation uses purpose `registration_email_confirmation`. Login two-step uses `login_email_two_step`. Enable/disable setting changes use `login_two_step_enable` and `login_two_step_disable`.

## Security setting model

Auth users store:

- `loginEmailTwoStepEnabled?: boolean` — `true` when Two-Step Login is active

The public projection on `/account` also exposes:

- `emailVerificationStatus` — must be `verified` before enabling Two-Step Login

No member status, Stripe, or identity-verification fields are added by this feature.

## Enable / disable flow

Both changes require an authenticated session, a confirmed email, the current password, and a one-time email code.

### Enable

1. Participant opens `/account` → **Account Security**.
2. Enters current password and chooses **Enable Two-Step Login**.
3. `POST /api/v1/auth/login-two-step/enable/start` validates password and queues a six-digit code.
4. Participant submits the code via `POST /api/v1/auth/login-two-step/enable/confirm`.
5. API sets `loginEmailTwoStepEnabled = true` and returns the updated user projection.

### Disable

1. Participant enters current password and chooses **Disable Two-Step Login**.
2. `POST /api/v1/auth/login-two-step/disable/start` validates password and queues a code.
3. `POST /api/v1/auth/login-two-step/disable/confirm` validates the code and sets `loginEmailTwoStepEnabled = false`.

Disabling without password confirmation and email code is not allowed, so a stolen browser session cannot silently remove Two-Step Login.

Setting resend: `POST /api/v1/auth/login-two-step/setting/resend` with `{ "action": "enable" | "disable" }`.

## Login challenge flow

### Without Two-Step Login

`POST /api/v1/auth/login` → normal authenticated session:

```json
{
  "data": {
    "authenticationComplete": true,
    "user": { "...": "..." },
    "tokens": { "...": "..." }
  }
}
```

### With Two-Step Login enabled

1. `POST /api/v1/auth/login` validates email and password.
2. API creates a pending login challenge, sends a login code email, and returns:

```json
{
  "data": {
    "authenticationComplete": false,
    "twoStepRequired": true,
    "challengeToken": "...",
    "maskedEmail": "...",
    "resendAvailableAt": "..."
  }
}
```

3. A short-lived pending challenge token is also stored in an httpOnly cookie (`hu_pending_login_two_step`).
4. Participant completes `/login/verify` with the six-digit code.
5. `POST /api/v1/auth/login/two-step/confirm` consumes the challenge and issues access/refresh tokens.

No access or refresh token is issued before the second step succeeds. `userId` is never exposed to the client; the pending challenge token binds the browser to the in-progress login.

Supporting routes:

| Route                                      | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `GET /api/v1/auth/login/two-step/status`   | Masked email, resend availability, attempts remaining |
| `POST /api/v1/auth/login/two-step/confirm` | Submit code; issue session                            |
| `POST /api/v1/auth/login/two-step/resend`  | Issue a new login code                                |
| `POST /api/v1/auth/login/two-step/cancel`  | Cancel pending login                                  |

## Pending login challenge

Login codes reuse the `email_confirmation_codes` collection with purpose `login_email_two_step`. Records include:

- `confirmationId`, `userId`, `codeHash`, `purpose`, `status` (`active` | `consumed` | `expired` | `revoked`)
- `expiresAt`, `attemptCount`, `maxAttempts`, `createdAt`, optional `consumedAt`
- optional privacy-safe `ipKey` for rate limiting

Plain codes are never stored. Only one active login challenge per user is practical; resend revokes the previous active code.

## Code security

| Setting             | Env var                                           | Default             |
| ------------------- | ------------------------------------------------- | ------------------- |
| Code TTL            | `LOGIN_EMAIL_CODE_TTL_MINUTES`                    | 10 minutes          |
| Max failed attempts | `LOGIN_EMAIL_CODE_MAX_ATTEMPTS`                   | 5                   |
| Resend cooldown     | `LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS`        | 60 seconds          |
| Max sends per hour  | `EMAIL_CONFIRMATION_MAX_SENDS_PER_HOUR`           | 5 per user/email/IP |
| Challenge token TTL | `LOGIN_EMAIL_TWO_STEP_CHALLENGE_TOKEN_EXPIRES_IN` | 15m                 |

Codes are six numeric digits (leading zeros allowed). Hashed with SHA-256 over `userId:code`, consistent with registration confirmation codes.

## Email template

Template: `login_two_step_code`

Subject: **Your Humanity Union login code**

Body includes the six-digit code, a 10-minute expiry notice, and guidance to change the password if the login was unexpected. No password or token values are included.

## Rate limiting

Limits apply by account, privacy-safe request key (IP hash where permitted), and challenge record. Protected endpoints:

- Password login
- Login code confirmation and resend
- Enable/disable setting start, confirm, and resend

Failed login responses use generic _Invalid email or password_ messaging to avoid account enumeration.

## Session behavior

Two-Step Login applies only when establishing a **new login session** after password authentication.

- Normal access-token refresh does **not** send another email code.
- A new second step is required after explicit logout and login, refresh session expiration/revocation, password reset, and other security-sensitive session invalidation.

## Recovery limitations

Because Two-Step Login depends on email access:

- Password reset remains the primary self-service recovery route.
- Account-security support may be required if email access is lost.

There are no unsafe security questions, administrator code reveal endpoints, or bypass paths in this task.

## Future administrator policy

Architecture supports future mandatory Two-Step Login (or stronger factors) for administrators, moderators, and other security-sensitive roles. Ordinary Participants keep optional email two-step only in this task.

Future migration path:

- TOTP/authenticator apps as an additional or replacement second factor
- Passkeys/WebAuthn for phishing-resistant login
- Recovery codes managed separately from email OTP

Existing purpose-specific OTP configuration and pending-challenge token patterns are designed to accommodate those extensions without mixing registration confirmation with login verification.

## Verification

Run:

```bash
npm run verify:email-two-step-login
```

The script runs three consecutive passes covering enable/disable guards, login challenge issuance, token withholding, code validation, resend cooldown, refresh behavior, logout/re-login, and absence of member/payment/identity fields.
