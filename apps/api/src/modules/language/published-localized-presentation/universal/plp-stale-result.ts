/**
 * RESET 05D.8 — structured stale-result contract for PLP auto-build.
 *
 * Bare "STALE_REVISION" crossing a layer is forbidden. Every stale result must
 * carry originId, boundary, and both compared canonical versions.
 */

export const PLP_STALE_ORIGIN = {
  CLAIM_SOURCE_RELOAD: "claim_source_reload",
  BUILD_PIPELINE_PRE_MERGE: "build_pipeline_pre_merge",
  PUBLISH_CAS_CONTENT_REVISION: "publish_cas_content_revision",
  PUBLISH_CAS_DUPLICATE_KEY: "publish_cas_duplicate_key",
  PUBLISH_ATOMIC_MAPPER: "publish_atomic_mapper",
  MAP_BUILD_STATUS: "map_build_status",
} as const;

export type PlpStaleOriginId =
  (typeof PLP_STALE_ORIGIN)[keyof typeof PLP_STALE_ORIGIN];

export type PlpStructuredStaleDetail = {
  readonly code: "STALE_CANONICAL_VERSION";
  readonly reason: "STALE_REVISION";
  readonly originId: PlpStaleOriginId;
  readonly boundary: string;
  readonly authority: string;
  readonly workCanonicalVersion: string;
  readonly currentSourceCanonicalVersion: string;
  readonly candidateCanonicalVersion?: string;
  readonly existingSnapshotCanonicalVersion?: string;
  readonly candidateContentRevision?: number;
  readonly existingContentRevision?: number;
};

/** Testable inventory of every producer that may emit STALE_REVISION / STALE_CANONICAL_VERSION. */
export const PLP_STALE_ORIGIN_INVENTORY = [
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.CLAIM_SOURCE_RELOAD,
    FILE_FUNCTION: "process-plp-build-request.ts:processPlpBuildRequest",
    INPUT_COMPARISON: "request.canonicalVersion !== contract.canonicalVersion",
    METADATA_PASSTHROUGH: true,
  },
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.BUILD_PIPELINE_PRE_MERGE,
    FILE_FUNCTION: "build-pipeline.ts:runUniversalPlpBuild",
    INPUT_COMPARISON: "contract.canonicalVersion !== liveCanonicalVersion",
    METADATA_PASSTHROUGH: true,
  },
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION,
    FILE_FUNCTION:
      "mongo.repository.ts|memory.store.ts:publishAtomic*(same canonicalVersion)",
    INPUT_COMPARISON:
      "same canonicalVersion+schema AND existing.contentRevision > candidate.contentRevision",
    METADATA_PASSTHROUGH: true,
  },
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.PUBLISH_CAS_DUPLICATE_KEY,
    FILE_FUNCTION: "mongo.repository.ts:publishAtomicMongo catch E11000",
    INPUT_COMPARISON: "Mongo duplicate-key race during current-pointer upsert",
    METADATA_PASSTHROUGH: true,
  },
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.PUBLISH_ATOMIC_MAPPER,
    FILE_FUNCTION: "publish-atomic.ts:publishPublishedLocalizedPresentation",
    INPUT_COMPARISON: "persistence reason === STALE_REVISION",
    METADATA_PASSTHROUGH: true,
  },
  {
    ORIGIN_ID: PLP_STALE_ORIGIN.MAP_BUILD_STATUS,
    FILE_FUNCTION: "plp-auto-build-failure.ts:mapBuildStatusToFailure",
    INPUT_COMPARISON: "status SUPERSEDED or reasonCodes contain STALE*",
    METADATA_PASSTHROUGH: true,
  },
] as const;

export function encodePlpStructuredStaleSafeReason(
  detail: PlpStructuredStaleDetail,
): string {
  const parts = [
    detail.code,
    detail.reason,
    `STALE_ORIGIN_ID=${detail.originId}`,
    `STALE_WORK_VERSION=${detail.workCanonicalVersion}`,
    `STALE_CURRENT_SOURCE_VERSION=${detail.currentSourceCanonicalVersion}`,
    `STALE_BOUNDARY=${detail.boundary}`,
    `STALE_AUTHORITY=${detail.authority}`,
  ];
  if (detail.candidateCanonicalVersion != null) {
    parts.push(`STALE_CANDIDATE_VERSION=${detail.candidateCanonicalVersion}`);
  }
  if (detail.existingSnapshotCanonicalVersion != null) {
    parts.push(
      `STALE_EXISTING_SNAPSHOT_VERSION=${detail.existingSnapshotCanonicalVersion}`,
    );
  }
  if (detail.candidateContentRevision != null) {
    parts.push(
      `STALE_WORK_CONTENT_REVISION=${detail.candidateContentRevision}`,
    );
  }
  if (detail.existingContentRevision != null) {
    parts.push(
      `STALE_EXISTING_CONTENT_REVISION=${detail.existingContentRevision}`,
    );
  }
  return parts.join(";");
}

export function encodePlpStructuredStaleReasonCodes(
  detail: PlpStructuredStaleDetail,
): readonly string[] {
  return encodePlpStructuredStaleSafeReason(detail).split(";");
}

export function parsePlpStructuredStaleFromSafeReason(
  reason: string | null | undefined,
): PlpStructuredStaleDetail | null {
  if (!reason) {
    return null;
  }
  const get = (label: string): string | null => {
    const marker = `${label}=`;
    const idx = reason.indexOf(marker);
    if (idx < 0) {
      return null;
    }
    const rest = reason.slice(idx + marker.length);
    const semi = rest.indexOf(";");
    const raw = (semi >= 0 ? rest.slice(0, semi) : rest).trim();
    return raw || null;
  };
  const originId = get("STALE_ORIGIN_ID");
  const work = get("STALE_WORK_VERSION");
  const current = get("STALE_CURRENT_SOURCE_VERSION");
  const boundary = get("STALE_BOUNDARY");
  const authority = get("STALE_AUTHORITY");
  if (!originId || !work || !current || !boundary || !authority) {
    return null;
  }
  const candidateRev = get("STALE_WORK_CONTENT_REVISION");
  const existingRev = get("STALE_EXISTING_CONTENT_REVISION");
  return {
    code: "STALE_CANONICAL_VERSION",
    reason: "STALE_REVISION",
    originId: originId as PlpStaleOriginId,
    boundary,
    authority,
    workCanonicalVersion: work,
    currentSourceCanonicalVersion: current,
    candidateCanonicalVersion: get("STALE_CANDIDATE_VERSION") ?? undefined,
    existingSnapshotCanonicalVersion:
      get("STALE_EXISTING_SNAPSHOT_VERSION") ?? undefined,
    candidateContentRevision:
      candidateRev != null && Number.isFinite(Number(candidateRev))
        ? Number(candidateRev)
        : undefined,
    existingContentRevision:
      existingRev != null && Number.isFinite(Number(existingRev))
        ? Number(existingRev)
        : undefined,
  };
}

/** True when a durable/safe reason is the forbidden bare STALE_REVISION form. */
export function isBareStaleRevisionReason(reason: string | null | undefined): boolean {
  if (!reason) {
    return false;
  }
  const trimmed = reason.trim();
  if (trimmed === "STALE_REVISION") {
    return true;
  }
  // Pre-05D.7 mapper: failureCode persisted separately, lastError was just STALE_REVISION
  // or comma-joined codes without WORK/CURRENT version keys.
  if (
    (trimmed === "STALE_CANONICAL_VERSION" ||
      trimmed.startsWith("STALE_CANONICAL_VERSION;") ||
      trimmed.startsWith("STALE_REVISION")) &&
    !trimmed.includes("STALE_WORK_VERSION=") &&
    !trimmed.includes("STALE_CURRENT_SOURCE_VERSION=")
  ) {
    return true;
  }
  return false;
}

export function buildPublishCasContentRevisionStale(input: {
  readonly authority: "publishAtomicMongo" | "publishAtomicMemory";
  readonly workCanonicalVersion: string;
  readonly existingSnapshotCanonicalVersion: string;
  readonly candidateContentRevision: number;
  readonly existingContentRevision: number;
}): PlpStructuredStaleDetail {
  return {
    code: "STALE_CANONICAL_VERSION",
    reason: "STALE_REVISION",
    originId: PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION,
    boundary: PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION,
    authority: input.authority,
    workCanonicalVersion: input.workCanonicalVersion,
    currentSourceCanonicalVersion: input.existingSnapshotCanonicalVersion,
    candidateCanonicalVersion: input.workCanonicalVersion,
    existingSnapshotCanonicalVersion: input.existingSnapshotCanonicalVersion,
    candidateContentRevision: input.candidateContentRevision,
    existingContentRevision: input.existingContentRevision,
  };
}

export function buildPublishCasDuplicateKeyStale(input: {
  readonly candidateCanonicalVersion: string;
  readonly existingSnapshotCanonicalVersion: string | null;
  readonly candidateContentRevision: number;
  readonly existingContentRevision: number | null;
}): PlpStructuredStaleDetail {
  return {
    code: "STALE_CANONICAL_VERSION",
    reason: "STALE_REVISION",
    originId: PLP_STALE_ORIGIN.PUBLISH_CAS_DUPLICATE_KEY,
    boundary: PLP_STALE_ORIGIN.PUBLISH_CAS_DUPLICATE_KEY,
    authority: "publishAtomicMongo",
    workCanonicalVersion: input.candidateCanonicalVersion,
    currentSourceCanonicalVersion:
      input.existingSnapshotCanonicalVersion ?? input.candidateCanonicalVersion,
    candidateCanonicalVersion: input.candidateCanonicalVersion,
    existingSnapshotCanonicalVersion:
      input.existingSnapshotCanonicalVersion ?? undefined,
    candidateContentRevision: input.candidateContentRevision,
    existingContentRevision: input.existingContentRevision ?? undefined,
  };
}
