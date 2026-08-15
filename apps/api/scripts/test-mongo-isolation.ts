/**
 * Recovery Task 30 — Mongo test-database isolation.
 *
 * Root cause this addresses:
 *
 *   `apps/api/test/helpers/test-setup.ts` loads `apps/api/.env`, which sets
 *   `MONGODB_DATABASE=humanity_union_dev`. Every Mongo-backed repository
 *   (outbox, processed events, workspace projections, Activity, Participant
 *   Action, …) resolves its database through the single shared
 *   `resolveMongoConfig()` / `connectMongoClient()` chokepoint
 *   (`apps/api/src/infrastructure/mongodb/`), so the test suite and any
 *   concurrently running `dev:api` process end up reading and writing the
 *   *same* physical database. That shared state is the mechanism behind the
 *   intermittent failures observed in Recovery Tasks 25–29.
 *
 * Fix:
 *
 *   Generate one unique, throwaway database name per complete `pnpm test`
 *   invocation (see `generateIsolatedTestDatabaseName`), inject it into the
 *   test child process via `MONGODB_TEST_DATABASE`, and have
 *   `test/helpers/test-setup.ts` point the shared Mongo config at it before
 *   any repository connects. This module is the shared, narrow companion
 *   used by both the parent runner (name generation + owned cleanup) and the
 *   test-setup preload (name validation), so neither duplicates the other's
 *   safety rules.
 */
import { randomBytes } from "node:crypto";
import { MongoClient } from "mongodb";

/** Environment variable the parent test runner uses to inject the isolated database name into the test child process. */
export const TEST_DATABASE_ENV_VAR = "MONGODB_TEST_DATABASE";

/** Opt-in escape hatch: when set to "1", the runner skips dropping the isolated database at the end of the run. */
export const KEEP_TEST_DATABASE_ENV_VAR = "KEEP_TEST_DATABASE";

/**
 * Every generated test database name matches this pattern. Anything a test
 * process (or a human) passes in that does *not* match this pattern is
 * rejected outright, regardless of the forbidden-name list below.
 */
export const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

/**
 * MongoDB Atlas (the environment this repository actually runs against, per
 * `apps/api/.env`) rejects database names longer than 38 bytes with a hard
 * server-side error (`AtlasError` code 8000) — discovered while building
 * this isolation mechanism, when a naive
 * `hu_test_<ms-timestamp>_<pid>_<hex>` name came out to 41+ characters.
 * Enforced here as a fail-fast client-side guard so an oversized name is
 * rejected with a clear message instead of an opaque server error deep
 * inside a repository call.
 */
export const MAX_TEST_DATABASE_NAME_BYTES = 38;

/**
 * Names that must never be treated as an isolated test database, even if a
 * caller somehow constructed a string that happened to match
 * `TEST_DATABASE_NAME_PATTERN`. Includes the repository's actual default
 * (`humanity_union`, see `mongo-config.ts`) and development (`humanity_union_dev`,
 * see `apps/api/.env`) database names, plus MongoDB's own reserved system
 * databases and other generic names called out by Recovery Task 30.
 */
export const FORBIDDEN_TEST_DATABASE_NAMES: ReadonlySet<string> = new Set([
  "",
  "humanity_union",
  "humanity_union_dev",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

export class UnsafeTestDatabaseNameError extends Error {
  constructor(name: string, reason: string) {
    super(`Refusing to use "${name}" as an isolated test database: ${reason}`);
    this.name = "UnsafeTestDatabaseNameError";
  }
}

/**
 * Generates a stable, unique-enough test-run identifier of the shape
 * `hu_test_<timestamp>_<pid>_<randomSuffix>` (Recovery Task 30, Part 3),
 * encoded in base36 to stay comfortably under the 38-byte database-name
 * limit enforced by MongoDB Atlas (see {@link MAX_TEST_DATABASE_NAME_BYTES}).
 * A base-10/hex encoding of the same three components would already exceed
 * 38 bytes on its own.
 *
 * Deliberately includes both the process id and a random suffix (not just a
 * timestamp) so that two runs started within the same millisecond — e.g. two
 * concurrent `pnpm test` invocations on the same machine — still receive
 * different names.
 */
export function generateIsolatedTestDatabaseName(): string {
  const timestamp = Date.now().toString(36);
  const pid = process.pid.toString(36);
  const randomSuffix = randomBytes(4).toString("hex");
  const name = `hu_test_${timestamp}_${pid}_${randomSuffix}`;

  // Defensive: this should be unreachable given the encodings above, but a
  // silently oversized generated name would be worse than a loud crash here.
  assertSafeTestDatabaseName(name);

  return name;
}

/** Returns `true` only if `name` matches the safe pattern, is not on the forbidden list, and fits within the Atlas name-length limit. */
export function isSafeTestDatabaseName(name: string): boolean {
  if (FORBIDDEN_TEST_DATABASE_NAMES.has(name)) {
    return false;
  }
  if (Buffer.byteLength(name, "utf-8") > MAX_TEST_DATABASE_NAME_BYTES) {
    return false;
  }
  return TEST_DATABASE_NAME_PATTERN.test(name);
}

/** Throws {@link UnsafeTestDatabaseNameError} unless `name` is a safe, generated isolated-test-database name. */
export function assertSafeTestDatabaseName(name: string | undefined | null): asserts name is string {
  if (!name || !name.trim()) {
    throw new UnsafeTestDatabaseNameError(String(name ?? ""), "the name is missing or empty");
  }
  const trimmed = name.trim();
  if (FORBIDDEN_TEST_DATABASE_NAMES.has(trimmed)) {
    throw new UnsafeTestDatabaseNameError(
      trimmed,
      "it is a forbidden name (production, development, default application database, or a reserved MongoDB system database)",
    );
  }
  if (!TEST_DATABASE_NAME_PATTERN.test(trimmed)) {
    throw new UnsafeTestDatabaseNameError(
      trimmed,
      `it does not match the required pattern ${TEST_DATABASE_NAME_PATTERN}`,
    );
  }
  const byteLength = Buffer.byteLength(trimmed, "utf-8");
  if (byteLength > MAX_TEST_DATABASE_NAME_BYTES) {
    throw new UnsafeTestDatabaseNameError(
      trimmed,
      `it is ${byteLength} bytes long, exceeding the ${MAX_TEST_DATABASE_NAME_BYTES}-byte MongoDB Atlas database-name limit`,
    );
  }
}

/**
 * Rewrites the database-path segment of a MongoDB connection string to
 * `databaseName`, leaving host/credentials/query string untouched. Mirrors
 * the existing `apps/api/src/scripts/verification-database-isolation.ts`
 * helper (kept as a small, self-contained duplicate here rather than a
 * cross-import, since verification isolation remains independently
 * controlled per Recovery Task 30 Part 4).
 *
 * Functionally this is defense-in-depth only: `getMongoDatabase()` always
 * selects the working database via `MONGODB_DATABASE` (`client.db(name)`),
 * not the URI's path segment, so correctness does not depend on this
 * rewrite — but keeping the two in sync avoids a misleading URI in logs or
 * diagnostics.
 */
export function rewriteMongoUriDatabase(uri: string, databaseName: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return trimmed;
  }

  const queryIndex = trimmed.indexOf("?");
  const withoutQuery = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : trimmed.slice(queryIndex);

  // Search for the path-segment slash *after* the "scheme://" separator, not
  // the "//" inside the scheme separator itself — a bare authority with no
  // database path (e.g. "mongodb://localhost:27017") must not have its host
  // truncated by naively taking the last "/" in the whole string.
  const schemeSeparatorIndex = withoutQuery.indexOf("://");
  const searchFrom = schemeSeparatorIndex === -1 ? 0 : schemeSeparatorIndex + 3;
  const pathSlashIndex = withoutQuery.indexOf("/", searchFrom);

  if (pathSlashIndex === -1) {
    return `${withoutQuery}/${databaseName}${query}`;
  }

  return `${withoutQuery.slice(0, pathSlashIndex + 1)}${databaseName}${query}`;
}

export interface DropIsolatedTestDatabaseOptions {
  uri: string;
  databaseName: string;
  /** Bounded wait for the drop to complete before giving up (Recovery Task 30 Part 8: "SIGINT/SIGTERM cleanup is best-effort and bounded"). */
  timeoutMs?: number;
}

/**
 * Drops exactly one database — the isolated test database owned by this run
 * — and nothing else. Refuses outright (via {@link assertSafeTestDatabaseName})
 * if `databaseName` is not a safe, generated test-database name, so this
 * function can never be used to drop the development or production database
 * even if called incorrectly.
 *
 * Uses its own short-lived `MongoClient`, entirely separate from the
 * application's shared connection singleton (`mongo-connection.ts`), because
 * this runs in the parent test-runner process, which never loads any
 * application/repository code.
 */
export async function dropIsolatedTestDatabase(options: DropIsolatedTestDatabaseOptions): Promise<void> {
  assertSafeTestDatabaseName(options.databaseName);

  const timeoutMs = options.timeoutMs ?? 10_000;

  const dropPromise = (async () => {
    const client = new MongoClient(options.uri, {
      connectTimeoutMS: Math.min(timeoutMs, 5_000),
      serverSelectionTimeoutMS: Math.min(timeoutMs, 5_000),
    });
    try {
      await client.connect();
      await client.db(options.databaseName).dropDatabase();
    } finally {
      await client.close();
    }
  })();

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Dropping isolated test database "${options.databaseName}" timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([dropPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    // If the timeout won the race, `dropPromise` keeps running in the
    // background; prevent it from surfacing as an unhandled rejection once
    // it eventually settles.
    dropPromise.catch(() => {});
  }
}
