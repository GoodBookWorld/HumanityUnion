# Email Delivery Operations

Mail Delivery Reliability Pack 01 — canonical outbound mail via Flockmail SMTP.

## Canonical architecture

```
Domain / system event
  → Notification decision (in-app) and/or preference gate
  → MailDeliveryService (apps/api/src/modules/email)
  → Provider (mock | smtp | resend)
  → SMTP (smtp-out.flockmail.com) when EMAIL_PROVIDER=smtp
```

Do not construct per-feature SMTP transports (Auth, Blog, Notifications, reminders).

## Provider configuration

Set `EMAIL_PROVIDER` in `apps/api/.env` (server-side only — never expose to Web):

| Provider           | Value    | Required variables                                                                 |
| ------------------ | -------- | ---------------------------------------------------------------------------------- |
| Mock (development) | `mock`   | none                                                                               |
| SMTP               | `smtp`   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`/`SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`/`SMTP_FROM_EMAIL` |
| Resend             | `resend` | `RESEND_API_KEY`, `SMTP_FROM` / `EMAIL_FROM`                                       |

### Canonical Flockmail SMTP (documentation only — do not commit passwords)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-out.flockmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@huws.org
SMTP_PASSWORD=<secret>
SMTP_FROM_EMAIL=info@huws.org
SMTP_FROM_NAME=Humanity Union
EMAIL_REPLY_TO=info@huws.org
EMAIL_LOGO_URL=https://huws.org/brand/humanity-union-logo-white-email.png
SMTP_CONNECTION_TIMEOUT_MS=15000
SMTP_GREETING_TIMEOUT_MS=15000
SMTP_SOCKET_TIMEOUT_MS=30000
SMTP_MAX_ATTEMPTS=3
```

Notes:

- Hostinger/Titan family mail often presents as `smtp-out.flockmail.com` (alias of Titan SMTP).
- Prefer port `465` + `SMTP_SECURE=true` (implicit TLS). Confirm against the live mailbox settings before changing.
- TLS certificate validation remains enabled (`rejectUnauthorized: true`). Do not disable it.
- Aliases accepted: `SMTP_USER` ↔ `SMTP_USERNAME`, `SMTP_FROM_EMAIL` ↔ `SMTP_FROM`, `SMTP_FROM_NAME` ↔ `EMAIL_FROM_NAME`.

## Transport lifecycle

- One pooled Nodemailer transporter is reused (`pool: true`).
- Connection / greeting / socket timeouts prevent hung API requests.
- Temporary SMTP failures retry with bounded backoff (`SMTP_MAX_ATTEMPTS`, default 3).
- Permanent failures (auth, invalid recipient/sender) do not loop.
- API startup does not hard-fail when SMTP is temporarily unreachable; health reports unhealthy and sends fail gracefully.

## Delivery result (internal)

Statuses: `sent` | `failed` | `deferred` | `blocked`

Metadata (not exposed to end users): `messageId`, `attemptCount`, `provider`, `durationMs`, `failureCategory`.

## Email preferences

Participant `communicationPreferences.emailNotificationsEnabled` gates non-auth notification email (e.g. Blog Author Access status). Default when preferences are absent: enabled (matches preference defaults).

Prefer digest-style copy (`workspace_notification_summary`) over duplicating every in-app Notification body into email.

## Private content rule

Email must never include:

- Direct Message bodies
- Collaboration Channel private content
- private documents
- credentials / OTP bodies beyond the intentional auth templates

Allowed alert copy example: “You have a new message in Humanity Union.” with a link back to the Workspace.

## Blog Author Access email

Approved / changes requested / declined events emit in-app notifications and, when email preferences allow, a `blog_author_application_status` message through `MailDeliveryService` (no Blog-specific SMTP).

## Branded email header / logo

Transactional templates use a shared blue header:

- Humanity Union logo (when a safe public HTTPS URL is configured)
- “Humanity Union” text (always present)

| Asset          | Path                                                        |
| -------------- | ----------------------------------------------------------- |
| Source (SVG)   | `apps/web/public/brand/humanity-union-logo-white.svg`       |
| Email-safe PNG | `apps/web/public/brand/humanity-union-logo-white-email.png` |

```env
EMAIL_LOGO_URL=https://huws.org/brand/humanity-union-logo-white-email.png
```

Requirements:

- Absolute HTTPS URL
- Publicly reachable without authentication
- PNG preferred
- No localhost / relative application paths

When `EMAIL_LOGO_URL` (or `{WEB_ORIGIN}/brand/...` fallback) is not a safe public HTTPS URL, templates **omit** the `<img>` so Gmail does not show a broken-image icon. Text branding remains. Plain-text bodies never depend on the image.

Future option (not required for Pack 01): CID inline attachment (`cid:humanity-union-logo`).

## Email Sender Brand Identity / Deliverability (not HTML)

The avatar shown by Gmail beside `Humanity Union <info@huws.org>` is controlled by **sender / mail-domain identity and Gmail**, **not** by the HTML email template.

Do not attempt to fix that avatar with HTML/CSS.

### DNS / mailbox deployment checklist (manual — do not automate DNS from this repo)

Configure with the domain registrar / DNS host and Flockmail mailbox:

1. **SPF** — authorize Flockmail/Titan outbound senders for the From domain (`huws.org`).
2. **DKIM** — enable signing for the mailbox/domain in the Flockmail/Titan control panel; publish the DKIM TXT record.
3. **DMARC** — publish a DMARC policy (start with `p=none` + rua reporting, tighten after alignment is confirmed).
4. **From alignment** — `SMTP_FROM_EMAIL` / envelope identity should align with the SPF/DKIM domain.
5. **BIMI readiness** (optional) — requires strong DMARC (`p=quarantine`/`reject`) plus a published BIMI record and brand mark; confirm Gmail eligibility separately.
6. **Flockmail mailbox profile avatar** — if the provider exposes a mailbox/profile photo, configure it in the Flockmail/Titan account UI (independent of HTML templates).

### Bounce / Return-Path behavior

| Header / concept | Behavior |
| ---------------- | -------- |
| From             | Canonical `SMTP_FROM_NAME` + `SMTP_FROM_EMAIL` |
| Reply-To         | Optional `EMAIL_REPLY_TO` |
| Envelope-From / Return-Path | Provider default (Nodemailer / Flockmail). Production bounces typically arrive at the authenticated mailbox or provider bounce address |

Goals:

- Synthetic/test recipients never leave the process → no Flockmail DNS bounce storms.
- Genuine production delivery failures remain observable (do not hide legitimate bounces).

If a dedicated bounce mailbox is desired, configure it explicitly with operator approval — do not invent an address in code.

## Automated test isolation (mandatory)

See `docs/EMAIL_TEST_SAFETY.md`.

Even when `apps/api/.env` contains valid Flockmail credentials:

- `NODE_ENV=test` / `NODE_TEST_ENV=true` / `HU_VERIFICATION_MODE=true` force `EMAIL_PROVIDER=mock`
- SMTP transporter construction is refused in those modes
- Synthetic recipients (`.test`, `.invalid`, `.example`, `example.com`, …) are hard-blocked before external SMTP
- Automated regression must never open `smtp-out.flockmail.com`

## Registration / auth flows

Auth confirmation, welcome, password reset, and two-step login continue through `MailDeliveryService` / `sendTransactionalEmail*` helpers. Confirmation URLs and token semantics are unchanged by Pack 01.

## Health / diagnostics

`GET /api/v1/health` reports provider health (configured / healthy / message). Optional internal fields: `lastSuccessAt`, `lastFailureCategory`.

Never expose SMTP username, password, or raw auth error payloads containing secrets.

## Logging

Allowed: template, recipient domain or redacted recipient, success/failure, duration, attempt count, failure category.

Forbidden: email bodies, verification secrets, password-reset tokens, SMTP password, unnecessary full recipient addresses.

## Manual SMTP smoke (deliberate only)

```bash
cd apps/api
SMTP_TEST_RECIPIENT=<user-approved-real-inbox> npm run test:smtp
```

Rules:

- At most one message
- Never synthetic `@*.test` / `@example.com` recipients
- Never run from CI or `verify:*`
- Do not default to the administrative mailbox unless explicitly approved

Subject concept: `Humanity Union email delivery test`

## Language readiness

Templates are English by default and locale-ready for future Language Architecture integration. Do not build full multilingual email packs until prepared.

## Production checklist

- [ ] `EMAIL_PROVIDER=smtp` with `SMTP_HOST=smtp-out.flockmail.com`
- [ ] Credentials in deployment secrets only
- [ ] `EMAIL_LOGO_URL` absolute public HTTPS
- [ ] SPF / DKIM / DMARC configured for From alignment
- [ ] Registration + one controlled real inbox smoke verified
- [ ] Automated gates: mock only, zero real SMTP
