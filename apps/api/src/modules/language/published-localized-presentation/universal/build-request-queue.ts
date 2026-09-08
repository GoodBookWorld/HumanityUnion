/**
 * RESET 04 / 05C / 05C.1 — PLP build request queue (durable source of truth).
 *
 * Lifecycle:
 * - Enqueue upserts durable work (Mongo when configured, else memory).
 * - Drain claims from durable store and runs the registered processor.
 * - Pending work survives restart when QUEUE_BACKEND=MONGO.
 * - Default concurrency 1 (resolvePlpProviderConcurrency).
 * - Without a processor, work stays pending (no dormant re-queue spin).
 */

import type {
  PlpBuildRequest,
  PlpBuildRequestStatus,
  PlpPublicationTriggerKind,
  PublicPresentationNode,
} from "@hu/types";
import { plpBuildWorkKey, PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "../persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "../usability.js";
import {
  recordPlpAutoBuildDequeued,
  recordPlpAutoBuildFailed,
  recordPlpAutoBuildProviderCall,
  recordPlpAutoBuildPublish,
  recordPlpAutoBuildStarted,
  recordPlpAutoBuildSucceeded,
  recordPlpAutoBuildWorkAccepted,
  recordPlpAutoBuildWorkDeduped,
  recordPlpAutoBuildWorkSkippedUsable,
  refreshPlpAutoBuildQueueDepthFromStore,
  setPlpAutoBuildProcessorRunning,
} from "./plp-auto-build-runtime.js";
import {
  structuredFailure,
  type ProcessPlpBuildRequestResult,
} from "./plp-auto-build-failure.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkCompleted,
  markPlpAutoBuildWorkFailed,
  markPlpAutoBuildWorkSkippedUsable,
  markPlpAutoBuildWorkSuperseded,
  resetPlpAutoBuildWorkStoreForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "./plp-auto-build-work.repository.js";
import { resolvePlpProviderConcurrency } from "./safety.js";

type ProcessorFn = (
  request: PlpBuildRequest,
) => Promise<ProcessPlpBuildRequestResult | PlpBuildRequestStatus>;

const completed: PlpBuildRequest[] = [];
let running = 0;
let processor: ProcessorFn | null = null;
let drainInProgress = false;
let drainKickPending = false;

/**
 * Production (and test) processor wiring. Sets the handler and kicks drain
 * so durable pending work is processed.
 */
export function setPlpBuildRequestProcessor(fn: ProcessorFn | null): void {
  processor = fn;
  if (fn != null) {
    kickPlpAutoBuildDrain();
  }
}

/** @deprecated Prefer setPlpBuildRequestProcessor — kept as test alias. */
export function setPlpBuildRequestProcessorForTests(fn: ProcessorFn | null): void {
  setPlpBuildRequestProcessor(fn);
}

export function getPlpBuildRequestProcessorForTests(): ProcessorFn | null {
  return processor;
}

export function resetPlpBuildRequestQueueForTests(): void {
  completed.length = 0;
  running = 0;
  processor = null;
  drainInProgress = false;
  drainKickPending = false;
  resetPlpAutoBuildWorkStoreForTests();
}

export function getPlpBuildRequestQueueStats(): {
  readonly pending: number;
  readonly running: number;
  readonly completed: number;
  readonly PROVIDER_CONCURRENCY: number;
  readonly processorActive: boolean;
} {
  const pending = listPlpAutoBuildWorkForTests().filter((r) => r.status === "pending")
    .length;
  return {
    pending,
    running,
    completed: completed.length,
    PROVIDER_CONCURRENCY: resolvePlpProviderConcurrency(),
    processorActive: processor != null,
  };
}

export function listPlpBuildRequestsPendingForTests(): readonly PlpBuildRequest[] {
  return listPlpAutoBuildWorkForTests()
    .filter((r) => r.status === "pending" || r.status === "running")
    .map((work) => workToRequest(work));
}

export function listPlpBuildRequestsCompletedForTests(): readonly PlpBuildRequest[] {
  return [...completed];
}

function workToRequest(
  work: PlpAutoBuildWorkRecord,
  status: PlpBuildRequestStatus = work.status === "pending"
    ? "QUEUED"
    : work.status === "running"
      ? "RUNNING"
      : work.status === "completed"
        ? "COMPLETED"
        : work.status === "failed"
          ? "FAILED"
          : work.status === "superseded"
            ? "SUPERSEDED"
            : "SKIPPED_USABLE",
): PlpBuildRequest {
  return {
    workKey: work.workKey,
    entityType: work.entityType,
    entityId: work.entityId,
    locale: work.locale,
    canonicalVersion: work.canonicalVersion,
    contentRevision: work.contentRevision,
    trigger: work.trigger,
    enqueuedAt: work.enqueuedAt,
    status,
  };
}

/**
 * Optional enqueue-time skip when a usable PLP already exists for this version.
 * Identity fingerprint authority unchanged — only suppresses duplicate provider work.
 */
export async function isExistingPlpUsableForEnqueue(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly canonicalPresentation?: PublicPresentationNode | null;
}): Promise<boolean> {
  try {
    const existing = await findCurrentPublishedPresentation({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
    });
    if (!existing) {
      return false;
    }
    if (
      existing.state === "PUBLISHED" &&
      existing.identity.canonicalVersion === input.canonicalVersion &&
      input.canonicalPresentation == null &&
      existing.contentIntegrity?.status === "PASSED" &&
      existing.structuralIntegrity?.status === "PASSED"
    ) {
      return true;
    }
    if (input.canonicalPresentation == null) {
      return false;
    }
    const usability = classifyUsableLocalizedPresentation({
      locale: input.locale,
      liveCanonicalVersion: input.canonicalVersion,
      liveLocalizationSchemaVersion:
        existing.identity.localizationSchemaVersion ??
        PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: input.canonicalPresentation,
      snapshot: existing,
    });
    return usability.allowPublishedLocalized;
  } catch {
    return false;
  }
}

export type EnqueuePlpBuildRequestResult = {
  readonly request: PlpBuildRequest;
  readonly accepted: boolean;
  readonly deduped: boolean;
  readonly skippedUsable: boolean;
};

type EnqueueInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
  readonly canonicalPresentation?: PublicPresentationNode | null;
  /** Default true. Set false to skip usability probe (tests / forced rebuild). */
  readonly skipUsableCheck?: boolean;
  /**
   * RESET 05D — when true, same-version terminal failed rows may be reopened
   * for consumer-visible heal (media-12 / editorial). Not for mass historical reopen.
   */
  readonly reopenFailedSameVersion?: boolean;
  /** RESET 05E.1 — stamp when reopening under provider-contract recovery. */
  readonly recoveryGeneration?: string | null;
};

function finalizeUpsertResult(
  upsert: Awaited<ReturnType<typeof upsertPendingPlpAutoBuildWork>>,
): EnqueuePlpBuildRequestResult {
  if (upsert.deduped) {
    recordPlpAutoBuildWorkDeduped();
  } else {
    recordPlpAutoBuildWorkAccepted();
  }
  void refreshPlpAutoBuildQueueDepthFromStore();
  kickPlpAutoBuildDrain();
  return {
    request: workToRequest(upsert.record),
    accepted: upsert.accepted,
    deduped: upsert.deduped,
    skippedUsable: false,
  };
}

function skippedUsableResult(input: EnqueueInput): EnqueuePlpBuildRequestResult {
  recordPlpAutoBuildWorkSkippedUsable();
  return {
    request: {
      workKey: plpBuildWorkKey(input),
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale).toLowerCase(),
      canonicalVersion: input.canonicalVersion,
      contentRevision: input.contentRevision,
      trigger: input.trigger,
      enqueuedAt: new Date().toISOString(),
      status: "SKIPPED_USABLE",
    },
    accepted: false,
    deduped: true,
    skippedUsable: true,
  };
}

/**
 * Enqueue or coalesce into durable work. Never starts Gemini here — only schedules.
 * Always returns a Promise so callers can await durable upserts (RSS refresh).
 * Memory path without usable-check completes synchronously before the Promise settles
 * so existing unit tests that fire-and-forget still observe pending immediately.
 */
export function enqueuePlpBuildRequest(
  input: EnqueueInput,
): Promise<EnqueuePlpBuildRequestResult> {
  const needsUsableProbe =
    input.skipUsableCheck !== false && input.canonicalPresentation != null;

  if (!needsUsableProbe) {
    // Sync-start path: memory upsert runs before Promise.resolve returns.
    return upsertPendingPlpAutoBuildWork({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale).toLowerCase(),
      canonicalVersion: input.canonicalVersion,
      contentRevision: input.contentRevision,
      trigger: input.trigger,
      reopenFailedSameVersion: input.reopenFailedSameVersion === true,
      recoveryGeneration: input.recoveryGeneration,
    }).then(finalizeUpsertResult);
  }

  return (async () => {
    const usable = await isExistingPlpUsableForEnqueue({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale).toLowerCase(),
      canonicalVersion: input.canonicalVersion,
      canonicalPresentation: input.canonicalPresentation,
    });
    if (usable) {
      return skippedUsableResult(input);
    }
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: String(input.locale).toLowerCase(),
      canonicalVersion: input.canonicalVersion,
      contentRevision: input.contentRevision,
      trigger: input.trigger,
      reopenFailedSameVersion: input.reopenFailedSameVersion === true,
      recoveryGeneration: input.recoveryGeneration,
    });
    return finalizeUpsertResult(upsert);
  })();
}

/** Kick bounded drain (non-blocking). */
export function kickPlpAutoBuildDrain(): void {
  if (drainInProgress) {
    drainKickPending = true;
    return;
  }
  void drainPlpBuildQueue();
}

async function drainPlpBuildQueue(): Promise<void> {
  if (drainInProgress) {
    drainKickPending = true;
    return;
  }
  drainInProgress = true;
  setPlpAutoBuildProcessorRunning(true);
  try {
    const concurrency = resolvePlpProviderConcurrency();
    while (running < concurrency) {
      if (processor == null) {
        // Leave durable pending until processor registers — no spin.
        break;
      }
      const claimed = await claimNextPlpAutoBuildWork();
      if (!claimed) {
        break;
      }
      running += 1;
      recordPlpAutoBuildDequeued();
      const runningRequest = workToRequest(claimed, "RUNNING");
      void processClaimedWork(claimed, runningRequest).finally(() => {
        running -= 1;
        kickPlpAutoBuildDrain();
      });
    }
  } finally {
    drainInProgress = false;
    setPlpAutoBuildProcessorRunning(running > 0);
    if (drainKickPending) {
      drainKickPending = false;
      kickPlpAutoBuildDrain();
    }
    await refreshPlpAutoBuildQueueDepthFromStore();
  }
}

function normalizeProcessorOutcome(
  raw: ProcessPlpBuildRequestResult | PlpBuildRequestStatus,
): ProcessPlpBuildRequestResult {
  if (typeof raw !== "string") {
    return raw;
  }
  switch (raw) {
    case "COMPLETED":
    case "SKIPPED_USABLE":
    case "SUPERSEDED":
    case "QUEUED":
      return { status: raw };
    case "FAILED":
      return {
        status: "FAILED",
        failure: structuredFailure({
          failureCode: "UNKNOWN",
          retryable: false,
          stage: "processor",
          safeReason: "UNKNOWN:legacy_status_FAILED",
        }),
      };
    case "REJECTED_PARTIAL":
      return {
        status: "FAILED",
        failure: structuredFailure({
          failureCode: "REJECTED_PARTIAL",
          retryable: false,
          stage: "validate",
          safeReason: "REJECTED_PARTIAL",
        }),
      };
    case "RUNNING":
    default:
      return {
        status: "FAILED",
        failure: structuredFailure({
          failureCode: "UNKNOWN",
          retryable: false,
          stage: "processor",
          safeReason: `UNKNOWN:legacy_status_${raw}`,
        }),
      };
  }
}

async function processClaimedWork(
  work: PlpAutoBuildWorkRecord,
  runningRequest: PlpBuildRequest,
): Promise<void> {
  recordPlpAutoBuildStarted();
  try {
    if (processor == null) {
      await markPlpAutoBuildWorkFailed({
        workKey: work.workKey,
        attempts: work.attempts,
        maxAttempts: work.maxAttempts,
        failure: structuredFailure({
          failureCode: "PROCESSOR_DORMANT",
          retryable: true,
          stage: "processor",
          safeReason: "PROCESSOR_DORMANT",
        }),
      });
      return;
    }

    const raw = await processor(runningRequest);
    const outcome = normalizeProcessorOutcome(raw);

    completed.push({
      ...runningRequest,
      status: outcome.status === "QUEUED" ? "QUEUED" : outcome.status,
    });

    if (outcome.status === "QUEUED") {
      await markPlpAutoBuildWorkFailed({
        workKey: work.workKey,
        attempts: work.attempts,
        maxAttempts: work.maxAttempts,
        failure: structuredFailure({
          failureCode: "PROCESSOR_DORMANT",
          retryable: true,
          stage: "processor",
          safeReason: "PROCESSOR_DORMANT",
        }),
      });
      return;
    }

    if (outcome.status === "COMPLETED") {
      await markPlpAutoBuildWorkCompleted(work.workKey);
      recordPlpAutoBuildSucceeded();
      recordPlpAutoBuildPublish();
      return;
    }
    if (outcome.status === "SKIPPED_USABLE") {
      await markPlpAutoBuildWorkSkippedUsable(work.workKey);
      recordPlpAutoBuildSucceeded();
      return;
    }
    if (outcome.status === "SUPERSEDED") {
      await markPlpAutoBuildWorkSuperseded(work.workKey);
      return;
    }

    if (outcome.status !== "FAILED") {
      return;
    }

    const failure = outcome.failure;
    recordPlpAutoBuildFailed(failure.failureCode);
    await markPlpAutoBuildWorkFailed({
      workKey: work.workKey,
      attempts: work.attempts,
      maxAttempts: work.maxAttempts,
      failure,
    });
  } catch (error) {
    const failure = structuredFailure({
      failureCode: "UNKNOWN",
      retryable: true,
      stage: "processor",
      safeReason:
        error instanceof Error ? error.message : "UNKNOWN:processor_throw",
    });
    recordPlpAutoBuildFailed(failure.failureCode);
    completed.push({ ...runningRequest, status: "FAILED" });
    await markPlpAutoBuildWorkFailed({
      workKey: work.workKey,
      attempts: work.attempts,
      maxAttempts: work.maxAttempts,
      failure,
    });
  }
}

/**
 * Stale-work guard: a build targeting an older canonicalVersion must not
 * overwrite a newer published/current version.
 */
export function isPlpBuildStaleAgainstLive(input: {
  readonly buildTargetCanonicalVersion: string;
  readonly liveCanonicalVersion: string;
}): boolean {
  return input.buildTargetCanonicalVersion !== input.liveCanonicalVersion;
}

/** Test/helper: record a provider call against runtime counters. */
export function notePlpAutoBuildProviderCallForTests(): void {
  recordPlpAutoBuildProviderCall();
}
