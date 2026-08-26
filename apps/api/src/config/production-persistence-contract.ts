/**
 * Production Pre-Deployment Hardening Pack 01 —
 * Durable persistence must not silently use `.runtime` file/memory in production.
 */

export type PersistenceMode = "mongodb" | "file" | "memory";

/** Civic/user state that must survive process restart in production. */
export const DURABLE_PERSISTENCE_ENV_KEYS = [
  "INITIATIVE_PERSISTENCE",
  "INITIATIVE_ANALYSIS_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE",
  "INITIATIVE_VERSION_REVISION_PERSISTENCE",
  "DECISION_SESSION_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE",
  "PARTICIPATION_AREA_PERSISTENCE",
  "CIVIC_ACTION_PACKAGE_PERSISTENCE",
  "CIVIC_DELIVERY_PERSISTENCE",
  "OFFICIAL_RESPONSE_PERSISTENCE",
  "CIVIC_ACCOUNTABILITY_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_PERSISTENCE",
  "CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE",
  "INITIATIVE_PETITION_DRAFT_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE",
  "INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE",
  "CIVIC_NOMINATION_PERSISTENCE",
  "CIVIC_NOMINATION_VOTE_PERSISTENCE",
  "NOTIFICATION_PERSISTENCE",
  "ADMIN_NOTIFICATION_PERSISTENCE",
  "REMINDER_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE",
  "INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE",

  "PUBLIC_CIVIC_ARCHIVE_PERSISTENCE",
  // Lifecycle package / report / recommendation stores (legacy `.runtime` JSON)
  "INITIATIVE_DECISION_SESSION_RECOMMENDATION_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PACKAGE_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE",
  "INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE",
  "INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE",
] as const;

export type DurablePersistenceEnvKey = (typeof DURABLE_PERSISTENCE_ENV_KEYS)[number];

const DURABLE_KEY_SET = new Set<string>(DURABLE_PERSISTENCE_ENV_KEYS);

function readMode(envKey: string): PersistenceMode | undefined {
  const raw = process.env[envKey]?.trim().toLowerCase();
  if (raw === "mongodb" || raw === "file" || raw === "memory") {
    return raw;
  }
  return undefined;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolve persistence for a module.
 * Production durable keys default to mongodb and never silently use file/memory.
 */
export function resolvePersistenceMode(
  envKey: string,
  nonProductionDefault: PersistenceMode,
): PersistenceMode {
  const configured = readMode(envKey);
  const durable = DURABLE_KEY_SET.has(envKey);
  const production = isProductionRuntime();

  if (production && durable) {
    if (configured === "file" || configured === "memory") {
      throw new Error(
        `${envKey}=${configured} is not allowed when NODE_ENV=production. ` +
          "Use mongodb for durable civic/user persistence.",
      );
    }
    return "mongodb";
  }

  return configured ?? nonProductionDefault;
}

export function collectInvalidProductionPersistenceModes(): string[] {
  if (!isProductionRuntime()) {
    return [];
  }

  const invalid: string[] = [];
  for (const key of DURABLE_PERSISTENCE_ENV_KEYS) {
    const configured = readMode(key);
    if (configured === "file" || configured === "memory") {
      invalid.push(`${key}=${configured}`);
    }
  }
  return invalid;
}

/** True when this env key resolves to mongodb (including production durable defaults). */
export function isMongoPersistenceMode(envKey: string): boolean {
  try {
    return resolvePersistenceMode(envKey, "file") === "mongodb";
  } catch {
    return false;
  }
}

/** Production always needs Mongo bootstrap; otherwise any explicit mongodb selection. */
export function shouldBootstrapMongoPersistence(): boolean {
  if (isProductionRuntime()) {
    return true;
  }

  for (const key of DURABLE_PERSISTENCE_ENV_KEYS) {
    if (readMode(key) === "mongodb") {
      return true;
    }
  }

  return false;
}
