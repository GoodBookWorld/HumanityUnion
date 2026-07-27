# Staging Deployment Runbook

TASK-061 — First real staging deployment on a production-like VPS.

This runbook prepares Humanity Union for external tester access on staging **without** a public production launch. Local development with `pnpm dev` remains unchanged.

Related foundation doc: [PRODUCTION_DEPLOYMENT_FOUNDATION.md](./PRODUCTION_DEPLOYMENT_FOUNDATION.md)

---

## 1. Architecture

```text
Browser
   │
 HTTPS (recommended before external testers)
   │
 Nginx (VPS, ports 80/443)
   ├── /        → Next.js web container (humanity-union-web)
   ├── /health  → Web health check
   └── /api/    → Express API container (humanity-union-api)
                         │
                         ▼
                   MongoDB Atlas (external, not in Docker)
```

### Components

| Component         | Role                                                   |
| ----------------- | ------------------------------------------------------ |
| **VPS**           | Runs Docker Compose stack                              |
| **Nginx**         | Reverse proxy, gzip, security headers, TLS termination |
| **Web**           | Next.js standalone server                              |
| **API**           | Express API with production env validation             |
| **MongoDB Atlas** | External managed database                              |

### Principles

1. Staging closely matches production topology.
2. Local `pnpm dev` workflow is unchanged.
3. MongoDB Atlas stays external — never run Mongo in staging compose.
4. Deployment is reproducible from Git + `.env`.
5. Secrets never enter Git.
6. Rollback steps are documented below.
7. Target cost: low single-digit EUR/USD per month for VPS + Atlas free/low tier.

### Alternative VPS providers

The steps below use **Hetzner** as the primary recommendation. The same runbook applies to:

| Provider          | Notes                                                |
| ----------------- | ---------------------------------------------------- |
| **Hetzner**       | Recommended — CX/CPX 2 vCPU / 4 GB RAM, Ubuntu 24.04 |
| **DigitalOcean**  | Droplet 2 vCPU / 4 GB, Ubuntu 24.04                  |
| **Hostinger VPS** | Use KVM VPS with Docker support                      |
| **HostPapa VPS**  | Verify Docker availability on plan                   |

No provider-specific application code is required.

---

## 2. VPS preparation

### Recommended server spec (Hetzner)

| Resource | Minimum                    |
| -------- | -------------------------- |
| OS       | Ubuntu 24.04 LTS           |
| vCPU     | 2                          |
| RAM      | 4 GB                       |
| Disk     | 40–80 GB SSD               |
| Location | Closest to primary testers |

Example: Hetzner **CPX22** or equivalent.

### Step-by-step server setup

#### 1. Create VPS

1. Create an Ubuntu 24.04 LTS server at your provider.
2. Note the public IPv4 address.
3. Add your SSH public key during creation when possible.

#### 2. Initial login and update

```bash
ssh root@YOUR_VPS_IP

apt update && apt upgrade -y
timedatectl set-timezone UTC
```

#### 3. Create deployment user

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

#### 4. SSH key authentication

From your local machine, confirm key login:

```bash
ssh deploy@YOUR_VPS_IP
```

#### 5. Disable password login (after key auth works)

Edit `/etc/ssh/sshd_config`:

```text
PasswordAuthentication no
PermitRootLogin prohibit-password
```

Then:

```bash
sudo systemctl reload sshd
```

#### 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

#### 7. Install Docker

```bash
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

Log out and back in as `deploy`, then verify:

```bash
docker --version
docker compose version
```

#### 8. Clone repository

```bash
sudo mkdir -p /opt/humanity-union
sudo chown deploy:deploy /opt/humanity-union
cd /opt/humanity-union
git clone https://github.com/YOUR_ORG/HumanityUnion.git .
git checkout YOUR_STAGING_TAG_OR_BRANCH
```

---

## 3. MongoDB Atlas

MongoDB runs **outside** the VPS.

### Setup checklist

1. Create a dedicated Atlas cluster for staging (M0 free tier acceptable for early testing).
2. Create a database user with read/write on `MONGODB_DATABASE` only.
3. Enable **Network Access** IP allowlist for the VPS egress IP.
4. Copy the connection string into server `.env` as `MONGODB_URI`.
5. Set `MONGODB_DATABASE=humanity_union` (or your chosen name).
6. From a trusted machine with the same URI, run:

```bash
npm run verify:mongodb
```

### Atlas backups

- Enable Atlas automated backups on paid tiers before external testers.
- Document backup retention policy in your ops notes.
- Application-level rollback does **not** restore Mongo data — Atlas backups do.

---

## 4. Docker

### Files

| File                       | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `docker-compose.yml`       | Staging/production-like stack (api + web + nginx)                    |
| `docker-compose.local.yml` | Optional local Mongo experimentation — **not for staging**           |
| `apps/api/Dockerfile`      | API production image (`CMD`: `pnpm start:prod` → `tsx src/index.ts`) |
| `apps/web/Dockerfile`      | Next.js standalone image                                             |
| `.dockerignore`            | Excludes secrets, docs, dev artifacts                                |

### Services

| Service | Container name         | Internal port    | Restart          |
| ------- | ---------------------- | ---------------- | ---------------- |
| `api`   | `humanity-union-api`   | 4000             | `unless-stopped` |
| `web`   | `humanity-union-web`   | 3000             | `unless-stopped` |
| `nginx` | `humanity-union-nginx` | 80 (host-mapped) | `unless-stopped` |

### Build and run

On the VPS, after configuring `.env`:

```bash
cd /opt/humanity-union
cp .env.example .env
nano .env   # fill secrets — never commit this file

npm run docker:build
npm run docker:up
docker compose ps
```

### Image tags and rollback

Compose builds local tags by default. Before each deploy:

```bash
git rev-parse HEAD > .deploy-revision
docker compose images >> .deploy-revision
```

Keep the previous image IDs available for rollback (see Section 9).

### Local development unchanged

Developers continue using:

```bash
pnpm dev
```

Docker on the VPS does not affect local workflows.

---

## 5. Nginx

Template: `infrastructure/nginx/humanity-union.conf`

### Configure domain

Replace `STAGING_DOMAIN` with:

- VPS IP (HTTP-only early testing), or
- Staging subdomain (recommended), e.g. `staging.example.org`

### Routing

| Path      | Target      |
| --------- | ----------- |
| `/`       | Next.js web |
| `/health` | Web health  |
| `/api/`   | Express API |

### Features enabled

- Gzip for JSON, JS, CSS, plain text
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- `client_max_body_size 10m`

### Reload after config change

```bash
docker compose exec nginx nginx -t
docker compose restart nginx
```

---

## 6. HTTPS

Use **Let's Encrypt** via **Certbot** on the VPS. Do **not** commit certificates or private keys.

### Option A — Certbot on host

1. Start stack on HTTP first; confirm health checks pass.
2. Install certbot: `sudo apt install -y certbot`
3. Obtain certificate (replace domain):

```bash
sudo certbot certonly --standalone -d staging.example.org
```

4. Customize `infrastructure/nginx/humanity-union-https.conf.example` and mount it in compose.
5. Update `.env` URLs to `https://staging.example.org`.
6. Rebuild web container so `NEXT_PUBLIC_*` URLs use HTTPS:

```bash
npm run docker:build
npm run docker:up
```

### Renewal

```bash
sudo certbot renew --dry-run
```

Add a cron job:

```text
0 3 * * * certbot renew --quiet && docker compose -f /opt/humanity-union/docker-compose.yml restart nginx
```

### Option B — Cloudflare proxy

Point DNS to VPS, enable Cloudflare SSL, ensure Atlas allowlist uses VPS egress IP.

### Reference template

See `infrastructure/nginx/humanity-union-https.conf.example` for a TLS-ready server block.

---

## 7. Deployment

### Environment — API

Configure in root `.env` (loaded by Docker Compose):

| Variable                       | Staging value                             |
| ------------------------------ | ----------------------------------------- |
| `NODE_ENV`                     | `production`                              |
| `PORT`                         | `4000`                                    |
| `MONGODB_URI`                  | Atlas connection string                   |
| `MONGODB_DATABASE`             | `humanity_union`                          |
| `JWT_ACCESS_SECRET`            | Long random string (≥ 32 chars)           |
| `JWT_REFRESH_SECRET`           | Long random string (≥ 32 chars)           |
| `AUTH_BOOTSTRAP_FALLBACK`      | **`false`**                               |
| `CORS_ORIGIN`                  | `https://staging.example.org`             |
| `WEB_ORIGIN`                   | Same as CORS                              |
| `API_PUBLIC_URL`               | `https://staging.example.org/api`         |
| `NOTIFICATION_PERSISTENCE`     | `mongodb`                                 |
| `WORKSPACE_ASSISTANT_PROVIDER` | `mock` (or `ai_assisted` with key)        |
| `AI_PROVIDER`                  | `openai` (optional)                       |
| `AI_API_KEY`                   | Optional — leave empty for mock assistant |

### Environment — Web (build-time)

| Variable                   | Staging value                     |
| -------------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://staging.example.org/api` |
| `NEXT_PUBLIC_SITE_URL`     | `https://staging.example.org`     |

**Important:** Changing `NEXT_PUBLIC_*` requires rebuilding the web image.

### Deploy procedure

```bash
cd /opt/humanity-union
git fetch origin
git checkout STAGING_BRANCH
git pull

cp .env .env.backup.$(date +%Y%m%d)

npm run docker:build
npm run docker:up
docker compose ps
curl -s http://localhost/api/v1/health | head
curl -s http://localhost/health
```

### Pre-deploy verification (from CI or laptop)

```bash
npm run verify:staging
npm run verify:deployment
npm run verify:auth
npm run verify:mongodb
```

---

## 8. Smoke test

Run after every staging deploy.

### Smoke test checklist

| #   | Check              | How                                | Expected                                    |
| --- | ------------------ | ---------------------------------- | ------------------------------------------- |
| 1   | API health         | `GET /api/v1/health`               | `status: healthy`, Mongo connected          |
| 2   | Web health         | `GET /health`                      | `status: healthy`                           |
| 3   | Homepage           | Open `/`                           | Page loads, no console errors               |
| 4   | Registration       | `/register`                        | New account creates successfully            |
| 5   | Login              | `/login`                           | JWT session works                           |
| 6   | Workspace          | `/workspace`                       | Dashboard loads for authenticated user      |
| 7   | Member Profile     | `/profile`                         | Profile visible and editable                |
| 8   | Participation Area | Member workspace sections          | Area settings load                          |
| 9   | Initiatives        | `/initiatives`                     | Initiative list and workspace open          |
| 10  | Capability 02      | Initiative civic pipeline sections | Integration view loads                      |
| 11  | Global Search      | `/search`                          | Search returns public records               |
| 12  | Notifications      | `/notifications`                   | Notification list loads                     |
| 13  | Assistant          | Initiative workspace sidebar       | Intelligence panel + advisory actions       |
| 14  | MongoDB            | API health payload                 | `mongodb.connected: true`                   |
| 15  | HTTPS              | Browser padlock                    | Valid certificate (before external testers) |

### Example curl checks

```bash
curl -s https://staging.example.org/api/v1/health | jq '.data.status, .data.mongodb.connected'
curl -s https://staging.example.org/health | jq '.status'
```

---

## 9. Rollback

### Application rollback (fast)

1. Stop stack: `npm run docker:down`
2. Restore Git: `git checkout PREVIOUS_KNOWN_GOOD_SHA`
3. Restore `.env` if changed: `cp .env.backup.YYYYMMDD .env`
4. Rebuild and start: `npm run docker:build && npm run docker:up`
5. Re-run smoke test checklist (Section 8).

### Docker image rollback

If previous images still exist locally, retag and redeploy previous image IDs.

### MongoDB rollback considerations

- Application rollback **does not** undo database writes.
- Use Atlas point-in-time restore or snapshot restore for data rollback.

---

## 10. Troubleshooting

| Symptom                      | Likely cause           | Fix                                         |
| ---------------------------- | ---------------------- | ------------------------------------------- |
| API container exits on start | Missing env vars       | Check `docker compose logs api`; fix `.env` |
| API health `degraded`        | Mongo unreachable      | Verify Atlas IP allowlist, URI, credentials |
| Web shows wrong API URL      | Stale build args       | Rebuild web after changing `NEXT_PUBLIC_*`  |
| 502 from Nginx               | API/web not healthy    | `docker compose ps`; check healthchecks     |
| CORS errors                  | `CORS_ORIGIN` mismatch | Match exact staging URL scheme/host         |
| Certbot fails                | Port 80 in use         | Stop nginx temporarily or use webroot mode  |

### Useful commands

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f nginx
docker compose ps
```

---

## 11. Budget estimates

| Item                         | Cost           |
| ---------------------------- | -------------- |
| Hetzner CPX22 (2 vCPU, 4 GB) | ~€6–8 / month  |
| DigitalOcean 4 GB droplet    | ~$24 / month   |
| MongoDB Atlas M0             | Free (limited) |
| MongoDB Atlas M10+           | ~$9+ / month   |
| Domain (optional)            | ~$10–15 / year |
| Let's Encrypt                | Free           |

**Estimated staging minimum:** ~€6–10/month with Hetzner + Atlas M0.

---

## 12. Go-live checklist

### Infrastructure

- [ ] VPS provisioned (2 vCPU, 4 GB RAM, Ubuntu 24.04)
- [ ] Deployment user created, password SSH disabled
- [ ] Firewall allows 22, 80, 443 only
- [ ] Docker and Compose installed
- [ ] Repository cloned at known Git SHA

### MongoDB Atlas

- [ ] Cluster created
- [ ] Database user with least privilege
- [ ] VPS IP allowlisted
- [ ] `npm run verify:mongodb` passes with staging URI
- [ ] Backups enabled or backup policy documented

### Secrets and configuration

- [ ] `.env` created on server, **not** in Git
- [ ] JWT secrets are strong random values
- [ ] `AUTH_BOOTSTRAP_FALLBACK=false`
- [ ] `CORS_ORIGIN` matches staging URL exactly
- [ ] `NEXT_PUBLIC_*` URLs match staging URL

### Deployment

- [ ] `npm run verify:staging` passes
- [ ] `npm run docker:build` succeeds on VPS
- [ ] All containers healthy
- [ ] `GET /api/v1/health` returns healthy + Mongo connected
- [ ] `GET /health` returns healthy

### HTTPS and security

- [ ] HTTPS enabled before external testers
- [ ] Certbot renewal scheduled
- [ ] Security checklist completed (below)

### Functional smoke test

- [ ] Homepage, auth, workspace, initiatives work
- [ ] Search, notifications, assistant work

---

## Security checklist

- [ ] `AUTH_BOOTSTRAP_FALLBACK=false`
- [ ] JWT secrets are long random strings
- [ ] HTTPS enabled
- [ ] MongoDB Atlas IP allowlist configured
- [ ] No debug logging of tokens or connection strings
- [ ] `.env` is gitignored and not committed
- [ ] No development API keys in staging `.env`
- [ ] SSH password login disabled
- [ ] Firewall enabled
- [ ] Atlas database user uses least privilege

---

## Logging

| Source         | Command                        |
| -------------- | ------------------------------ |
| All containers | `docker compose logs -f`       |
| API            | `docker compose logs -f api`   |
| Web            | `docker compose logs -f web`   |
| Nginx          | `docker compose logs -f nginx` |
| Mongo status   | `/api/v1/health` mongodb field |

---

## Monitoring (future — not implemented)

| Tool            | Purpose                 |
| --------------- | ----------------------- |
| **UptimeRobot** | HTTP uptime checks      |
| **Prometheus**  | Metrics collection      |
| **Grafana**     | Dashboards and alerting |

---

## Backups (documentation only)

| Asset          | Method                   |
| -------------- | ------------------------ |
| MongoDB data   | Atlas automated backups  |
| Git repository | Remote origin            |
| Server `.env`  | Encrypted offline backup |
| Docker images  | Tag critical releases    |

---

## Verification commands

```bash
npm run verify:staging
npm run verify:deployment
```

See also [ENGINEERING_VERIFICATION_BASELINE.md](./ENGINEERING_VERIFICATION_BASELINE.md).

---

## Deferred work

- CI/CD pipeline for automated staging deploys
- Terraform / Ansible provisioning
- Centralized logging
- Uptime monitoring installation
- Email provider setup
- WordPress migration / production cutover
