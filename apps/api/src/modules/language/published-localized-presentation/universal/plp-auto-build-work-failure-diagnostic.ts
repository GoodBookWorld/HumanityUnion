/**
 * RESET 05C.2 — read-only failed PLP auto-build work inspection.
 *
 * PROVIDER_CALLS=0, PLP_WRITES=0, MONGO_WRITES=0.
 * Never prints bodies, prompts, secrets, env, or Mongo URI.
 */

import type { LanguageCode } from "@hu/types";

import {
  listFailedPlpAutoBuildWork,
  normalizePlpAutoBuildFailureClass,
  type PlpAutoBuildFailureClass,
  type PlpAutoBuildWorkRecord,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_DEFAULT_LIMIT,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT,
} from "./plp-auto-build-work.repository.js";
import { findCurrentPublishedPresentation } from "../persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import { getPlpDomainAdapter } from "./domain-adapter-registry.js";
import {
  ensureAllDefaultPlpAdaptersRegistered,
  ensureMediaPlpAdapterRegistered,
} from "./register-defaults.js";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

export const PLP_AUTO_BUILD_FAILURE_DIAGNOSTIC_PACK = "RESET_05C_2" as const;

export type PlpAutoBuildFailedWorkRow = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly status: "failed";
  readonly failureCode: PlpAutoBuildFailureClass;
  readonly failureReason: string | null;
  readonly lastAttemptAt: string | null;
  readonly nextAttemptAt: null;
  readonly liveCanonicalVersion: string | null;
  readonly canonicalVersionMatchesLive: boolean | null;
  readonly usablePlpSnapshotExists: boolean;
  readonly snapshotUsability: string | null;
};

export type PlpAutoBuildFailedWorkReport = {
  readonly pack: typeof PLP_AUTO_BUILD_FAILURE_DIAGNOSTIC_PACK;
  readonly operation: "diagnose_plp_auto_build_failed_work";
  readonly readOnly: true;
  readonly PROVIDER_CALLS: 0;
  readonly PLP_WRITES: 0;
  readonly MONGO_WRITES: 0;
  readonly LIMIT: number;
  readonly FAILED_TOTAL: number;
  readonly ROWS_RETURNED: number;
  readonly FAILURE_CLASSES: Readonly<Record<string, number>>;
  readonly CURRENT_VERSION_FAILURES: number;
  readonly STALE_VERSION_FAILURES: number;
  readonly VERSION_UNKNOWN: number;
  readonly NOW_USABLE: number;
  readonly STILL_MISSING: number;
  readonly rows: readonly PlpAutoBuildFailedWorkRow[];
};

export type InspectPlpAutoBuildFailedWorkDeps = {
  readonly listFailed?: (input: {
    readonly limit: number;
  }) => Promise<readonly PlpAutoBuildWorkRecord[]>;
  readonly resolveLive?: (input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly locale: string;
  }) => Promise<{
    readonly liveCanonicalVersion: string | null;
    readonly canonicalPresentation: unknown | null;
    readonly localizationSchemaVersion: string | null;
  } | null>;
  readonly findCurrent?: typeof findCurrentPublishedPresentation;
};

function clampLimit(raw: number | undefined): number {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.trunc(raw)
      : PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_DEFAULT_LIMIT;
  if (n < 1) {
    return 1;
  }
  return Math.min(n, PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT);
}

async function defaultResolveLive(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<{
  readonly liveCanonicalVersion: string | null;
  readonly canonicalPresentation: unknown | null;
  readonly localizationSchemaVersion: string | null;
} | null> {
  ensureMediaPlpAdapterRegistered();
  ensureAllDefaultPlpAdaptersRegistered();
  const adapter = getPlpDomainAdapter(input.entityType);
  if (!adapter) {
    return null;
  }
  const contract = await adapter.resolveCanonicalEntity({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale as LanguageCode,
  });
  if (!contract) {
    return null;
  }
  return {
    liveCanonicalVersion: contract.canonicalVersion,
    canonicalPresentation: contract.canonicalPresentation,
    localizationSchemaVersion: contract.localizationSchemaVersion,
  };
}

/**
 * Bounded READ-ONLY inspection of terminal failed durable PLP auto-build rows.
 */
export async function inspectPlpAutoBuildFailedWork(input?: {
  readonly limit?: number;
  readonly deps?: InspectPlpAutoBuildFailedWorkDeps;
}): Promise<PlpAutoBuildFailedWorkReport> {
  const limit = clampLimit(input?.limit);
  const deps = input?.deps ?? {};
  const listFailed = deps.listFailed ?? listFailedPlpAutoBuildWork;
  const resolveLive = deps.resolveLive ?? defaultResolveLive;
  const findCurrent = deps.findCurrent ?? findCurrentPublishedPresentation;

  const failed = await listFailed({ limit });
  const classCounts: Record<string, number> = {};
  let currentVersionFailures = 0;
  let staleVersionFailures = 0;
  let versionUnknown = 0;
  let nowUsable = 0;
  let stillMissing = 0;

  const rows: PlpAutoBuildFailedWorkRow[] = [];

  for (const work of failed) {
    const failureCode = normalizePlpAutoBuildFailureClass(work.lastError);
    classCounts[failureCode] = (classCounts[failureCode] ?? 0) + 1;

    const live = await resolveLive({
      entityType: work.entityType,
      entityId: work.entityId,
      locale: work.locale,
    });

    let liveCanonicalVersion: string | null = live?.liveCanonicalVersion ?? null;
    let canonicalVersionMatchesLive: boolean | null = null;
    if (liveCanonicalVersion == null) {
      versionUnknown += 1;
    } else if (liveCanonicalVersion === work.canonicalVersion) {
      canonicalVersionMatchesLive = true;
      currentVersionFailures += 1;
    } else {
      canonicalVersionMatchesLive = false;
      staleVersionFailures += 1;
    }

    let usablePlpSnapshotExists = false;
    let snapshotUsability: string | null = null;
    try {
      const snapshot = await findCurrent({
        entityType: work.entityType,
        entityId: work.entityId,
        locale: work.locale,
      });
      if (
        snapshot &&
        live?.canonicalPresentation != null &&
        liveCanonicalVersion != null
      ) {
        const usability = classifyUsableLocalizedPresentation({
          locale: work.locale,
          liveCanonicalVersion,
          liveLocalizationSchemaVersion:
            live.localizationSchemaVersion ??
            PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          canonicalPresentation: live.canonicalPresentation as never,
          snapshot,
        });
        usablePlpSnapshotExists = usability.allowPublishedLocalized;
        snapshotUsability =
          usability.resolveReasonCode ?? String(usability.reason);
      } else if (snapshot?.state === "PUBLISHED") {
        // Snapshot exists but we could not classify without live tree.
        usablePlpSnapshotExists =
          snapshot.identity.canonicalVersion ===
          (liveCanonicalVersion ?? work.canonicalVersion);
        snapshotUsability = usablePlpSnapshotExists
          ? "PUBLISHED_VERSION_MATCH"
          : "PUBLISHED_VERSION_MISMATCH";
      } else {
        snapshotUsability = "NO_PUBLISHED_SNAPSHOT";
      }
    } catch {
      snapshotUsability = "SNAPSHOT_LOOKUP_UNAVAILABLE";
    }

    if (usablePlpSnapshotExists) {
      nowUsable += 1;
    } else {
      stillMissing += 1;
    }

    rows.push({
      entityType: work.entityType,
      entityId: work.entityId,
      locale: work.locale,
      canonicalVersion: work.canonicalVersion,
      attemptCount: work.attempts,
      maxAttempts: work.maxAttempts,
      status: "failed",
      failureCode,
      failureReason: work.lastError,
      lastAttemptAt: work.lastFailureAt ?? work.claimedAt ?? work.updatedAt,
      nextAttemptAt: null,
      liveCanonicalVersion,
      canonicalVersionMatchesLive,
      usablePlpSnapshotExists,
      snapshotUsability,
    });
  }

  return {
    pack: PLP_AUTO_BUILD_FAILURE_DIAGNOSTIC_PACK,
    operation: "diagnose_plp_auto_build_failed_work",
    readOnly: true,
    PROVIDER_CALLS: 0,
    PLP_WRITES: 0,
    MONGO_WRITES: 0,
    LIMIT: limit,
    FAILED_TOTAL: failed.length,
    ROWS_RETURNED: rows.length,
    FAILURE_CLASSES: classCounts,
    CURRENT_VERSION_FAILURES: currentVersionFailures,
    STALE_VERSION_FAILURES: staleVersionFailures,
    VERSION_UNKNOWN: versionUnknown,
    NOW_USABLE: nowUsable,
    STILL_MISSING: stillMissing,
    rows,
  };
}

export {
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_DEFAULT_LIMIT,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT,
  normalizePlpAutoBuildFailureClass,
};
