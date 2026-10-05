/**
 * RESET 05C.1 — durable PLP auto-build work store (Mongo + memory fallback).
 *
 * Source of truth for enqueue/claim/terminal status. Survives API restart.
 * lastError holds safe reason codes only — never bodies/prompts/secrets.
 */

import type { Document } from "mongodb";
import type { PlpPublicationTriggerKind } from "@hu/types";
import {
  isLocalizationSourceOriginalEntityType,
  LANGUAGE_LOCALIZATION_SOURCE_ORIGINAL_ENTITY_TYPES,
  plpBuildWorkKey,
} from "@hu/types";

import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../../infrastructure/mongodb/mongo-database.js";
import {
  sanitizePlpAutoBuildFailureReason,
  isLegacyPacingMisclassifiedTerminalFailure,
  isObsoleteTerminologyHardGateFailure,
  isPlpQuotaDeferSafeReason,
  type PlpAutoBuildFailureCode,
  type PlpAutoBuildFailureStage,
  type PlpAutoBuildStructuredFailure,
} from "./plp-auto-build-failure.js";
import {
  isCompatiblePlpBatchCheckpoint,
  type PlpBatchCheckpoint,
} from "./plp-batch-checkpoint.js";
import {
  encodePlpStructuredStaleSafeReason,
  isBareStaleRevisionReason,
  parsePlpStructuredStaleFromSafeReason,
  PLP_STALE_ORIGIN,
} from "./plp-stale-result.js";
import { getThinGeminiCooldownSnapshot } from "../../media-plp-materializer/thin-gemini-provider-state.js";
import {
  PLP_PROVIDER_QUOTA_CLASS,
  resolveQuotaCooldownSeconds,
  type PlpProviderQuotaClass,
} from "../../media-plp-materializer/gemini-quota-forensics.js";

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
   * Durable attempt-window index for the same canonical version: "0", "1", or "2".
   * Null means window 0 has not yet exhausted. Historical "05E" is not a window index.
   * Ordinary same-version coalesce must not clear it. A new canonical version does.
   */
  readonly recoveryGeneration: string | null;
  /**
   * Accepted machine segments for this canonical version.
   * Null when there is no partial progress. Cleared on publish or version change.
   */
  readonly batchCheckpoint: PlpBatchCheckpoint | null;
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
  batchCheckpoint?: PlpBatchCheckpoint | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const STUCK_RUNNING_MS = 10 * 60 * 1000;
const PLP_PROVIDER_ADMISSION_FALLBACK_MS = 60_000;

let plpProviderAdmissionReads = 0;
let plpStatusAggregationReads = 0;

export function resetPlpProviderAdmissionReadsForTests(): void {
  plpProviderAdmissionReads = 0;
}

export function plpProviderAdmissionReadsForTests(): number {
  return plpProviderAdmissionReads;
}

export function resetPlpStatusAggregationReadsForTests(): void {
  plpStatusAggregationReads = 0;
}

export function plpStatusAggregationReadsForTests(): number {
  return plpStatusAggregationReads;
}
/** RESET 05E — base backoff for retryable provider failures (ms). */
const PROVIDER_RETRY_BACKOFF_BASE_MS = 5_000;
const PROVIDER_RETRY_BACKOFF_MAX_MS = 60_000;

/**
 * Same-version automatic recovery windows after the immediate attempt budget.
 * Window 0 is the immediate budget. Generations 1 and 2 are delayed recoveries.
 * Absolute ceiling: 3 windows × maxAttempts.
 */
export const PLP_MAX_RECOVERY_GENERATIONS = 2;
export const PLP_RECOVERY_COOLDOWN_GENERATION_1_MS = 30 * 60 * 1000;
export const PLP_RECOVERY_COOLDOWN_GENERATION_2_MS = 60 * 60 * 1000;

/** Null and non-numeric stamps (including historical "05E") are window 0. */
export function parsePlpRecoveryGeneration(
  value: string | null | undefined,
): number {
  if (value === "0" || value === "1" || value === "2") {
    return Number(value);
  }
  return 0;
}

/** Cooldown before the next recovery window. Null when no further window remains. */
export function computePlpRecoveryCooldownNextAttemptAt(
  exhaustedGeneration: number,
  nowMs: number = Date.now(),
): string | null {
  const nextWindow = exhaustedGeneration + 1;
  if (nextWindow > PLP_MAX_RECOVERY_GENERATIONS) {
    return null;
  }
  const delay =
    nextWindow === 1
      ? PLP_RECOVERY_COOLDOWN_GENERATION_1_MS
      : PLP_RECOVERY_COOLDOWN_GENERATION_2_MS;
  return new Date(nowMs + delay).toISOString();
}

/**
 * Bounded exponential backoff with jitter. attempts is the post-claim count.
 * Does not raise maxAttempts.
 * RESET 05E.2 — minimum 5s so drain (3s) cannot reclaim in a tight loop;
 * Retry-After (seconds) raises the floor when present.
 */
export function computePlpProviderRetryNextAttemptAt(
  attempts: number,
  nowMs: number = Date.now(),
  options?: { readonly retryAfterSeconds?: number | null },
): string {
  const exp = Math.max(0, Math.trunc(attempts) - 1);
  const exponential = Math.min(
    PROVIDER_RETRY_BACKOFF_MAX_MS,
    PROVIDER_RETRY_BACKOFF_BASE_MS * 2 ** exp,
  );
  const retryAfterMs =
    options?.retryAfterSeconds != null &&
    Number.isFinite(options.retryAfterSeconds) &&
    options.retryAfterSeconds > 0
      ? Math.min(Math.trunc(options.retryAfterSeconds), 3600) * 1000
      : 0;
  const delay = Math.max(exponential, retryAfterMs);
  const jitter = Math.floor(delay * 0.2 * Math.random());
  return new Date(nowMs + delay + jitter).toISOString();
}

let forceMemoryForTests = false;
let nowOverrideMs: number | null = null;
const memoryByWorkKey = new Map<string, PlpAutoBuildWorkRecord>();

export function setPlpAutoBuildWorkForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function setPlpAutoBuildNowMsForTests(ms: number | null): void {
  nowOverrideMs = ms;
}

export function resetPlpAutoBuildWorkStoreForTests(): void {
  memoryByWorkKey.clear();
  nowOverrideMs = null;
}

/** Memory-store seam for a pre-existing document. Does not write Mongo. */
export function putPlpAutoBuildWorkForTests(record: PlpAutoBuildWorkRecord): void {
  if (!forceMemoryForTests) {
    throw new Error("putPlpAutoBuildWorkForTests requires the memory work store");
  }
  memoryByWorkKey.set(record.workKey, record);
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

function nowMs(): number {
  return nowOverrideMs ?? Date.now();
}

function nowIso(): string {
  return new Date(nowMs()).toISOString();
}

function isDueRecoveryWindow(row: PlpAutoBuildWorkRecord, now: string): boolean {
  if (row.status !== "pending" || row.retryable !== true) {
    return false;
  }
  if (isLocalizationSourceOriginalEntityType(row.entityType)) {
    return false;
  }
  if (row.attempts < row.maxAttempts) {
    return false;
  }
  if (row.nextAttemptAt == null || row.nextAttemptAt > now) {
    return false;
  }
  return parsePlpRecoveryGeneration(row.recoveryGeneration) < PLP_MAX_RECOVERY_GENERATIONS;
}

/**
 * When a recovery cooldown is due, open the next window on the same document.
 * Increments recoveryGeneration once and restores a fresh per-window attempt budget.
 * Does not call the provider.
 */
async function promoteDueRecoveryWindow(now: string): Promise<void> {
  if (usePlpAutoBuildWorkMemory()) {
    const due = [...memoryByWorkKey.values()]
      .filter((row) => isDueRecoveryWindow(row, now))
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    const row = due[0];
    if (!row) {
      return;
    }
    const generation = parsePlpRecoveryGeneration(row.recoveryGeneration);
    memoryByWorkKey.set(row.workKey, {
      ...row,
      status: "pending",
      attempts: 0,
      recoveryGeneration: String(generation + 1),
      nextAttemptAt: null,
      claimedAt: null,
      completedAt: null,
      updatedAt: now,
    });
    return;
  }

  const col = collection();
  const due = await col.findOne(
    {
      status: "pending",
      retryable: true,
      nextAttemptAt: { $ne: null, $lte: now },
      $expr: { $gte: ["$attempts", "$maxAttempts"] },
      entityType: { $nin: [...LANGUAGE_LOCALIZATION_SOURCE_ORIGINAL_ENTITY_TYPES] },
      $or: [
        { recoveryGeneration: null },
        { recoveryGeneration: { $exists: false } },
        { recoveryGeneration: "0" },
        { recoveryGeneration: "1" },
      ],
    },
    { sort: { enqueuedAt: 1 } },
  );
  if (!due) {
    return;
  }
  const generation = parsePlpRecoveryGeneration(due.recoveryGeneration ?? null);
  if (generation >= PLP_MAX_RECOVERY_GENERATIONS) {
    return;
  }
  await col.updateOne(
    {
      workKey: due.workKey,
      status: "pending",
      attempts: due.attempts,
      nextAttemptAt: due.nextAttemptAt ?? null,
    },
    {
      $set: {
        status: "pending",
        attempts: 0,
        recoveryGeneration: String(generation + 1),
        nextAttemptAt: null,
        claimedAt: null,
        completedAt: null,
        updatedAt: now,
      },
    },
  );
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
    batchCheckpoint: doc.batchCheckpoint ?? null,
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
  /**
   * Live provider plan. Required before an obsolete terminology row can be
   * adopted, so the stored fingerprint is the same one resume will accept.
   */
  readonly checkpointBatches?: readonly (Readonly<Record<string, string>>)[];
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
      batchCheckpoint: null,
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

  // Same-version failed: ordinary coalesce keeps the forensic row.
  // A wake may adopt retryable exhaustion into the durable recovery contract.
  // It must not reset attempts or recoveryGeneration, and it must not reopen
  // non-retryable or generation-capped failures.
  if (existing.status === "failed" && sameVersion) {
    if (
      input.reopenFailedSameVersion &&
      isObsoleteTerminologyHardGateFailure({
        failureCode: existing.failureCode,
        retryable: existing.retryable,
        safeReason: existing.lastError,
      }) &&
      isCompatiblePlpBatchCheckpoint({
        sourceVersion: input.canonicalVersion,
        checkpoint: existing.batchCheckpoint,
        batches: input.checkpointBatches,
      })
    ) {
      const record: PlpAutoBuildWorkRecord = {
        ...existing,
        status: "pending",
        attempts: Math.max(0, existing.attempts - 1),
        maxAttempts: input.maxAttempts,
        claimedAt: null,
        completedAt: null,
        updatedAt,
        nextAttemptAt: updatedAt,
        recoveryGeneration: existing.recoveryGeneration,
        batchCheckpoint: existing.batchCheckpoint,
      };
      return { accepted: true, deduped: false, record };
    }
    if (!input.reopenFailedSameVersion || existing.retryable !== true) {
      return { accepted: false, deduped: true, record: existing };
    }
    const generation = parsePlpRecoveryGeneration(existing.recoveryGeneration);
    const exhausted = existing.attempts >= existing.maxAttempts;
    if (
      exhausted &&
      (generation >= PLP_MAX_RECOVERY_GENERATIONS ||
        isLocalizationSourceOriginalEntityType(existing.entityType))
    ) {
      // ES.05 — one same-row continuation for the pre-repair pacing mislabel.
      // Does not raise the generation cap and does not reopen other failures.
      if (
        input.reopenFailedSameVersion &&
        !isLocalizationSourceOriginalEntityType(existing.entityType) &&
        isLegacyPacingMisclassifiedTerminalFailure({
          failureCode: existing.failureCode,
          retryable: existing.retryable,
          safeReason: existing.lastError,
        })
      ) {
        const record: PlpAutoBuildWorkRecord = {
          ...existing,
          status: "pending",
          attempts: Math.max(0, existing.attempts - 1),
          maxAttempts: input.maxAttempts,
          claimedAt: null,
          completedAt: null,
          updatedAt,
          nextAttemptAt: updatedAt,
          recoveryGeneration: existing.recoveryGeneration,
        };
        return { accepted: true, deduped: false, record };
      }
      return { accepted: false, deduped: true, record: existing };
    }
    if (exhausted) {
      const scheduled = computePlpRecoveryCooldownNextAttemptAt(
        generation,
        Date.parse(updatedAt),
      );
      if (!scheduled) {
        return { accepted: false, deduped: true, record: existing };
      }
      const existingDue = existing.nextAttemptAt
        ? Date.parse(existing.nextAttemptAt)
        : Number.NaN;
      const nextAttemptAt =
        Number.isFinite(existingDue) && existingDue > Date.parse(updatedAt)
          ? existing.nextAttemptAt
          : scheduled;
      const record: PlpAutoBuildWorkRecord = {
        ...existing,
        status: "pending",
        attempts: existing.attempts,
        maxAttempts: input.maxAttempts,
        claimedAt: null,
        completedAt: null,
        updatedAt,
        nextAttemptAt,
        recoveryGeneration: String(generation),
      };
      return { accepted: true, deduped: false, record };
    }
    const record: PlpAutoBuildWorkRecord = {
      ...existing,
      status: "pending",
      attempts: existing.attempts,
      maxAttempts: input.maxAttempts,
      claimedAt: null,
      completedAt: null,
      updatedAt,
      nextAttemptAt: existing.nextAttemptAt,
      recoveryGeneration: existing.recoveryGeneration,
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
    batchCheckpoint: resetAttempts ? null : existing.batchCheckpoint ?? null,
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
  readonly checkpointBatches?: readonly (Readonly<Record<string, string>>)[];
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

/**
 * Read-only provider admission. Does not call Gemini and does not write.
 * Returns the instant work may be claimed, or null when admission is open.
 * Fail-open on state-read errors, matching the previous claim path.
 */
export async function readPlpProviderNotBeforeMs(
  nowMsValue: number = Date.now(),
): Promise<number | null> {
  plpProviderAdmissionReads += 1;
  try {
    const cooldown = await getThinGeminiCooldownSnapshot(nowMsValue);
    if (cooldown.active) {
      const until = cooldown.cooldownUntil ? Date.parse(cooldown.cooldownUntil) : Number.NaN;
      return Number.isFinite(until) ? until : nowMsValue + PLP_PROVIDER_ADMISSION_FALLBACK_MS;
    }
    const { readLocalizationProviderPacing } = await import(
      "../../localization-provider-governor.js"
    );
    const pacing = await readLocalizationProviderPacing(nowMsValue);
    if (pacing.blocked) {
      const until = pacing.nextProviderRequestAt
        ? Date.parse(pacing.nextProviderRequestAt)
        : Number.NaN;
      return Number.isFinite(until) ? until : nowMsValue + PLP_PROVIDER_ADMISSION_FALLBACK_MS;
    }
    return null;
  } catch {
    return null;
  }
}

function stuckBeforeIso(): string {
  return new Date(nowMs() - STUCK_RUNNING_MS).toISOString();
}

function isImmediatelyClaimablePlpRow(
  row: PlpAutoBuildWorkRecord,
  now: string,
  stuckBefore: string,
): boolean {
  if (isLocalizationSourceOriginalEntityType(row.entityType)) {
    return false;
  }
  if (row.attempts >= row.maxAttempts) {
    return false;
  }
  if (row.nextAttemptAt != null && row.nextAttemptAt > now) {
    return false;
  }
  if (row.status === "pending") {
    return true;
  }
  return row.status === "running" && row.claimedAt != null && row.claimedAt < stuckBefore;
}

function isFutureRelevantPlpRow(row: PlpAutoBuildWorkRecord, now: string): boolean {
  if (row.status !== "pending" || isLocalizationSourceOriginalEntityType(row.entityType)) {
    return false;
  }
  if (row.nextAttemptAt == null || row.nextAttemptAt <= now) {
    return false;
  }
  if (row.attempts < row.maxAttempts) {
    return true;
  }
  return (
    row.retryable === true &&
    parsePlpRecoveryGeneration(row.recoveryGeneration) < PLP_MAX_RECOVERY_GENERATIONS
  );
}

/**
 * One bounded read: is any PLP row claimable now, including a due recovery window?
 * Completed, failed, superseded, and skipped rows are not matched.
 */
export async function probePlpAutoBuildImmediatelyDue(
  now: string = nowIso(),
): Promise<boolean> {
  const stuckBefore = stuckBeforeIso();
  if (usePlpAutoBuildWorkMemory()) {
    for (const row of memoryByWorkKey.values()) {
      if (isImmediatelyClaimablePlpRow(row, now, stuckBefore) || isDueRecoveryWindow(row, now)) {
        return true;
      }
    }
    return false;
  }

  const doc = await collection().findOne(
    {
      entityType: { $nin: [...LANGUAGE_LOCALIZATION_SOURCE_ORIGINAL_ENTITY_TYPES] },
      $or: [
        {
          status: "pending",
          $expr: { $lt: ["$attempts", "$maxAttempts"] },
          $or: [
            { nextAttemptAt: null },
            { nextAttemptAt: { $exists: false } },
            { nextAttemptAt: { $lte: now } },
          ],
        },
        {
          status: "pending",
          retryable: true,
          nextAttemptAt: { $ne: null, $lte: now },
          $expr: { $gte: ["$attempts", "$maxAttempts"] },
          $or: [
            { recoveryGeneration: null },
            { recoveryGeneration: { $exists: false } },
            { recoveryGeneration: "0" },
            { recoveryGeneration: "1" },
          ],
        },
        {
          status: "running",
          claimedAt: { $lt: stuckBefore },
          $expr: { $lt: ["$attempts", "$maxAttempts"] },
        },
      ],
    },
    { projection: { _id: 1 } },
  );
  return doc != null;
}

/**
 * Earliest future nextAttemptAt among pending rows that can still run.
 * Does not match completed history. Not used by the idle safety probe.
 */
export async function findEarliestPlpFutureDueAt(now: string = nowIso()): Promise<string | null> {
  if (usePlpAutoBuildWorkMemory()) {
    let earliest: string | null = null;
    for (const row of memoryByWorkKey.values()) {
      if (!isFutureRelevantPlpRow(row, now) || row.nextAttemptAt == null) {
        continue;
      }
      if (earliest == null || row.nextAttemptAt < earliest) {
        earliest = row.nextAttemptAt;
      }
    }
    return earliest;
  }

  const doc = await collection()
    .find(
      {
        status: "pending",
        entityType: { $nin: [...LANGUAGE_LOCALIZATION_SOURCE_ORIGINAL_ENTITY_TYPES] },
        nextAttemptAt: { $gt: now },
        $or: [
          { $expr: { $lt: ["$attempts", "$maxAttempts"] } },
          {
            retryable: true,
            $or: [
              { recoveryGeneration: null },
              { recoveryGeneration: { $exists: false } },
              { recoveryGeneration: "0" },
              { recoveryGeneration: "1" },
            ],
          },
        ],
      },
      { projection: { nextAttemptAt: 1 } },
    )
    .sort({ nextAttemptAt: 1 })
    .limit(1)
    .next();
  return doc?.nextAttemptAt ?? null;
}

export async function countPendingPlpAutoBuildWork(): Promise<number> {
  if (usePlpAutoBuildWorkMemory()) {
    let pending = 0;
    for (const row of memoryByWorkKey.values()) {
      if (row.status === "pending") {
        pending += 1;
      }
    }
    return pending;
  }
  return collection().countDocuments({ status: "pending" });
}

export async function claimNextPlpAutoBuildWork(options?: {
  readonly skipProviderAdmission?: boolean;
}): Promise<PlpAutoBuildWorkRecord | null> {
  const now = nowIso();
  const stuckBefore = stuckBeforeIso();

  // RESET 05E.3 — do not claim while thin_gemini durable cooldown is active.
  // F.3.12 — also wait for the shared global pacing permit. Neither path calls Gemini.
  if (!options?.skipProviderAdmission) {
    const notBefore = await readPlpProviderNotBeforeMs(nowMs());
    if (notBefore != null && notBefore > nowMs()) {
      return null;
    }
  }

  await promoteDueRecoveryWindow(now);

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
      .filter((row) => !isLocalizationSourceOriginalEntityType(row.entityType))
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
        {
          entityType: { $nin: [...LANGUAGE_LOCALIZATION_SOURCE_ORIGINAL_ENTITY_TYPES] },
        },
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
        ...(patch.batchCheckpoint !== undefined
          ? { batchCheckpoint: patch.batchCheckpoint }
          : {}),
      },
    },
  );
}

export async function getPlpAutoBuildWorkByKey(
  workKey: string,
): Promise<PlpAutoBuildWorkRecord | null> {
  if (usePlpAutoBuildWorkMemory()) {
    return memoryByWorkKey.get(workKey) ?? null;
  }
  const doc = await collection().findOne({ workKey });
  return doc ? mapDoc(doc) : null;
}

/**
 * One accepted batch is durable progress, not a failed attempt.
 * Refunds the claim increment and does not touch recoveryGeneration.
 */
export async function persistPlpBatchCheckpointYield(input: {
  readonly workKey: string;
  readonly attempts: number;
  readonly checkpoint: PlpBatchCheckpoint;
  readonly pacingUntil: string | null;
}): Promise<void> {
  const now = nowIso();
  let existing: PlpAutoBuildWorkRecord | null = null;
  if (usePlpAutoBuildWorkMemory()) {
    existing = memoryByWorkKey.get(input.workKey) ?? null;
  } else {
    const doc = await collection().findOne({ workKey: input.workKey });
    existing = doc ? mapDoc(doc) : null;
  }
  if (!existing) {
    return;
  }
  const record: PlpAutoBuildWorkRecord = {
    ...existing,
    status: "pending",
    attempts: Math.max(0, Math.trunc(input.attempts) - 1),
    lastError: "PROVIDER_PACING_WAIT",
    failureCode: "PROVIDER_FAILURE",
    failureStage: "provider",
    retryable: true,
    lastFailureAt: now,
    nextAttemptAt: input.pacingUntil,
    batchCheckpoint: input.checkpoint,
    claimedAt: null,
    completedAt: null,
    updatedAt: now,
  };
  if (usePlpAutoBuildWorkMemory()) {
    memoryByWorkKey.set(input.workKey, record);
    return;
  }
  await collection().updateOne({ workKey: input.workKey }, { $set: record });
}

/**
 * Provider batch accepted and safe to keep. Does not refund attempts, change
 * status, or start pacing. A later local quality failure must leave this
 * checkpoint in place.
 */
export async function persistPlpProviderSuccessCheckpoint(input: {
  readonly workKey: string;
  readonly checkpoint: PlpBatchCheckpoint;
}): Promise<void> {
  const now = nowIso();
  if (usePlpAutoBuildWorkMemory()) {
    const existing = memoryByWorkKey.get(input.workKey);
    if (!existing) {
      return;
    }
    memoryByWorkKey.set(input.workKey, {
      ...existing,
      batchCheckpoint: input.checkpoint,
      updatedAt: now,
    });
    return;
  }
  await collection().updateOne(
    { workKey: input.workKey },
    { $set: { batchCheckpoint: input.checkpoint, updatedAt: now } },
  );
}

export async function markPlpAutoBuildWorkCompleted(workKey: string): Promise<void> {
  // RESET 05D.4 — completed current truth must not expose stale failure codes.
  await markTerminal(workKey, "completed", {
    lastError: null,
    failureCode: null,
    failureStage: null,
    retryable: null,
    batchCheckpoint: null,
  });
}

export async function markPlpAutoBuildWorkSuperseded(workKey: string): Promise<void> {
  await markTerminal(workKey, "superseded");
}

export async function markPlpAutoBuildWorkSkippedUsable(workKey: string): Promise<void> {
  await markTerminal(workKey, "skipped_usable");
}

/**
 * RESET 05E.3 — nextAttemptAt for quota deferral (does not use attempt exponential).
 */
export function computePlpQuotaDeferNextAttemptAt(
  safeReason: string,
  nowMs: number = Date.now(),
  cooldownUntilIso?: string | null,
): string {
  if (cooldownUntilIso) {
    const untilMs = Date.parse(cooldownUntilIso);
    if (Number.isFinite(untilMs) && untilMs > nowMs) {
      return new Date(untilMs).toISOString();
    }
  }
  const quotaDelayMatch = safeReason.match(
    /PROVIDER_QUOTA_RETRY_DELAY_SECONDS=(\d+)/,
  )?.[1];
  const retryAfterMatch = safeReason.match(/PROVIDER_RETRY_AFTER=(\d+)/)?.[1];
  const quotaClassMatch = safeReason.match(
    /PROVIDER_QUOTA_CLASS=([A-Z_]+)/,
  )?.[1];
  const delayFromReason = Number.parseInt(
    quotaDelayMatch ?? retryAfterMatch ?? "",
    10,
  );
  const quotaClass = (quotaClassMatch ??
    PLP_PROVIDER_QUOTA_CLASS.UNKNOWN_QUOTA) as PlpProviderQuotaClass;
  const seconds = resolveQuotaCooldownSeconds({
    quotaClass,
    quotaRetryDelaySeconds: Number.isFinite(delayFromReason)
      ? delayFromReason
      : null,
  });
  return new Date(nowMs + seconds * 1000).toISOString();
}

export async function markPlpAutoBuildWorkFailed(input: {
  readonly workKey: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly failure: PlpAutoBuildStructuredFailure;
}): Promise<{ readonly requeued: boolean; readonly quotaDeferred?: boolean }> {
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
  if (input.failure.pacingDefer === true && input.failure.pacingUntil) {
    const restoredAttempts = Math.max(0, Math.trunc(input.attempts) - 1);
    const failurePatch = {
      lastError: "PROVIDER_PACING_WAIT",
      failureCode: input.failure.failureCode,
      failureStage: input.failure.stage,
      retryable: true,
      lastFailureAt: now,
      nextAttemptAt: input.failure.pacingUntil,
      attempts: restoredAttempts,
    };
    if (usePlpAutoBuildWorkMemory()) {
      const existing = memoryByWorkKey.get(input.workKey);
      if (!existing) {
        return { requeued: false, quotaDeferred: false };
      }
      memoryByWorkKey.set(input.workKey, {
        ...existing,
        ...failurePatch,
        status: "pending",
        updatedAt: now,
        claimedAt: null,
        completedAt: null,
      });
      return { requeued: true, quotaDeferred: false };
    }
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
    return { requeued: true, quotaDeferred: false };
  }
  const quotaDefer =
    input.failure.quotaDefer === true || isPlpQuotaDeferSafeReason(safeReason);

  if (quotaDefer) {
    let cooldownUntil: string | null = null;
    try {
      const snap = await getThinGeminiCooldownSnapshot();
      cooldownUntil = snap.cooldownUntil;
    } catch {
      cooldownUntil = null;
    }
    const restoredAttempts = Math.max(0, Math.trunc(input.attempts) - 1);
    const nextAttemptAt = computePlpQuotaDeferNextAttemptAt(
      safeReason,
      Date.now(),
      cooldownUntil,
    );
    const failurePatch = {
      lastError: safeReason,
      failureCode: input.failure.failureCode,
      failureStage: input.failure.stage,
      retryable: true,
      lastFailureAt: now,
      nextAttemptAt,
      attempts: restoredAttempts,
    };

    if (usePlpAutoBuildWorkMemory()) {
      const existing = memoryByWorkKey.get(input.workKey);
      if (!existing) {
        return { requeued: false, quotaDeferred: true };
      }
      memoryByWorkKey.set(input.workKey, {
        ...existing,
        ...failurePatch,
        status: "pending",
        updatedAt: now,
        claimedAt: null,
        completedAt: null,
      });
      return { requeued: true, quotaDeferred: true };
    }

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
    return { requeued: true, quotaDeferred: true };
  }

  const underCap = input.attempts < input.maxAttempts;
  const canRetry = input.failure.retryable && underCap;
  const retryAfterMatch = safeReason.match(/PROVIDER_RETRY_AFTER=(\d+)/)?.[1];
  const retryAfterSeconds = retryAfterMatch
    ? Number.parseInt(retryAfterMatch, 10)
    : null;
  // Memory/test drain is synchronous — skip wall-clock backoff there unless
  // tests opt in via HU_PLP_RETRY_BACKOFF_IN_MEMORY=1.
  const applyBackoff =
    canRetry &&
    (!usePlpAutoBuildWorkMemory() ||
      process.env.HU_PLP_RETRY_BACKOFF_IN_MEMORY === "1");
  const nextAttemptAt = applyBackoff
    ? computePlpProviderRetryNextAttemptAt(input.attempts, nowMs(), {
        retryAfterSeconds,
      })
    : null;

  const existing = usePlpAutoBuildWorkMemory()
    ? memoryByWorkKey.get(input.workKey) ?? null
    : await collection()
        .findOne({ workKey: input.workKey })
        .then((doc) => (doc ? mapDoc(doc) : null));
  if (!existing) {
    return { requeued: false };
  }

  const exhaustedRetryable =
    input.failure.retryable === true && !underCap &&
    !isLocalizationSourceOriginalEntityType(existing.entityType);
  const generation = parsePlpRecoveryGeneration(existing.recoveryGeneration);
  const recoveryCooldownAt = exhaustedRetryable
    ? computePlpRecoveryCooldownNextAttemptAt(generation, nowMs())
    : null;
  const alreadyCooling =
    recoveryCooldownAt != null &&
    existing.status === "pending" &&
    existing.attempts >= existing.maxAttempts &&
    existing.nextAttemptAt != null &&
    Date.parse(existing.nextAttemptAt) > nowMs();
  const durableRecovery =
    recoveryCooldownAt == null
      ? null
      : {
          status: "pending" as const,
          attempts: input.attempts,
          nextAttemptAt: alreadyCooling ? existing.nextAttemptAt : recoveryCooldownAt,
          recoveryGeneration: String(generation),
          completedAt: null,
          claimedAt: null,
        };

  const failurePatch = {
    lastError: safeReason,
    failureCode: input.failure.failureCode,
    failureStage: input.failure.stage,
    retryable: input.failure.retryable,
    lastFailureAt: now,
    nextAttemptAt: durableRecovery?.nextAttemptAt ?? nextAttemptAt,
    ...(durableRecovery
      ? {
          attempts: durableRecovery.attempts,
          recoveryGeneration: durableRecovery.recoveryGeneration,
        }
      : {}),
  };

  if (canRetry || durableRecovery) {
    const record: PlpAutoBuildWorkRecord = {
      ...existing,
      ...failurePatch,
      status: "pending",
      updatedAt: now,
      claimedAt: null,
      completedAt: null,
    };
    if (usePlpAutoBuildWorkMemory()) {
      memoryByWorkKey.set(input.workKey, record);
    } else {
      await collection().updateOne({ workKey: input.workKey }, { $set: record });
    }
    return { requeued: true };
  }

  const terminal: PlpAutoBuildWorkRecord = {
    ...existing,
    ...failurePatch,
    status: "failed",
    updatedAt: now,
    completedAt: now,
    nextAttemptAt: null,
  };
  if (usePlpAutoBuildWorkMemory()) {
    memoryByWorkKey.set(input.workKey, terminal);
  } else {
    await collection().updateOne({ workKey: input.workKey }, { $set: terminal });
  }
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
  plpStatusAggregationReads += 1;
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
 * Bounded locale read for activation progress. Not a corpus scan.
 */
export async function listPlpAutoBuildWorkForLocale(input: {
  readonly locale: string;
  readonly limit: number;
}): Promise<readonly PlpAutoBuildWorkRecord[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit) || 1, 1), 50);
  const locale = String(input.locale).toLowerCase();
  if (usePlpAutoBuildWorkMemory()) {
    return [...memoryByWorkKey.values()]
      .filter((row) => row.locale === locale)
      .slice(0, limit);
  }
  const docs = await collection()
    .find({ locale })
    .limit(limit)
    .toArray();
  return docs.map((doc) => mapDoc(doc));
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
