/**
 * Recovery Task 30 — Mongo test-database isolation.
 * Pack 01 — hardening: protected DB contract, owned drop verification,
 * collection-pressure gate before create.
 *
 * Root cause this addresses:
 *
 *   `apps/api/test/helpers/test-setup.ts` loads `apps/api/.env`, which sets
 *   `MONGODB_DATABASE=humanity_union_dev`. Every Mongo-backed repository
 *   resolves its database through the shared `resolveMongoConfig()` /
 *   `connectMongoClient()` chokepoint, so the test suite and any concurrently
 *   running `dev:api` process end up reading and writing the same physical
 *   database without isolation.
 *
 * Fix:
 *
 *   Generate one unique, throwaway database name per complete `pnpm test`
 *   invocation, inject it via `MONGODB_TEST_DATABASE`, and drop that one
 *   owned database in finally — unless KEEP_TEST_DATABASE=1 (diagnostic only).
 */
import { randomBytes } from "node:crypto";

import {
  assertMayCreateEphemeralDatabase,
  assertSafeOwnedEphemeralDatabaseName,
  assessClusterCollectionPressure,
  type CollectionPressureAssessment,
  dropOwnedEphemeralDatabase,
  formatCollectionPressureLog,
  isProtectedDatabaseName,
  KEEP_TEST_DATABASE_ENV_VAR,
  MAX_EPHEMERAL_DATABASE_NAME_BYTES,
  PROTECTED_DATABASE_NAMES,
  TEST_DATABASE_NAME_PATTERN,
  TEST_DATABASE_PREFIX,
  UnsafeEphemeralDatabaseNameError,
} from "../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";

export {
  KEEP_TEST_DATABASE_ENV_VAR,
  TEST_DATABASE_NAME_PATTERN,
  TEST_DATABASE_PREFIX,
};

/** Environment variable the parent test runner uses to inject the isolated database name into the test child process. */
export const TEST_DATABASE_ENV_VAR = "MONGODB_TEST_DATABASE";

export const MAX_TEST_DATABASE_NAME_BYTES = MAX_EPHEMERAL_DATABASE_NAME_BYTES;

/**
 * Names that must never be treated as an isolated test database.
 * Includes staging/dev/production-shaped names and Mongo system DBs.
 */
export const FORBIDDEN_TEST_DATABASE_NAMES: ReadonlySet<string> = new Set([
  "",
  ...PROTECTED_DATABASE_NAMES,
]);

export class UnsafeTestDatabaseNameError extends UnsafeEphemeralDatabaseNameError {
  constructor(name: string, reason: string) {
    super(name, reason);
    this.name = "UnsafeTestDatabaseNameError";
  }
}

export function generateIsolatedTestDatabaseName(): string {
  const timestamp = Date.now().toString(36);
  const pid = process.pid.toString(36);
  const randomSuffix = randomBytes(4).toString("hex");
  const name = `${TEST_DATABASE_PREFIX}${timestamp}_${pid}_${randomSuffix}`;
  assertSafeTestDatabaseName(name);
  return name;
}

export function isSafeTestDatabaseName(name: string): boolean {
  try {
    assertSafeTestDatabaseName(name);
    return true;
  } catch {
    return false;
  }
}

export function assertSafeTestDatabaseName(name: string | undefined | null): asserts name is string {
  if (!name || !name.trim()) {
    throw new UnsafeTestDatabaseNameError(String(name ?? ""), "the name is missing or empty");
  }
  const trimmed = name.trim();
  if (isProtectedDatabaseName(trimmed) || FORBIDDEN_TEST_DATABASE_NAMES.has(trimmed)) {
    throw new UnsafeTestDatabaseNameError(
      trimmed,
      "it is a forbidden/protected name (staging, development, production, default application database, or a reserved MongoDB system database)",
    );
  }
  try {
    assertSafeOwnedEphemeralDatabaseName({
      databaseName: trimmed,
      ownedDatabaseName: trimmed,
      kind: "test",
    });
  } catch (error) {
    if (error instanceof UnsafeEphemeralDatabaseNameError) {
      const reason = error.message.replace(/^Refusing ephemeral database "[^"]+": /, "");
      throw new UnsafeTestDatabaseNameError(trimmed, reason);
    }
    throw error;
  }
}

/**
 * Rewrites the database-path segment of a MongoDB connection string to
 * `databaseName`, leaving host/credentials/query string untouched.
 */
export function rewriteMongoUriDatabase(uri: string, databaseName: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return trimmed;
  }

  const queryIndex = trimmed.indexOf("?");
  const withoutQuery = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : trimmed.slice(queryIndex);

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
  timeoutMs?: number;
  verifyAbsent?: boolean;
  connectAndDrop?: (args: {
    uri: string;
    databaseName: string;
    timeoutMs: number;
  }) => Promise<void>;
  listDatabaseNames?: (uri: string, timeoutMs: number) => Promise<string[]>;
}

/**
 * Drops exactly one owned isolated test database. Refuses protected names and
 * any name that is not a safe hu_test_* ephemeral database.
 */
export async function dropIsolatedTestDatabase(options: DropIsolatedTestDatabaseOptions): Promise<void> {
  assertSafeTestDatabaseName(options.databaseName);

  await dropOwnedEphemeralDatabase({
    uri: options.uri,
    databaseName: options.databaseName,
    ownedDatabaseName: options.databaseName,
    kind: "test",
    timeoutMs: options.timeoutMs,
    verifyAbsent: options.verifyAbsent ?? true,
    connectAndDrop: options.connectAndDrop,
    listDatabaseNames: options.listDatabaseNames,
  });
}

export interface EnsureEphemeralTestDatabaseAllowedOptions {
  uri: string;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  assessPressure?: (uri: string) => Promise<CollectionPressureAssessment>;
}

/**
 * Collection-pressure gate before creating a new hu_test_* database.
 * Does not block production/staging API startup — only ephemeral test creation.
 */
export async function ensureEphemeralTestDatabaseCreationAllowed(
  options: EnsureEphemeralTestDatabaseAllowedOptions,
): Promise<void> {
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.log(message));
  const assessment =
    options.assessPressure !== undefined
      ? await options.assessPressure(options.uri)
      : await assessClusterCollectionPressure(options.uri);
  const message = formatCollectionPressureLog(assessment);
  if (message) {
    log(message);
  }
  assertMayCreateEphemeralDatabase(assessment, {
    env,
    purpose: "hu_test_* test database",
  });
}
