/**
 * HU-RRP-03J — isolated browser E2E stack orchestrator.
 *
 * 1) Starts MongoMemoryReplSet (no Docker, no paid cloud)
 * 2) Seeds verified participant + admin into hu_test_* DB
 * 3) Starts local API (turnstile verifier injected) + WEB (RRP flag ON)
 * 4) Optionally runs Playwright and tears down
 *
 * Usage:
 *   pnpm --filter @hu/api exec tsx ./scripts/rrp-03j-isolated-e2e-stack.mts
 *   pnpm --filter @hu/api exec tsx ./scripts/rrp-03j-isolated-e2e-stack.mts --run-playwright
 *
 * NO Production Mongo / SMTP / messaging. NO Production flag activation.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

import { generateIsolatedTestDatabaseName } from "./test-mongo-isolation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const webRoot = path.resolve(repoRoot, "apps/web");
const stateDir = path.resolve("/tmp/hu-rrp-03j-e2e");
const envOutPath = path.join(stateDir, "e2e.env");
const logDir = path.join(stateDir, "logs");

const PARTICIPANT_EMAIL = "rrp03j.participant@hu-test.local";
const PARTICIPANT_PASSWORD = "RrpE2e!Participant9";
const PARTICIPANT_NAME = "RRP03J Participant";
const ADMIN_EMAIL = "rrp03j.admin@hu-test.local";
const ADMIN_PASSWORD = "RrpE2e!Admin9";
const ADMIN_NAME = "RRP03J Administrator";
const SECOND_EMAIL = "rrp03j.participant2@hu-test.local";
const SECOND_PASSWORD = "RrpE2e!Participant29";
const SECOND_NAME = "RRP03J Participant Two";

const API_PORT = Number(process.env.RRP_E2E_API_PORT ?? 4010);
const WEB_PORT = Number(process.env.RRP_E2E_WEB_PORT ?? 3010);
const runPlaywright = process.argv.includes("--run-playwright");
const useNextDev = process.argv.includes("--next-dev") || process.env.RRP_E2E_NEXT_DEV === "1";
const skipWebBuild =
  process.argv.includes("--skip-web-build") || process.env.RRP_E2E_SKIP_WEB_BUILD === "1";

mkdirSync(logDir, { recursive: true });

function log(message: string): void {
  console.log(`[rrp-03j] ${message}`);
}

function buildIsolatedEnv(uri: string, database: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "development",
    NODE_TEST_ENV: "false",
    PLATFORM_MODE: "local",
    MONGODB_URI: uri,
    MONGODB_DATABASE: database,
    MONGODB_TEST_DATABASE: database,
    PORT: String(API_PORT),
    API_PORT: String(API_PORT),
    API_PUBLIC_URL: `http://127.0.0.1:${API_PORT}`,
    CORS_ORIGIN: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
    WEB_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
    JWT_ACCESS_SECRET: "rrp-03j-isolated-access-secret-not-for-prod",
    JWT_REFRESH_SECRET: "rrp-03j-isolated-refresh-secret-not-for-prod",
    AUTH_BOOTSTRAP_FALLBACK: "false",
    AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
    EMAIL_PROVIDER: "mock",
    TURNSTILE_SECRET_KEY: "rrp-03j-isolated-turnstile-secret",
    HU_VERIFICATION_MODE: "true",
  };
}

async function seedIdentities(uri: string, database: string): Promise<void> {
  const env = buildIsolatedEnv(uri, database);
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }

  const { bootstrapAuthPersistence } = await import(
    "../src/infrastructure/mongodb/bootstrap-auth-persistence.js"
  );
  const { bootstrapMongoPersistence } = await import(
    "../src/infrastructure/mongodb/bootstrap-mongo-persistence.js"
  );
  const { insertAuthUser } = await import("../src/modules/auth/auth-user.repository.js");
  const { createMemberProfileForUser } = await import(
    "../src/modules/member-profile/member-profile.service.js"
  );
  const { confirmMemberRegistration } = await import(
    "../src/modules/member/application/confirm-member-registration.service.js"
  );
  const { disconnectMongoClient } = await import(
    "../src/infrastructure/mongodb/mongo-connection.js"
  );

  await bootstrapAuthPersistence();
  await bootstrapMongoPersistence();

  // Locale F needs enabled Registry rows; defaults seed uk/ar disabled and omit he.
  const { ensureLanguageRegistrySeeded, updateLanguageRegistryRecord, createLanguageRegistryRecord, resolveLanguageRegistryLocale } =
    await import("../src/modules/language/language-registry/language-registry.repository.js");
  await ensureLanguageRegistrySeeded();
  for (const languageId of ["lang-uk", "lang-ar"] as const) {
    await updateLanguageRegistryRecord(languageId, {
      enabled: true,
      uiTranslationStatus: "complete",
      searchEnabled: true,
    });
  }
  const heExisting = await resolveLanguageRegistryLocale("he");
  if (!heExisting) {
    await createLanguageRegistryRecord({
      languageId: "lang-he",
      locale: "he",
      englishName: "Hebrew",
      nativeName: "עברית",
      textDirection: "rtl",
      aliases: [],
      enabled: true,
      uiTranslationStatus: "complete",
      contentTranslationEnabled: false,
      searchEnabled: true,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
    });
  } else if (!heExisting.enabled) {
    await updateLanguageRegistryRecord(heExisting.languageId, { enabled: true });
  }
  log("Enabled language registry locales for F: en, uk, ar, he");

  async function seedUser(input: {
    email: string;
    password: string;
    displayName: string;
    role: "member" | "admin";
  }): Promise<void> {
    const memberId = randomUUID();
    const authUser = await insertAuthUser(
      {
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        role: input.role,
      },
      memberId,
    );
    await createMemberProfileForUser({
      userId: authUser.userId,
      displayName: input.displayName,
      language: "en",
    });
    await confirmMemberRegistration(authUser, {
      correlationId: `rrp-03j-seed:${authUser.userId}`,
    });
    log(`Seeded ${input.role}: ${input.email} memberId=${authUser.memberId}`);
  }

  await seedUser({
    email: PARTICIPANT_EMAIL,
    password: PARTICIPANT_PASSWORD,
    displayName: PARTICIPANT_NAME,
    role: "member",
  });
  await seedUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: ADMIN_NAME,
    role: "admin",
  });
  await seedUser({
    email: SECOND_EMAIL,
    password: SECOND_PASSWORD,
    displayName: SECOND_NAME,
    role: "member",
  });

  // Release seed connection so API child owns the pool cleanly.
  await disconnectMongoClient().catch(() => undefined);
}

function spawnLogged(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  logName: string,
  cwd: string,
): ChildProcess {
  const out = createWriteStream(path.join(logDir, `${logName}.log`), { flags: "a" });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(out);
  child.stderr?.pipe(out);
  child.on("exit", (code, signal) => {
    log(`${logName} exited code=${code} signal=${signal ?? ""}`);
  });
  return child;
}

async function waitForUrl(url: string, label: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        log(`${label} ready (${response.status})`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} not ready within ${timeoutMs}ms (${lastError})`);
}

async function runPlaywrightSuite(env: NodeJS.ProcessEnv): Promise<number> {
  return await new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@hu/web",
        "exec",
        "playwright",
        "test",
        "-c",
        "playwright.config.ts",
        "src/features/regional-program/rrp-03j-browser.playwright.e2e.ts",
      ],
      {
        cwd: repoRoot,
        env,
        stdio: "inherit",
      },
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  log("Starting MongoMemoryReplSet…");
  const database = generateIsolatedTestDatabaseName();
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri(database);
  const hostname = new URL(uri.replace(/^mongodb:/, "http:")).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    await replSet.stop({ doCleanup: true });
    throw new Error(`Refusing non-local MemoryReplSet host: ${hostname}`);
  }

  log(`Isolated DB ready: ${database}`);
  await seedIdentities(uri, database);

  const apiEnv = buildIsolatedEnv(uri, database);
  // WEB must not inherit API verification/mongo env — those break Next build/prerender.
  const webEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG,
    CI: process.env.CI,
    NODE_ENV: useNextDev ? "development" : "production",
    PORT: String(WEB_PORT),
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
    NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED: "true",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "rrp-03j-isolated-site-key",
    NEXT_PUBLIC_PLATFORM_MODE: "local",
  };

  writeFileSync(
    envOutPath,
    [
      `export MONGODB_URI='${uri}'`,
      `export MONGODB_DATABASE='${database}'`,
      `export RRP_E2E_BASE_URL='http://127.0.0.1:${WEB_PORT}'`,
      `export RRP_E2E_API_BASE_URL='http://127.0.0.1:${API_PORT}'`,
      `export RRP_E2E_PARTICIPANT_EMAIL='${PARTICIPANT_EMAIL}'`,
      `export RRP_E2E_PARTICIPANT_PASSWORD='${PARTICIPANT_PASSWORD}'`,
      `export RRP_E2E_ADMIN_EMAIL='${ADMIN_EMAIL}'`,
      `export RRP_E2E_ADMIN_PASSWORD='${ADMIN_PASSWORD}'`,
      `export RRP_E2E_SECOND_EMAIL='${SECOND_EMAIL}'`,
      `export RRP_E2E_SECOND_PASSWORD='${SECOND_PASSWORD}'`,
      `export NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true`,
      "",
    ].join("\n"),
    "utf8",
  );
  log(`Wrote ${envOutPath}`);

  const children: ChildProcess[] = [];
  const apiChild = spawnLogged(
    "pnpm",
    ["exec", "tsx", "./scripts/rrp-03j-api-entry.mts"],
    apiEnv,
    "api",
    apiRoot,
  );
  children.push(apiChild);

  await waitForUrl(`http://127.0.0.1:${API_PORT}/api/v1/health`, "API", 120_000);

  let webChild: ChildProcess;
  if (useNextDev) {
    // Must use --webpack: turbopack does not honor extensionAlias for .js→.ts imports.
    webChild = spawnLogged(
      "pnpm",
      ["exec", "next", "dev", "--webpack", "-p", String(WEB_PORT), "-H", "127.0.0.1"],
      webEnv,
      "web",
      webRoot,
    );
  } else {
    if (!skipWebBuild) {
      log("Building isolated WEB with RRP flag ON (webpack)…");
      const buildCode = await new Promise<number>((resolve) => {
        const build = spawn("pnpm", ["exec", "next", "build", "--webpack"], {
          cwd: webRoot,
          env: webEnv,
          stdio: "inherit",
        });
        build.on("exit", (code) => resolve(code ?? 1));
      });
      if (buildCode !== 0) {
        throw new Error(`Isolated WEB build failed with code ${buildCode}`);
      }
    } else {
      log("Skipping WEB rebuild (--skip-web-build); reusing existing .next with flag-ON build.");
    }
    webChild = spawnLogged(
      "pnpm",
      ["exec", "next", "start", "-p", String(WEB_PORT), "-H", "127.0.0.1"],
      webEnv,
      "web",
      webRoot,
    );
  }
  children.push(webChild);

  await waitForUrl(`http://127.0.0.1:${WEB_PORT}/`, "WEB", useNextDev ? 180_000 : 120_000);

  const playwrightEnv: NodeJS.ProcessEnv = {
    ...process.env,
    RRP_E2E_BASE_URL: `http://127.0.0.1:${WEB_PORT}`,
    RRP_E2E_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
    RRP_E2E_PARTICIPANT_EMAIL: PARTICIPANT_EMAIL,
    RRP_E2E_PARTICIPANT_PASSWORD: PARTICIPANT_PASSWORD,
    RRP_E2E_ADMIN_EMAIL: ADMIN_EMAIL,
    RRP_E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
    RRP_E2E_SECOND_EMAIL: SECOND_EMAIL,
    RRP_E2E_SECOND_PASSWORD: SECOND_PASSWORD,
    NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED: "true",
    // Prefer the real user Playwright cache over ephemeral sandbox paths.
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.RRP_E2E_PLAYWRIGHT_BROWSERS_PATH?.trim() ||
      path.join(process.env.HOME ?? "", "Library/Caches/ms-playwright"),
  };

  const shutdown = async (exitCode: number) => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    try {
      const client = new MongoClient(uri);
      await client.connect();
      await client.db(database).dropDatabase();
      await client.close();
    } catch (error) {
      console.warn("DB cleanup warning:", error instanceof Error ? error.message : error);
    }
    await replSet.stop({ doCleanup: true });
    process.exit(exitCode);
  };

  process.on("SIGINT", () => {
    void shutdown(130);
  });
  process.on("SIGTERM", () => {
    void shutdown(143);
  });

  if (runPlaywright) {
    const code = await runPlaywrightSuite(playwrightEnv);
    await shutdown(code);
    return;
  }

  log("Stack is up. Export env from:");
  log(`  source ${envOutPath}`);
  log("Press Ctrl+C to stop and drop the isolated database.");
  await new Promise(() => undefined);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
