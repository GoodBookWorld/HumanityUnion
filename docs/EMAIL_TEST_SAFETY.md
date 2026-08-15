# Email Test Safety

Mail Delivery Reliability Pack 01 — prevent automated tests from contacting Flockmail / generating bounce storms.

## Incidents

### TASK-095B

Verification runs inherited `EMAIL_PROVIDER=smtp` and sent welcome mail to `@example.com`, producing Titan/Flockmail bounce traffic.

### Pack 01 (direct-messaging synthetic recipients)

Automated/direct-messaging tests used synthetic addresses such as:

```
dm-service-...@direct-messaging.test
```

When real SMTP was reachable, Flockmail attempted DNS delivery and bounced to the Humanity Union administrative mailbox.

Root causes:

1. Valid SMTP credentials present in `apps/api/.env` during test runs.
2. Synthetic recipient hard-guard was incomplete / verification-mode-only.
3. Provider selection could still resolve to real SMTP if isolation flags were incomplete.

## Required architecture

```
TEST / VERIFICATION
  → Fake / in-memory MockEmailProvider
  → NEVER real SMTP

REAL DEV / PRODUCTION MAIL
  → MailDeliveryService
  → Flockmail SMTP (smtp-out.flockmail.com)
```

## Permanent controls

### 1. Test preload (`apps/api/test/helpers/test-setup.ts`)

After dotenv loads (which may include production SMTP credentials):

```
NODE_ENV=test
NODE_TEST_ENV=true
EMAIL_PROVIDER=mock
ALLOW_REAL_EMAIL_IN_TESTS=false
HU_VERIFICATION_MODE=true
```

Credentials remaining in `process.env` must not override this isolation.

### 2. Provider mode force (`mustForceMockEmailProvider`)

`resolveEmailProviderMode()` always returns `mock` when:

- `NODE_ENV=test`, or
- `NODE_TEST_ENV=true`, or
- `HU_VERIFICATION_MODE=true`

unless `ALLOW_REAL_EMAIL_IN_TESTS=true` (manual smoke only).

### 3. SMTP transport refuse

`createSmtpTransport()` throws in automated test/verification mode — no pooled connection to Flockmail.

### 4. Synthetic recipient hard guard (all environments)

Before any external provider send, recipients matching reserved/synthetic patterns are blocked locally (`test_recipient_blocked`):

- Domains ending in `.test`, `.invalid`, `.example`, `.localhost`, `.local`
- Documentation domains: `example.com`, `example.org`, `example.net`
- Bare labels such as `localhost` / `test`

This is **not** limited to the string `direct-messaging.test`.

Behavior:

- Message is **not** submitted to Flockmail
- No external bounce is generated
- Result status: `blocked`

Mock provider may still accept synthetic addresses for local assertions.

### 5. Queue draining

Verification finalizers drain async email queue jobs before exit.

### 6. Manual SMTP only

`npm run test:smtp` in `apps/api` is manual only — never part of CI / `verify:*` / regression.

## Proving isolation

`apps/api/test/unit/email/mail-delivery-reliability-pack01.test.ts` covers:

- `NODE_ENV=test` never selects Flockmail SMTP even with real-looking credentials
- `.test` / `.invalid` / `.example` recipients blocked on real provider
- No SMTP transporter cache after blocked sends
- Logo absolute HTTPS / no localhost in rendered HTML
- HTML + plain-text templates
- Temporary vs permanent retry classification

## Deliberate real SMTP smoke

Only after automated gates pass, and only with a **user-approved real recipient**:

```bash
cd apps/api
SMTP_TEST_RECIPIENT=<approved-inbox> npm run test:smtp
```

Never use synthetic test addresses for real smoke.

## Related documentation

- `docs/EMAIL_DELIVERY_OPERATIONS.md`
- `docs/EMAIL_INFRASTRUCTURE_FOUNDATION.md`
