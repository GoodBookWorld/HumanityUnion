import { randomBytes } from "node:crypto";

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
] as const;

export interface VerificationDatabaseIsolation {
  runId: string;
  verificationTask: string;
  restore: () => void;
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

export function activateVerificationDatabaseIsolation(
  verificationTask: string,
): VerificationDatabaseIsolation {
  const runId = `${verificationTask.toLowerCase()}-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const verifyDatabase = `humanity_union_verify_${runId.replace(/[^a-z0-9-]/gi, "-")}`;
  const previousEnv = new Map<string, string | undefined>();

  for (const key of [
    ...MEMORY_PERSISTENCE_KEYS,
    "MONGODB_DATABASE",
    "MONGODB_URI",
    "HU_VERIFICATION_MODE",
  ]) {
    previousEnv.set(key, process.env[key]);
  }

  process.env.HU_VERIFICATION_MODE = "true";

  for (const key of MEMORY_PERSISTENCE_KEYS) {
    process.env[key] = "memory";
  }

  if (process.env.MONGODB_URI?.trim()) {
    process.env.MONGODB_DATABASE = verifyDatabase;
    process.env.MONGODB_URI = replaceMongoDatabase(process.env.MONGODB_URI, verifyDatabase);
  } else {
    process.env.MONGODB_DATABASE = verifyDatabase;
  }

  return {
    runId,
    verificationTask,
    restore: () => {
      for (const [key, value] of previousEnv.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

export function assertVerificationDatabaseIsolated(): void {
  if (process.env.HU_VERIFICATION_MODE !== "true") {
    throw new Error("Verification fixture mutations require HU_VERIFICATION_MODE=true.");
  }

  const database = process.env.MONGODB_DATABASE?.trim();

  if (database === "humanity_union_dev") {
    throw new Error("Verification must not use humanity_union_dev.");
  }

  if (database && !database.startsWith("humanity_union_verify_")) {
    throw new Error(`Verification must use an isolated database, received "${database}".`);
  }
}
