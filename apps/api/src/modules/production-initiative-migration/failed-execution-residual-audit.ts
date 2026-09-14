import type { Db } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { inventoryMustMigrateCivicChildren } from "./civic-inventory.js";
import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  VLAD_SHAPRAN_USER_ID,
} from "./constants.js";
import {
  MEDIA_RECOVERY_COLLECTION,
} from "./media-recovery-store.js";
import type { MediaR2PreflightReader } from "./media-r2-preflight.js";
import { loadReconciledPublicMediaPlanFromSource } from "./media-r2-preflight.js";
import type { DestinationObjectInspection } from "./media-ownership.js";
import { assertNoSecretLeak } from "./redact.js";

/** Default failed controlled-execute id from Task 07.7 residual audit. */
export const FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID =
  "mig_c4e677f1-8338-4ab2-bdd5-d9ddde60074d" as const;

export type ResidualAuditVerdict =
  | "CLEAN_FOR_FRESH_DRY_RUN"
  | "RESIDUAL_CLEANUP_REQUIRED"
  | "AUDIT_INDETERMINATE";

export type ProfileVisibilityResidualClass =
  | "UNCHANGED"
  | "ROLLBACK_RESTORED"
  | "RESIDUAL_PATCH"
  | "INDETERMINATE";

export type R2ResidualClassification =
  | "ABSENT"
  | "PRESENT_UNPROVEN"
  | "OWNED_BY_FAILED_EXECUTION"
  | "OWNED_BY_OTHER_EXECUTION"
  | "PREEXISTING_EQUIVALENT"
  | "SOURCE_UNREADABLE";

export type RecoveryRowResidualKind =
  | "HISTORICAL_EVIDENCE_ONLY"
  | "ACTIVE_OWNERSHIP_CLAIM"
  | "ROLLBACK_FAILED_CLAIM"
  | "INDETERMINATE";

export interface ResidualAuditMutationProof {
  mongoWrites: number;
  putObjectCalls: number;
  deleteObjectCalls: number;
  recoveryStoreWrites: number;
}

export interface ResidualAuditReport {
  tool: "audit-production-initiative-migration-residuals";
  mode: "read-only";
  migrationExecutionId: string;
  destinationPayload: {
    rootsCount: number;
    rootsPresentIds: string[];
    civicChildrenCount: number;
    civicChildrenByCollection: Record<string, number>;
    membershipsForVlad: number;
    membershipContributionsForVlad: number;
    memberBadgeApplicationsForVlad: number;
    mediaUploadRecordsForAllowList: number;
    payloadResidual: boolean;
  };
  vladProfileVisibility: {
    current: boolean | null;
    fieldPresent: boolean;
    sourceApplied: boolean | null;
    baselinePrevious: boolean | null | undefined;
    classification: ProfileVisibilityResidualClass;
    note: string;
  };
  durableRecovery: {
    collection: typeof MEDIA_RECOVERY_COLLECTION;
    rowCount: number;
    byStatus: Record<string, number>;
    rows: Array<{
      storageKey: string;
      status: string;
      residualKind: RecoveryRowResidualKind;
    }>;
    activeOwnershipClaims: number;
  };
  destinationR2: {
    plannedKeysExpected: number;
    plannedKeysAudited: number;
    byClassification: Record<R2ResidualClassification, number>;
    ownedByFailedExecutionKeys: string[];
    contradictions: string[];
  };
  ownershipConsistency: {
    contradictions: string[];
    ok: boolean;
  };
  mutationProof: ResidualAuditMutationProof;
  blockers: string[];
  verdict: ResidualAuditVerdict;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Pure classifier for Vlad membershipPubliclyVisible residual state. */
export function classifyVladProfileVisibilityResidual(input: {
  current: boolean | null;
  fieldPresent: boolean;
  sourceApplied: boolean | null;
  /** Pre-execution destination value when known; `undefined` means unknown. */
  baselinePrevious: boolean | null | undefined;
  /** True when durable recovery shows Phase E1 progressed (implies Phase B ran before C failure). */
  phaseBLikelyCompleted: boolean;
}): { classification: ProfileVisibilityResidualClass; note: string } {
  const { current, fieldPresent, sourceApplied, baselinePrevious, phaseBLikelyCompleted } =
    input;

  if (baselinePrevious === undefined) {
    return {
      classification: "INDETERMINATE",
      note: "Pre-execution membershipPubliclyVisible baseline unavailable; fail closed.",
    };
  }

  // `null` baseline means the field was absent pre-execution.
  const baselineAbsent = baselinePrevious === null;
  const currentEqualsBaseline = baselineAbsent
    ? !fieldPresent
    : fieldPresent && current === baselinePrevious;

  if (
    sourceApplied !== null &&
    fieldPresent &&
    current === sourceApplied &&
    !currentEqualsBaseline
  ) {
    return {
      classification: "RESIDUAL_PATCH",
      note: "Destination still equals Phase B applied value and differs from known baseline.",
    };
  }

  if (currentEqualsBaseline) {
    if (
      phaseBLikelyCompleted &&
      sourceApplied !== null &&
      (baselineAbsent || baselinePrevious !== sourceApplied)
    ) {
      return {
        classification: "ROLLBACK_RESTORED",
        note: "Destination matches known baseline after Phase B likely ran; consistent with profile rollback/restore.",
      };
    }
    return {
      classification: "UNCHANGED",
      note: "Destination matches known pre-execution baseline.",
    };
  }

  return {
    classification: "INDETERMINATE",
    note: "Destination matches neither baseline nor applied Phase B value.",
  };
}

export function classifyRecoveryRowResidualKind(
  status: string,
): RecoveryRowResidualKind {
  if (status === "rollback_deleted" || status === "preexisting_equivalent" || status === "planned") {
    return "HISTORICAL_EVIDENCE_ONLY";
  }
  if (status === "created_verified" || status === "copying") {
    return "ACTIVE_OWNERSHIP_CLAIM";
  }
  if (status === "rollback_failed") {
    return "ROLLBACK_FAILED_CLAIM";
  }
  return "INDETERMINATE";
}

export function classifyDestinationR2Residual(input: {
  sourceReadable: boolean;
  sourceChecksum?: string;
  sourceLength?: number;
  observed: DestinationObjectInspection | null;
  failedExecutionId: string;
}): R2ResidualClassification {
  if (!input.sourceReadable) return "SOURCE_UNREADABLE";
  if (!input.observed) return "ABSENT";
  if (input.observed.ownership.kind === "owned") {
    return "OWNED_BY_FAILED_EXECUTION";
  }
  if (input.observed.ownership.kind === "foreign") {
    return "OWNED_BY_OTHER_EXECUTION";
  }
  const equivalent =
    input.sourceChecksum != null &&
    input.sourceLength != null &&
    input.observed.checksumSHA256 === input.sourceChecksum &&
    input.observed.contentLength === input.sourceLength;
  if (equivalent) return "PREEXISTING_EQUIVALENT";
  return "PRESENT_UNPROVEN";
}

/**
 * Read-only residual audit for a failed production Initiative migration execution.
 */
export async function runFailedExecutionResidualAudit(input: {
  sourceDb: Db;
  destinationDb: Db;
  mediaReader: MediaR2PreflightReader;
  migrationExecutionId?: string;
  /**
   * Optional known pre-execution destination membershipPubliclyVisible.
   * Pass `null` when the field was absent; omit (`undefined`) when unknown.
   */
  baselineMembershipPubliclyVisible?: boolean | null;
  mutationCounters?: Partial<ResidualAuditMutationProof>;
}): Promise<ResidualAuditReport> {
  const migrationExecutionId =
    input.migrationExecutionId ?? FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID;
  if (!migrationExecutionId.startsWith("mig_")) {
    throw new Error("migrationExecutionId must start with mig_");
  }

  const blockers: string[] = [];
  const ids = [...CANONICAL_PRODUCTION_INITIATIVE_IDS];
  const vladProfileId = APPROVED_PRODUCTION_PARTICIPANTS[0]!.profileId;

  // --- 1. Destination canonical payload ---
  const rootDocs = await input.destinationDb
    .collection(MONGO_COLLECTIONS.initiatives)
    .find({ initiativeId: { $in: ids } })
    .project({ initiativeId: 1 })
    .toArray();
  const rootsPresentIds = rootDocs
    .map((d) => asString(d.initiativeId))
    .filter((id): id is string => Boolean(id))
    .sort();

  let civicChildrenCount = 0;
  let civicChildrenByCollection: Record<string, number> = {};
  try {
    const destCivic = await inventoryMustMigrateCivicChildren(input.destinationDb);
    civicChildrenCount = destCivic.children.length;
    civicChildrenByCollection = destCivic.byCollection;
  } catch (error) {
    blockers.push(
      `Destination civic inventory failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const membershipsForVlad = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberships)
    .countDocuments({ userId: VLAD_SHAPRAN_USER_ID });
  const membershipContributionsForVlad = await input.destinationDb
    .collection(MONGO_COLLECTIONS.membershipContributions)
    .countDocuments({ userId: VLAD_SHAPRAN_USER_ID });
  const memberBadgeApplicationsForVlad = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberBadgeApplications)
    .countDocuments({
      $or: [
        { userId: VLAD_SHAPRAN_USER_ID },
        { participantId: APPROVED_PRODUCTION_PARTICIPANTS[0]!.memberId },
      ],
    });
  const mediaUploadRecordsForAllowList = await input.destinationDb
    .collection(MONGO_COLLECTIONS.mediaUploadRecords)
    .countDocuments({ initiativeId: { $in: ids } });

  const payloadResidual =
    rootsPresentIds.length > 0 ||
    civicChildrenCount > 0 ||
    membershipsForVlad > 0 ||
    membershipContributionsForVlad > 0 ||
    memberBadgeApplicationsForVlad > 0 ||
    mediaUploadRecordsForAllowList > 0;

  if (payloadResidual) {
    blockers.push("Migration-created canonical Mongo payload remains in destination");
  }

  // --- 2. Vlad profile visibility ---
  const sourceProfile = await input.sourceDb
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .findOne(
      { profileId: vladProfileId },
      { projection: { membershipPubliclyVisible: 1 } },
    );
  const destProfile = await input.destinationDb
    .collection(MONGO_COLLECTIONS.memberProfiles)
    .findOne(
      { profileId: vladProfileId },
      { projection: { membershipPubliclyVisible: 1 } },
    );
  const sourceApplied = asBooleanOrNull(sourceProfile?.membershipPubliclyVisible);
  const fieldPresent = Boolean(
    destProfile && Object.prototype.hasOwnProperty.call(destProfile, "membershipPubliclyVisible"),
  );
  const current = fieldPresent
    ? asBooleanOrNull(destProfile?.membershipPubliclyVisible)
    : null;

  // --- 3. Durable recovery ---
  const recoveryDocs = await input.destinationDb
    .collection(MEDIA_RECOVERY_COLLECTION)
    .find({ migrationExecutionId })
    .project({ storageKey: 1, status: 1, migrationExecutionId: 1 })
    .toArray();
  const byStatus: Record<string, number> = {};
  const recoveryRows: ResidualAuditReport["durableRecovery"]["rows"] = [];
  for (const row of recoveryDocs) {
    const storageKey = asString(row.storageKey) ?? "unknown";
    const status = asString(row.status) ?? "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    recoveryRows.push({
      storageKey,
      status,
      residualKind: classifyRecoveryRowResidualKind(status),
    });
  }
  const activeOwnershipClaims = recoveryRows.filter(
    (r) => r.residualKind === "ACTIVE_OWNERSHIP_CLAIM" || r.residualKind === "ROLLBACK_FAILED_CLAIM",
  ).length;
  const phaseBLikelyCompleted = recoveryDocs.length > 0;

  const baselinePrevious = input.baselineMembershipPubliclyVisible;
  const profileClass = classifyVladProfileVisibilityResidual({
    current,
    fieldPresent,
    sourceApplied,
    baselinePrevious,
    phaseBLikelyCompleted,
  });
  if (
    profileClass.classification === "RESIDUAL_PATCH" ||
    profileClass.classification === "INDETERMINATE"
  ) {
    blockers.push(`Vlad profile visibility: ${profileClass.classification}`);
  }

  // --- 4/5. Destination R2 + ownership consistency ---
  const planned = await loadReconciledPublicMediaPlanFromSource(input.sourceDb);
  const keys = planned.planned.map((p) => p.storageKey);
  const byClassification: Record<R2ResidualClassification, number> = {
    ABSENT: 0,
    PRESENT_UNPROVEN: 0,
    OWNED_BY_FAILED_EXECUTION: 0,
    OWNED_BY_OTHER_EXECUTION: 0,
    PREEXISTING_EQUIVALENT: 0,
    SOURCE_UNREADABLE: 0,
  };
  const ownedByFailedExecutionKeys: string[] = [];
  const r2Contradictions: string[] = [];
  const ownershipContradictions: string[] = [];
  const recoveryByKey = new Map(recoveryRows.map((r) => [r.storageKey, r]));

  for (const storageKey of keys) {
    let sourceChecksum: string | undefined;
    let sourceLength: number | undefined;
    let sourceReadable = true;
    try {
      const sourceObj = await input.mediaReader.prepareSourceObject(storageKey);
      sourceChecksum = sourceObj.checksumSHA256;
      sourceLength = sourceObj.contentLength;
    } catch {
      sourceReadable = false;
    }

    const observed = await input.mediaReader.inspectDestinationObject(
      storageKey,
      migrationExecutionId,
    );
    const classification = classifyDestinationR2Residual({
      sourceReadable,
      sourceChecksum,
      sourceLength,
      observed,
      failedExecutionId: migrationExecutionId,
    });
    byClassification[classification] += 1;
    if (classification === "OWNED_BY_FAILED_EXECUTION") {
      ownedByFailedExecutionKeys.push(storageKey);
      blockers.push(`Owned R2 residual remains for ${storageKey}`);
    }
    if (classification === "PRESENT_UNPROVEN") {
      blockers.push(
        `Destination R2 present without proven ownership for ${storageKey} (fail closed)`,
      );
    }
    if (classification === "SOURCE_UNREADABLE") {
      blockers.push(`Source R2 unreadable while auditing residual for ${storageKey}`);
    }

    const recovery = recoveryByKey.get(storageKey);
    if (recovery?.status === "rollback_deleted" && classification === "OWNED_BY_FAILED_EXECUTION") {
      const msg = `Recovery says rollback_deleted but owned R2 object still present: ${storageKey}`;
      ownershipContradictions.push(msg);
      r2Contradictions.push(msg);
    }
    if (
      (recovery?.status === "created_verified" || recovery?.status === "copying") &&
      classification === "ABSENT"
    ) {
      const msg = `Recovery claims active ownership but destination R2 absent: ${storageKey}`;
      ownershipContradictions.push(msg);
    }
    if (
      classification === "OWNED_BY_FAILED_EXECUTION" &&
      !recovery
    ) {
      const msg = `Owned R2 object has no matching durable recovery row: ${storageKey}`;
      ownershipContradictions.push(msg);
    }
  }

  // Recovery keys not in planned set but claiming active ownership
  for (const row of recoveryRows) {
    if (
      (row.residualKind === "ACTIVE_OWNERSHIP_CLAIM" ||
        row.residualKind === "ROLLBACK_FAILED_CLAIM") &&
      !keys.includes(row.storageKey)
    ) {
      const observed = await input.mediaReader.inspectDestinationObject(
        row.storageKey,
        migrationExecutionId,
      );
      if (observed?.ownership.kind === "owned") {
        ownedByFailedExecutionKeys.push(row.storageKey);
        ownershipContradictions.push(
          `Active recovery claim outside planned set with owned R2: ${row.storageKey}`,
        );
        blockers.push(`Owned R2 residual remains for ${row.storageKey}`);
      } else if (!observed) {
        ownershipContradictions.push(
          `Active recovery claim but object absent (outside planned set): ${row.storageKey}`,
        );
      }
    }
  }

  if (activeOwnershipClaims > 0 && ownedByFailedExecutionKeys.length === 0) {
    // Active claims with absent objects — incomplete ownership evidence / contradiction
    blockers.push("Durable recovery still claims active ownership without matching owned R2");
  }
  if (ownershipContradictions.length > 0) {
    blockers.push(...ownershipContradictions.slice(0, 10));
  }

  const mongoWrites = input.mutationCounters?.mongoWrites ?? 0;
  const putObjectCalls =
    input.mutationCounters?.putObjectCalls ?? input.mediaReader.getWriteCount?.() ?? 0;
  const deleteObjectCalls =
    input.mutationCounters?.deleteObjectCalls ?? input.mediaReader.getDeleteCount?.() ?? 0;
  const recoveryStoreWrites = input.mutationCounters?.recoveryStoreWrites ?? 0;
  if (mongoWrites || putObjectCalls || deleteObjectCalls || recoveryStoreWrites) {
    blockers.push("Refusing verdict: mutation detected during read-only residual audit");
  }

  const uniqueBlockers = [...new Set(blockers)];
  let verdict: ResidualAuditVerdict = "CLEAN_FOR_FRESH_DRY_RUN";
  if (
    payloadResidual ||
    ownedByFailedExecutionKeys.length > 0 ||
    profileClass.classification === "RESIDUAL_PATCH" ||
    ownershipContradictions.some((c) => /still present|Owned R2/.test(c))
  ) {
    verdict = "RESIDUAL_CLEANUP_REQUIRED";
  } else if (
    profileClass.classification === "INDETERMINATE" ||
    ownershipContradictions.length > 0 ||
    activeOwnershipClaims > 0 ||
    uniqueBlockers.some((b) => /INDETERMINATE|incomplete|contradiction|claims active/i.test(b))
  ) {
    verdict = "AUDIT_INDETERMINATE";
  }

  // Fail closed: unresolved profile or ownership contradictions escalate away from CLEAN
  if (verdict === "CLEAN_FOR_FRESH_DRY_RUN" && uniqueBlockers.length > 0) {
    verdict = "AUDIT_INDETERMINATE";
  }

  const report: ResidualAuditReport = {
    tool: "audit-production-initiative-migration-residuals",
    mode: "read-only",
    migrationExecutionId,
    destinationPayload: {
      rootsCount: rootsPresentIds.length,
      rootsPresentIds,
      civicChildrenCount,
      civicChildrenByCollection,
      membershipsForVlad,
      membershipContributionsForVlad,
      memberBadgeApplicationsForVlad,
      mediaUploadRecordsForAllowList,
      payloadResidual,
    },
    vladProfileVisibility: {
      current,
      fieldPresent,
      sourceApplied,
      baselinePrevious,
      classification: profileClass.classification,
      note: profileClass.note,
    },
    durableRecovery: {
      collection: MEDIA_RECOVERY_COLLECTION,
      rowCount: recoveryRows.length,
      byStatus,
      rows: recoveryRows,
      activeOwnershipClaims,
    },
    destinationR2: {
      plannedKeysExpected: EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
      plannedKeysAudited: keys.length,
      byClassification,
      ownedByFailedExecutionKeys,
      contradictions: r2Contradictions,
    },
    ownershipConsistency: {
      contradictions: ownershipContradictions,
      ok: ownershipContradictions.length === 0,
    },
    mutationProof: {
      mongoWrites,
      putObjectCalls,
      deleteObjectCalls,
      recoveryStoreWrites,
    },
    blockers: uniqueBlockers,
    verdict,
  };

  assertNoSecretLeak(JSON.stringify(report));
  return report;
}
