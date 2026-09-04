import { deserializeDomainEventEnvelope } from "../events/event-serialization.js";
import { dispatchEnvelopeToHandlers } from "../integration/event-handler-registry.js";
import { logDomainEvent, logger } from "../../shared/observability/logger.js";
import { isMongoConfigured } from "../mongodb/mongo-config.js";
import { resolveOutboxConfig } from "./outbox.config.js";
import {
  claimEventForProcessing,
  markEventProcessingCompleted,
  releaseEventProcessingClaim,
} from "./processed-events.repository.js";
import {
  fetchPendingOutboxRecords,
  getOutboxDispatchStats,
  markOutboxRecordFailed,
  markOutboxRecordPublished,
} from "./outbox.repository.js";
import type { OutboxHealthStatus } from "./outbox.types.js";

let dispatchTimer: NodeJS.Timeout | null = null;
let dispatchInProgress = false;
let lastDispatchAt: string | null = null;
let lastError: string | null = null;

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

  if (dispatchTimer) {
    return;
  }

  logger.info("outbox.dispatcher.started", {
    component: "outbox",
    intervalMs: config.dispatchIntervalMs,
    batchSize: config.dispatchBatchSize,
  });

  void dispatchOutboxBatch();

  dispatchTimer = setInterval(() => {
    void dispatchOutboxBatch();
  }, config.dispatchIntervalMs);

  dispatchTimer.unref?.();
}

export function stopOutboxDispatcher(): void {
  if (dispatchTimer) {
    clearInterval(dispatchTimer);
    dispatchTimer = null;
  }
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
    running: dispatchTimer !== null,
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
}
