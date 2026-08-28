# Production Deployment Foundation

TASK-059 prepares Humanity Union for first production-like staging deployment on a VPS using Docker, MongoDB Atlas, Nginx, and environment-based configuration.

Local development with `pnpm dev` remains unchanged.

## Recommended architecture

```text
Internet
   │
   ▼
Nginx (VPS, port 80/443)
   ├── /        → Next.js web container
   └── /api/    → Express API container
                         │
                         ▼
                   MongoDB Atlas (external)
```

Components:

- **VPS** — economical staging host (Hetzner CX series is sufficient to start)
- **Docker Compose** — reproducible API + web + Nginx stack
- **MongoDB Atlas** — external managed database (not in production compose)
- **Nginx** — reverse proxy, gzip, basic security headers, HTTPS-ready template

WordPress is not required for staging. The main WordPress site can remain untouched until migration.

## Hetzner VPS notes

1. Create an Ubuntu 24.04 VPS with at least 2 GB RAM for staging.
2. Install Docker Engine and Docker Compose plugin.
3. Open ports 22 (SSH), 80 (HTTP), and 443 (HTTPS when enabled).
4. Clone the Humanity Union repository on the server.
5. Copy `.env.example` to `.env` and fill in Atlas + JWT secrets.
6. Run `docker compose up -d --build`.

Use a non-root deploy user with Docker group membership. Keep SSH key authentication enabled.

## MongoDB Atlas notes

1. Create a dedicated Atlas cluster for staging/production.
2. Create a database user with least privilege for the application database.
3. Allow VPS IP access in Atlas Network Access (IP allowlist).
4. Set `MONGODB_URI` and `MONGODB_DATABASE` in `.env`.
5. Run `npm run verify:mongodb` from a trusted machine with the same URI before go-live.

Atlas remains external — `docker-compose.yml` does not start MongoDB.

## Environment variables

### Root `.env` (Docker Compose)

| Variable                   | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`                 | `production` for staging/production containers                      |
| `MONGODB_URI`              | MongoDB Atlas connection string                                     |
| `MONGODB_DATABASE`         | Database name (for example `humanity_union`)                        |
| `JWT_ACCESS_SECRET`        | Strong random access token secret                                   |
| `JWT_REFRESH_SECRET`       | Strong random refresh token secret                                  |
| `AUTH_BOOTSTRAP_FALLBACK`  | Must be `false` in production                                       |
| `CORS_ORIGIN`              | Allowed browser origin for API                                      |
| `WEB_ORIGIN`               | Legacy alias; `CORS_ORIGIN` takes precedence                        |
| `API_PUBLIC_URL`           | Public API base URL (for example `https://staging.example.org/api`) |
| `NEXT_PUBLIC_API_BASE_URL` | Web client API URL (build-time for Next.js)                         |
| `NEXT_PUBLIC_SITE_URL`     | Public site URL                                                     |
| `NGINX_HTTP_PORT`          | Host port for Nginx (default `80`)                                  |

See also:

- `.env.example`
- `apps/api/.env.example`
- `apps/web/.env.example`

Never commit real `.env` files.

## Production config validation

When `NODE_ENV=production`, the API validates required variables at startup:

- `MONGODB_URI`
- `MONGODB_DATABASE`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` or `WEB_ORIGIN`
- Media storage contract (prefer R2; local only with explicit ephemeral override)
- Email provider must not be `mock`
- **Stripe (Pack 26A):** when `MEMBERSHIP_PAYMENT_PROVIDER=stripe` or
  `MEMBER_BADGE_PAYMENT_PROVIDER=stripe` (or Stripe is implied by `STRIPE_SECRET_KEY`),
  require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the matching Price IDs
  (`STRIPE_MEMBERSHIP_PRICE_ID` / `STRIPE_MEMBER_BADGE_PRICE_ID`). Secret **values
  are never printed**.
- **Legacy Badge:** `MEMBER_BADGE_CONTRIBUTIONS_ENABLED` must be `false` in production.

Missing / invalid values cause a clear startup failure.

Development remains permissive with local defaults.

## Pack 26A — environment classes (read carefully)

### API production env

- `NODE_ENV=production`
- `PLATFORM_MODE=production`
- Dedicated production MongoDB (`humanity_union_production` or equivalent) — **never**
  reuse staging MongoDB
- Stripe **Live** keys + Live Price IDs only
- `MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false`
- Real email provider (`smtp` / `resend`)

### Web production env (build-time)

- `NEXT_PUBLIC_PLATFORM_MODE=production` (rebuild before enabling indexing)
- `NEXT_PUBLIC_API_BASE_URL=https://api.huws.org` (origin only — no `/api` path)
- `NEXT_PUBLIC_SITE_URL=https://huws.org`
- `NEXT_PUBLIC_ALLOW_BOOTSTRAP_UI=false`

### Staging-only env (must not leak into production)

- `PLATFORM_MODE=staging` (API treats as beta)
- Staging MongoDB / R2 / SMTP / Stripe **Test** keys + Test Price IDs
- Staging migration / provision flags (`migrate:staging-*`, `provision:staging-admin`, etc.)
- `NEXT_PUBLIC_PLATFORM_MODE=staging` + noindex

### Legacy-disabled env

- `MEMBER_BADGE_CONTRIBUTIONS_ENABLED=false` — required production posture for the
  legacy CA$20 Member Badge contribution flow. Canonical CA$28 Member Badge
  Application Checkout does **not** require this flag to be true.

### Hard warnings

1. Never reuse staging MongoDB in production.
2. Never use Stripe Test keys or Test Price IDs in production.
3. Never enable staging migration/provision flags in production.
4. Legacy CA$20 Badge contribution stays disabled.
5. Production Web must be rebuilt with production platform mode before indexing.

## Docker Compose usage

### Staging / production-like stack

```bash
cp .env.example .env
# edit .env with Atlas URI, JWT secrets, staging URLs

npm run docker:build
npm run docker:up
```

Services:

- `api` — Express API on internal port 4000
- `web` — Next.js on internal port 3000
- `nginx` — public entry on port 80

### Local compose with MongoDB (optional)

```bash
docker compose -f docker-compose.local.yml up --build
```

This starts a local MongoDB container for experimentation. Normal local development can continue using `pnpm dev` without Docker.

## Nginx setup

Template: `infrastructure/nginx/humanity-union.conf`

1. Replace `STAGING_DOMAIN` with your IP, staging subdomain, or production domain.
2. Mount the file in the Nginx container (already wired in `docker-compose.yml`).
3. Add TLS certificates with certbot/Let's Encrypt on the host when ready.
4. Reload Nginx after certificate installation.

Routing:

- `/` → web
- `/api/` → API
- `/health` → web health check

## Health checks

| Service | Endpoint             |
| ------- | -------------------- |
| API     | `GET /api/v1/health` |
| Web     | `GET /health`        |

API health returns status, uptime, environment, version, and MongoDB connection status.

## Staging without final domain

### Option A — VPS IP only

- Set `CORS_ORIGIN=http://YOUR_VPS_IP`
- Set `NEXT_PUBLIC_API_BASE_URL=http://YOUR_VPS_IP/api`
- Set `NEXT_PUBLIC_SITE_URL=http://YOUR_VPS_IP`
- Replace `STAGING_DOMAIN` in Nginx with the IP

### Option B — temporary subdomain

- Example: `staging.example.org`
- Point DNS A record to VPS IP
- Use HTTPS before public beta

### Option C — Cloudflare DNS subdomain

- Create proxied or DNS-only subdomain to VPS
- Configure Atlas IP allowlist for VPS egress IP
- Enable HTTPS through Cloudflare or certbot on VPS

The main WordPress site can remain on its current domain during staging.

## Backup notes

- MongoDB Atlas provides automated backups on paid tiers — enable for staging/production clusters.
- Export environment variable documentation separately; never store secrets in git.
- Before upgrades, tag the deployed git commit and keep the previous Docker images available for rollback.

## Rollback notes

1. Stop containers: `npm run docker:down`
2. Checkout previous known-good git tag/commit.
3. Rebuild: `npm run docker:build`
4. Start: `npm run docker:up`
5. Verify health endpoints and auth login.

## Security checklist

- [ ] `.env` files are gitignored and not committed
- [ ] JWT secrets are long random strings (not example placeholders)
- [ ] `AUTH_BOOTSTRAP_FALLBACK=false` in production
- [ ] `CORS_ORIGIN` restricted to known staging/production origin
- [ ] MongoDB Atlas IP allowlist configured for VPS egress
- [ ] HTTPS enabled before public beta
- [ ] No debug logging of tokens, passwords, or connection strings
- [ ] Atlas database user uses least privilege
- [ ] SSH key auth enabled; password login disabled on VPS

## Verification

```bash
npm run verify:deployment
npm run verify:staging
npm run deploy:check
```

`deploy:check` runs deployment verification and confirms the local build still passes.

For the full staging operator runbook, see [STAGING_DEPLOYMENT_RUNBOOK.md](./STAGING_DEPLOYMENT_RUNBOOK.md).

## Deferred work

- CI/CD pipelines
- Terraform / Kubernetes
- Server provisioning automation
- Email provider setup
- Redis / background workers
- Production monitoring (Datadog, Sentry, etc.)
- WordPress migration
- Real production domain cutover
