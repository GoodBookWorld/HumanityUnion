/**
 * Pack 02G Task 04 — durable enqueue for ContentTranslationWarmRequested.
 *
 * Source-level request only (no provider payload / locale snapshot).
 * Pending dedupe: one pending outbox row per sourceKind+sourceRecordId.
 * Later legitimate updates enqueue again after the prior request is published/failed.
 */

import { randomUUID } from "node:crypto";

import type {
  ContentTranslationSourceKind,
  ContentTranslationWarmReason,
  ContentTranslationWarmRequestedCommand,
} from "@hu/types";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  enqueueDomainEvent,
  type EnqueueOutboxOptions,
  type OutboxRecord,
} from "../../infrastructure/outbox/index.js";
import { logger } from "../../shared/observability/logger.js";
import { buildContentTranslationWarmRequestedCommand } from "./content-translation-warm-request.js";

export const CONTENT_TRANSLATION_WARM_AGGREGATE_TYPE = "ContentTranslationSource" as const;

export interface ContentTranslationWarmEnqueueResult {
  readonly enqueued: boolean;
  readonly deduped: boolean;
  readonly mode: "mongo" | "memory" | "skipped";
  readonly eventId: string | null;
  readonly command: ContentTranslationWarmRequestedCommand;
}

interface MemoryWarmOutboxRecord {
  readonly eventId: string;
  readonly command: ContentTranslationWarmRequestedCommand;
  status: "pending" | "published" | "failed";
  attempts: number;
  lastError: string | null;
}

let forceMemoryForTests = false;
const memoryPendingByAggregate = new Map<string, MemoryWarmOutboxRecord>();
const memoryRecordsByEventId = new Map<string, MemoryWarmOutboxRecord>();

export function setContentTranslationWarmForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetContentTranslationWarmMemoryForTests(): void {
  memoryPendingByAggregate.clear();
  memoryRecordsByEventId.clear();
}

export function listContentTranslationWarmMemoryPendingForTests(): ReadonlyArray<{
  readonly eventId: string;
  readonly command: ContentTranslationWarmRequestedCommand;
}> {
  return [...memoryPendingByAggregate.values()]
    .filter((row) => row.status === "pending")
    .map((row) => ({ eventId: row.eventId, command: row.command }));
}

export function buildContentTranslationWarmAggregateId(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
}): string {
  return `${input.sourceKind}::${input.sourceRecordId.trim()}`;
}

export function buildContentTranslationWarmEventId(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly requestedAt: string;
  readonly nonce?: string;
}): string {
  const nonce = input.nonce ?? randomUUID();
  return `content-translation-warm-requested:${input.sourceKind}:${input.sourceRecordId.trim()}:${input.requestedAt}:${nonce}`;
}

function useMemoryWarmOutbox(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function findPendingWarmOutbox(aggregateId: string): Promise<boolean> {
  if (useMemoryWarmOutbox()) {
    const existing = memoryPendingByAggregate.get(aggregateId);
    return existing?.status === "pending";
  }

  const collection = getMongoCollection<{
    status: string;
    eventName: string;
    aggregateId: string;
  }>(MONGO_COLLECTIONS.outbox);

  const pending = await collection.findOne({
    status: "pending",
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    aggregateId,
  });
  return pending !== null;
}

/**
 * Enqueue a durable source-level warm request.
 * Safe to call after public persistence (optionally with Mongo session).
 */
export async function enqueueContentTranslationWarmRequested(
  input: {
    readonly sourceKind: ContentTranslationSourceKind;
    readonly sourceRecordId: string;
    readonly reason?: ContentTranslationWarmReason;
    readonly requestedAt?: string;
  },
  options: EnqueueOutboxOptions = {},
): Promise<ContentTranslationWarmEnqueueResult> {
  const command = buildContentTranslationWarmRequestedCommand(input);
  const aggregateId = buildContentTranslationWarmAggregateId(command);

  if (await findPendingWarmOutbox(aggregateId)) {
    logger.info("content_translation.warm.enqueue_deduped", {
      component: "content-translation-warm",
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
      reason: command.reason,
    });
    return {
      enqueued: false,
      deduped: true,
      mode: useMemoryWarmOutbox() ? "memory" : "mongo",
      eventId: null,
      command,
    };
  }

  const eventId = buildContentTranslationWarmEventId({
    sourceKind: command.sourceKind,
    sourceRecordId: command.sourceRecordId,
    requestedAt: command.requestedAt,
  });

  if (useMemoryWarmOutbox()) {
    const record: MemoryWarmOutboxRecord = {
      eventId,
      command,
      status: "pending",
      attempts: 0,
      lastError: null,
    };
    memoryPendingByAggregate.set(aggregateId, record);
    memoryRecordsByEventId.set(eventId, record);
    logger.info("content_translation.warm.enqueued", {
      component: "content-translation-warm",
      mode: "memory",
      eventId,
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
      reason: command.reason,
    });
    return {
      enqueued: true,
      deduped: false,
      mode: "memory",
      eventId,
      command,
    };
  }

  try {
    const record: OutboxRecord = await enqueueDomainEvent(
      createDomainEvent({
        eventId,
        eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
        aggregateType: CONTENT_TRANSLATION_WARM_AGGREGATE_TYPE,
        aggregateId,
        payload: {
          commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
          sourceKind: command.sourceKind,
          sourceRecordId: command.sourceRecordId,
          requestedAt: command.requestedAt,
          reason: command.reason,
        },
        occurredAt: command.requestedAt,
      }),
      options,
    );

    logger.info("content_translation.warm.enqueued", {
      component: "content-translation-warm",
      mode: "mongo",
      eventId: record.eventId,
      outboxId: record.outboxId,
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
      reason: command.reason,
    });

    return {
      enqueued: true,
      deduped: false,
      mode: "mongo",
      eventId: record.eventId,
      command,
    };
  } catch (error) {
    // Duplicate eventId (race) — treat as dedupe.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("E11000") || message.includes("duplicate key")) {
      return {
        enqueued: false,
        deduped: true,
        mode: "mongo",
        eventId,
        command,
      };
    }
    throw error;
  }
}

/**
 * Fire-and-forget schedule after mutation persistence.
 * Never awaits provider work; never fails the mutation path.
 */
export function scheduleContentTranslationWarmAfterMutation(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly reason?: ContentTranslationWarmReason;
}): void {
  void enqueueContentTranslationWarmRequested(input).catch((error) => {
    logger.warn("content_translation.warm.enqueue_failed", {
      component: "content-translation-warm",
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      reason: input.reason ?? "public_mutation",
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/** Test helper — mark memory pending row published after consumer success. */
export function markContentTranslationWarmMemoryPublishedForTests(eventId: string): void {
  const record = memoryRecordsByEventId.get(eventId);
  if (!record) {
    return;
  }
  record.status = "published";
  const aggregateId = buildContentTranslationWarmAggregateId(record.command);
  const pending = memoryPendingByAggregate.get(aggregateId);
  if (pending?.eventId === eventId) {
    memoryPendingByAggregate.delete(aggregateId);
  }
}
