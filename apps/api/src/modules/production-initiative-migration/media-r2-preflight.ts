import type { Db } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import {
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  SYSTEM_MEDIA_RECOVERY_OWNER,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import {
  planMediaFromInitiativeDocument,
  planMediaFromSharedDocument,
  planMediaFromUploadRecord,
} from "./media-plan.js";
import { reconcileMediaPlanReferences } from "./media-reconcile.js";
import type { PreparedSourceObject } from "./r2-media-copy.js";
import type { DestinationObjectInspection } from "./media-ownership.js";
import { assertNoSecretLeak } from "./redact.js";
import type { PlannedMediaCopy } from "./types.js";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Read-only R2 surface — never PutObject / DeleteObject. */
export interface MediaR2PreflightReader {
  prepareSourceObject(storageKey: string): Promise<PreparedSourceObject>;
  inspectDestinationObject(
    storageKey: string,
    expectedMigrationExecutionId?: string,
  ): Promise<DestinationObjectInspection | null>;
  /** Optional mutation counters for tests / DualBucket executor. */
  getWriteCount?(): number;
  getDeleteCount?(): number;
}

export type MediaR2PreflightSourceStatus =
  | "SOURCE_OK"
  | "SOURCE_MISSING"
  | "SOURCE_UNREADABLE";

export type MediaR2PreflightDestinationStatus =
  | "DESTINATION_ABSENT"
  | "DESTINATION_EQUIVALENT"
  | "DESTINATION_FOREIGN_EQUIVALENT"
  | "DESTINATION_INTEGRITY_MISMATCH"
  | "DESTINATION_UNREADABLE";

export interface MediaR2PreflightKeyRow {
  storageKey: string;
  destinationUrl: string;
  sourceStatus: MediaR2PreflightSourceStatus;
  sourceContentSha256: string | null;
  sourceContentLength: number | null;
  sourceContentType: string | null;
  destinationStatus: MediaR2PreflightDestinationStatus | null;
  destinationContentSha256: string | null;
  destinationContentLength: number | null;
  destinationOwnershipExecutionId: string | null;
  safeForExecute: boolean;
  notes: string[];
}

export interface MediaR2PreflightReport {
  tool: "preflight-production-initiative-migration-media-r2";
  mode: "read-only";
  destinationPublicBaseUrl: string;
  dualR2: {
    sourceCredentialsConfigured: true;
    destinationCredentialsConfigured: true;
    bucketsDistinct: true;
  };
  sourceObjectsExpected: number;
  sourceObjectsReadable: number;
  destinationAbsent: number;
  destinationEquivalent: number;
  destinationConflicts: number;
  totalBytes: number;
  blockers: string[];
  verdict: "PASS" | "FAIL";
  keys: MediaR2PreflightKeyRow[];
  mutationProof: {
    putObjectCalls: number;
    deleteObjectCalls: number;
    mongoWrites: number;
    recoveryStoreWrites: number;
  };
}

export interface MediaR2PreflightMutationCounters {
  putObjectCalls?: number;
  deleteObjectCalls?: number;
  mongoWrites?: number;
  recoveryStoreWrites?: number;
}

/**
 * Load reconciled unique public media copies from staging source Mongo (read-only).
 */
export async function loadReconciledPublicMediaPlanFromSource(db: Db): Promise<{
  planned: PlannedMediaCopy[];
  copyPublicReferenceCount: number;
  uniquePublicObjectCount: number;
}> {
  const initiativeIds = [...CANONICAL_PRODUCTION_INITIATIVE_IDS];
  const mediaItems = [];

  const mediaUploads = await db
    .collection(MONGO_COLLECTIONS.mediaUploadRecords)
    .find({
      $or: [
        { initiativeId: { $in: initiativeIds } },
        { uploadedByParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
        { ownerParticipantId: SYSTEM_MEDIA_RECOVERY_OWNER },
      ],
    })
    .limit(5000)
    .toArray();
  const mediaUploadKeys = new Set(
    mediaUploads.map((d) => asString(d.storageKey)).filter((k): k is string => Boolean(k)),
  );

  for (const initiativeId of initiativeIds) {
    const root = await db.collection(MONGO_COLLECTIONS.initiatives).findOne({ initiativeId });
    if (!root) continue;
    mediaItems.push(
      ...planMediaFromInitiativeDocument({
        initiativeId,
        doc: root,
        mediaUploadKeys,
      }),
    );
  }
  for (const upload of mediaUploads) {
    mediaItems.push(planMediaFromUploadRecord(upload));
  }
  const sharedDocs = await db
    .collection(MONGO_COLLECTIONS.sharedDocuments)
    .find({ initiativeId: { $in: initiativeIds } })
    .limit(2000)
    .toArray();
  for (const doc of sharedDocs) {
    mediaItems.push(planMediaFromSharedDocument(doc));
  }

  const reconciled = reconcileMediaPlanReferences(mediaItems);
  return {
    planned: reconciled.uniquePublicCopies,
    copyPublicReferenceCount: reconciled.copyPublicReferenceCount,
    uniquePublicObjectCount: reconciled.uniquePublicObjectCount,
  };
}

function classifyDestination(input: {
  source: PreparedSourceObject;
  observed: DestinationObjectInspection | null;
}): {
  status: MediaR2PreflightDestinationStatus;
  safeForExecute: boolean;
  notes: string[];
} {
  if (!input.observed) {
    return {
      status: "DESTINATION_ABSENT",
      safeForExecute: true,
      notes: ["Destination object absent — expected for a fresh migration"],
    };
  }

  const contentMatches =
    input.observed.checksumSHA256 === input.source.checksumSHA256 &&
    input.observed.contentLength === input.source.contentLength;

  if (!contentMatches) {
    return {
      status: "DESTINATION_INTEGRITY_MISMATCH",
      safeForExecute: false,
      notes: [
        "Destination present but SHA-256/length does not match source — refuse execute until resolved",
      ],
    };
  }

  const foreign =
    input.observed.ownership.kind === "foreign" ||
    (input.observed.rawOwnershipExecutionId != null &&
      input.observed.rawOwnershipExecutionId.length > 0);

  if (foreign) {
    return {
      status: "DESTINATION_FOREIGN_EQUIVALENT",
      safeForExecute: true,
      notes: [
        "Destination content equivalent with foreign/prior migration ownership metadata; will not overwrite",
      ],
    };
  }

  return {
    status: "DESTINATION_EQUIVALENT",
    safeForExecute: true,
    notes: [
      "Destination content equivalent (pre-existing or unowned); will not overwrite",
    ],
  };
}

/**
 * Read-only dual-R2 media preflight for reconciled unique public objects.
 * Never PutObject / DeleteObject / Mongo writes / recovery writes.
 */
export async function runMediaR2Preflight(input: {
  planned: readonly PlannedMediaCopy[];
  reader: MediaR2PreflightReader;
  destinationPublicBaseUrl?: string;
  /** Optional counters proving non-mutation (defaults read from reader / zero). */
  mutationCounters?: MediaR2PreflightMutationCounters;
}): Promise<MediaR2PreflightReport> {
  const base = (input.destinationPublicBaseUrl ?? PRODUCTION_MEDIA_PUBLIC_BASE_URL).replace(
    /\/$/,
    "",
  );
  const blockers: string[] = [];

  if (base !== PRODUCTION_MEDIA_PUBLIC_BASE_URL) {
    blockers.push(
      `Destination public base must be ${PRODUCTION_MEDIA_PUBLIC_BASE_URL} (got ${base})`,
    );
  }

  const keys: MediaR2PreflightKeyRow[] = [];
  let sourceObjectsReadable = 0;
  let destinationAbsent = 0;
  let destinationEquivalent = 0;
  let destinationConflicts = 0;
  let totalBytes = 0;

  for (const item of input.planned) {
    const notes: string[] = [];
    const expectedUrl = `${base}/${item.storageKey.replace(/^\/+/, "")}`;
    if (item.destinationUrl.replace(/\/$/, "") !== expectedUrl) {
      blockers.push(
        `Planned destinationUrl for ${item.storageKey} must use ${PRODUCTION_MEDIA_PUBLIC_BASE_URL}`,
      );
      notes.push("destinationUrl base mismatch");
    }

    let sourceStatus: MediaR2PreflightSourceStatus = "SOURCE_OK";
    let source: PreparedSourceObject | null = null;
    let sourceContentSha256: string | null = null;
    let sourceContentLength: number | null = null;
    let sourceContentType: string | null = null;
    let destinationStatus: MediaR2PreflightDestinationStatus | null = null;
    let destinationContentSha256: string | null = null;
    let destinationContentLength: number | null = null;
    let destinationOwnershipExecutionId: string | null = null;
    let safeForExecute = false;

    try {
      source = await input.reader.prepareSourceObject(item.storageKey);
      sourceContentSha256 = source.checksumSHA256;
      sourceContentLength = source.contentLength;
      sourceContentType = source.contentType;
      sourceObjectsReadable += 1;
      totalBytes += source.contentLength;
    } catch (error) {
      const code =
        error instanceof ProductionInitiativeMigrationError ? error.code : null;
      if (code === "MEDIA_SOURCE_MISSING") {
        sourceStatus = "SOURCE_MISSING";
        blockers.push(`Source missing for storageKey=${item.storageKey}`);
      } else {
        sourceStatus = "SOURCE_UNREADABLE";
        blockers.push(`Source unreadable for storageKey=${item.storageKey}`);
      }
      notes.push(
        error instanceof Error ? error.message.replace(/[A-Za-z0-9+/]{20,}/g, "[redacted]") : "source read failed",
      );
    }

    if (source) {
      try {
        const observed = await input.reader.inspectDestinationObject(item.storageKey);
        const classified = classifyDestination({ source, observed });
        destinationStatus = classified.status;
        notes.push(...classified.notes);
        safeForExecute = classified.safeForExecute && sourceStatus === "SOURCE_OK";
        if (observed) {
          destinationContentSha256 = observed.checksumSHA256;
          destinationContentLength = observed.contentLength;
          destinationOwnershipExecutionId = observed.rawOwnershipExecutionId;
        }
        if (classified.status === "DESTINATION_ABSENT") {
          destinationAbsent += 1;
        } else if (
          classified.status === "DESTINATION_EQUIVALENT" ||
          classified.status === "DESTINATION_FOREIGN_EQUIVALENT"
        ) {
          destinationEquivalent += 1;
        } else {
          destinationConflicts += 1;
          blockers.push(
            `Destination conflict for storageKey=${item.storageKey}: ${classified.status}`,
          );
          safeForExecute = false;
        }
      } catch {
        destinationStatus = "DESTINATION_UNREADABLE";
        destinationConflicts += 1;
        safeForExecute = false;
        blockers.push(`Destination unreadable for storageKey=${item.storageKey}`);
        notes.push("destination inspect failed");
      }
    }

    keys.push({
      storageKey: item.storageKey,
      destinationUrl: expectedUrl,
      sourceStatus,
      sourceContentSha256,
      sourceContentLength,
      sourceContentType,
      destinationStatus,
      destinationContentSha256,
      destinationContentLength,
      destinationOwnershipExecutionId,
      safeForExecute,
      notes,
    });
  }

  if (input.planned.length === 0) {
    blockers.push("No unique public media objects planned for R2 preflight");
  }

  const putObjectCalls =
    input.mutationCounters?.putObjectCalls ?? input.reader.getWriteCount?.() ?? 0;
  const deleteObjectCalls =
    input.mutationCounters?.deleteObjectCalls ?? input.reader.getDeleteCount?.() ?? 0;
  const mongoWrites = input.mutationCounters?.mongoWrites ?? 0;
  const recoveryStoreWrites = input.mutationCounters?.recoveryStoreWrites ?? 0;

  if (putObjectCalls > 0 || deleteObjectCalls > 0) {
    blockers.push("Refusing verdict: R2 mutation detected during read-only preflight");
  }
  if (mongoWrites > 0 || recoveryStoreWrites > 0) {
    blockers.push("Refusing verdict: Mongo/recovery mutation detected during read-only preflight");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const allSourcesOk =
    sourceObjectsReadable === input.planned.length && input.planned.length > 0;
  const allDestSafe = keys.every(
    (row) =>
      row.sourceStatus !== "SOURCE_OK" ||
      row.destinationStatus === "DESTINATION_ABSENT" ||
      row.destinationStatus === "DESTINATION_EQUIVALENT" ||
      row.destinationStatus === "DESTINATION_FOREIGN_EQUIVALENT",
  );
  const verdict: "PASS" | "FAIL" =
    uniqueBlockers.length === 0 && allSourcesOk && allDestSafe && base === PRODUCTION_MEDIA_PUBLIC_BASE_URL
      ? "PASS"
      : "FAIL";

  const report: MediaR2PreflightReport = {
    tool: "preflight-production-initiative-migration-media-r2",
    mode: "read-only",
    destinationPublicBaseUrl: base,
    dualR2: {
      sourceCredentialsConfigured: true,
      destinationCredentialsConfigured: true,
      bucketsDistinct: true,
    },
    sourceObjectsExpected: input.planned.length,
    sourceObjectsReadable,
    destinationAbsent,
    destinationEquivalent,
    destinationConflicts,
    totalBytes,
    blockers: uniqueBlockers,
    verdict,
    keys,
    mutationProof: {
      putObjectCalls,
      deleteObjectCalls,
      mongoWrites,
      recoveryStoreWrites,
    },
  };

  assertNoSecretLeak(JSON.stringify(report));
  return report;
}

/** Build a sanitized JSON string of the report (asserts no credential leak). */
export function formatMediaR2PreflightReport(report: MediaR2PreflightReport): string {
  const text = JSON.stringify(report, null, 2);
  assertNoSecretLeak(text);
  return text;
}
