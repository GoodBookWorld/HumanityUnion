/**
 * Verification-script Mongo database isolation.
 *
 * Lifecycle (required):
 *   isolation = activateVerificationDatabaseIsolation(...)
 *   try { run verification }
 *   finally {
 *     await isolation.cleanupDatabase()  // drops owned hu_verify_* DB
 *     isolation.restoreEnvironment()     // restores process.env only
 *   }
 *
 * Or simply: await isolation.dispose() in finally (cleanup then env restore).
 *
 * `restore()` / `restoreEnvironment()` deliberately do NOT drop the database.
 * Historical leak: callers treated restore() as full teardown. Database cleanup
 * is now explicit and also enforced by finalizeVerificationResources().
 */
import { createHash, randomBytes } from "node:crypto";

import {
  ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR,
  assertMayCreateEphemeralDatabase,
  assertSafeOwnedEphemeralDatabaseName,
  assessClusterCollectionPressure,
  dropOwnedEphemeralDatabase,
  formatCollectionPressureLog,
  isDiagnosticPreserveEnabled,
  KEEP_VERIFICATION_DATABASE_ENV_VAR,
  ProtectedDatabaseError,
  type CollectionPressureAssessment,
  VERIFICATION_DATABASE_PREFIX,
} from "../infrastructure/mongodb/ephemeral-mongo-database-safety.js";

const MEMORY_PERSISTENCE_KEYS = [
  "INITIATIVE_PERSISTENCE",
  "INITIATIVE_ANALYSIS_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE",
  "INITIATIVE_VERSION_REVISION_PERSISTENCE",
  "DECISION_SESSION_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_PERSISTENCE",
  "PUBLIC_CIVIC_ARCHIVE_PERSISTENCE",
  "INITIATIVE_PETITION_DRAFT_PERSISTENCE",
] as const;

export { VERIFICATION_DATABASE_PREFIX, KEEP_VERIFICATION_DATABASE_ENV_VAR };

export interface VerificationDatabaseCleanupResult {
  attempted: boolean;
  succeeded: boolean;
  preservedForDiagnostics: boolean;
  error: Error | null;
  databaseName: string;
}

export interface VerificationDatabaseIsolation {
  runId: string;
  verificationTask: string;
  /** Exact owned ephemeral database name for this run. */
  databaseName: string;
  /**
   * Environment restore only — does NOT drop the verification database.
   * Prefer `dispose()` or `cleanupDatabase()` + `restoreEnvironment()`.
   */
  restoreEnvironment: () => void;
  /**
   * @deprecated Alias of `restoreEnvironment()`. Does not drop the database.
   * Use `dispose()` for full teardown.
   */
  restore: () => void;
  /** Drop the owned hu_verify_* database (unless KEEP_VERIFICATION_DATABASE=1). */
  cleanupDatabase: () => Promise<VerificationDatabaseCleanupResult>;
  /** cleanupDatabase() then restoreEnvironment(). Safe to call more than once. */
  dispose: () => Promise<VerificationDatabaseCleanupResult>;
}

type ActiveIsolationRecord = {
  isolation: VerificationDatabaseIsolation;
};

const activeIsolations: ActiveIsolationRecord[] = [];

export function getActiveVerificationIsolationsForTests(): readonly VerificationDatabaseIsolation[] {
  return activeIsolations.map((entry) => entry.isolation);
}

export function clearActiveVerificationIsolationsForTests(): void {
  activeIsolations.length = 0;
}

function replaceMongoDatabase(uri: string, databaseName: string): string {
  const trimmed = uri.trim();

  if (!trimmed) {
    return trimmed;
  }

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?")) : "";
  const lastSlash = withoutQuery.lastIndexOf("/");

  if (lastSlash === -1) {
    return `${withoutQuery}/${databaseName}${query}`;
  }

  const prefix = withoutQuery.slice(0, lastSlash + 1);
  return `${prefix}${databaseName}${query}`;
}

/**
 * MongoDB Atlas (this project's configured cluster tier) enforces a hard
 * 38-byte database name limit. Prefix "hu_verify_" (10) + 16-hex digest stays
 * under the cap while remaining unique per runId.
 */
function buildVerificationDatabaseName(runId: string): string {
  const digest = createHash("sha256").update(runId).digest("hex").slice(0, 16);
  return `${VERIFICATION_DATABASE_PREFIX}${digest}`;
}

export interface ActivateVerificationDatabaseIsolationOptions {
  /** Skip live pressure assessment (unit tests). */
  skipPressureCheck?: boolean;
  /** Injected pressure assessment for tests. */
  pressureAssessment?: CollectionPressureAssessment;
  /** Injected drop implementation for tests. */
  dropDatabase?: (args: {
    uri: string;
    databaseName: string;
  }) => Promise<void>;
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  logError?: (message: string) => void;
}

export function activateVerificationDatabaseIsolation(
  verificationTask: string,
  options: ActivateVerificationDatabaseIsolationOptions = {},
): VerificationDatabaseIsolation {
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.log(message));
  const logError = options.logError ?? ((message: string) => console.error(message));

  const runId = `${verificationTask.toLowerCase()}-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const verifyDatabase = buildVerificationDatabaseName(runId);

  assertSafeOwnedEphemeralDatabaseName({
    databaseName: verifyDatabase,
    ownedDatabaseName: verifyDatabase,
    kind: "verify",
    env,
  });

  const previousEnv = new Map<string, string | undefined>();

  for (const key of [
    ...MEMORY_PERSISTENCE_KEYS,
    "MONGODB_DATABASE",
    "MONGODB_URI",
    "HU_VERIFICATION_MODE",
  ]) {
    previousEnv.set(key, env[key]);
  }

  const originalUri = env.MONGODB_URI?.trim() || "";
  let dropUri = originalUri;

  if (options.pressureAssessment) {
    const message = formatCollectionPressureLog(options.pressureAssessment);
    if (message) {
      log(message);
    }
    assertMayCreateEphemeralDatabase(options.pressureAssessment, {
      env,
      purpose: "hu_verify_* verification database",
    });
  } else if (!options.skipPressureCheck && originalUri) {
    throw new Error(
      "activateVerificationDatabaseIsolation requires skipPressureCheck or pressureAssessment when MONGODB_URI is set. Use activateVerificationDatabaseIsolationAsync().",
    );
  }

  env.HU_VERIFICATION_MODE = "true";

  for (const key of MEMORY_PERSISTENCE_KEYS) {
    env[key] = "memory";
  }

  if (originalUri) {
    dropUri = replaceMongoDatabase(originalUri, verifyDatabase);
    env.MONGODB_DATABASE = verifyDatabase;
    env.MONGODB_URI = dropUri;
  } else {
    env.MONGODB_DATABASE = verifyDatabase;
  }

  let environmentRestored = false;
  let cleanupCompleted = false;
  let lastCleanupResult: VerificationDatabaseCleanupResult | null = null;

  const restoreEnvironment = (): void => {
    if (environmentRestored) {
      return;
    }
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    environmentRestored = true;
  };

  const cleanupDatabase = async (): Promise<VerificationDatabaseCleanupResult> => {
    if (cleanupCompleted && lastCleanupResult) {
      return lastCleanupResult;
    }

    const base: VerificationDatabaseCleanupResult = {
      attempted: false,
      succeeded: true,
      preservedForDiagnostics: false,
      error: null,
      databaseName: verifyDatabase,
    };

    if (!dropUri) {
      cleanupCompleted = true;
      lastCleanupResult = base;
      return base;
    }

    if (isDiagnosticPreserveEnabled("verify", env)) {
      log(
        `[verification-isolation] ${KEEP_VERIFICATION_DATABASE_ENV_VAR}=1 — keeping owned verification database "${verifyDatabase}" for inspection.`,
      );
      cleanupCompleted = true;
      lastCleanupResult = {
        ...base,
        preservedForDiagnostics: true,
      };
      return lastCleanupResult;
    }

    try {
      if (options.dropDatabase) {
        assertSafeOwnedEphemeralDatabaseName({
          databaseName: verifyDatabase,
          ownedDatabaseName: verifyDatabase,
          kind: "verify",
          env,
        });
        await options.dropDatabase({ uri: dropUri, databaseName: verifyDatabase });
      } else {
        await dropOwnedEphemeralDatabase({
          uri: dropUri,
          databaseName: verifyDatabase,
          ownedDatabaseName: verifyDatabase,
          kind: "verify",
          verifyAbsent: true,
        });
      }
      log(`[verification-isolation] dropped owned verification database: ${verifyDatabase}`);
      cleanupCompleted = true;
      lastCleanupResult = { ...base, attempted: true, succeeded: true };
      return lastCleanupResult;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      logError(
        `[verification-isolation] WARNING: failed to drop owned verification database "${verifyDatabase}": ${normalized.message}`,
      );
      cleanupCompleted = true;
      lastCleanupResult = {
        ...base,
        attempted: true,
        succeeded: false,
        error: normalized,
      };
      return lastCleanupResult;
    }
  };

  const dispose = async (): Promise<VerificationDatabaseCleanupResult> => {
    try {
      return await cleanupDatabase();
    } finally {
      restoreEnvironment();
      const index = activeIsolations.findIndex((entry) => entry.isolation === isolation);
      if (index >= 0) {
        activeIsolations.splice(index, 1);
      }
    }
  };

  const isolation: VerificationDatabaseIsolation = {
    runId,
    verificationTask,
    databaseName: verifyDatabase,
    restoreEnvironment,
    restore: restoreEnvironment,
    cleanupDatabase,
    dispose,
  };

  activeIsolations.push({ isolation });
  return isolation;
}

/**
 * Async activator: enforces collection-pressure guard against live Mongo when
 * MONGODB_URI is configured, then activates isolation.
 */
export async function activateVerificationDatabaseIsolationAsync(
  verificationTask: string,
  options: ActivateVerificationDatabaseIsolationOptions = {},
): Promise<VerificationDatabaseIsolation> {
  const env = options.env ?? process.env;
  const log = options.log ?? ((message: string) => console.log(message));
  const uri = env.MONGODB_URI?.trim();

  if (!options.skipPressureCheck && uri && !options.pressureAssessment) {
    const assessment = await assessClusterCollectionPressure(uri);
    const message = formatCollectionPressureLog(assessment);
    if (message) {
      log(message);
    }
    assertMayCreateEphemeralDatabase(assessment, {
      env,
      purpose: "hu_verify_* verification database",
    });
    return activateVerificationDatabaseIsolation(verificationTask, {
      ...options,
      skipPressureCheck: true,
      pressureAssessment: assessment,
    });
  }

  return activateVerificationDatabaseIsolation(verificationTask, {
    ...options,
    skipPressureCheck: options.skipPressureCheck ?? !uri,
  });
}

/**
 * Dispose every still-active verification isolation (DB cleanup + env restore).
 * Called from finalizeVerificationResources so scripts that only call
 * restoreEnvironment()/restore() still drop their owned database.
 */
export async function disposeActiveVerificationIsolations(): Promise<VerificationDatabaseCleanupResult[]> {
  const pending = [...activeIsolations];
  const results: VerificationDatabaseCleanupResult[] = [];
  for (const entry of pending) {
    results.push(await entry.isolation.dispose());
  }
  return results;
}

export function assertVerificationDatabaseIsolated(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.HU_VERIFICATION_MODE !== "true") {
    throw new Error("Verification fixture mutations require HU_VERIFICATION_MODE=true.");
  }

  const database = env.MONGODB_DATABASE?.trim();

  if (database === "humanity_union_dev" || database === "humanity_union_staging") {
    throw new Error(`Verification must not use ${database}.`);
  }

  if (database && isProtectedDatabaseNameForAssert(database, env)) {
    throw new ProtectedDatabaseError(database, "verification must use an isolated hu_verify_* database");
  }

  if (database && !database.startsWith(VERIFICATION_DATABASE_PREFIX)) {
    throw new Error(`Verification must use an isolated database, received "${database}".`);
  }
}

function isProtectedDatabaseNameForAssert(database: string, env: NodeJS.ProcessEnv): boolean {
  try {
    assertSafeOwnedEphemeralDatabaseName({
      databaseName: database,
      ownedDatabaseName: database,
      kind: "verify",
      env,
    });
    return false;
  } catch (error) {
    return error instanceof ProtectedDatabaseError;
  }
}

/** Re-export override flag name for docs/tests. */
export { ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR };
