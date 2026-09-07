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
  readonly enqueuedAt: string;
  readonly claimedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
  readonly lastFailureAt: string | null;
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
  enqueuedAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lastFailureAt: string | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const STUCK_RUNNING_MS = 10 * 60 * 1000;

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
    enqueuedAt: doc.enqueuedAt,
    claimedAt: doc.claimedAt,
    completedAt: doc.completedAt,
    updatedAt: doc.updatedAt,
    lastFailureAt: doc.lastFailureAt,
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
      enqueuedAt: updatedAt,
      claimedAt: null,
      completedAt: null,
      updatedAt,
      lastFailureAt: null,
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
  const record: PlpAutoBuildWorkRecord = {
    ...existing,
    canonicalVersion: input.canonicalVersion,
    contentRevision: newerRevision,
    trigger: input.trigger,
    status: "pending",
    maxAttempts: input.maxAttempts,
    lastError: null,
    claimedAt: null,
    completedAt: null,
    updatedAt,
    // Preserve enqueuedAt for FIFO when still pending; refresh when reopening terminal.
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
          row.status === "pending" ||
          (row.status === "running" &&
            row.claimedAt != null &&
            row.claimedAt < stuckBefore),
      )
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    const next = candidates[0];
    if (!next) {
      return null;
    }
    const claimed: PlpAutoBuildWorkRecord = {
      ...next,
      status: "running",
      claimedAt: now,
      updatedAt: now,
      attempts: next.attempts + 1,
    };
    memoryByWorkKey.set(next.workKey, claimed);
    return claimed;
  }

  const col = collection();
  const claimed = await col.findOneAndUpdate(
    {
      $or: [
        { status: "pending" },
        { status: "running", claimedAt: { $lt: stuckBefore } },
      ],
    },
    {
      $set: {
        status: "running",
        claimedAt: now,
        updatedAt: now,
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
      },
    },
  );
}

export async function markPlpAutoBuildWorkCompleted(workKey: string): Promise<void> {
  await markTerminal(workKey, "completed");
}

export async function markPlpAutoBuildWorkSuperseded(workKey: string): Promise<void> {
  await markTerminal(workKey, "superseded");
}

export async function markPlpAutoBuildWorkSkippedUsable(workKey: string): Promise<void> {
  await markTerminal(workKey, "skipped_usable");
}

export async function markPlpAutoBuildWorkFailed(input: {
  readonly workKey: string;
  readonly reason: string;
  readonly attempts: number;
  readonly maxAttempts: number;
}): Promise<{ readonly requeued: boolean }> {
  const safeReason = sanitizePlpAutoBuildFailureReason(input.reason);
  const now = nowIso();
  const canRetry = input.attempts < input.maxAttempts;

  if (usePlpAutoBuildWorkMemory()) {
    const existing = memoryByWorkKey.get(input.workKey);
    if (!existing) {
      return { requeued: false };
    }
    if (canRetry) {
      memoryByWorkKey.set(input.workKey, {
        ...existing,
        status: "pending",
        lastError: safeReason,
        lastFailureAt: now,
        updatedAt: now,
        claimedAt: null,
        completedAt: null,
      });
      return { requeued: true };
    }
    memoryByWorkKey.set(input.workKey, {
      ...existing,
      status: "failed",
      lastError: safeReason,
      lastFailureAt: now,
      updatedAt: now,
      completedAt: now,
    });
    return { requeued: false };
  }

  if (canRetry) {
    await collection().updateOne(
      { workKey: input.workKey },
      {
        $set: {
          status: "pending",
          lastError: safeReason,
          lastFailureAt: now,
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
        lastError: safeReason,
        lastFailureAt: now,
        updatedAt: now,
        completedAt: now,
      },
    },
  );
  return { requeued: false };
}

/** Safe reason codes only — strip URLs, payloads, long blobs. */
export function sanitizePlpAutoBuildFailureReason(reason: string): string {
  const trimmed = reason.trim().slice(0, 120);
  return trimmed
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[redacted]")
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/[A-Za-z0-9+/_-]{40,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "FAILED";
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
  | "FAILED"
  | "PROCESSOR_DORMANT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILURE"
  | "PROVIDER_PARTIAL"
  | "PROVIDER_INTEGRITY"
  | "PROVIDER_PAYLOAD"
  | "PROVIDER_CAP"
  | "REJECTED_PARTIAL"
  | "PUBLISH_FAILED"
  | "ADAPTER_OR_SOURCE"
  | "UNKNOWN";

/**
 * Map sanitized lastError into a stable failure class for grouping.
 * Does not invent reasons — only classifies stored safe codes/messages.
 */
export function normalizePlpAutoBuildFailureClass(
  lastError: string | null | undefined,
): PlpAutoBuildFailureClass {
  const raw = (lastError ?? "").trim();
  if (!raw) {
    return "UNKNOWN";
  }
  const upper = raw.toUpperCase();
  if (upper === "FAILED") {
    return "FAILED";
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

