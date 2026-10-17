/**
 * Test-only gate for an explicit isolated MongoDB database.
 *
 * This module does not read MONGODB_URI or MONGODB_DATABASE. Callers must
 * pass the connection and the database name. A missing, malformed, or
 * protected target is rejected before any client is created.
 */
import {
  isProtectedDatabaseName,
  MAX_EPHEMERAL_DATABASE_NAME_BYTES,
  TEST_DATABASE_NAME_PATTERN,
} from "./ephemeral-mongo-database-safety.js";
import { getLockedMongoConfigForTests, lockMongoConfigForTests } from "./mongo-config.js";

export class ExplicitIsolatedMongoTestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplicitIsolatedMongoTestError";
  }
}

let explicitIsolatedTestLocked = false;

export function assertExplicitIsolatedMongoTestTarget(input: {
  uri: string | null | undefined;
  database: string | null | undefined;
}): { uri: string; database: string } {
  const database = input.database?.trim() ?? "";
  if (!database) {
    throw new ExplicitIsolatedMongoTestError("An explicit isolated test database name is required.");
  }
  if (databaseLooksUnsafeToReport(database)) {
    throw new ExplicitIsolatedMongoTestError("The isolated test database name is malformed.");
  }
  if (isProtectedTestDatabase(database)) {
    throw new ExplicitIsolatedMongoTestError("The isolated test database name is protected.");
  }
  if (
    !TEST_DATABASE_NAME_PATTERN.test(database) ||
    Buffer.byteLength(database) > MAX_EPHEMERAL_DATABASE_NAME_BYTES
  ) {
    throw new ExplicitIsolatedMongoTestError(
      "The isolated test database name is not an owned hu_test_ database.",
    );
  }

  const uri = input.uri?.trim() ?? "";
  if (!uri) {
    throw new ExplicitIsolatedMongoTestError("An explicit isolated test connection is required.");
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new ExplicitIsolatedMongoTestError(
      "The isolated test connection must be a MongoDB connection string.",
    );
  }

  const pathName = uriPathDatabase(uri);
  if (pathName === undefined) {
    throw new ExplicitIsolatedMongoTestError("The isolated test connection string is malformed.");
  }
  if (pathName !== null && (isProtectedTestDatabase(pathName) || pathName !== database)) {
    throw new ExplicitIsolatedMongoTestError(
      "The isolated test connection does not name the same hu_test_ database.",
    );
  }

  return { uri, database };
}

/**
 * Locks the shared test client to the supplied connection. Requires
 * NODE_TEST_ENV=true. Does not open a connection.
 */
export function lockExplicitIsolatedMongoTestConfig(input: {
  uri: string | null | undefined;
  database: string | null | undefined;
}): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new ExplicitIsolatedMongoTestError(
      "Isolated test Mongo configuration is available only when NODE_TEST_ENV=true.",
    );
  }

  const target = assertExplicitIsolatedMongoTestTarget(input);
  lockMongoConfigForTests({
    uri: target.uri,
    database: target.database,
    connectTimeoutMs: 10_000,
    serverSelectionTimeoutMs: 10_000,
    maxPoolSize: 5,
  });
  explicitIsolatedTestLocked = true;
}

/** True only after a successful explicit lock whose database is still an owned hu_test_ name. */
export function isExplicitIsolatedMongoTest(): boolean {
  if (process.env.NODE_TEST_ENV !== "true" || !explicitIsolatedTestLocked) {
    return false;
  }

  const locked = getLockedMongoConfigForTests();
  if (!locked?.uri) {
    return false;
  }

  try {
    assertExplicitIsolatedMongoTestTarget({ uri: locked.uri, database: locked.database });
    return true;
  } catch {
    return false;
  }
}

function isProtectedTestDatabase(databaseName: string): boolean {
  const lowered = databaseName.toLowerCase();
  return (
    isProtectedDatabaseName(databaseName) ||
    lowered === "staging" ||
    lowered.includes("staging") ||
    lowered.includes("production")
  );
}

function databaseLooksUnsafeToReport(databaseName: string): boolean {
  return (
    databaseName.includes("://") ||
    databaseName.includes("@") ||
    databaseName.includes("/") ||
    databaseName.includes(" ") ||
    databaseName.includes("?")
  );
}

/** Null when the URI has no database path. Undefined when the path is not a single database name. */
function uriPathDatabase(uri: string): string | null | undefined {
  const queryIndex = uri.indexOf("?");
  const withoutQuery = queryIndex === -1 ? uri : uri.slice(0, queryIndex);
  const schemeSeparatorIndex = withoutQuery.indexOf("://");
  if (schemeSeparatorIndex === -1) {
    return undefined;
  }

  const pathSlashIndex = withoutQuery.indexOf("/", schemeSeparatorIndex + 3);
  if (pathSlashIndex === -1) {
    return null;
  }

  const path = withoutQuery.slice(pathSlashIndex + 1);
  if (!path) {
    return null;
  }
  if (path.includes("/")) {
    return undefined;
  }

  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
}
