# Email Test Safety

This document records the TASK-095B incident and the permanent controls that prevent automated tests from sending real email.

## Incident summary

During membership and related verification runs, scripts created real user registrations that triggered **welcome emails through the async email queue**. More than **40 messages** were sent through the configured **Titan SMTP** provider to synthetic addresses such as:

```
membership-domain-...-status@example.com
```

Because `example.com` publishes a **null MX**, Titan accepted the messages for delivery but the recipient domain could not receive them, producing **bounce notifications**.

Root causes:

1. Verification scripts inherited `EMAIL_PROVIDER=smtp` from the developer shell or loaded `.env` without forcing mock mode.
2. Welcome email used the **async queue** (`sendTransactionalEmail`) and was not drained before process exit (fixed in TASK-INFRA-001B).
3. No factory guard blocked real SMTP/Resend construction during verification runs.

## Permanent prevention controls

### 1. Verification bootstrap

All scripts using `runVerificationScript()` import `verification-environment.bootstrap.ts`, which sets:

```
HU_VERIFICATION_MODE=true
EMAIL_PROVIDER=mock
```

unless `ALLOW_REAL_EMAIL_IN_TESTS=true` (manual opt-in only).

### 2. Provider factory guard

`resolveEmailProvider()` rejects `smtp` and `resend` when:

- `HU_VERIFICATION_MODE=true`, and
- `ALLOW_REAL_EMAIL_IN_TESTS` is not `true`

### 3. Reserved recipient domains

In verification mode, real providers reject recipients on documentation/test domains:

- `example.com`, `example.org`, `example.net`
- `.test`, `.invalid`, `localhost`

### 4. Package script isolation

Root `verify:*` email-related scripts set:

```
HU_VERIFICATION_MODE=true EMAIL_PROVIDER=mock
```

### 5. Queue draining

`finalizeVerificationResources()` drains:

- civic notification tasks
- async email queue jobs
- mock outbox reset between isolated passes

### 6. Manual SMTP only

`npm run test:smtp` (in `apps/api`) is **manual only**:

- never part of `verify:*`, CI, typecheck, or build
- sends at most one message
- requires explicit recipient configuration
- prints a warning before sending

## Running automated gates safely

```bash
npm run verify:smtp-provider
npm run verify:email
npm run verify:membership-domain
```

Expected:

- `[email:mock]` log lines only
- zero Titan connections
- zero bounce messages
- processes exit naturally

## Deliberate real SMTP testing

Only after automated gates pass:

1. Ensure `HU_VERIFICATION_MODE` is **unset** or `false`.
2. Configure `apps/api/.env` with Titan settings.
3. Start API with `cd apps/api && npm run dev`.
4. Check `GET /api/v1/health` → `email.provider = smtp`, `healthy = true`.
5. Register **one controlled real address** manually in the browser.
6. Or run `npm run test:smtp` with `SMTP_TEST_RECIPIENT` set.

Never use `@example.com` or other reserved domains for real SMTP tests.

## Related documentation

- `docs/EMAIL_DELIVERY_OPERATIONS.md`
- `docs/API_MODULE_RESOLUTION.md`
