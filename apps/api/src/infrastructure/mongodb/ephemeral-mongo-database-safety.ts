/**
 * Central safety contract for ephemeral Mongo test/verification databases.
 *
 * Fail-closed rules:
 * - Never drop protected canonical databases.
 * - Never accept arbitrary database names for dropDatabase.
 * - Only drop a run-owned ephemeral DB whose exact name was tracked by the
 *   current process (hu_test_* or hu_verify_*).
 * - No automatic wildcard / historical bulk cleanup.
 */

import { MongoClient } from "mongodb";

/** Typical Atlas shared/Flex/M0-class hard limit (collections per cluster). */
export const DEFAULT_CLUSTER_COLLECTION_LIMIT = 500;

/**
 * Collection-pressure thresholds for ephemeral DB creation only.
 * These do not gate production/staging API startup.
 */
export const COLLECTION_PRESSURE_THRESHOLDS = Object.freeze({
  /** Below this: OK */
  okBelow: 300,
  /** Inclusive start of INFO / growing pressure */
  infoFrom: 300,
  /** Inclusive start of WARNING */
  warningFrom: 350,
  /** Inclusive start of HIGH RISK — refuse new ephemeral DB by default */
  highRiskFrom: 425,
});

export const KEEP_TEST_DATABASE_ENV_VAR = "KEEP_TEST_DATABASE";
export const KEEP_VERIFICATION_DATABASE_ENV_VAR = "KEEP_VERIFICATION_DATABASE";
/** Diagnostic override: allow creating a new ephemeral DB even under high-risk pressure. */
export const ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR =
  "ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE";

export const TEST_DATABASE_PREFIX = "hu_test_";
export const VERIFICATION_DATABASE_PREFIX = "hu_verify_";

export const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;
export const VERIFICATION_DATABASE_NAME_PATTERN = /^hu_verify_[a-zA-Z0-9_]+$/;

export const MAX_EPHEMERAL_DATABASE_NAME_BYTES = 38;

/**
 * Databases that automated test/verify cleanup must never delete.
 * Includes staging/dev plus production-shaped defaults and Mongo system DBs.
 */
export const PROTECTED_DATABASE_NAMES: ReadonlySet<string> = new Set([
  "humanity_union_staging",
  "humanity_union_dev",
  "humanity_union_production",
  "humanity_union",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

export type EphemeralDatabaseKind = "test" | "verify";
export type CollectionPressureLevel = "ok" | "info" | "warning" | "high_risk";

export class ProtectedDatabaseError extends Error {
  constructor(databaseName: string, detail: string) {
    super(`Refusing database operation on protected name "${databaseName}": ${detail}`);
    this.name = "ProtectedDatabaseError";
  }
}

export class UnsafeEphemeralDatabaseNameError extends Error {
  constructor(databaseName: string, reason: string) {
    super(`Refusing ephemeral database "${databaseName}": ${reason}`);
    this.name = "UnsafeEphemeralDatabaseNameError";
  }
}

export class CollectionPressureError extends Error {
  readonly level: CollectionPressureLevel;
  readonly totalCollections: number;

  constructor(level: CollectionPressureLevel, totalCollections: number, message: string) {
    super(message);
    this.name = "CollectionPressureError";
    this.level = level;
    this.totalCollections = totalCollections;
  }
}

export interface CollectionPressureAssessment {
  totalCollections: number;
  clusterLimit: number;
  level: CollectionPressureLevel;
  mayCreateEphemeralDatabase: boolean;
}

export interface DropOwnedEphemeralDatabaseOptions {
  uri: string;
  /** Exact run-owned name; must equal the name being dropped. */
  ownedDatabaseName: string;
  databaseName: string;
  kind: EphemeralDatabaseKind;
  timeoutMs?: number;
  /** When true, listDatabases after drop and assert absence. */
  verifyAbsent?: boolean;
  /**
   * Optional injectables for unit tests (no live Mongo).
   * Production callers omit these.
   */
  connectAndDrop?: (args: {
    uri: string;
    databaseName: string;
    timeoutMs: number;
  }) => Promise<void>;
  listDatabaseNames?: (uri: string, timeoutMs: number) => Promise<string[]>;
}

export interface DropOwnedEphemeralDatabaseResult {
  dropped: boolean;
  verifiedAbsent: boolean;
  preservedForDiagnostics: boolean;
}

function patternForKind(kind: EphemeralDatabaseKind): RegExp {
  return kind === "test" ? TEST_DATABASE_NAME_PATTERN : VERIFICATION_DATABASE_NAME_PATTERN;
}

function prefixForKind(kind: EphemeralDatabaseKind): string {
  return kind === "test" ? TEST_DATABASE_PREFIX : VERIFICATION_DATABASE_PREFIX;
}

/** Resolve additional protected names from the current process environment. */
export function resolveConfiguredProtectedDatabaseNames(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<string> {
  const names = new Set(PROTECTED_DATABASE_NAMES);
  const configured = env.MONGODB_DATABASE?.trim();
  if (configured) {
    const isEphemeral =
      TEST_DATABASE_NAME_PATTERN.test(configured) ||
      VERIFICATION_DATABASE_NAME_PATTERN.test(configured);
    if (!isEphemeral) {
      names.add(configured);
    }
  }
  return names;
}

export function isProtectedDatabaseName(
  databaseName: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const trimmed = databaseName.trim();
  if (!trimmed) {
    return true;
  }
  return resolveConfiguredProtectedDatabaseNames(env).has(trimmed);
}

export function classifyCollectionPressure(
  totalCollections: number,
  clusterLimit: number = DEFAULT_CLUSTER_COLLECTION_LIMIT,
): CollectionPressureAssessment {
  const { okBelow, infoFrom, warningFrom, highRiskFrom } = COLLECTION_PRESSURE_THRESHOLDS;
  let level: CollectionPressureLevel = "ok";
  if (totalCollections >= highRiskFrom) {
    level = "high_risk";
  } else if (totalCollections >= warningFrom) {
    level = "warning";
  } else if (totalCollections >= infoFrom) {
    level = "info";
  } else if (totalCollections >= okBelow) {
    level = "ok";
  }

  return {
    totalCollections,
    clusterLimit,
    level,
    mayCreateEphemeralDatabase: level !== "high_risk",
  };
}

export function assertMayCreateEphemeralDatabase(
  assessment: CollectionPressureAssessment,
  options: {
    env?: NodeJS.ProcessEnv;
    purpose?: string;
  } = {},
): void {
  const env = options.env ?? process.env;
  const purpose = options.purpose ?? "ephemeral test/verification database";
  const override = env[ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR] === "1";

  if (assessment.level === "high_risk" && !override) {
    throw new CollectionPressureError(
      assessment.level,
      assessment.totalCollections,
      `HIGH RISK collection pressure (${assessment.totalCollections}/${assessment.clusterLimit}) — refusing to create a new ${purpose}. Set ${ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE_ENV_VAR}=1 only for explicit diagnostics.`,
    );
  }
}

export function formatCollectionPressureLog(assessment: CollectionPressureAssessment): string | null {
  const { totalCollections, clusterLimit, level } = assessment;
  if (level === "ok") {
    return null;
  }
  if (level === "info") {
    return `[mongo-pressure] INFO: cluster collection count growing (${totalCollections}/${clusterLimit}).`;
  }
  if (level === "warning") {
    return `[mongo-pressure] WARNING: elevated collection pressure (${totalCollections}/${clusterLimit}). Prefer cleaning abandoned hu_test_*/hu_verify_* residue before more isolation runs.`;
  }
  return `[mongo-pressure] HIGH RISK: ${totalCollections}/${clusterLimit} collections — new ephemeral DB creation blocked unless diagnostic override is set.`;
}

/**
 * Asserts `databaseName` is a safe owned ephemeral DB of the given kind.
 * Fail-closed: protected names, wrong prefix, ownership mismatch, length, etc.
 */
export function assertSafeOwnedEphemeralDatabaseName(options: {
  databaseName: string;
  ownedDatabaseName: string;
  kind: EphemeralDatabaseKind;
  env?: NodeJS.ProcessEnv;
}): void {
  const { kind } = options;
  const databaseName = options.databaseName?.trim() ?? "";
  const ownedDatabaseName = options.ownedDatabaseName?.trim() ?? "";
  const env = options.env ?? process.env;

  if (!databaseName) {
    throw new UnsafeEphemeralDatabaseNameError(String(options.databaseName ?? ""), "name is missing or empty");
  }
  if (!ownedDatabaseName) {
    throw new UnsafeEphemeralDatabaseNameError(databaseName, "owned database name is missing");
  }
  if (databaseName !== ownedDatabaseName) {
    throw new UnsafeEphemeralDatabaseNameError(
      databaseName,
      `does not match run-owned name "${ownedDatabaseName}"`,
    );
  }
  if (isProtectedDatabaseName(databaseName, env)) {
    throw new ProtectedDatabaseError(
      databaseName,
      "protected canonical/system databases cannot be dropped by ephemeral cleanup",
    );
  }
  if (!databaseName.startsWith(prefixForKind(kind))) {
    throw new UnsafeEphemeralDatabaseNameError(
      databaseName,
      `must start with ${prefixForKind(kind)}`,
    );
  }
  if (!patternForKind(kind).test(databaseName)) {
    throw new UnsafeEphemeralDatabaseNameError(
      databaseName,
      `does not match required pattern ${patternForKind(kind)}`,
    );
  }
  const byteLength = Buffer.byteLength(databaseName, "utf-8");
  if (byteLength > MAX_EPHEMERAL_DATABASE_NAME_BYTES) {
    throw new UnsafeEphemeralDatabaseNameError(
      databaseName,
      `is ${byteLength} bytes long, exceeding the ${MAX_EPHEMERAL_DATABASE_NAME_BYTES}-byte Atlas database-name limit`,
    );
  }
}

async function defaultConnectAndDrop(args: {
  uri: string;
  databaseName: string;
  timeoutMs: number;
}): Promise<void> {
  const client = new MongoClient(args.uri, {
    connectTimeoutMS: Math.min(args.timeoutMs, 5_000),
    serverSelectionTimeoutMS: Math.min(args.timeoutMs, 5_000),
  });
  try {
    await client.connect();
    await client.db(args.databaseName).dropDatabase();
  } finally {
    await client.close();
  }
}

async function defaultListDatabaseNames(uri: string, timeoutMs: number): Promise<string[]> {
  const client = new MongoClient(uri, {
    connectTimeoutMS: Math.min(timeoutMs, 5_000),
    serverSelectionTimeoutMS: Math.min(timeoutMs, 5_000),
  });
  try {
    await client.connect();
    const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
    return databases.map((entry) => entry.name);
  } finally {
    await client.close();
  }
}

/**
 * Drops exactly one run-owned ephemeral database. Never accepts untrusted
 * arbitrary names: ownership + kind + protected-name checks are mandatory.
 */
export async function dropOwnedEphemeralDatabase(
  options: DropOwnedEphemeralDatabaseOptions,
): Promise<DropOwnedEphemeralDatabaseResult> {
  assertSafeOwnedEphemeralDatabaseName({
    databaseName: options.databaseName,
    ownedDatabaseName: options.ownedDatabaseName,
    kind: options.kind,
  });

  const timeoutMs = options.timeoutMs ?? 10_000;
  const connectAndDrop = options.connectAndDrop ?? defaultConnectAndDrop;
  const listDatabaseNames = options.listDatabaseNames ?? defaultListDatabaseNames;
  const verifyAbsent = options.verifyAbsent ?? true;

  const dropPromise = connectAndDrop({
    uri: options.uri,
    databaseName: options.databaseName,
    timeoutMs,
  });

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () =>
        reject(
          new Error(
            `Dropping owned ephemeral database "${options.databaseName}" timed out after ${timeoutMs}ms`,
          ),
        ),
      timeoutMs,
    );
  });

  try {
    await Promise.race([dropPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    dropPromise.catch(() => {});
  }

  let verifiedAbsent = false;
  if (verifyAbsent) {
    const names = await listDatabaseNames(options.uri, timeoutMs);
    if (names.includes(options.databaseName)) {
      throw new Error(
        `Drop verification failed: ephemeral database "${options.databaseName}" still exists`,
      );
    }
    verifiedAbsent = true;
  }

  return {
    dropped: true,
    verifiedAbsent,
    preservedForDiagnostics: false,
  };
}

/**
 * READ-ONLY: sum collection counts across non-system databases.
 * Never prints URI/credentials or document contents.
 */
export async function countClusterCollections(
  uri: string,
  options: {
    timeoutMs?: number;
    listCollectionsCounts?: (uri: string, timeoutMs: number) => Promise<number>;
  } = {},
): Promise<number> {
  if (options.listCollectionsCounts) {
    return options.listCollectionsCounts(uri, options.timeoutMs ?? 15_000);
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const client = new MongoClient(uri, {
    connectTimeoutMS: Math.min(timeoutMs, 10_000),
    serverSelectionTimeoutMS: Math.min(timeoutMs, 10_000),
  });

  try {
    await client.connect();
    const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
    let total = 0;
    for (const entry of databases) {
      const name = entry.name;
      if (name === "admin" || name === "local" || name === "config") {
        continue;
      }
      const collections = await client.db(name).listCollections({}, { nameOnly: true }).toArray();
      total += collections.length;
    }
    return total;
  } finally {
    await client.close();
  }
}

export async function assessClusterCollectionPressure(
  uri: string,
  options: {
    clusterLimit?: number;
    timeoutMs?: number;
    countCollections?: (uri: string) => Promise<number>;
  } = {},
): Promise<CollectionPressureAssessment> {
  const total =
    options.countCollections !== undefined
      ? await options.countCollections(uri)
      : await countClusterCollections(uri, { timeoutMs: options.timeoutMs });
  return classifyCollectionPressure(total, options.clusterLimit ?? DEFAULT_CLUSTER_COLLECTION_LIMIT);
}

export function isDiagnosticPreserveEnabled(
  kind: EphemeralDatabaseKind,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (kind === "test") {
    return env[KEEP_TEST_DATABASE_ENV_VAR] === "1";
  }
  return env[KEEP_VERIFICATION_DATABASE_ENV_VAR] === "1";
}
