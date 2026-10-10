import { deserializeDomainEventEnvelope } from "../events/event-serialization.js";
import { dispatchEnvelopeToHandlers } from "../integration/event-handler-registry.js";
import { logDomainEvent, logger } from "../../shared/observability/logger.js";
import { isMongoConfigured } from "../mongodb/mongo-config.js";
import { resolveOutboxConfig } from "./outbox.config.js";
import { registerOutboxDispatcherWake } from "./outbox-wake.js";
import {
  claimEventForProcessing,
  markEventProcessingCompleted,
  PROCESSING_CLAIM_HEARTBEAT_MS,
  releaseEventProcessingClaim,
  renewEventProcessingClaim,
} from "./processed-events.repository.js";
import {
  deferOutboxRecordUntilAvailable,
  fetchPendingOutboxRecords,
  findEarliestFutureOutboxAvailableAt,
  getOutboxDispatchStats,
  markOutboxRecordFailed,
  markOutboxRecordPublished,
  outboxPacingDeferAvailableAt,
  probeOutboxImmediatelyDue,
} from "./outbox.repository.js";
import type { OutboxHealthStatus } from "./outbox.types.js";

/** Idle multi-process/crash recovery. Not a 2s poll. */
export const OUTBOX_SAFETY_SWEEP_MS = 60_000;

export type OutboxDueSnapshot = {
  readonly immediatelyDue: boolean;
  readonly earliestFutureDueAt: string | null;
  readonly includeFuture: boolean;
};

let dispatcherStarted = false;
let dispatchInProgress = false;
let cycleInProgress = false;
let followUp = false;
let cyclePromise: Promise<void> | null = null;
let lastDispatchAt: string | null = null;
let lastError: string | null = null;
let dueTimer: NodeJS.Timeout | null = null;
let dueTimerAtMs: number | null = null;
let dueFire: (() => void) | null = null;
let safetyTimer: NodeJS.Timeout | null = null;
let safetyArmed = false;
let manualTimers = false;
let nowOverrideMs: number | null = null;
let scheduleReads = 0;
let lastScheduleRead: OutboxDueSnapshot | null = null;
let dueReaderOverride: ((input: { readonly includeFuture: boolean }) => Promise<OutboxDueSnapshot>) | null =
  null;
let batchOverride: (() => Promise<number>) | null = null;

function schedulerNowMs(): number {
  return nowOverrideMs ?? Date.now();
}

function clearOutboxDueTimer(): void {
  if (dueTimer) {
    clearTimeout(dueTimer);
    dueTimer = null;
  }
  dueTimerAtMs = null;
  dueFire = null;
}

function armOutboxDueTimer(dueAtMs: number): void {
  if (!Number.isFinite(dueAtMs)) {
    return;
  }
  clearOutboxDueTimer();
  dueTimerAtMs = dueAtMs;
  const fire = () => {
    if (dueTimerAtMs !== dueAtMs) {
      return;
    }
    clearOutboxDueTimer();
    wakeOutboxDispatcher();
  };
  dueFire = fire;
  if (manualTimers) {
    return;
  }
  const delay = Math.max(0, dueAtMs - schedulerNowMs());
  dueTimer = setTimeout(fire, delay);
  dueTimer.unref?.();
}

async function readOutboxSchedule(input: {
  readonly includeFuture: boolean;
}): Promise<OutboxDueSnapshot> {
  scheduleReads += 1;
  const snapshot = dueReaderOverride
    ? await dueReaderOverride(input)
    : await readOutboxScheduleFromStore(input.includeFuture);
  lastScheduleRead = snapshot;
  return snapshot;
}

async function readOutboxScheduleFromStore(includeFuture: boolean): Promise<OutboxDueSnapshot> {
  const nowIso = new Date(schedulerNowMs()).toISOString();
  const immediatelyDue = await probeOutboxImmediatelyDue(nowIso);
  if (!includeFuture || immediatelyDue) {
    return { immediatelyDue, earliestFutureDueAt: null, includeFuture };
  }
  const earliestFutureDueAt = await findEarliestFutureOutboxAvailableAt(nowIso);
  return { immediatelyDue, earliestFutureDueAt, includeFuture };
}

async function runOutboxBatch(): Promise<number> {
  if (batchOverride) {
    return batchOverride();
  }
  return dispatchOutboxBatch();
}

async function reconcileOutboxDueTimer(): Promise<void> {
  const snapshot = await readOutboxSchedule({ includeFuture: true });
  if (snapshot.immediatelyDue) {
    const gap = resolveOutboxConfig().dispatchIntervalMs;
    const delay = Number.isFinite(gap) && gap > 0 ? gap : 0;
    armOutboxDueTimer(schedulerNowMs() + delay);
    return;
  }
  if (!snapshot.earliestFutureDueAt) {
    clearOutboxDueTimer();
    return;
  }
  const at = Date.parse(snapshot.earliestFutureDueAt);
  if (Number.isFinite(at)) {
    armOutboxDueTimer(at);
  }
}

function wakeOutboxDispatcher(): void {
  if (!dispatcherStarted) {
    return;
  }
  if (cycleInProgress) {
    followUp = true;
    return;
  }
  cycleInProgress = true;
  cyclePromise = (async () => {
    try {
      do {
        followUp = false;
        clearOutboxDueTimer();
        await runOutboxBatch();
      } while (followUp);
      await reconcileOutboxDueTimer();
    } finally {
      cycleInProgress = false;
      const again = followUp;
      followUp = false;
      cyclePromise = null;
      if (again) {
        wakeOutboxDispatcher();
      }
    }
  })();
}

registerOutboxDispatcherWake(() => {
  wakeOutboxDispatcher();
});

async function bootOutboxRecovery(): Promise<void> {
  const snapshot = await readOutboxSchedule({ includeFuture: true });
  if (snapshot.immediatelyDue) {
    wakeOutboxDispatcher();
    return;
  }
  if (!snapshot.earliestFutureDueAt) {
    clearOutboxDueTimer();
    return;
  }
  const at = Date.parse(snapshot.earliestFutureDueAt);
  if (Number.isFinite(at)) {
    armOutboxDueTimer(at);
  }
}

function startOutboxSafetySweep(): void {
  if (safetyArmed) {
    return;
  }
  safetyArmed = true;
  if (manualTimers) {
    return;
  }
  safetyTimer = setInterval(() => {
    void runOutboxSafetySweep();
  }, OUTBOX_SAFETY_SWEEP_MS);
  safetyTimer.unref?.();
}

/** One due-only probe. No batch, write, or provider call when nothing is due. */
export async function runOutboxSafetySweep(): Promise<void> {
  if (!dispatcherStarted) {
    return;
  }
  const snapshot = await readOutboxSchedule({ includeFuture: false });
  if (!snapshot.immediatelyDue) {
    return;
  }
  wakeOutboxDispatcher();
}

export async function dispatchOutboxBatch(): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  if (dispatchInProgress) {
    return 0;
  }

  dispatchInProgress = true;
  const config = resolveOutboxConfig();
  let processedCount = 0;

  try {
    const pendingRecords = await fetchPendingOutboxRecords(config.dispatchBatchSize);

    for (const record of pendingRecords) {
      try {
        const envelope = deserializeDomainEventEnvelope(record.envelope);

        // Pack 08I.14B.3 — do not treat in-progress skip as successful publish.
        // A deploy/restart during a long warm handler left claims "processing";
        // marking published here previously completed outbox rows without materialization.
        let handlerSucceeded = false;
        let deferredInProgress = false;

        await dispatchEnvelopeToHandlers(envelope, async (handler, eventEnvelope) => {
          const claim = await claimEventForProcessing({
            consumerId: handler.consumerId,
            eventId: eventEnvelope.eventId,
            correlationId: eventEnvelope.metadata.correlationId,
          });

          if (claim.alreadyCompleted) {
            handlerSucceeded = true;
            logDomainEvent("skipped_duplicate", {
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
              eventName: eventEnvelope.eventName,
              correlationId: eventEnvelope.metadata.correlationId,
              skipReason: "completed",
            });
            return;
          }

          if (claim.inProgress) {
            deferredInProgress = true;
            logDomainEvent("skipped_duplicate", {
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
              eventName: eventEnvelope.eventName,
              correlationId: eventEnvelope.metadata.correlationId,
              skipReason: "in_progress",
            });
            return;
          }

          if (!claim.claimed) {
            return;
          }

          const claimHeartbeat = setInterval(() => {
            void renewEventProcessingClaim({
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
            }).catch(() => undefined);
          }, PROCESSING_CLAIM_HEARTBEAT_MS);
          claimHeartbeat.unref?.();
          try {
            await handler.handle(eventEnvelope);
            await markEventProcessingCompleted({
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
            });
            handlerSucceeded = true;

            logDomainEvent("processed", {
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
              eventName: eventEnvelope.eventName,
              correlationId: eventEnvelope.metadata.correlationId,
              causationId: eventEnvelope.metadata.causationId,
            });
          } catch (handlerError) {
            await releaseEventProcessingClaim({
              consumerId: handler.consumerId,
              eventId: eventEnvelope.eventId,
              error: handlerError,
            });

            throw handlerError;
          } finally {
            clearInterval(claimHeartbeat);
          }
        });

        if (deferredInProgress && !handlerSucceeded) {
          logDomainEvent("skipped_duplicate", {
            outboxId: record.outboxId,
            eventId: record.eventId,
            eventName: record.eventName,
            correlationId: record.correlationId,
            skipReason: "in_progress_defer_publish",
          });
          continue;
        }

        await markOutboxRecordPublished(record.outboxId);
        processedCount += 1;

        logDomainEvent("dispatched", {
          outboxId: record.outboxId,
          eventId: record.eventId,
          eventName: record.eventName,
          correlationId: record.correlationId,
          causationId: record.causationId,
        });
      } catch (error) {
        const pacingAvailableAt = outboxPacingDeferAvailableAt(error);
        if (pacingAvailableAt) {
          await deferOutboxRecordUntilAvailable(record.outboxId, pacingAvailableAt);
          logDomainEvent("deferred", {
            outboxId: record.outboxId,
            eventId: record.eventId,
            eventName: record.eventName,
            correlationId: record.correlationId,
            skipReason: "provider_pacing_defer",
            availableAt: pacingAvailableAt,
          });
          continue;
        }

        lastError = error instanceof Error ? error.message : String(error);

        logDomainEvent("failed", {
          outboxId: record.outboxId,
          eventId: record.eventId,
          eventName: record.eventName,
          error: lastError,
        });

        await markOutboxRecordFailed(record.outboxId, error, config.maxAttempts);
      }
    }

    lastDispatchAt = new Date().toISOString();
    return processedCount;
  } finally {
    dispatchInProgress = false;
  }
}

export function startOutboxDispatcher(): void {
  const config = resolveOutboxConfig();

  if (!config.dispatchEnabled) {
    logger.info("outbox.dispatcher.disabled", { component: "outbox" });
    return;
  }

  if (!isMongoConfigured()) {
    logger.warn("outbox.dispatcher.mongo_not_configured", { component: "outbox" });
    return;
  }

  if (dispatcherStarted) {
    return;
  }

  dispatcherStarted = true;

  logger.info("outbox.dispatcher.started", {
    component: "outbox",
    safetySweepMs: OUTBOX_SAFETY_SWEEP_MS,
    batchSize: config.dispatchBatchSize,
  });

  startOutboxSafetySweep();
  void bootOutboxRecovery();
}

export function stopOutboxDispatcher(): void {
  dispatcherStarted = false;
  clearOutboxDueTimer();
  if (safetyTimer) {
    clearInterval(safetyTimer);
    safetyTimer = null;
  }
  safetyArmed = false;
  followUp = false;
}

export async function getOutboxHealthStatus(): Promise<OutboxHealthStatus> {
  const config = resolveOutboxConfig();
  const configured = isMongoConfigured();

  if (!configured) {
    return {
      enabled: config.dispatchEnabled,
      configured: false,
      running: false,
      dispatchIntervalMs: config.dispatchIntervalMs,
      stats: null,
      lastDispatchAt,
      lastError,
    };
  }

  const stats = await getOutboxDispatchStats();

  return {
    enabled: config.dispatchEnabled,
    configured: true,
    running: dispatcherStarted,
    dispatchIntervalMs: config.dispatchIntervalMs,
    stats,
    lastDispatchAt,
    lastError,
  };
}

/** Test helper — run one dispatch cycle without interval timer. */
export async function dispatchOutboxOnceForTests(): Promise<number> {
  return dispatchOutboxBatch();
}

export function resetOutboxDispatcherStateForTests(): void {
  stopOutboxDispatcher();
  lastDispatchAt = null;
  lastError = null;
  dispatchInProgress = false;
  cycleInProgress = false;
  followUp = false;
  cyclePromise = null;
  manualTimers = false;
  nowOverrideMs = null;
  scheduleReads = 0;
  lastScheduleRead = null;
  dueReaderOverride = null;
  batchOverride = null;
}

export function useOutboxSchedulerManualTimersForTests(enabled: boolean): void {
  manualTimers = enabled;
}

export function setOutboxSchedulerNowMsForTests(ms: number | null): void {
  nowOverrideMs = ms;
}

export function setOutboxDueReaderForTests(
  reader: ((input: { readonly includeFuture: boolean }) => Promise<OutboxDueSnapshot>) | null,
): void {
  dueReaderOverride = reader;
}

export function setOutboxBatchOverrideForTests(runner: (() => Promise<number>) | null): void {
  batchOverride = runner;
}

export function outboxScheduleReadsForTests(): number {
  return scheduleReads;
}

export function lastOutboxScheduleReadForTests(): OutboxDueSnapshot | null {
  return lastScheduleRead;
}

export function outboxDueTimerAtMsForTests(): number | null {
  return dueTimerAtMs;
}

export function outboxDueTimerCountForTests(): number {
  return dueTimerAtMs == null ? 0 : 1;
}

export function outboxSafetySweepArmedForTests(): boolean {
  return safetyArmed;
}

export function outboxCycleInProgressForTests(): boolean {
  return cycleInProgress;
}

export function fireOutboxDueTimerForTests(): void {
  dueFire?.();
}

export async function settleOutboxDispatcherForTests(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const current = cyclePromise;
    if (current) {
      await current;
    }
    await new Promise((resolve) => setImmediate(resolve));
    if (!cycleInProgress && !followUp) {
      return;
    }
  }
}

/** Test boot path. Does not require Mongo when a due reader is installed. */
export async function startOutboxDispatcherForTests(): Promise<void> {
  if (dispatcherStarted) {
    return;
  }
  dispatcherStarted = true;
  startOutboxSafetySweep();
  await bootOutboxRecovery();
  await settleOutboxDispatcherForTests();
}
