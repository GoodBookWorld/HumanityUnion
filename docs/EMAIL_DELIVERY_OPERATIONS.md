# Email Delivery Operations

TASK-095 / TASK-095B email delivery operations guide.

## Provider configuration

Set `EMAIL_PROVIDER` in `apps/api/.env`:

| Provider           | Value    | Required variables                                                      |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| Mock (development) | `mock`   | none                                                                    |
| SMTP               | `smtp`   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Resend             | `resend` | `RESEND_API_KEY`, `EMAIL_FROM` or `SMTP_FROM`                           |

### Titan SMTP example (documentation only — do not commit passwords)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=info@huws.org
SMTP_PASSWORD=<secret>
SMTP_FROM=info@huws.org
EMAIL_FROM_NAME="Humanity Union"
EMAIL_REPLY_TO=info@huws.org
```

Shared:

- `EMAIL_FROM_NAME` (default: Humanity Union)
- `EMAIL_REPLY_TO` (optional)
- `WEB_ORIGIN` / `CORS_ORIGIN` (link targets)
- `EMAIL_LOGO_URL` (absolute HTTPS URL for email header logo; see below)

## Automatic environment loading

`apps/api` loads `apps/api/.env` automatically via `loadApiEnvironment()` before email configuration is read.

Precedence:

| Environment                             | Behavior                                                                                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development (`NODE_ENV` ≠ `production`) | Values from `apps/api/.env` **override** inherited shell variables (so local `EMAIL_PROVIDER=smtp` is not replaced by a parent-shell `EMAIL_PROVIDER=mock`) |
| Production                              | Process environment wins; `apps/api/.env` fills only unset variables                                                                                        |

Manual `source .env` is not required for `npm run dev`.

## Branded email header / logo

Transactional templates use a shared blue header with the Humanity Union logo.

| Asset          | Path                                                        |
| -------------- | ----------------------------------------------------------- |
| Source (SVG)   | `apps/web/public/brand/humanity-union-logo-white.svg`       |
| Email-safe PNG | `apps/web/public/brand/humanity-union-logo-white-email.png` |

Configure an **absolute public URL**:

```env
EMAIL_LOGO_URL=https://huws.org/brand/humanity-union-logo-white-email.png
```

Local development fallback (when `EMAIL_LOGO_URL` is unset):

```
{WEB_ORIGIN}/brand/humanity-union-logo-white-email.png
```

**Local development limitation:** when `WEB_ORIGIN` is `http://localhost:3000`, external email clients (Gmail, Outlook, mobile mail apps) cannot fetch that logo URL. The email still renders correctly with the blue header, `alt="Humanity Union"`, and visible text fallback — only the image is missing locally. This is expected and not a template defect.

**Production requirement:** deploy the PNG to the public web origin and configure:

```env
EMAIL_LOGO_URL=https://huws.org/brand/humanity-union-logo-white-email.png
```

Do not hardcode the production domain in email templates. Templates resolve the logo through `resolveEmailLogoUrl()` / `EMAIL_LOGO_URL`.

### Future inline logo architecture (not implemented in v1)

A future option is CID inline attachment support:

```html
<img src="cid:humanity-union-logo" alt="Humanity Union" />
```

That would embed the PNG directly in each transactional message and avoid dependence on a public HTTPS asset URL. v1 uses the deployed public asset URL approach above because it fits the current provider abstraction without SMTP MIME attachment changes.

Email clients often render PNG more reliably than SVG. The HTML header includes `alt="Humanity Union"` and a visible text fallback when images are blocked. Plain-text bodies always include codes and instructions.

## Mock provider behavior

When `EMAIL_PROVIDER=mock`:

- Emails are logged to the API console and stored in `MockEmailProvider.sentMessages` (tests only)
- The UI shows a development notice on confirmation/login verify pages
- OTP codes are never exposed in production UI or public endpoints

## Automated test isolation (mandatory)

All `verify:*` gates use mock email only. See `docs/EMAIL_TEST_SAFETY.md`.

Controls:

- `HU_VERIFICATION_MODE=true` during verification scripts
- `EMAIL_PROVIDER=mock` forced at bootstrap
- Factory guard blocks `smtp` / `resend` without `ALLOW_REAL_EMAIL_IN_TESTS=true`
- Reserved domains (`example.com`, etc.) cannot reach real providers in verification mode
- Async queue drained before process exit

Run:

```bash
npm run verify:smtp-provider
```

## Registration confirmation flow

1. User registers → pending account created
2. Six-digit code generated
3. Provider send attempted synchronously (`sendTransactionalEmailAndAwait`)
4. API returns `emailSent: true` only after provider acceptance
5. Welcome email sends only after successful code confirmation (async queue)

Pending accounts support **Resend Code** without false “code sent” messaging when delivery fails.

## Two-step login flow

1. Verified user with two-step enabled submits password
2. Login code generated and sent synchronously
3. API returns `emailSent` on challenge response
4. Full session issued only after code confirmation
5. Token refresh does not send a new login code

## Delivery failure behavior

If sending fails:

- API returns `emailSent: false`
- UI shows: “We could not send the confirmation code. Please try again shortly.”
- Challenge is not marked as delivered (`lastSentAt` unset)
- Resend remains available without false success messaging
- Server logs use masked recipients, for example: `v***@example.org`
- Never log SMTP passwords, OTP codes, or raw message bodies

## Health check

`GET /api/v1/health` uses the same provider as runtime sending.

For SMTP:

- Calls `transporter.verify()` — **no email is sent**
- Expected when configured: `provider: "smtp"`, `healthy: true`, `configured: true`

## Manual SMTP test (deliberate only)

```bash
cd apps/api
SMTP_TEST_RECIPIENT=you@yourdomain.org npm run test:smtp
```

Never run `test:smtp` from automated verification or CI.

## Local development testing

1. Set `EMAIL_PROVIDER=mock` in `apps/api/.env` for day-to-day dev, or `smtp` for real delivery testing
2. Run `cd apps/api && npm run dev`
3. Inspect logs for `[email:mock]` or `[email:smtp]` entries

Verification:

- `npm run verify:smtp-provider`
- `npm run verify:registration-email-confirmation`
- `npm run verify:email-two-step-login`
- `npm run verify:email`

## Troubleshooting SMTP 535 / authentication errors

Compare runtime with the manual test:

1. Confirm `apps/api/.env` is loaded (`npm run dev` from `apps/api`)
2. Confirm shell `EMAIL_PROVIDER=mock` is not overriding `.env` in development (fixed by `loadApiEnvironment`)
3. Confirm `SMTP_PASSWORD` is not trimmed or altered after dotenv load
4. Confirm `SMTP_SECURE=true` with port `465` for Titan
5. Confirm `SMTP_FROM` matches the authenticated mailbox
6. Run `npm run test:smtp` once with a **real** recipient (not `@example.com`)

## Bounce prevention

Never send automated verification traffic to synthetic domains. Use mock provider and `@example.com` only with `EMAIL_PROVIDER=mock`.

## Production checklist

- [ ] `EMAIL_PROVIDER` set to `smtp` or `resend`
- [ ] Provider credentials configured in deployment secrets (not committed)
- [ ] From address/domain verified with provider
- [ ] `WEB_ORIGIN` and `EMAIL_LOGO_URL` match public site URLs
- [ ] Registration and two-step login tested manually with a real inbox
- [ ] Failed delivery returns `emailSent: false` (not false success)
- [ ] Automated gates pass with zero real SMTP sends
