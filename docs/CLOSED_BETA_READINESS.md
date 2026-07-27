# Closed Beta Readiness

Humanity Union closed beta preparation (TASK-064). This document describes controlled access, onboarding, operational safeguards, and deployment readiness for the first real participants.

## Beta philosophy

Closed beta is intentional and controlled:

- Access is invite-only during beta.
- Bootstrap auth is disabled outside development.
- Participants should understand unfinished areas.
- Platform integrity matters more than rapid growth.
- Civic architecture and Capability 02 workflows remain unchanged.

## Platform mode

Set `PLATFORM_MODE` on the API:

| Mode          | Bootstrap              | Registration                                 |
| ------------- | ---------------------- | -------------------------------------------- |
| `development` | Allowed (configurable) | Open                                         |
| `beta`        | Disabled               | Invite-only                                  |
| `production`  | Disabled               | Configurable via `ALLOW_PUBLIC_REGISTRATION` |

Recommended closed beta deployment:

```env
PLATFORM_MODE=beta
AUTH_BOOTSTRAP_FALLBACK=false
AUTH_REQUIRE_EMAIL_VERIFICATION=true
ALLOW_PUBLIC_REGISTRATION=false
```

## Invite process

1. Seed or promote a **Platform Administrator** (`role: admin` on the auth user record).
2. Authenticate as admin and create an invite:

   `POST /api/v1/beta-invites`

   Body: `{ "email": "participant@example.org" }`

3. Share the returned invite code privately with the participant.
4. Participant registers at `/register` with email and beta invite code.
5. Invite is single-use, hashed at rest, and expires after `BETA_INVITE_EXPIRES_DAYS` (default 14).

Invites are never listed with raw codes after creation.

## Test user roles

Use existing identity roles — no new permission system:

| Role                   | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| Platform Administrator | `admin` auth role — generates beta invites |
| Steward                | Initiative steward workflows (existing)    |
| Participant            | Standard member workflows (existing)       |
| Observer               | Future — not implemented in closed beta    |

## Seed data policy

| Environment | Seed policy                                                     |
| ----------- | --------------------------------------------------------------- |
| Development | Local seed/bootstrap allowed for fast iteration                 |
| Beta        | Minimal intentional seed only (admin + test fixtures as needed) |
| Production  | Empty by default — no automatic wipes                           |

**Reset procedure (manual only):**

1. Stop API services.
2. Drop or truncate non-production Mongo collections as required.
3. Re-run index bootstrap (`bootstrapAuthPersistence` / deployment bootstrap).
4. Recreate admin account and beta invites.
5. Verify with `npm run verify:closed-beta`.

Never run automatic database wipes in beta or production.

## First user guide

After login, participants see:

1. **Closed Beta banner** — limited testing notice.
2. **Getting started checklist** (dismissible):
   - Complete Member Profile
   - Configure Participation Area
   - Verify Email
   - Create first Initiative
3. **Workspace Readiness** — checklist only (`Workspace Ready` or `Missing: …`).

Support and feedback: [/support](/support)

## Known limitations

- Closed beta is invite-only; public registration is disabled.
- Some public experience navigation items remain placeholders.
- Capability 02 civic workflows may evolve during stabilization.
- Email delivery depends on configured provider (mock/SMTP/Resend).
- No analytics, referrals, OAuth, or phone verification in this release.

## Deployment checklist

Run before inviting participants:

```bash
npm run typecheck
npm run build
npm run lint
npm run format:check
npm run verify:closed-beta
npm run verify:auth-production
npm run verify:deployment
npm run verify:staging
npm run verify:notifications
npm run verify:workspace-intelligence
npm run verify:global-search
npm run verify:mongodb
```

Operational checklist (also exposed via `GET /api/v1/health` and `GET /api/v1/platform/readiness/platform`):

- Mongo connected
- Health checks pass
- JWT configured
- Email configured
- Notifications working
- Workspace working
- Search working
- Assistant working
- Deployment verified
- Bootstrap disabled
- HTTPS configured
- Email verification enabled
- Mongo Atlas (production)
- Environment validation
- No debug configuration

## Production safety

Production and beta deployments must enforce:

- `AUTH_BOOTSTRAP_FALLBACK=false`
- Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- HTTPS public URLs (`API_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL`)
- Email verification (`AUTH_REQUIRE_EMAIL_VERIFICATION=true` recommended)
- Mongo Atlas or managed Mongo in production
- Validated CORS / web origin configuration
- No development JWT defaults or debug bootstrap

## Support process

- Participants use [/support](/support) for feedback and bug reporting.
- Header/footer **Feedback** links route to the support page.
- No ticket system in closed beta — coordinators triage via agreed channels.

## Rollback

1. Set maintenance mode or stop web/API containers.
2. Redeploy previous known-good image/tag.
3. Confirm `GET /api/v1/health` returns healthy.
4. Re-run smoke verification (`verify:deployment`, `verify:closed-beta`).
5. Pause new invite issuance until stability is confirmed.

## Future public launch

Public launch is explicitly out of scope for TASK-064. When ready:

1. Switch `PLATFORM_MODE=production`.
2. Enable `ALLOW_PUBLIC_REGISTRATION=true` when appropriate.
3. Replace placeholder public experience sections.
4. Expand support and legal pages.
5. Run full production verification suite before announcement.
