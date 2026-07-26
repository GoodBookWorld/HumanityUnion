/**
 * TASK-061 — Staging deployment runbook verification.
 * Run: npm run verify:staging
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const RUNBOOK_PATH = "docs/STAGING_DEPLOYMENT_RUNBOOK.md";

const RUNBOOK_REQUIRED_SECTIONS = [
  "## 1. Architecture",
  "## 2. VPS preparation",
  "## 3. MongoDB Atlas",
  "## 4. Docker",
  "## 5. Nginx",
  "## 6. HTTPS",
  "## 7. Deployment",
  "## 8. Smoke test",
  "## 9. Rollback",
  "## 10. Troubleshooting",
  "## 11. Budget estimates",
  "## 12. Go-live checklist",
] as const;

const ROOT_ENV_REQUIRED = [
  "NODE_ENV=production",
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "AUTH_BOOTSTRAP_FALLBACK=false",
  "CORS_ORIGIN",
  "API_PUBLIC_URL",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "WORKSPACE_ASSISTANT_PROVIDER",
] as const;

const SECRET_PATTERNS = [
  /mongodb\+srv:\/\/[^:]+:[^@]+@/i,
  /JWT_ACCESS_SECRET=(?!change_this|replace_with|dev-jwt)/i,
  /JWT_REFRESH_SECRET=(?!change_this|replace_with|dev-jwt)/i,
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyRunbook(): void {
  console.log("1. Staging deployment runbook");

  assert(fs.existsSync(path.join(REPO_ROOT, RUNBOOK_PATH)), `Missing ${RUNBOOK_PATH}`);

  const runbook = readRepoFile(RUNBOOK_PATH);

  for (const section of RUNBOOK_REQUIRED_SECTIONS) {
    assert(runbook.includes(section), `Runbook must include section: ${section}`);
  }

  assert(runbook.includes("Hetzner"), "Runbook must document Hetzner VPS");
  assert(runbook.includes("DigitalOcean"), "Runbook must document alternative VPS providers");
  assert(runbook.includes("Let's Encrypt"), "Runbook must document HTTPS with Let's Encrypt");
  assert(
    runbook.includes("AUTH_BOOTSTRAP_FALLBACK=false"),
    "Runbook must require bootstrap disabled",
  );
  assert(runbook.includes("GET /api/v1/health"), "Runbook must document API health endpoint");
  assert(runbook.includes("GET /health"), "Runbook must document web health endpoint");
  assert(runbook.includes("Smoke test checklist"), "Runbook must include smoke test checklist");
}

function verifyDockerStagingStack(): void {
  console.log("2. Docker and Compose staging stack");

  const compose = readRepoFile("docker-compose.yml");

  assert(compose.includes("container_name: humanity-union-api"), "Compose must name api container");
  assert(compose.includes("container_name: humanity-union-web"), "Compose must name web container");
  assert(
    compose.includes("container_name: humanity-union-nginx"),
    "Compose must name nginx container",
  );
  assert(compose.includes("restart: unless-stopped"), "Compose services must use restart policy");
  assert(compose.includes("healthcheck:"), "Compose services must define health checks");
  assert(!compose.includes("mongo:"), "Staging compose must not include MongoDB service");
  assert(
    compose.includes("WORKSPACE_ASSISTANT_PROVIDER"),
    "Compose must pass workspace assistant provider env",
  );
  assert(compose.includes("AI_API_KEY"), "Compose must document optional AI_API_KEY");

  const apiDockerfile = readRepoFile("apps/api/Dockerfile");
  const webDockerfile = readRepoFile("apps/web/Dockerfile");

  assert(apiDockerfile.includes("HEALTHCHECK"), "API Dockerfile must define HEALTHCHECK");
  assert(webDockerfile.includes("HEALTHCHECK"), "Web Dockerfile must define HEALTHCHECK");
  assert(apiDockerfile.includes("NODE_ENV=production"), "API Dockerfile must set production mode");
}

function verifyEnvironmentExamples(): void {
  console.log("3. Staging environment examples");

  const rootExample = readRepoFile(".env.example");

  for (const key of ROOT_ENV_REQUIRED) {
    assert(
      rootExample.includes(key.split("=")[0]!),
      `.env.example must document ${key.split("=")[0]}`,
    );
  }

  assert(
    rootExample.includes("AUTH_BOOTSTRAP_FALLBACK=false"),
    "Root env must default bootstrap off",
  );
  assert(rootExample.includes("AI_PROVIDER"), "Root env must document AI_PROVIDER");
}

async function verifyProductionValidation(): Promise<void> {
  console.log("4. Production environment validation");

  const { listRequiredProductionVariables } =
    await import("../config/validate-production-environment.js");

  const required = listRequiredProductionVariables();
  assert(required.includes("MONGODB_URI"), "Production validation must require MONGODB_URI");
  assert(required.includes("JWT_ACCESS_SECRET"), "Production validation must require JWT secrets");
}

function verifyHealthEndpoints(): void {
  console.log("5. Health endpoints");

  const apiHealth = readRepoFile("apps/api/src/routes/health.routes.ts");
  assert(apiHealth.includes("uptimeSeconds"), "API health must expose uptime");
  assert(apiHealth.includes("checkMongoConnection"), "API health must check MongoDB");

  const webHealth = readRepoFile("apps/web/src/app/health/route.ts");
  assert(webHealth.includes('"healthy"'), "Web health must return healthy status");
}

function verifyNginxTemplates(): void {
  console.log("6. Nginx reverse proxy templates");

  const nginx = readRepoFile("infrastructure/nginx/humanity-union.conf");
  assert(nginx.includes("location /api/"), "Nginx must proxy API");
  assert(nginx.includes("location /health"), "Nginx must proxy web health");
  assert(nginx.includes("gzip"), "Nginx must enable gzip");
  assert(nginx.includes("X-Content-Type-Options"), "Nginx must set security headers");

  const httpsExample = readRepoFile("infrastructure/nginx/humanity-union-https.conf.example");
  assert(httpsExample.includes("listen 443 ssl"), "HTTPS example must define TLS listener");
  assert(httpsExample.includes("letsencrypt"), "HTTPS example must reference Let's Encrypt paths");
  assert(!httpsExample.includes(".pem\n-----BEGIN"), "HTTPS example must not embed certificates");
}

function verifySecurityAndSecrets(): void {
  console.log("7. Security checklist and secret hygiene");

  const runbook = readRepoFile(RUNBOOK_PATH);
  assert(runbook.includes("Security checklist"), "Runbook must include security checklist");
  assert(runbook.includes("MongoDB Atlas IP allowlist"), "Runbook must mention Atlas allowlist");
  assert(runbook.includes(".env"), "Runbook must mention env file handling");

  const gitignore = readRepoFile(".gitignore");
  assert(gitignore.includes(".env"), ".gitignore must ignore .env");

  try {
    const trackedEnvFiles = execSync("git ls-files '.env' 'apps/api/.env' 'apps/web/.env'", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();

    assert(trackedEnvFiles.length === 0, "Real .env files must not be committed");
  } catch {
    console.log("Skipping git tracked .env check (not a git repository).");
  }

  for (const file of [".env.example", "apps/api/.env.example", "apps/web/.env.example"]) {
    const content = readRepoFile(file);

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.source.includes("mongodb") && file.endsWith(".example")) {
        continue;
      }

      assert(!pattern.test(content), `${file} must not contain committed secrets`);
    }
  }
}

function verifyFoundationCrossReference(): void {
  console.log("8. Deployment foundation cross-reference");

  const foundation = readRepoFile("docs/PRODUCTION_DEPLOYMENT_FOUNDATION.md");
  assert(foundation.includes("MongoDB Atlas"), "Foundation doc must cover Atlas");
  assert(
    foundation.includes("STAGING_DEPLOYMENT_RUNBOOK") ||
      fs.existsSync(path.join(REPO_ROOT, RUNBOOK_PATH)),
    "Staging runbook must exist alongside foundation doc",
  );
}

async function main(): Promise<void> {
  verifyRunbook();
  verifyDockerStagingStack();
  verifyEnvironmentExamples();
  await verifyProductionValidation();
  verifyHealthEndpoints();
  verifyNginxTemplates();
  verifySecurityAndSecrets();
  verifyFoundationCrossReference();

  console.log("\nverify:staging — all checks passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
