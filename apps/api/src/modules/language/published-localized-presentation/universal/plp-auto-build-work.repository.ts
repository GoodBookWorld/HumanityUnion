/**
 * RESET 05C.1 — durable PLP auto-build work store (Mongo + memory fallback).
 *
 * Source of truth for enqueue/claim/terminal status. Survives API restart.
 * lastError holds safe reason codes only — never bodies/prompts/secrets.
 */

import type { Document } from "mongodb";
import type { PlpPublicationTriggerKind } from "@hu/types";
import { plpBuildWorkKey } from "@hu/types";

import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";
import {
  sanitizePlpAutoBuildFailureReason,
  type PlpAutoBuildFailureCode,
  type PlpAutoBuildFailureStage,
  type PlpAutoBuildStructuredFailure,
} from "./plp-auto-build-failure.js";
import {
  encodePlpStructuredStaleSafeReason,
  isBareStaleRevisionReason,
  parsePlpStructuredStaleFromSafeReason,
  PLP_STALE_ORIGIN,
} from "./plp-stale-result.js";

export { sanitizePlpAutoBuildFailureReason } from "./plp-auto-build-failure.js";

export type PlpAutoBuildWorkStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "superseded"
  | "skipped_usable";

export type PlpAutoBuildWorkRecord = {
  readonly workKey: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
  readonly status: PlpAutoBuildWorkStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lastError: string | null;
  /** RESET 05C.3 — structured failure (null for legacy FAILED-only rows). */
  readonly failureCode: PlpAutoBuildFailureCode | null;
  readonly failureStage: PlpAutoBuildFailureStage | null;
  readonly retryable: boolean | null;
  readonly enqueuedAt: string;
  readonly claimedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
  readonly lastFailureAt: string | null;
  /** RESET 05E — exponential backoff gate for retryable provider failures. */
  readonly nextAttemptAt: string | null;
  /**
   * RESET 05E.1 — one-shot provider-contract recovery generation (e.g. "05E").
   * When set, bootstrap heal must not reset attempt budget again for that generation.
   */
  readonly recoveryGeneration: string | null;
};


export type UpsertPlpAutoBuildWorkResult = {
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly record: PlpAutoBuildWorkRecord;
};

interface PlpAutoBuildWorkDocument extends Document {
  workKey: string;
  entityType: string;
  entityId: string;
  locale: string;
  canonicalVersion: string;
  contentRevision: number;
  trigger: PlpPublicationTriggerKind;
  status: PlpAutoBuildWorkStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  failureCode?: PlpAutoBuildFailureCode | null;
  failureStage?: PlpAutoBuildFailureStage | null;
  retryable?: boolean | null;
  enqueuedAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lastFailureAt: string | null;
  nextAttemptAt?: string | null;
  recoveryGeneration?: string | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const STUCK_RUNNING_MS = 10 * 60 * 1000;
/** RESET 05E — base backoff for retryable provider failures (ms). */
const PROVIDER_RETRY_BACKOFF_BASE_MS = 2_000;
const PROVIDER_RETRY_BACKOFF_MAX_MS = 60_000;

/**
 * Bounded exponential backoff with jitter. attempts is the post-claim count.
 * Does not raise maxAttempts.
 */
export function computePlpProviderRetryNextAttemptAt(
  attempts: number,
  nowMs: number = Date.now(),
): string {
  const exp = Math.max(0, Math.trunc(attempts) - 1);
  const raw = Math.min(
    PROVIDER_RETRY_BACKOFF_MAX_MS,
    PROVIDER_RETRY_BACKOFF_BASE_MS * 2 ** exp,
  );
  const jitter = Math.floor(raw * 0.2 * Math.random());
  return new Date(nowMs + raw + jitter).toISOString();
}

let forceMemoryForTests = false;
const memoryByWorkKey = new Map<string, PlpAutoBuildWorkRecord>();

export function setPlpAutoBuildWorkForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetPlpAutoBuildWorkStoreForTests(): void {
  memoryByWorkKey.clear();
}

export function listPlpAutoBuildWorkForTests(): readonly PlpAutoBuildWorkRecord[] {
  return [...memoryByWorkKey.values()];
}

export function usePlpAutoBuildWorkMemory(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

export function resolvePlpAutoBuildMaxAttempts(
  envValue: string | undefined = process.env.HU_PLP_AUTO_BUILD_MAX_ATTEMPTS,
): number {
  const raw = envValue?.trim();
  if (!raw) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return Math.min(parsed, 20);
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapDoc(doc: PlpAutoBuildWorkDocument): PlpAutoBuildWorkRecord {
  return {
    workKey: doc.workKey,
    entityType: doc.entityType,
    entityId: doc.entityId,
    locale: doc.locale,
    canonicalVersion: doc.canonicalVersion,
    contentRevision: doc.contentRevision,
    trigger: doc.trigger,
    status: doc.status,
    attempts: doc.attempts,
    maxAttempts: doc.maxAttempts,
    lastError: doc.lastError,
    failureCode: doc.failureCode ?? null,
    failureStage: doc.failureStage ?? null,
    retryable: doc.retryable ?? null,
    enqueuedAt: doc.enqueuedAt,
    claimedAt: doc.claimedAt,
    completedAt: doc.completedAt,
    updatedAt: doc.updatedAt,
    lastFailureAt: doc.lastFailureAt,
    nextAttemptAt: doc.nextAttemptAt ?? null,
    recoveryGeneration: doc.recoveryGeneration ?? null,
  };
}

function collection() {
  return getMongoCollection<PlpAutoBuildWorkDocument>(MONGO_COLLECTIONS.plpAutoBuildWork);
}

function coalesceUpsert(input: {
  readonly existing: PlpAutoBuildWorkRecord | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
  readonly maxAttempts: number;
  readonly reopenFailedSameVersion?: boolean;
  /** RESET 05E.1 — stamp recovery generation when reopening exhausted provider failures. */
  readonly recoveryGeneration?: string | null;
}): UpsertPlpAutoBuildWorkResult {
  const workKey = plpBuildWorkKey(input);
  const updatedAt = nowIso();
  const existing = input.existing;

  if (!existing) {
    const record: PlpAutoBuildWorkRecord = {
      workKey,
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale).toLowerCase(),
      canonicalVersion: input.canonicalVersion,
      contentRevision: input.contentRevision,
      trigger: input.trigger,
      status: "pending",
      attempts: 0,
      maxAttempts: input.maxAttempts,
      lastError: null,
      failureCode: null,
      failureStage: null,
      retryable: null,
      enqueuedAt: updatedAt,
      claimedAt: null,
      completedAt: null,
      updatedAt,
      lastFailureAt: null,
      nextAttemptAt: null,
      recoveryGeneration: null,
    };
    return { accepted: true, deduped: false, record };
  }

  const sameVersion = existing.canonicalVersion === input.canonicalVersion;
  if (
    (existing.status === "completed" || existing.status === "skipped_usable") &&
    sameVersion
  ) {
    return { accepted: false, deduped: true, record: existing };
  }

  // Same-version terminal failed: never reopen via normal coalesce (preserves
  // forensic row; stops RSS refresh climbing attemptCount past maxAttempts).
  // RESET 05D / 05E.1 — explicit reopenFailedSameVersion allows one-shot heal.
  if (existing.status === "failed" && sameVersion) {
    if (!input.reopenFailedSameVersion) {
      return { accepted: false, deduped: true, record: existing };
    }
    const record: PlpAutoBuildWorkRecord = {
      ...existing,
      status: "pending",
      attempts: 0,
      maxAttempts: input.maxAttempts,
      claimedAt: null,
      completedAt: null,
      updatedAt,
      enqueuedAt: updatedAt,
      nextAttemptAt: null,
      recoveryGeneration:
        input.recoveryGeneration ?? existing.recoveryGeneration,
    };
    return { accepted: true, deduped: false, record };
  }

  // Same-version pending/running: coalesce in place (no duplicate work).
  if (
    sameVersion &&
    (existing.status === "pending" || existing.status === "running")
  ) {
    const newerRevision = Math.max(input.contentRevision, existing.contentRevision);
    const record: PlpAutoBuildWorkRecord = {
      ...existing,
      contentRevision: newerRevision,
      trigger: input.trigger,
      maxAttempts: input.maxAttempts,
      updatedAt,
    };
    return { accepted: false, deduped: true, record };
  }

  const reopen =
    existing.status === "completed" ||
    existing.status === "skipped_usable" ||
    existing.status === "superseded" ||
    existing.status === "failed" ||
    existing.status === "pending" ||
    existing.status === "running";

  if (!reopen) {
    return { accepted: false, deduped: true, record: existing };
  }

  const newerRevision = Math.max(input.contentRevision, existing.contentRevision);
  // New canonicalVersion → fresh attempt budget. Forensic last-failure fields retained.
  // New version is not the 05E migration reopen — clear recovery generation.
  const resetAttempts = !sameVersion;
  const record: PlpAutoBuildWorkRecord = {
    ...existing,
    canonicalVersion: input.canonicalVersion,
    contentRevision: newerRevision,
    trigger: input.trigger,
    status: "pending",
    attempts: resetAttempts ? 0 : existing.attempts,
    maxAttempts: input.maxAttempts,
    // Keep last failure forensic fields across reopen/success (bounded metadata).
    lastError: existing.lastError,
    failureCode: existing.failureCode,
    failureStage: existing.failureStage,
    retryable: existing.retryable,
    lastFailureAt: existing.lastFailureAt,
    claimedAt: null,
    completedAt: null,
    updatedAt,
    nextAttemptAt: null,
    recoveryGeneration: resetAttempts ? null : existing.recoveryGeneration,
    enqueuedAt:
      existing.status === "pending" || existing.status === "running"
        ? existing.enqueuedAt
        : updatedAt,
  };
  return { accepted: true, deduped: false, record };
}

export async function upsertPendingPlpAutoBuildWork(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
  readonly maxAttempts?: number;
  readonly reopenFailedSameVersion?: boolean;
  readonly recoveryGeneration?: string | null;
}): Promise<UpsertPlpAutoBuildWorkResult> {
  const maxAttempts = input.maxAttempts ?? resolvePlpAutoBuildMaxAttempts();
  const workKey = plpBuildWorkKey(input);

  if (usePlpAutoBuildWorkMemory()) {
    const existing = memoryByWorkKey.get(workKey) ?? null;
    const result = coalesceUpsert({
      existing,
      ...input,
      maxAttempts,
    });
    const pureTerminalDedup =
      result.deduped &&
      existing != null &&
      (existing.status === "completed" || existing.status === "skipped_usable") &&
      existing.canonicalVersion === input.canonicalVersion;
    if (!pureTerminalDedup) {
      memoryByWorkKey.set(workKey, result.record);
    }
    return result;
  }

  const col = collection();
  const existingDoc = await col.findOne({ workKey });
  const existing = existingDoc ? mapDoc(existingDoc) : null;
  const result = coalesceUpsert({
    existing,
    ...input,
    maxAttempts,
  });

  const pureTerminalDedup =
    result.deduped &&
    existing != null &&
    (existing.status === "completed" || existing.status === "skipped_usable") &&
    existing.canonicalVersion === input.canonicalVersion;
  if (pureTerminalDedup) {
    return result;
  }

  const doc: PlpAutoBuildWorkDocument = { ...result.record };
  await col.updateOne({ workKey }, { $set: doc }, { upsert: true });
  return result;
}

export async function claimNextPlpAutoBuildWork(): Promise<PlpAutoBuildWorkRecord | null> {
  const now = nowIso();
  const stuckBefore = new Date(Date.now() - STUCK_RUNNING_MS).toISOString();

  if (usePlpAutoBuildWorkMemory()) {
    const candidates = [...memoryByWorkKey.values()]
      .filter(
        (row) =>
          row.attempts < row.maxAttempts &&
          (row.nextAttemptAt == null || row.nextAttemptAt <= now) &&
          (row.status === "pending" ||
            (row.status === "running" &&
              row.claimedAt != null &&
              row.claimedAt < stuckBefore)),
      )
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    const next = candidates[0];
    if (!next) {
      return null;
    }
    // Invariant: never start an attempt when attempts already >= maxAttempts.
    if (next.attempts >= next.maxAttempts) {
      return null;
    }
    const claimed: PlpAutoBuildWorkRecord = {
      ...next,
      status: "running",
      claimedAt: now,
      updatedAt: now,
      attempts: next.attempts + 1,
      nextAttemptAt: null,
    };
    memoryByWorkKey.set(next.workKey, claimed);
    return claimed;
  }

  const col = collection();
  const claimed = await col.findOneAndUpdate(
    {
      $and: [
        { $expr: { $lt: ["$attempts", "$maxAttempts"] } },
        {
          $or: [
            { nextAttemptAt: null },
            { nextAttemptAt: { $exists: false } },
            { nextAttemptAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { status: "pending" },
            { status: "running", claimedAt: { $lt: stuckBefore } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "running",
        claimedAt: now,
        updatedAt: now,
        nextAttemptAt: null,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { enqueuedAt: 1 },
      returnDocument: "after",
    },
  );

  if (!claimed) {
    return null;
  }
  return mapDoc(claimed as PlpAutoBuildWorkDocument);
}

async function markTerminal(
  workKey: string,
  status: PlpAutoBuildWorkStatus,
  patch: Partial<PlpAutoBuildWorkRecord> = {},
): Promise<void> {
  const updatedAt = nowIso();
  if (usePlpAutoBuildWorkMemory()) {
    const existing = memoryByWorkKey.get(workKey);
    if (!existing) {
      return;
    }
    memoryByWorkKey.set(workKey, {
      ...existing,
      ...patch,
      status,
      updatedAt,
      completedAt: patch.completedAt ?? updatedAt,
    });
    return;
  }

  await collection().updateOne(
    { workKey },
    {
      $set: {
        status,
        updatedAt,
        completedAt: patch.completedAt ?? updatedAt,
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.lastFailureAt !== undefined
          ? { lastFailureAt: patch.lastFailureAt }
          : {}),
        ...(patch.failureCode !== undefined
          ? { failureCode: patch.failureCode }
          : {}),
        ...(patch.failureStage !== undefined
          ? { failureStage: patch.failureStage }
          : {}),
        ...(patch.retryable !== undefined ? { retryable: patch.retryable } : {}),
      },
    },
  );
}

export async function markPlpAutoBuildWorkCompleted(workKey: string): Promise<void> {
  // RESET 05D.4 — completed current truth must not expose stale failure codes.
  await markTerminal(workKey, "completed", {
    lastError: null,
    failureCode: null,
    failureStage: null,
    retryable: null,
  });
}

export async function markPlpAutoBuildWorkSuperseded(workKey: string): Promise<void> {
  await markTerminal(workKey, "superseded");
}

export async function markPlpAutoBuildWorkSkippedUsable(workKey: string): Promise<void> {
  await markTerminal(workKey, "skipped_usable");
}

export async function markPlpAutoBuildWorkFailed(input: {
  readonly workKey: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly failure: PlpAutoBuildStructuredFailure;
}): Promise<{ readonly requeued: boolean }> {
  let safeReason = sanitizePlpAutoBuildFailureReason(input.failure.safeReason);
  // RESET 05D.8 — bare STALE_REVISION without origin/versions is a contract violation.
  if (
    input.failure.failureCode === "STALE_CANONICAL_VERSION" ||
    safeReason.includes("STALE_REVISION") ||
    isBareStaleRevisionReason(safeReason)
  ) {
    const parsed = parsePlpStructuredStaleFromSafeReason(safeReason);
    if (!parsed || isBareStaleRevisionReason(safeReason)) {
      safeReason = encodePlpStructuredStaleSafeReason({
        code: "STALE_CANONICAL_VERSION",
        reason: "STALE_REVISION",
        originId: parsed?.originId ?? PLP_STALE_ORIGIN.MAP_BUILD_STATUS,
        boundary: parsed?.boundary ?? PLP_STALE_ORIGIN.MAP_BUILD_STATUS,
        authority: parsed?.authority ?? "markPlpAutoBuildWorkFailed",
        workCanonicalVersion: parsed?.workCanonicalVersion ?? "UNKNOWN",
        currentSourceCanonicalVersion:
          parsed?.currentSourceCanonicalVersion ?? "UNKNOWN",
        candidateCanonicalVersion: parsed?.candidateCanonicalVersion,
        existingSnapshotCanonicalVersion:
          parsed?.existingSnapshotCanonicalVersion,
        candidateContentRevision: parsed?.candidateContentRevision,
        existingContentRevision: parsed?.existingContentRevision,
      });
    }
  }
  const now = nowIso();
  const underCap = input.attempts < input.maxAttempts;
  const canRetry = input.failure.retryable && underCap;
  // Memory/test drain is synchronous — skip wall-clock backoff there.
  // Mongo durable queue uses bounded exponential backoff + jitter.
  const nextAttemptAt =
    canRetry && !usePlpAutoBuildWorkMemory()
      ? computePlpProviderRetryNextAttemptAt(input.attempts)
      : null;

  const failurePatch = {
    lastError: safeReason,
    failureCode: input.failure.failureCode,
    failureStage: input.failure.stage,
    retryable: input.failure.retryable,
    lastFailureAt: now,
    nextAttemptAt,
  };

  if (usePlpAutoBuildWorkMemory()) {
    const existing = memoryByWorkKey.get(input.workKey);
    if (!existing) {
      return { requeued: false };
    }
    if (canRetry) {
      memoryByWorkKey.set(input.workKey, {
        ...existing,
        ...failurePatch,
        status: "pending",
        updatedAt: now,
        claimedAt: null,
        completedAt: null,
      });
      return { requeued: true };
    }
    memoryByWorkKey.set(input.workKey, {
      ...existing,
      ...failurePatch,
      status: "failed",
      updatedAt: now,
      completedAt: now,
      nextAttemptAt: null,
    });
    return { requeued: false };
  }

  if (canRetry) {
    await collection().updateOne(
      { workKey: input.workKey },
      {
        $set: {
          status: "pending",
          ...failurePatch,
          updatedAt: now,
          claimedAt: null,
          completedAt: null,
        },
      },
    );
    return { requeued: true };
  }

  await collection().updateOne(
    { workKey: input.workKey },
    {
      $set: {
        status: "failed",
        ...failurePatch,
        nextAttemptAt: null,
        updatedAt: now,
        completedAt: now,
      },
    },
  );
  return { requeued: false };
}

export async function countPlpAutoBuildWorkByStatus(): Promise<{
  readonly pending: number;
  readonly running: number;
  readonly completed: number;
  readonly failed: number;
  readonly superseded: number;
  readonly skipped_usable: number;
}> {
  const empty = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    superseded: 0,
    skipped_usable: 0,
  };

  if (usePlpAutoBuildWorkMemory()) {
    for (const row of memoryByWorkKey.values()) {
      empty[row.status] += 1;
    }
    return empty;
  }

  const col = collection();
  const rows = await col
    .aggregate<{ _id: PlpAutoBuildWorkStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();
  for (const row of rows) {
    if (row._id in empty) {
      empty[row._id] += row.count;
    }
  }
  return empty;
}

/** RESET 05C.2 — bounded READ-ONLY list of terminal failed work. */
export const PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_DEFAULT_LIMIT = 20;
export const PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT = 20;

export type PlpAutoBuildFailureClass =
  | PlpAutoBuildFailureCode
  | "FAILED"
  | "UNKNOWN";

/**
 * Map sanitized lastError / persisted failureCode into a stable failure class.
 * Prefers structured failureCode when present (05C.3).
 */
export function normalizePlpAutoBuildFailureClass(
  lastError: string | null | undefined,
  persistedCode?: PlpAutoBuildFailureCode | string | null,
): PlpAutoBuildFailureClass {
  if (persistedCode && persistedCode !== "FAILED") {
    return persistedCode as PlpAutoBuildFailureClass;
  }
  const raw = (lastError ?? "").trim();
  if (!raw) {
    return "UNKNOWN";
  }
  const upper = raw.toUpperCase();
  if (upper === "FAILED") {
    return "FAILED";
  }
  const known: PlpAutoBuildFailureCode[] = [
    "PROCESSOR_DORMANT",
    "SOURCE_NOT_FOUND",
    "ADAPTER_OR_SOURCE",
    "PROVIDER_TIMEOUT",
    "PROVIDER_FAILURE",
    "PROVIDER_PARTIAL",
    "PROVIDER_INTEGRITY",
    "PROVIDER_PAYLOAD",
    "PROVIDER_CAP",
    "REJECTED_PARTIAL",
    "PUBLISH_FAILED",
    "STALE_CANONICAL_VERSION",
  ];
  for (const code of known) {
    if (upper === code || upper.startsWith(`${code}:`)) {
      return code;
    }
  }
  if (upper.includes("PROCESSOR_DORMANT")) {
    return "PROCESSOR_DORMANT";
  }
  if (upper.includes("TIMEOUT") || upper.includes("TIMED OUT")) {
    return "PROVIDER_TIMEOUT";
  }
  if (
    upper.includes("PARTIAL") ||
    upper.includes("REJECTED_PARTIAL") ||
    upper.includes("WRONG_TARGET")
  ) {
    if (upper.includes("REJECTED_PARTIAL")) {
      return "REJECTED_PARTIAL";
    }
    return "PROVIDER_PARTIAL";
  }
  if (
    upper.includes("INTEGRITY") ||
    upper.includes("LOCALIZATION_CONTENT_INTEGRITY")
  ) {
    return "PROVIDER_INTEGRITY";
  }
  if (upper.includes("PAYLOAD") || upper.includes("PAYLOAD_LIMIT")) {
    return "PROVIDER_PAYLOAD";
  }
  if (upper.includes("PROVIDER_CALL_CAP") || upper.includes("CALL_CAP")) {
    return "PROVIDER_CAP";
  }
  if (
    upper.includes("PROVIDER") ||
    upper.includes("GEMINI") ||
    upper.includes("PARSE_FAILURE")
  ) {
    return "PROVIDER_FAILURE";
  }
  if (upper.includes("PUBLISH")) {
    return "PUBLISH_FAILED";
  }
  if (
    upper.includes("ADAPTER") ||
    upper.includes("SOURCE_NOT") ||
    upper.includes("NOT_FOUND")
  ) {
    return "ADAPTER_OR_SOURCE";
  }
  return "UNKNOWN";
}

/**
 * READ-ONLY: list terminal failed rows, newest failure first, hard-bounded.
 */
export async function listFailedPlpAutoBuildWork(input: {
  readonly limit: number;
}): Promise<readonly PlpAutoBuildWorkRecord[]> {
  const limit = Math.min(
    Math.max(Math.trunc(input.limit) || 1, 1),
    PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT,
  );

  if (usePlpAutoBuildWorkMemory()) {
    return [...memoryByWorkKey.values()]
      .filter((row) => row.status === "failed")
      .sort((a, b) => {
        const aAt = a.lastFailureAt ?? a.updatedAt;
        const bAt = b.lastFailureAt ?? b.updatedAt;
        return bAt.localeCompare(aAt);
      })
      .slice(0, limit);
  }

  const docs = await collection()
    .find(
      { status: "failed" },
      {
        projection: {
          workKey: 1,
          entityType: 1,
          entityId: 1,
          locale: 1,
          canonicalVersion: 1,
          contentRevision: 1,
          trigger: 1,
          status: 1,
          attempts: 1,
          maxAttempts: 1,
          lastError: 1,
          failureCode: 1,
          failureStage: 1,
          retryable: 1,
          enqueuedAt: 1,
          claimedAt: 1,
          completedAt: 1,
          updatedAt: 1,
          lastFailureAt: 1,
        },
        sort: { lastFailureAt: -1, updatedAt: -1 },
        limit,
      },
    )
    .limit(limit)
    .toArray();

  return docs.map((doc) => mapDoc(doc as PlpAutoBuildWorkDocument));
}

/** READ-ONLY lookup by work identity (diagnostic). */
export async function findPlpAutoBuildWorkByKey(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<PlpAutoBuildWorkRecord | null> {
  const workKey = plpBuildWorkKey(input);
  if (usePlpAutoBuildWorkMemory()) {
    return memoryByWorkKey.get(workKey) ?? null;
  }
  const doc = await collection().findOne({ workKey });
  return doc ? mapDoc(doc as PlpAutoBuildWorkDocument) : null;
}

