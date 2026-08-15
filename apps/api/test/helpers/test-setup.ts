import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { lockMongoConfigForTests, resolveMongoConfig } from "../../src/infrastructure/mongodb/mongo-config.js";
import {
  assertSafeTestDatabaseName,
  rewriteMongoUriDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../scripts/test-mongo-isolation.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDir, "../..");

dotenv.config({ path: path.join(apiRoot, "../../.env") });
dotenv.config({ path: path.join(apiRoot, ".env") });

/**
 * Mail Delivery Reliability Pack 01 — hard email isolation.
 *
 * apps/api/.env may contain real SMTP credentials (including Flockmail).
 * Those credentials must never override test isolation. Force mock after
 * dotenv so automated regression cannot open smtp-out.flockmail.com.
 */
process.env.NODE_ENV = "test";
process.env.NODE_TEST_ENV = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
process.env.EMAIL_CONFIRMATION_CODE_TTL_MINUTES = "1440";
process.env.HU_VERIFICATION_MODE = "true";
process.env.OUTBOX_DISPATCH_ENABLED = "false";

/**
 * Default Initiative persistence to in-memory for unit tests so parallel
 * suites cannot race on apps/api/.runtime/initiatives.json.tmp. Individual
 * tests may still opt into mongodb/file explicitly before importing stores.
 */
if (!process.env.INITIATIVE_PERSISTENCE?.trim()) {
  process.env.INITIATIVE_PERSISTENCE = "memory";
}

/**
 * Recovery Task 30 — Mongo test-database isolation enforcement.
 *
 * Root cause this closes: `apps/api/.env` sets `MONGODB_DATABASE=humanity_union_dev`,
 * and every Mongo-backed repository resolves its database through the same
 * shared `resolveMongoConfig()` chokepoint — so, without this block, the test
 * suite silently reads and writes the exact same database as any running
 * `dev:api` process. This must run before any repository connects, which is
 * guaranteed here because this file is loaded via `--import` (a preload
 * hook) before any test file.
 *
 * Only enforced when Mongo is actually configured (`MONGODB_URI` set) —
 * mirrors `isMongoConfigured()`. When Mongo is not configured, Mongo-gated
 * tests already skip themselves (see `test/helpers/test-env.ts`), so there
 * is nothing to isolate.
 */
if (process.env.MONGODB_URI?.trim()) {
  const isolatedDatabaseName = process.env[TEST_DATABASE_ENV_VAR]?.trim();

  if (!isolatedDatabaseName) {
    throw new Error(
      `${TEST_DATABASE_ENV_VAR} is required when MONGODB_URI is configured, but was not set. ` +
        `Run tests via "pnpm test" (apps/api/scripts/run-tests-recursively.ts), which generates and ` +
        "injects an isolated test database name automatically. Refusing to fall back to the " +
        "development database.",
    );
  }

  // Throws with a specific reason if the name is unsafe, forbidden (e.g. the
  // development database), or doesn't match the generated-name pattern.
  assertSafeTestDatabaseName(isolatedDatabaseName);

  process.env.MONGODB_DATABASE = isolatedDatabaseName;
  process.env.MONGODB_URI = rewriteMongoUriDatabase(process.env.MONGODB_URI, isolatedDatabaseName);

  // Locking here — before any repository has had a chance to call
  // `connectMongoClient()` — fixes the database for the rest of this
  // process's lifetime. Any later attempt to lock again (or any code that
  // mutates `process.env.MONGODB_DATABASE` afterward) has no effect: every
  // `resolveMongoConfig()` call keeps returning this exact, frozen config.
  lockMongoConfigForTests(resolveMongoConfig());

  console.log(`[test-setup] isolated Mongo test database: ${isolatedDatabaseName}`);
} else {
  console.log("[test-setup] MONGODB_URI is not configured; Mongo-gated tests will skip themselves.");
}
