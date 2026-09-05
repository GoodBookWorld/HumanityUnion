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

/** Test helper — mark memory pending row as terminal failed. */
export function markContentTranslationWarmMemoryFailedForTests(
  eventId: string,
  lastError = "terminal warm failure",
): void {
  const record = memoryRecordsByEventId.get(eventId);
  if (!record) {
    return;
  }
  record.status = "failed";
  record.lastError = lastError;
  const aggregateId = buildContentTranslationWarmAggregateId(record.command);
  const pending = memoryPendingByAggregate.get(aggregateId);
  if (pending?.eventId === eventId) {
    memoryPendingByAggregate.delete(aggregateId);
  }
}

export type ContentTranslationWarmOutboxDisposition =
  | "pending"
  | "failed"
  | "published"
  | "none";

/**
 * Pack 08J / 08K.2 — wait diagnostics: distinguish PENDING / FAILED /
 * PUBLISHED (consumed) from absent outbox evidence.
 *
 * published + no translation ⇒ MISSING_AFTER_DISPATCH (not indefinite PENDING).
 */
export async function resolveContentTranslationWarmOutboxDisposition(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
}): Promise<ContentTranslationWarmOutboxDisposition> {
  const aggregateId = buildContentTranslationWarmAggregateId(input);

  if (useMemoryWarmOutbox()) {
    const pending = memoryPendingByAggregate.get(aggregateId);
    if (pending?.status === "pending") {
      return "pending";
    }
    let sawPublished = false;
    for (const record of memoryRecordsByEventId.values()) {
      const id = buildContentTranslationWarmAggregateId(record.command);
      if (id !== aggregateId) {
        continue;
      }
      if (record.status === "failed") {
        return "failed";
      }
      if (record.status === "published") {
        sawPublished = true;
      }
    }
    return sawPublished ? "published" : "none";
  }

  const collection = getMongoCollection<{
    status: string;
    eventName: string;
    aggregateId: string;
    updatedAt?: string;
    lastError?: string | null;
  }>(MONGO_COLLECTIONS.outbox);

  const pending = await collection.findOne({
    status: "pending",
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    aggregateId,
  });
  if (pending) {
    return "pending";
  }

  const failed = await collection.findOne({
    status: "failed",
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    aggregateId,
  });
  if (failed) {
    return "failed";
  }

  const published = await collection.findOne({
    status: "published",
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    aggregateId,
  });
  return published ? "published" : "none";
}

/**
 * Safe outbox failure peek for residual diagnostics (no payload bodies).
 */
export async function peekContentTranslationWarmOutboxFailure(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
}): Promise<{
  readonly disposition: ContentTranslationWarmOutboxDisposition;
  readonly lastErrorClass: string | null;
  readonly lastFailureAt: string | null;
}> {
  const disposition = await resolveContentTranslationWarmOutboxDisposition(input);
  const aggregateId = buildContentTranslationWarmAggregateId(input);

  if (useMemoryWarmOutbox()) {
    for (const record of memoryRecordsByEventId.values()) {
      const id = buildContentTranslationWarmAggregateId(record.command);
      if (id === aggregateId && record.status === "failed") {
        const message = record.lastError ?? "";
        return {
          disposition,
          lastErrorClass: message.toLowerCase().includes("source unavailable")
            ? "SOURCE_UNAVAILABLE"
            : message
              ? "UNKNOWN"
              : null,
          lastFailureAt: null,
        };
      }
    }
    return { disposition, lastErrorClass: null, lastFailureAt: null };
  }

  if (disposition !== "failed") {
    return { disposition, lastErrorClass: null, lastFailureAt: null };
  }

  const collection = getMongoCollection<{
    status: string;
    eventName: string;
    aggregateId: string;
    updatedAt?: string;
    lastError?: string | null;
  }>(MONGO_COLLECTIONS.outbox);

  const failed = await collection.findOne({
    status: "failed",
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    aggregateId,
  });

  const message = typeof failed?.lastError === "string" ? failed.lastError : "";
  let lastErrorClass: string | null = null;
  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("source unavailable")) {
      lastErrorClass = "SOURCE_UNAVAILABLE";
    } else if (lower.includes("timeout")) {
      lastErrorClass = "PROVIDER_TIMEOUT";
    } else if (lower.includes("malformed")) {
      lastErrorClass = "PROVIDER_INVALID_RESPONSE";
    } else if (lower.includes("validation") || lower.includes("prose") || lower.includes("title")) {
      lastErrorClass = "VALIDATION_FAILED";
    } else {
      lastErrorClass = "UNKNOWN";
    }
  }

  return {
    disposition,
    lastErrorClass,
    lastFailureAt: typeof failed?.updatedAt === "string" ? failed.updatedAt : null,
  };
}
