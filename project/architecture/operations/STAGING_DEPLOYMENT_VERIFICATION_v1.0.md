# Staging Deployment Verification v1.0

**Status:** STAGING ENVIRONMENT IN USE (operator-provisioned hosts; formal checklist rows below may still say PENDING until re-verified in a dedicated ops Pack)
**Date:** 2026-08-13 (status wording refreshed 2026-08-16 — Continuity Pack 01)
**Scope:** First real staging environment — Render Web + Render API + Atlas + R2 + Cloudflare DNS
**Non-goals:** Production cutover (`huws.org` / `api.huws.org`), production user migration, Push

**Note:** Admin Console Packs 02–05 are implemented in the repository (see `project/architecture/administration/ADMIN_ARCHITECTURE_v1.0.md` §42). This verification document does **not** invent completed HTTPS/auth/PWA smoke results — leave §14 PENDING until explicitly re-verified.

Related:

- [PRODUCTION_CONFIGURATION_OPERATIONS_v1.0.md](./PRODUCTION_CONFIGURATION_OPERATIONS_v1.0.md)
- Production Pre-Deployment Hardening Pack 01 (complete in code; no live deploy)

---

## 1. Target architecture (confirmed)

| Host / service | Provider | Notes |
|---|---|---|
| `https://staging.huws.org` | Render Web (Next.js standalone) | Virginia |
| `https://api-staging.huws.org` | Render API (`node dist/index.js`) | Virginia, always-on, single instance |
| `humanity_union_staging` | MongoDB Atlas | Prefer **Canada Central**; separate from `humanity_union_dev` and future production DB |
| Public media | Cloudflare R2 `humanity-union-staging-media` | Public custom domain / `R2_PUBLIC_BASE_URL` |
| Private Shared Documents | Cloudflare R2 **separate** private bucket | e.g. `humanity-union-staging-private` — **no** public domain |
| DNS / edge | Cloudflare | Staging CNAMEs only — do not change production apex/MX |
| Mail | Flockmail SMTP `smtp-out.flockmail.com` | One approved manual recipient only |
| AI / Translation | Gemini (server-side) | `LIFECYCLE_AI_PROVIDER=gemini`, `TRANSLATION_PROVIDER=gemini` |

**Cursor cannot create Render / Atlas / Cloudflare / Flockmail / Google resources.** Operators enter secrets only in provider dashboards — never paste secrets into chat or Git.

---

## 2. Action ownership

### A. Cursor / repository (done or in-repo)

- Durable media metadata → Mongo `media_upload_records` + bootstrap hydrate
- Private Shared Documents → `SecureDocumentStorageProvider` with local default + `R2_PRIVATE_BUCKET` path
- Production validation requires distinct `R2_PRIVATE_BUCKET` when `MEDIA_STORAGE_PROVIDER=r2`
- `PLATFORM_MODE=staging` accepted (API maps to beta invite/bootstrap rules)
- Web noindex via `NEXT_PUBLIC_PLATFORM_MODE=staging`
- Env inventory in `apps/api/.env.example` (placeholders only)

### B. User-controlled dashboards (required before live verification)

Follow sections 3–8 below. Do not commit real `.env` files.

---

## 3. MongoDB Atlas — staging database

**Preferred region:** Canada Central (Toronto).

**Decision:** One Atlas cluster may host multiple databases. Staging **must** use database name `humanity_union_staging` with a least-privilege app user. Do **not** reuse `humanity_union_dev` or future production DB / user.

### Steps

1. Atlas → Project → Cluster (prefer Canada Central).
2. Database Access → Add user `hu_staging_app` (SCRAM), strong password, role: readWrite on `humanity_union_staging` only.
3. Network Access → allow Render outbound IPs (or temporarily `0.0.0.0/0` only while debugging, then restrict).
4. Connect → Drivers → copy URI; set database name to `humanity_union_staging`.
5. Paste URI into **Render API** env as `MONGODB_URI` / `MONGODB_DATABASE=humanity_union_staging` (dashboard only).
6. Indexes are created by API bootstrap (`ensureMongoIndexes`) on first healthy start — no manual index scripting required.
7. Do not copy QA/dev data automatically.

### Backups (staging)

| Item | Record |
|---|---|
| Tier snapshots | Document Atlas tier (M0 often has limited/no continuous backup) |
| Restore process | Atlas UI → Backup / Snapshots → Restore to new cluster or database |
| Production claim | **Do not** claim production backup readiness from staging tier alone |

---

## 4. Cloudflare R2 — staging buckets

Create **two** buckets:

| Bucket (suggested) | Purpose | Public access |
|---|---|---|
| `humanity-union-staging-media` | Avatars, initiative images, blog covers | Yes — custom domain / `R2_PUBLIC_BASE_URL` |
| `humanity-union-staging-private` | Shared Documents only | **No** public domain |

### Steps

1. Cloudflare → R2 → Create both buckets.
2. Manage R2 API Tokens → create token with Object Read & Write on both buckets.
3. Note Account ID, Access Key ID, Secret Access Key (dashboard only).
4. For public bucket only: connect custom domain (e.g. `media-staging.huws.org`) **or** use r2.dev public URL carefully.
5. **Never** connect a public custom domain to the private bucket.

### API env (Render — no Web exposure)

```text
MEDIA_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=humanity-union-staging-media
R2_PUBLIC_BASE_URL=https://media-staging.huws.org   # or provider public base, no trailing slash
R2_PRIVATE_BUCKET=humanity-union-staging-private
```

---

## 5. Render — API service

**Region:** Virginia (US East) unless account has a better approved NA option.

| Setting | Value |
|---|---|
| Runtime | Node |
| Build | root: `pnpm install --frozen-lockfile && pnpm --filter @hu/api build` (or monorepo-equivalent API build) |
| Start | `node apps/api/dist/index.js` (confirm path matches package output) |
| Health | `/api/v1/health/ready` (also verify `/api/v1/health`) |
| Instances | **1** (no autoscale initially — outbox single dispatcher) |
| Plan | Always-on (outbox + news scheduler need a persistent process) |

Do **not** use `tsx watch` / `pnpm dev` on Render.

### Required API env categories (names only)

`NODE_ENV=production`, `PLATFORM_MODE=staging`, Mongo, JWT secrets, `CORS_ORIGIN`/`WEB_ORIGIN=https://staging.huws.org`, `API_PUBLIC_URL=https://api-staging.huws.org`, Media/R2 (above), SMTP, Gemini, Translation, durable persistence defaults (mongodb), logging.

---

## 6. Render — Web service

| Setting | Value |
|---|---|
| Build | `pnpm install --frozen-lockfile && pnpm --filter @hu/web build` |
| Start | standalone Next server (`node apps/web/server.js` or Dockerfile entry) |
| Health | `/health` |
| Build env | `NEXT_PUBLIC_PLATFORM_MODE=staging`, `NEXT_PUBLIC_API_BASE_URL=https://api-staging.huws.org`, `NEXT_PUBLIC_SITE_URL=https://staging.huws.org` |

Confirm standalone packaging includes `.next/standalone`, `.next/static`, `public`, required workspace packages.

**No secrets as `NEXT_PUBLIC_*`.**

---

## 7. DNS (staging only)

After Render services show healthy:

| Name | Type | Target |
|---|---|---|
| `staging` | CNAME | Render Web hostname |
| `api-staging` | CNAME | Render API hostname |

Optional: `media-staging` → R2 public bucket custom domain.

### Do NOT modify

- `huws.org` production apex / www cutover
- MX / SPF / DKIM / DMARC for production mail unless Flockmail explicitly requires additive staging-safe records (prefer leave production mail DNS unchanged)

### Cloudflare proxy

- Prefer Proxied (orange cloud) for Web/API with HTTPS.
- Cache rules: **bypass** `/api/*`, `/workspace/*`, authenticated/private responses.
- Static assets may use normal edge caching.

---

## 8. Auth / cookie contract (must verify on real HTTPS)

| Item | Expected |
|---|---|
| Web origin | `https://staging.huws.org` |
| API origin | `https://api-staging.huws.org` |
| Cookies | HttpOnly, Secure, SameSite=Lax, host-only on API host |
| CORS | Exact origin — no `*` |
| Credentials | `include` |

Manual checklist: guest → login → `/auth/session` → `/workspace` → reload → PWA reopen → logout clears cookies.

---

## 9. Noindex (mandatory)

Verify live:

- HTML robots meta: `noindex, nofollow`
- `https://staging.huws.org/robots.txt` disallows `/`
- Driven by `NEXT_PUBLIC_PLATFORM_MODE=staging` at **build** time

---

## 10. SMTP / Gemini / Translation

| Concern | Staging rule |
|---|---|
| SMTP host | `smtp-out.flockmail.com` |
| Automated tests | Must remain mock — no real SMTP in CI |
| Manual smoke | One approved recipient only; skip send if none approved |
| Email logo | `https://staging.huws.org/brand/humanity-union-logo-white-email.png` must resolve over HTTPS |
| Gemini | Server-only `GEMINI_API_KEY`; one Assistant smoke; no auto-publish |
| Translation | `TRANSLATION_PROVIDER=gemini`; one EN→UK or FR smoke |

---

## 11. Restart / durability verification (after provision)

1. Upload public avatar/cover → note URL → restart API → URL still loads; delete-by-mediaId still works (Mongo metadata).
2. Upload private Shared Document → restart API → authorized download succeeds (private R2).
3. Confirm unauthorized download fails; object not reachable via `R2_PUBLIC_BASE_URL`.

---

## 12. Monitoring (plan only — no purchase)

- Uptime targets: `https://staging.huws.org/health`, `https://api-staging.huws.org/api/v1/health`
- Error monitoring: defer Sentry until staging logs prove need; recommend install before public launch if logs are noisy/opaque

---

## 13. Production cutover preview (do not execute)

1. Provision production Atlas DB + R2 buckets + Render prod services.
2. Point `api.huws.org` then `huws.org` after smoke.
3. Keep old website rollback until production smoke passes.
4. Do not migrate users from staging; do not reuse staging secrets.

---

## 14. Verification results log

| Check | Result | Notes |
|---|---|---|
| Atlas staging DB | PENDING | User dashboard |
| Atlas backups | PENDING | Document tier capability |
| R2 public bucket | PENDING | User dashboard |
| R2 private bucket | PENDING | User dashboard |
| Render API | PENDING | User dashboard |
| Render Web | PENDING | User dashboard |
| DNS staging CNAMEs | PENDING | Do not touch production |
| HTTPS / cookies / CORS | PENDING | Needs live hosts |
| Noindex live | PENDING | |
| Media restart persistence | CODE READY | Needs live restart proof |
| Shared Doc restart persistence | CODE READY | Needs live restart proof |
| SMTP / Gemini / PWA | PENDING | |

---

## 15. Current blocker / risk classification

| Severity | Item |
|---|---|
| OPEN (product/staging data) | Operator-observed: Initiative images UI, historical Participant login, unrestored comments/likes/support — see `project/NEXT_SESSION.md` (Pack 04) |
| HIGH (ops hygiene) | Formal §14 verification log still contains PENDING rows — do not treat this table as a completed smoke certificate |
| HIGH (mitigated in code) | Media metadata durability → Mongo `media_upload_records` |
| HIGH (mitigated in code) | Shared Document bytes on ephemeral disk → private R2 seam + validation |
| MEDIUM | Staging Atlas backup tier may be weaker than production needs |
| LOW | API `PLATFORM_MODE=staging` maps to beta behavior (documented) |

**Continuity Pack 01 correction:** earlier “hosts not yet provisioned” wording is obsolete relative to operator-provisioned staging use. This file still does not claim a full automated verification pass.

---

**End of STAGING_DEPLOYMENT_VERIFICATION_v1.0.md**
