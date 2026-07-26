/**
 * TASK-059 — Production Deployment Foundation verification.
 * Run: npm run verify:deployment
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const SECRET_PATTERNS = [
  /mongodb\+srv:\/\/[^:]+:[^@]+@/i,
  /JWT_ACCESS_SECRET=(?!change_this|replace_with|dev-jwt)/i,
  /JWT_REFRESH_SECRET=(?!change_this|replace_with|dev-jwt)/i,
  /passwordHash/i,
  /refreshTokenHash/i,
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyDockerAssets(): void {
  console.log("1. Docker and compose assets");

  const requiredPaths = [
    "apps/api/Dockerfile",
    "apps/web/Dockerfile",
    "docker-compose.yml",
    "docker-compose.local.yml",
    ".dockerignore",
  ];

  for (const relativePath of requiredPaths) {
    assert(fs.existsSync(path.join(REPO_ROOT, relativePath)), `Missing ${relativePath}`);
  }

  const compose = readRepoFile("docker-compose.yml");
  assert(compose.includes("api:"), "docker-compose.yml must define api service");
  assert(compose.includes("web:"), "docker-compose.yml must define web service");
  assert(!compose.includes("mongo:"), "Production compose must not include MongoDB service");
}

function verifyEnvExamples(): void {
  console.log("2. Environment examples");

  const examples = [".env.example", "apps/api/.env.example", "apps/web/.env.example"];

  for (const relativePath of examples) {
    assert(fs.existsSync(path.join(REPO_ROOT, relativePath)), `Missing ${relativePath}`);
  }

  const apiExample = readRepoFile("apps/api/.env.example");
  assert(apiExample.includes("MONGODB_URI"), "API env example must document MONGODB_URI");
  assert(apiExample.includes("JWT_ACCESS_SECRET"), "API env example must document JWT secrets");
  assert(apiExample.includes("CORS_ORIGIN"), "API env example must document CORS_ORIGIN");

  const webExample = readRepoFile("apps/web/.env.example");
  assert(
    webExample.includes("NEXT_PUBLIC_API_BASE_URL"),
    "Web env example must document NEXT_PUBLIC_API_BASE_URL",
  );
}

async function verifyProductionValidation(): Promise<void> {
  console.log("3. Production environment validation");

  const validationSource = readRepoFile("apps/api/src/config/validate-production-environment.ts");
  assert(
    validationSource.includes("validateProductionEnvironment"),
    "Production validation helper must exist",
  );
  assert(
    readRepoFile("apps/api/src/index.ts").includes("initializeEnvironment"),
    "API startup must initialize environment validation",
  );

  const previousNodeEnv = process.env.NODE_ENV;
  const previousMongo = process.env.MONGODB_URI;
  const previousDatabase = process.env.MONGODB_DATABASE;
  const previousAccess = process.env.JWT_ACCESS_SECRET;
  const previousRefresh = process.env.JWT_REFRESH_SECRET;
  const previousCors = process.env.CORS_ORIGIN;
  const previousWebOrigin = process.env.WEB_ORIGIN;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DATABASE;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.CORS_ORIGIN;
    delete process.env.WEB_ORIGIN;

    let failed = false;

    try {
      const { validateProductionEnvironment } =
        await import("../config/validate-production-environment.js");
      validateProductionEnvironment();
    } catch {
      failed = true;
    }

    assert(failed, "Production validation must fail when required variables are missing");

    process.env.MONGODB_URI = "mongodb://example.test/humanity_union";
    process.env.MONGODB_DATABASE = "humanity_union";
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.CORS_ORIGIN = "https://staging.example.org";

    const { validateProductionEnvironment: validateAgain } =
      await import("../config/validate-production-environment.js");
    validateAgain();
  } finally {
    process.env.NODE_ENV = previousNodeEnv;

    if (previousMongo === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previousMongo;
    }

    if (previousDatabase === undefined) {
      delete process.env.MONGODB_DATABASE;
    } else {
      process.env.MONGODB_DATABASE = previousDatabase;
    }

    if (previousAccess === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = previousAccess;
    }

    if (previousRefresh === undefined) {
      delete process.env.JWT_REFRESH_SECRET;
    } else {
      process.env.JWT_REFRESH_SECRET = previousRefresh;
    }

    if (previousCors === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = previousCors;
    }

    if (previousWebOrigin === undefined) {
      delete process.env.WEB_ORIGIN;
    } else {
      process.env.WEB_ORIGIN = previousWebOrigin;
    }
  }
}

function verifyHealthRoutes(): void {
  console.log("4. Health endpoints");

  const apiHealth = readRepoFile("apps/api/src/routes/health.routes.ts");
  assert(apiHealth.includes("uptimeSeconds"), "API health must expose uptime");
  assert(apiHealth.includes("environment"), "API health must expose environment");
  assert(apiHealth.includes("checkMongoConnection"), "API health must check MongoDB");

  assert(
    fs.existsSync(path.join(REPO_ROOT, "apps/web/src/app/health/route.ts")),
    "Web health route must exist at /health",
  );
}

function verifyNginxAndDocs(): void {
  console.log("5. Nginx template and deployment docs");

  const nginx = readRepoFile("infrastructure/nginx/humanity-union.conf");
  assert(nginx.includes("location /api/"), "Nginx template must proxy /api/");
  assert(nginx.includes("location /"), "Nginx template must proxy web root");
  assert(nginx.includes("gzip"), "Nginx template must enable gzip");

  const docs = readRepoFile("docs/PRODUCTION_DEPLOYMENT_FOUNDATION.md");
  assert(docs.includes("MongoDB Atlas"), "Deployment docs must cover MongoDB Atlas");
  assert(docs.includes("Hetzner"), "Deployment docs must cover VPS notes");
  assert(docs.includes("staging"), "Deployment docs must cover staging without final domain");
}

function verifyGitignoreAndSecrets(): void {
  console.log("6. Secret hygiene");

  const gitignore = readRepoFile(".gitignore");
  assert(gitignore.includes(".env"), ".gitignore must ignore .env files");

  try {
    const trackedEnvFiles = execSync("git ls-files '.env' 'apps/api/.env' 'apps/web/.env'", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();

    assert(trackedEnvFiles.length === 0, "Real .env files must not be committed");
  } catch {
    console.log("Skipping git tracked .env check (not a git repository).");
  }

  const exampleFiles = [".env.example", "apps/api/.env.example", "apps/web/.env.example"];

  for (const file of exampleFiles) {
    const content = readRepoFile(file);

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.source.includes("mongodb") && file.endsWith(".example")) {
        continue;
      }

      assert(!pattern.test(content), `${file} must not contain committed secrets`);
    }
  }
}

function verifyLocalBuildScript(): void {
  console.log("7. Local build still passes");

  execSync("npm run build", {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

async function main(): Promise<void> {
  verifyDockerAssets();
  verifyEnvExamples();
  await verifyProductionValidation();
  verifyHealthRoutes();
  verifyNginxAndDocs();
  verifyGitignoreAndSecrets();
  verifyLocalBuildScript();

  console.log("\nverify:deployment — all checks passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
