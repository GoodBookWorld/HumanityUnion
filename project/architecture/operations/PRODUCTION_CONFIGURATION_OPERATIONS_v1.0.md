# Production Configuration & Operations Pack 01

**Status:** COMPLETE (blueprint only — no provisioning, DNS, or deployment executed)  
**Date:** 2026-08-12  
**Scope:** Infrastructure discovery + production blueprint for Humanity Union Web + API + PWA  
**Non-goals:** Live deploy, DNS changes, secret materialization, data migration, Admin Console, Push/App Store

**Prerequisites confirmed complete (not reopened):**

- Browser & Device QA Pack 01 (with USER REAL-DEVICE PASS)
- PWA Experience + UX correction packs
- Auth & Session Hardening (Pack 07) + Auth Recovery Hotfix
- Performance / Mail Delivery / Production-readiness UX passes

---

## 1. Current runtime inventory

```text
Browser / PWA (huws.org)
        │  credentials: include
        ▼
Next.js 16 Web (@hu/web)  ──►  Express API (@hu/api, Node >=20)
        │                              │
        │                              ├── MongoDB (Atlas intended)
        │                              ├── SMTP (Flockmail canonical)
        │                              ├── Gemini (Assistant + Translation)
        │                              ├── Outbox dispatcher (in-process)
        │                              ├── Public news scheduler (in-process)
        │                              └── Local .runtime/ (dev defaults — prod risk)
        ▼
Service Worker (static shell only) + Manifest (start_url=/workspace)
```

| Layer | Runtime | Build | Start |
|---|---|---|---|
| Web | Next.js 16.2 (`output: "standalone"`) | `pnpm --filter @hu/web build` / root `pnpm build` | `next start -p 3000` or Docker `node apps/web/server.js` |
| API | Express + TypeScript | `tsc -p apps/api` | `node dist/index.js` (compiled) or Docker `pnpm start:prod` (tsx source) |
| Package manager | pnpm 11.9 | Node `>=20` | |
| Existing compose | `docker-compose.yml` — api + web + nginx | Atlas external | Health: `/api/v1/health`, `/health` |

**Dependency map (production-sensitive):**

| Dependency | Used for | Criticality |
|---|---|---|
| MongoDB Atlas | Auth sessions, outbox, domain persistence | Critical (startup fails if URI set but unreachable) |
| Flockmail SMTP | Transactional email | Degraded-ok if down (health reports unhealthy) |
| Gemini API | Assistant + Translation when provider=`gemini` | Degraded-ok (request-time errors) |
| Cloudflare (planned) | DNS / TLS edge / CDN / DDoS | Edge only — not app runtime |
| Local `.runtime/` + uploads | File persistence defaults / media | **Production-dangerous** on ephemeral hosts |

---

## 2. Target hosting recommendation

### Decision (evaluated against actual code)

| Option | Fit for Next + always-on API + outbox | Canada compute | Notes |
|---|---|---|---|
| **Render** | Strong — Web Service for Next, Web Service for API (always-on) | **No** Canadian region (Oregon / Ohio / Virginia / Frankfurt / Singapore) | Best PaaS fit; secrets, health checks, HTTPS, rollback |
| DigitalOcean App Platform | Good | App Platform regions primarily US/EU | Spaces TOR for media later |
| DigitalOcean Droplet + existing Compose | Strong control | **TOR1 Toronto available** | Matches `docs/PRODUCTION_DEPLOYMENT_FOUNDATION.md` |
| Railway | Good PaaS | No Canada | Similar to Render |
| AWS | High complexity | Multiple NA regions | Future only |

### Recommended primary: **Render**

- Two services: **Web** (Next standalone / Docker) + **API** (Node always-on for outbox + news scheduler)
- Region: **Virginia (US East)** — closest practical Render region to Canadian users/Atlas Canada
- Health checks: Web `/health`, API `/api/v1/health`
- Secrets via Render env dashboard (never Git)
- Custom domains + managed TLS

**Why not pick solely because it was suggested:** Render lacks Canadian compute, but matches the codebase’s need for a **persistent API process**, simple dual-service deploy, and predictable ops better than introducing Kubernetes/AWS now.

### Fallback: **DigitalOcean Droplet (TOR1) + Docker Compose + Nginx**

- Use when Canadian compute residency is required
- Reuses existing `docker-compose.yml` + `infrastructure/nginx/`
- Pair with Atlas Canada + (later) Spaces TOR for media

**AWS:** document as future high-complexity option only.

**Do not provision in this Pack.**

---

## 3. Region policy

| Preference order | Rule |
|---|---|
| 1 | Canada |
| 2 | United States |
| 3 | American continent |

| Service | Selected region (blueprint) | Notes |
|---|---|---|
| MongoDB Atlas | **Canada Central (Toronto)** preferred | Dedicated prod cluster; verify at provision time |
| Web + API (Render) | **Virginia, USA** | No Render Canada; document US East as best available |
| Web + API (DO fallback) | **TOR1 Toronto** | Preferred if Canadian compute is mandatory |
| Cloudflare | Anycast edge | DNS/CDN global; origin stays NA |
| Object storage (later) | Cloudflare R2 or DO Spaces **TOR** | Not provisioned now |
| SMTP | Flockmail / provider region | As provided by mailbox host |
| Gemini | Google API regional endpoints | Server-side only; residency per Google terms |

---

## 4. Production domain topology (recommended)

### Canonical recommendation

| Host | Role |
|---|---|
| `https://huws.org` | Web / PWA |
| `https://api.huws.org` | API |

**Rationale:** Matches Auth Pack 07 host-only cookie model (cookies owned by API host), clear service boundaries, and existing code comments targeting `api.huws.org`.

### Consequences

| Concern | Behavior |
|---|---|
| HttpOnly cookies | Set on `api.huws.org` (host-only, no `Domain`) |
| SameSite | `Lax` — works for same-site (`huws.org` ↔ `api.huws.org`) credentialed XHR |
| CORS / Origin guard | Exact allowlist: `https://huws.org` (+ optional `https://www.huws.org` only during redirect window) |
| PWA / SW | Scope `/` on **Web** origin; SW must not cache cross-origin API (already ignored) |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.huws.org` (**no** trailing `/api` — client paths already include `/api/v1/...`) |
| `API_PUBLIC_URL` | `https://api.huws.org` (email/public absolute links that need API) |
| Email links to app | Prefer Web origin `https://huws.org/...` |

### Alternative (already in repo)

Same-origin Nginx: `https://huws.org` + `https://huws.org/api/` → API. Simpler cookies-on-web-host model; valid for VPS/Compose staging. Prefer **not** mixing topologies between staging and production without a deliberate cookie cutover plan.

**DNS not modified in this Pack.**

---

## 5. WWW policy

**Canonical:** `https://huws.org`  
**Redirect:** `https://www.huws.org` → **301** permanent to apex.

Do not serve independent duplicate content on both hosts. During cutover, CORS may temporarily allow both origins until www is redirect-only.

---

## 6. Environment model

| Environment | Purpose | Data |
|---|---|---|
| **development** | Local machine (`pnpm dev`) | `humanity_union_dev` / local Mongo; mock email default |
| **test** | Automated isolation | `hu_test_*` / `hu_verify_*`; mock email forced |
| **staging** | Production-like verification | `humanity_union_staging`; real SMTP smoke allowed only to approved recipients |
| **production** | Public Humanity Union | `humanity_union_production` |

**Hard rule:** staging/test **never** share the production database or production Mongo user.

---

## 7. Staging recommendation

**YES — staging before public cutover.**

Use staging for:

- HTTPS PWA install
- Cookie / domain / CORS verification
- One approved SMTP smoke
- Production build smoke
- Browser/device smoke

**Likely topology:**

| Host | Role |
|---|---|
| `https://staging.huws.org` | Web |
| `https://api-staging.huws.org` | API |

Provider-generated domains acceptable initially. Staging must send `noindex` (see §47). **Do not create staging in this Pack.**

---

## 8. Production environment inventory

### Web (`apps/web`)

| Variable | Class | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | PUBLIC / REQUIRED | API origin only, e.g. `https://api.huws.org` |
| `NEXT_PUBLIC_SITE_URL` | PUBLIC / OPTIONAL | Documented; limited code use — set for consistency |
| `NEXT_PUBLIC_ALLOW_BOOTSTRAP_UI` | PUBLIC / CONFIG | Must be `false` in production |
| `NEXT_PUBLIC_MEMBERSHIP_SUCCESS_PREVIEW` | PUBLIC / CONFIG | `false` in production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | PUBLIC / OPTIONAL | Only if Stripe Checkout UI needs it |
| `PUBLIC_PROJECTION_PROVIDER` | SERVER CONFIG | Prefer `api` for live public projections (default `bootstrap` is staging-risk) |

### API — required when `NODE_ENV=production`

| Variable | Class |
|---|---|
| `MONGODB_URI` | SERVER SECRET / REQUIRED |
| `MONGODB_DATABASE` | SERVER CONFIG / REQUIRED |
| `JWT_ACCESS_SECRET` | SERVER SECRET / REQUIRED |
| `JWT_REFRESH_SECRET` | SERVER SECRET / REQUIRED |
| `CORS_ORIGIN` or `WEB_ORIGIN` | SERVER CONFIG / REQUIRED |

### API — Auth / platform

| Variable | Class |
|---|---|
| `JWT_ACCESS_EXPIRES_IN` | CONFIG (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | CONFIG (PWA: `30d`) |
| `AUTH_BOOTSTRAP_FALLBACK` | CONFIG — **must be false** for beta/production modes |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | CONFIG |
| `PLATFORM_MODE` | CONFIG — `beta` or `production` (not `development`) |
| `ALLOW_PUBLIC_REGISTRATION` | CONFIG |
| `API_PUBLIC_URL` | CONFIG |
| `AUTH_RATE_LIMIT_*` | CONFIG |

### API — Mongo / outbox / logging

| Variable | Class |
|---|---|
| `MONGODB_*_TIMEOUT*`, `MONGODB_MAX_POOL_SIZE` | OPTIONAL CONFIG |
| `OUTBOX_DISPATCH_*` | CONFIG |
| `LOG_LEVEL` | CONFIG (`info` prod default) |

### API — SMTP

| Variable | Class |
|---|---|
| `EMAIL_PROVIDER` | CONFIG (`smtp` in prod) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | CONFIG |
| `SMTP_USER` / `SMTP_USERNAME` / `SMTP_PASSWORD` | SECRET |
| `SMTP_FROM*` / `EMAIL_FROM_NAME` / `EMAIL_REPLY_TO` | CONFIG |
| `EMAIL_LOGO_URL` | CONFIG (public HTTPS) |
| `SMTP_*_TIMEOUT*`, `SMTP_MAX_ATTEMPTS` | CONFIG |

### API — AI / Translation

| Variable | Class |
|---|---|
| `GEMINI_API_KEY` | SECRET |
| `LIFECYCLE_AI_PROVIDER` | CONFIG (`gemini` when live) |
| `LIFECYCLE_AI_*` limits/timeouts | CONFIG |
| `TRANSLATION_PROVIDER` | CONFIG |
| `TRANSLATION_*` | CONFIG |
| `CONTENT_TRANSLATION_PERSISTENCE` | CONFIG (omit → Mongo when URI set) |

### API — Persistence (production must not use file defaults)

| Variable pattern | Class | Production expectation |
|---|---|---|
| `NOTIFICATION_PERSISTENCE` | CONFIG | `mongodb` |
| `REMINDER_PERSISTENCE` | CONFIG | `mongodb` |
| `INITIATIVE_*_PERSISTENCE` / lifecycle draft keys | CONFIG | `mongodb` (not `file`) |
| Auto-mongo modules (news, archive, engagement, translations) | — | Follow URI + existing resolvers |

### Media / Stripe / news (optional)

`STRIPE_*`, `MEMBER_BADGE_*`, `NEWS_*`, `MEDIA_REGISTRY_*` — secrets/config as applicable; badge disabled until legal/ops review.

---

## 9. Secret boundary

**Never place secrets in:** Git, client bundles, `NEXT_PUBLIC_*` (unless truly public), manifest, service worker, logs, docs with real values.

**Secrets include:** Mongo URI, JWT secrets, SMTP password, Gemini key, Stripe secrets, webhook secrets.

**Storage:** Hosting provider secret store (Render env / DO encrypted env / future vault). Rotate JWT + SMTP + Gemini on suspicion. `.env.example` placeholders only.

---

## 10. Auth production configuration

Preserve Pack 07 + Recovery Hotfix — **no redesign**.

| Setting | Production expectation |
|---|---|
| Cookies | HttpOnly access + refresh |
| Secure | `true` when `NODE_ENV=production` |
| SameSite | `Lax` |
| Path | `/` (access/refresh); pending cookies under `/api/v1/auth` |
| Domain | **none** (host-only on API host) |
| Access TTL | ~15m |
| Refresh TTL | ~30d (PWA remembered sessions) |
| Rotation | Existing Mongo session hash rotation |
| Logout | Clear cookies + revoke session |
| Origin guard | Mutating browser requests require allowlisted Origin |
| CORS | Credentialed; exact origins; never `*` |

**Topology env pairing:**

```text
CORS_ORIGIN=https://huws.org
WEB_ORIGIN=https://huws.org
API_PUBLIC_URL=https://api.huws.org
NEXT_PUBLIC_API_BASE_URL=https://api.huws.org
```

---

## 11. CORS / Origin production matrix

| Environment | Allowed Web origins | API |
|---|---|---|
| production | `https://huws.org` | `https://api.huws.org` |
| staging | `https://staging.huws.org` | `https://api-staging.huws.org` |
| development | loopback allowlist + configured localhost ports | `http://localhost:4000` |

Production **must not** permit wildcard credentialed origins. Arbitrary external Origins → reject (`AUTH_ORIGIN_FORBIDDEN` on mutating auth browser paths).

---

## 12. MongoDB Atlas production architecture

| Requirement | Blueprint |
|---|---|
| Cluster | Dedicated production cluster (not shared with staging/dev) |
| Region | Canada Central preferred |
| Database name | `humanity_union_production` |
| Staging DB | Separate cluster or at least separate DB + user: `humanity_union_staging` |
| TLS | Required (Atlas default) |
| Network | IP allowlist or private connectivity for API egress IPs |
| User | Least privilege read/write on app DB only |
| Indexes | Ensured at API bootstrap (`ensureMongoIndexes`) |
| URI | Secret only |
| Forbidden | Reusing `humanity_union_dev` as production |

**No cluster creation or data migration in this Pack.**

---

## 13. Database naming

| Name | Use |
|---|---|
| `humanity_union_production` | Production |
| `humanity_union_staging` | Staging |
| `humanity_union_dev` | Local development only |
| `hu_test_*` / `hu_verify_*` | Automated tests / verification |

Prefer env-based `MONGODB_DATABASE` over hardcoding.

---

## 14. Backup policy (minimum)

| Item | Recommendation |
|---|---|
| Mechanism | Atlas continuous cloud backup / snapshots |
| Retention | ≥ 7 daily + ≥ 4 weekly (tune at provision) |
| Pre-release | Snapshot before first production cutover and before destructive migrations |
| Restore drill | Documented restore to staging once before public launch |
| Status | **Not claimed working until configured in Deployment Pack** |

---

## 15. Data migration / seed policy

| Enter production | Do not auto-migrate |
|---|---|
| Required taxonomies / reference catalogues if product-critical | Dev QA Participants |
| Controlled admin capability grant (see §16) | Local `.runtime` JSON |
| Empty or curated public content | Test/verify DBs |

Controlled initialization only — no automatic copy from `humanity_union_dev`.

---

## 16. Admin bootstrap boundary

Admin Console is **not** implemented. Production may still need one Administrator capability via existing Admin Foundation / platform capability grants.

**Safe process (manual ops, later Pack):**

1. Create/confirm a real Participant account through normal registration  
2. Explicit capability grant with reason  
3. Audit trail  
4. **No** first-user auto-admin  
5. **No** default admin credentials  
6. `AUTH_BOOTSTRAP_FALLBACK=false` in beta/production  

**Not executed in this Pack.**

---

## 17. SMTP production configuration

Canonical host: **`smtp-out.flockmail.com`**

| Field | Production expectation |
|---|---|
| Host | `smtp-out.flockmail.com` |
| Port / TLS | Prefer `465` + `SMTP_SECURE=true` (matches API `.env.example`) |
| From | Platform transactional identity (e.g. `noreply@…` under owned domain) |
| From name | `Humanity Union` |
| Reply-To | Support inbox if desired |
| Timeouts / retries | Existing `SMTP_*_TIMEOUT*` + `SMTP_MAX_ATTEMPTS` (capped) |
| Provider | `EMAIL_PROVIDER=smtp` |
| Logo | `EMAIL_LOGO_URL` absolute HTTPS (see §19) |

Credentials never logged or committed.

---

## 18. Email DNS (checklist — values from provider)

| Record | Purpose | Source of values |
|---|---|---|
| SPF | Authorize Flockmail senders | Flockmail / DNS host |
| DKIM | Message signing | Flockmail generated keys/selectors |
| DMARC | Policy + reporting | Operator-defined (`p=` gradual) |
| BIMI | Optional later | Not required for launch |

**Do not invent record values in this blueprint.** Preserve MX/SPF/DKIM when changing DNS frontends.

---

## 19. Email logo

| Requirement | Value |
|---|---|
| Recommended URL | `https://huws.org/brand/humanity-union-logo-white-email.png` |
| Constraints | Public, HTTPS, stable, never localhost/relative |

Gmail account avatar ≠ HTML email logo. Avatar is mailbox-provider branding; HTML logo is fetched from `EMAIL_LOGO_URL` inside messages.

---

## 20. Real SMTP smoke plan

1. Staging/production SMTP configured  
2. One message to **approved recipient only**  
3. Verify SPF/DKIM pass in headers  
4. Automated tests remain **forced mock** (`ALLOW_REAL_EMAIL_IN_TESTS=false`)  

**No real email sent in this Pack.**

---

## 21. Gemini / Assistant production config

| Item | Expectation |
|---|---|
| Key | `GEMINI_API_KEY` server-side only |
| Provider | `LIFECYCLE_AI_PROVIDER=gemini` when live |
| Model / limits | `LIFECYCLE_AI_*` (timeouts, RPM/RPD, prompt caps) |
| Diagnostics | Off / safe in production (`LIFECYCLE_AI_DIAGNOSTICS` unset or safe) |
| Failure | Request-time errors; API stays up |

No model-behavior redesign in this Pack.

---

## 22. Translation provider

| Item | Expectation |
|---|---|
| Provider | `TRANSLATION_PROVIDER=gemini` when live (or deterministic for offline) |
| Key | Reuses `GEMINI_API_KEY` unless separated later |
| Persistence | Mongo when URI configured |
| Failure | Existing fallback messaging; no silent provider switch that hides misconfig |

Language Architecture not redesigned.

---

## 23. PWA HTTPS requirements

| Item | Production |
|---|---|
| HTTPS | Mandatory for installability + Secure cookies |
| Manifest | `name` Humanity Union; `short_name` Humanity; `start_url=/workspace`; `display=standalone` |
| Icons | `/brand/app-192.png`, `/brand/app-512.png` |
| SW | Registered on Web origin; private API denylist |
| Final install test | Staging HTTPS then production HTTPS — localhost insufficient |

---

## 24. Service Worker release policy

| Rule | Detail |
|---|---|
| Cache version | Bump `CACHE_NAME` (currently `hu-pwa-v2`) on shell changes |
| No `skipWaiting` | Avoid forced reload loops; activate after tabs release |
| Private data | Never cache auth/private API |
| Rollback | Redeploy previous Web build; bump cache name if clients stuck |
| Invalidation | Activate handler deletes old caches |

No complex release tooling required.

---

## 25. Static / media storage

**Current model:** API local filesystem — `apps/api/.runtime/uploads` (`LOCAL_MEDIA_UPLOAD_ROOT`), served as static files.

| Verdict | **HIGH for production on ephemeral PaaS disks** |
|---|---|
| Risk | Uploads lost on redeploy/restart; not shared across instances |
| Near-term mitigation | Single API instance + persistent disk volume **or** block upload-critical launch features until object storage |
| Later target | Cloudflare R2 / DO Spaces TOR / S3-compatible |

**Not migrated in this Pack.**

---

## 26. Ephemeral filesystem audit

| Path / pattern | Class |
|---|---|
| `apps/api/.runtime/*.json` initiative/lifecycle file stores | **production-dangerous** if used in prod |
| `apps/api/.runtime/uploads` | **production-dangerous** without durable volume/object store |
| Lifecycle draft `*_PERSISTENCE=file` | **production-dangerous** |
| Rate-limit maps / in-memory stores | temporary-safe (per process) |
| Civic Archive PDF buffers | temporary-safe (memory stream) |
| Web app | no runtime writes |
| Test/verify JSON fixtures | test-only |

**Production rule:** set critical `*_PERSISTENCE=mongodb` (or auto-mongo modules) and do not rely on `.runtime` for durable state.

---

## 27. Civic Archive PDF

Generated **on demand** into an in-memory Buffer (PDFKit stream); HTTP response ends the buffer. **No permanent local PDF persistence.** Watch memory under concurrent large exports on small instances.

---

## 28. Outbox / process model

| Item | Blueprint |
|---|---|
| Dispatcher | In-process inside API (`OUTBOX_DISPATCH_*`) |
| Idempotency | Mongo `processedEvents` claims |
| Initial production | **Single API instance** recommended |
| Multi-instance | Possible with claim semantics; increases contention; rate limits are per-process |
| News scheduler | Also in-process — same single-instance preference |

Do not introduce a new queue platform for launch.

---

## 29. Process model (initial)

```text
Web Service  → Next.js (standalone / container)
API Service  → Node API + Outbox dispatcher + News scheduler
MongoDB      → Atlas (external)
```

No unnecessary microservices. Prefer one API replica initially.

---

## 30. Health checks

| Endpoint | Use |
|---|---|
| `GET /api/v1/health` | API liveness/readiness signal for host |
| `GET /health` | Web container |

Must not expose secrets, DB URI, SMTP passwords, or API keys. Current design reports coarse Mongo/email/outbox status — keep payloads non-sensitive. Mongo down → API health **degraded** (process may already have failed startup if connect threw during bootstrap).

---

## 31. Startup / degraded-mode policy

| Dependency | Startup | Runtime |
|---|---|---|
| Mongo unreachable with URI | Process exit (fail closed) | — |
| Missing required prod env | Process exit | — |
| SMTP down | API starts | Email fails; health degraded |
| Gemini down / unset | API starts | Assistant/translation errors per request |
| File persistence misconfigured | API may start | Silent data loss risk — treat as ops BLOCKER before launch |

Do not fake readiness when Mongo is required.

---

## 32. Logging

JSON structured logger (`service: humanity-union-api`) + selective console diagnostics.

**Minimum fields:** timestamp, level, service, message; correlation where available; safe domain-event phases.

**Never log:** tokens, passwords, SMTP secrets, Gemini keys, DM bodies, private document contents.

**Retention:** host log drain ≥ 14–30 days (configure in Deployment Pack).

---

## 33. Error monitoring recommendation

**Recommended after staging is live; not required to write this blueprint.**  
Sentry (or equivalent) is **recommended before public launch** if staging shows opaque 500s; otherwise enable within first post-launch week. **Do not install in this Pack.**

---

## 34–35. Monitoring & uptime

**Minimum launch monitoring:**

- Web availability
- API `/api/v1/health`
- Mongo Atlas alerts
- Outbox failure rate / backlog
- SMTP failure rate
- Auth error spikes / 500 rate
- AI provider error rate

**Uptime (external, later):** `https://huws.org` and `https://api.huws.org/api/v1/health` — e.g. Better Stack / UptimeRobot / Cloudflare monitors. **Not provisioned now.**

---

## 36. Security header gaps

| Header | Web (Next) | Nginx template | API |
|---|---|---|---|
| CSP | **Missing** | Missing | N/A (API JSON) |
| HSTS | Missing in Next | Example HTTPS conf has it | — |
| X-Content-Type-Options | Missing in Next | Present in nginx | helmet |
| Referrer-Policy | Missing in Next | Present | helmet |
| Permissions-Policy | Missing in Next | Present | — |
| frame-ancestors / XFO | Missing in Next | SAMEORIGIN | helmet |

**Do not add CSP blindly** — must allow self, API origin, brand/media, Assistant/Gemini network as applicable. Gap owner: Deployment / Security follow-up Pack. Classify **MEDIUM** (not silent BLOCKER if TLS + Origin guard + helmet API hold).

---

## 37. HTTPS / HSTS

- All production/staging public hosts: HTTPS only  
- HTTP → HTTPS redirect at edge  
- Enable HSTS **after** HTTPS stability confirmed  
- Avoid aggressive preload until cutover verified  

---

## 38–39. Cloudflare role & CDN safety

| Do | Do not |
|---|---|
| DNS for `huws.org` / `api.huws.org` | Cache authenticated Workspace/PWA API responses |
| Edge TLS | Cache `/api/v1/**` private routes |
| CDN for public static (`/brand`, `/_next/static`, icons) | Bypass Origin guard via overly broad CORS at edge |
| Basic DDoS / bot controls | Store secrets in Workers |

API: proxy with **bypass cache** / `Cache-Control: private` respect. Public HTML caching only if freshness-safe (default: cautious).

---

## 40. Rate-limit findings

| Endpoint class | Status |
|---|---|
| login / register / password reset / confirmation | In-memory IP limiter present |
| **`POST /auth/refresh`** | **No dedicated limiter** — Pack 07 residual gap → **HIGH** (fix before or immediately after launch; not Auth redesign) |
| Media upload | Per-user limiter |
| Assistant | RPM/RPD caps |
| Multi-instance | In-memory limits weaken — another reason for single API initially |

---

## 41. Production build commands

```bash
# From repo root
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build   # API tsc + Web next build --webpack

# Or filtered
pnpm --filter @hu/api build
pnpm --filter @hu/web build
```

Do not run production traffic on `pnpm dev`. Docker builds per `apps/*/Dockerfile` + compose when using VPS fallback.

**Known Docker gap:** Web Dockerfile must copy all transpile workspace packages (`@hu/media-registry` etc.) — verify before first image push (**HIGH** ops checklist).

---

## 42. Deployment sequence (do not execute)

1. Create staging + production Atlas DBs (Canada preferred)  
2. Configure API secrets (JWT, Mongo, SMTP, Gemini, CORS)  
3. Force Mongo persistence for durable modules  
4. Deploy API → verify `/api/v1/health`  
5. Deploy Web with baked `NEXT_PUBLIC_API_BASE_URL` → verify `/health`  
6. Attach staging custom domains + HTTPS  
7. Auth / PWA / SMTP smoke on staging  
8. Production DNS cutover (after approval)  
9. Final launch verification checklist  

---

## 43. Rollback strategy

| Layer | Action |
|---|---|
| Web | Redeploy previous Render/DO image/release |
| API | Redeploy previous release (outbox claims remain safe) |
| DB | Prefer backward-compatible changes; restore Atlas snapshot only if necessary |
| SW | Prior Web build + cache version bump if clients pinned |

---

## 44. Database change policy

- Indexes applied at bootstrap — deploy API before depending on new indexes under load when possible  
- Backward-compatible document changes first  
- No destructive migration without Atlas backup + staging rehearsal  
- Mongo is flexible; **domain contracts still require migration discipline**

---

## 45. Domain cutover plan

1. Lower TTL on existing records ahead of time  
2. Staging green on HTTPS  
3. Certs ready for `huws.org` + `api.huws.org`  
4. Preserve MX/SPF/DKIM/DMARC while changing A/AAAA/CNAME for Web/API  
5. Cut Web → API → verify Auth cookies + PWA install  
6. Keep rollback window (previous DNS / previous deploy)  

**DNS not changed in this Pack.**

---

## 46. Existing `huws.org` migration strategy

If apex currently serves a prior site (e.g. WordPress):

1. Bring new platform up on staging / provider domains  
2. Verify Auth, PWA, mail, content  
3. Cut DNS to new origins  
4. Retain rollback window; do not destroy old site until smoke passes  

No migration executed here.

---

## 47. SEO / indexing pre-launch

| Environment | Policy |
|---|---|
| Staging | `noindex` / robots disallow (must add before public staging DNS) |
| Production | Indexable canonical public pages; sitemap/robots follow-up |

**Gap:** Web currently lacks `robots.ts` / sitemap / staging noindex — **HIGH** before public staging hostname is crawlable.

---

## 48. PWA final install verification

Must occur on canonical HTTPS staging/production origins:

- Manifest origin + SW scope  
- `start_url=/workspace`  
- Icons  
- Auth cookies on API host with credentialed calls from Web  

Localhost install is insufficient for launch sign-off.

---

## 49. Backup / recovery runbook (outline)

| Symptom | First checks |
|---|---|
| Web unavailable | Edge DNS/TLS → Web health → redeploy previous Web |
| API unavailable | `/api/v1/health` → logs → Mongo connectivity → redeploy API |
| Mongo unavailable | Atlas status → IP allowlist → credentials → restore only if data loss |
| Mail unavailable | SMTP health → Flockmail status → queue/retry logs (platform remains up) |
| Gemini unavailable | Assistant/translation errors only; confirm key/quota |
| Bad deployment | Rollback Web/API release |
| Bad SW | Redeploy Web; bump cache version; ask users to close tabs |

---

## 50. Production-readiness matrix

| Item | Current state | Required production state | Blocking? | Next |
|---|---|---|---|---|
| Domain topology | Blueprint only | `huws.org` + `api.huws.org` HTTPS | Yes until cutover Pack | Deployment Pack 02 |
| HTTPS | Local HTTP | Full HTTPS + redirect | Yes for public | Pack 02 |
| Mongo prod DB | Dev/shared historically | Dedicated `humanity_union_production` | **BLOCKER** if reused | Pack 02 |
| SMTP | Flockmail path coded | Live `EMAIL_PROVIDER=smtp` + DNS | HIGH | Pack 02 |
| SPF/DKIM/DMARC | Not verified here | Pass on real mail | HIGH | Pack 02 |
| Gemini | Optional deterministic | Key + provider when Assistant live | MEDIUM | Pack 02 |
| Translation | Deterministic default | Gemini + Mongo persistence when live | MEDIUM | Pack 02 |
| Object storage | Local uploads | Durable store or accepted single-node volume | **HIGH / launch-scope** | Storage follow-up |
| File persistence defaults | Many `file`/`memory` | Mongo for durable modules | **BLOCKER** if unchanged | Pack 02 config |
| Auth cookies | Hardened | Secure + host-only + CORS matrix | Config verification | Pack 02 |
| CORS | Code ready | Exact prod origins | Config | Pack 02 |
| PWA | Real-device PASS on install path | Prod HTTPS re-verify | Staging gate | Pack 02 |
| Backups | Not configured | Atlas backups + restore drill | HIGH | Pack 02 |
| Monitoring | Logs only | Health + uptime + Atlas alerts | MEDIUM | Pack 02 |
| Admin bootstrap | Architecture only | Controlled grant runbook | MEDIUM | Ops later |
| Security headers / CSP | Partial (nginx/API) | Documented gaps closed | MEDIUM | Security follow-up |
| Staging noindex | Missing | Required | HIGH before public staging | Pack 02 |
| `/auth/refresh` rate limit | Missing | Add limiter | HIGH | Focused hotfixes Pack |
| Web Docker package COPY | Incomplete risk | Fixed before DO/Render Docker | HIGH | Pack 02 |
| `NEXT_PUBLIC_API_BASE_URL` `/api` suffix | Root example wrong historically | Origin only | HIGH if mis-set | Fixed in templates |

---

## 51. Issue classification (this Pack)

### BLOCKER (must resolve before public production traffic)

1. Dedicated production Mongo DB/cluster separation (never `humanity_union_dev`)  
2. Durable persistence: no production reliance on `.runtime` file stores for civic/initiative state  
3. Valid Auth cookie + CORS + `NEXT_PUBLIC_API_BASE_URL` topology alignment  

### HIGH

1. Ephemeral upload filesystem without volume/object storage  
2. Staging `noindex` / robots before public staging hostname  
3. `/auth/refresh` rate-limit gap  
4. Atlas backups + restore drill  
5. Web Docker workspace package COPY verification  
6. SMTP + SPF/DKIM/DMARC verification on staging  

### MEDIUM

1. CSP / complete security headers on Web  
2. External error monitoring (Sentry)  
3. Maskable PWA icon  
4. Gemini/Translation go-live configuration  
5. Multi-browser physical QA remaining items  

### LOW

1. BIMI  
2. HSTS preload  
3. AWS migration path  

---

## 52. Explicit non-actions (this Pack)

Did **not**:

- create Render / DO / Atlas resources  
- modify Cloudflare or DNS  
- send production/staging mail  
- set real production secrets  
- deploy Web/API publicly  
- commit or stage Git changes as a release  

---

## 53. Recommended next Pack

**Production Deployment Pack 02**  
— Staging Provisioning, Domain Wiring & Production-Like Verification  

Do not start until this blueprint is explicitly approved.

---

## 54. Production Pre-Deployment Hardening Pack 01 — status update

Implementation/hardening only. No Render/Atlas/DNS/Cloudflare/SMTP provisioning in this Pack.

### Prior BLOCKER/HIGH disposition

| Finding | Status |
|---|---|
| Durable persistence silently using `.runtime` file/memory | **RESOLVED IN CODE** — `resolvePersistenceMode` + production defaults to `mongodb`; startup rejects `file`/`memory` for durable keys; legacy package/report/recommendation stores bridged to Mongo |
| Mongo bootstrap skipped when env unset despite prod defaults | **RESOLVED IN CODE** — `shouldBootstrapMongoPersistence()` + hydrate guards use `isMongoPersistenceMode` |
| Ephemeral local uploads on PaaS | **RESOLVED IN CODE** (provider seam) / **REQUIRES EXTERNAL CONFIG** (R2 bucket + keys) — `MediaObjectStorage` + `MEDIA_STORAGE_PROVIDER=r2` |
| Media upload metadata only in process memory | **STILL BLOCKED** (HIGH) — bytes can be durable on R2; ownership Map still process-local |
| `/auth/refresh` unlimited | **RESOLVED IN CODE** — 120 attempts / 15m per IP (`AUTH_REFRESH_RATE_LIMIT_*`) |
| Staging noindex / robots | **RESOLVED IN CODE** — `NEXT_PUBLIC_PLATFORM_MODE=staging` → robots disallow + metadata noindex |
| Web Docker workspace package COPY | **RESOLVED IN CODE** — copies `@hu/media-registry`, `@hu/geography`, standalone/static/public |
| API Docker `start:prod` via tsx source | **RESOLVED IN CODE** — `CMD ["node", "dist/index.js"]`; `start`/`start:prod` = compiled |
| Wildcard CORS with credentials | **RESOLVED IN CODE** — production validation rejects `*` |
| Production missing Mongo/JWT/media config | **RESOLVED IN CODE** — `validateProductionEnvironment` |
| Dedicated production Mongo cluster | **REQUIRES EXTERNAL CONFIG** / **STILL BLOCKED** until Pack 02 |
| SMTP + SPF/DKIM/DMARC | **REQUIRES EXTERNAL CONFIG** (checklist below) |
| Atlas backups | **REQUIRES EXTERNAL CONFIG** |
| Domain/HTTPS cutover | **REQUIRES EXTERNAL CONFIG** |

### Persistence defaults (production)

Durable `*_PERSISTENCE` keys default to `mongodb` when `NODE_ENV=production`. Explicit `file`/`memory` fail startup. Dev/test may still use file/memory.

### Upload storage

- Public: avatar / initiative-image / blog-image → `MediaObjectStorage` (`local` | `r2` | `memory`)
- Private: Shared Documents → authz download API + secure local path (not public R2)
- Civic Archive PDF → on-demand in-memory (unchanged; no object storage)

### Auth refresh limit

- Default: **120 attempts / 900000ms (15m)** per client IP
- Rationale: ~15m access JWT + multi-tab/PWA restore; client single-flight remains; abuse loops hit 429 calmly

### Cookie topology (unchanged preference)

Host-only API cookies on `api.huws.org` / `api-staging.huws.org` with credentialed CORS from `https://huws.org` / `https://staging.huws.org`. Do **not** set `Domain=.huws.org` unless a future Pack proves necessary.

### URL contract

| Env | Web | API |
|---|---|---|
| Production | `https://huws.org` | `https://api.huws.org` |
| Staging | `https://staging.huws.org` | `https://api-staging.huws.org` |

`NEXT_PUBLIC_API_BASE_URL` = origin only (no `/api` suffix).

### SMTP DNS preparation checklist (no records created here)

- [ ] Preserve existing MX for mailbox provider  
- [ ] SPF include for Flockmail/SMTP relay  
- [ ] DKIM keys published per provider  
- [ ] DMARC policy (start monitor/`p=none`)  
- [ ] From address aligned with SPF/DKIM domain  
- [ ] `EMAIL_LOGO_URL` absolute HTTPS asset on production CDN/site  

### Cloudflare cache contract (configure later — not in this Pack)

**CACHEABLE:** `/_next/static/*`, `/brand/*`, `/icons/*`, `/illustrations/*`, other immutable public assets  

**DO NOT CACHE:** `/api/*`, `/workspace/*`, `/notifications*`, `/preferences*`, authenticated responses, private downloads  

### Security headers

Web baseline: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`. HSTS only if `ENABLE_HSTS=true`. Full CSP deferred (needs domain inventory).

### Sitemap

No dedicated sitemap route in Web today — **follow-up** (MEDIUM). Staging robots disallow mitigates accidental indexing.

### Remaining after Hardening Pack 01

**BLOCKER (external):** dedicated production Mongo; real topology secrets/DNS/HTTPS cutover  

**HIGH:** media metadata durability; Atlas backups; SMTP DNS verification; R2 provisioning  

**MEDIUM/LOW:** CSP; Sentry; sitemap; HSTS preload; BIMI
