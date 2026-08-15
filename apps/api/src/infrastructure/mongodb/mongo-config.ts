export interface MongoConfig {
  uri: string | null;
  database: string;
  connectTimeoutMs: number;
  serverSelectionTimeoutMs: number;
  maxPoolSize: number;
}

/**
 * Recovery Task 30 — narrow test-isolation seam.
 *
 * When set, `resolveMongoConfig()` returns this exact object instead of
 * re-reading `process.env`, so the database this process talks to is fixed
 * for the remainder of its lifetime. This exists solely so the API test
 * suite can lock in its isolated per-run database name (see
 * `apps/api/test/helpers/test-setup.ts` and
 * `apps/api/scripts/test-mongo-isolation.ts`) *before* any repository makes
 * its first connection, and so nothing afterward — accidentally or
 * otherwise — can change which database the process is talking to.
 *
 * Outside of test mode this is never populated and `resolveMongoConfig()`
 * behaves exactly as before: production/development behavior is unchanged.
 */
let lockedTestConfig: MongoConfig | null = null;

/**
 * Locks `resolveMongoConfig()` to always return `config` for the lifetime of
 * this process. May only be called once, and only when `NODE_TEST_ENV` is
 * `"true"` — this is a test-only seam, not a general-purpose API.
 *
 * @throws {Error} If `NODE_TEST_ENV` is not `"true"`.
 * @throws {Error} If a configuration is already locked (prevents later mutation).
 */
export function lockMongoConfigForTests(config: MongoConfig): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("lockMongoConfigForTests() may only be called when NODE_TEST_ENV=true.");
  }
  if (lockedTestConfig) {
    throw new Error(
      `Mongo test configuration is already locked to database "${lockedTestConfig.database}" and cannot be changed.`,
    );
  }
  lockedTestConfig = Object.freeze({ ...config });
}

/** Test-only: returns the currently locked test config, if any. Used by focused tests to assert lock state. */
export function getLockedMongoConfigForTests(): MongoConfig | null {
  return lockedTestConfig;
}

export function resolveMongoConfig(): MongoConfig {
  if (lockedTestConfig) {
    return lockedTestConfig;
  }

  const uri = process.env.MONGODB_URI?.trim() || null;

  return {
    uri,
    database: process.env.MONGODB_DATABASE?.trim() || "humanity_union",
    connectTimeoutMs: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 10_000),
    serverSelectionTimeoutMs: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10_000),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
  };
}

export function isMongoConfigured(): boolean {
  return Boolean(resolveMongoConfig().uri);
}

export function assertMongoConfigured(): string {
  const uri = resolveMongoConfig().uri;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}
