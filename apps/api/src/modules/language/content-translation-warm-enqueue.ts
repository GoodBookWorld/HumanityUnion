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
  LanguageCode,
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
  /** Pack 08K.2.3 — set when terminal failed for deterministic ordering/diagnostics. */
  failedAt: string | null;
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
    /** Pack 08K.2.2 — constrain consumer locale fan-out (residual retry). */
    readonly targetLocales?: readonly LanguageCode[];
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
      failedAt: null,
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
          ...(command.targetLocales?.length
            ? { targetLocales: command.targetLocales }
            : {}),
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
  record.failedAt = new Date().toISOString();
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

export type ContentTranslationWarmAttemptSnapshot = {
  readonly eventId: string;
  readonly status: "pending" | "published" | "failed";
  readonly reason: string | null;
  readonly requestedAt: string;
  readonly attemptAt: string;
  readonly targetLocales: readonly LanguageCode[] | null;
  readonly lastError: string | null;
  readonly failureMetadata: ReturnType<
    typeof import("./content-translation-failure-metadata.js").parseContentTranslationFailureMetadata
  >;
};

function compareAttemptOrder(
  a: { readonly attemptAt: string; readonly eventId: string },
  b: { readonly attemptAt: string; readonly eventId: string },
): number {
  const byTime = a.attemptAt.localeCompare(b.attemptAt);
  if (byTime !== 0) {
    return byTime;
  }
  return a.eventId.localeCompare(b.eventId);
}

function parseTargetLocalesFromPayload(
  payload: Record<string, unknown> | null | undefined,
): LanguageCode[] | null {
  if (!payload || !Array.isArray(payload.targetLocales)) {
    return null;
  }
  const locales = [
    ...new Set(
      payload.targetLocales
        .filter((locale): locale is string => typeof locale === "string")
        .map((locale) => locale.trim())
        .filter(Boolean),
    ),
  ] as LanguageCode[];
  return locales.length ? locales : null;
}

function attemptAppliesToLocale(
  attempt: ContentTranslationWarmAttemptSnapshot,
  targetLocale: LanguageCode | string,
): boolean {
  if (!attempt.targetLocales || attempt.targetLocales.length === 0) {
    return true;
  }
  return attempt.targetLocales.includes(targetLocale as LanguageCode);
}

/**
 * List warm attempts for a presentation aggregate, oldest → newest.
 * Deterministic order: attemptAt (createdAt/requestedAt/failedAt), then eventId.
 */
export async function listContentTranslationWarmAttempts(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
}): Promise<readonly ContentTranslationWarmAttemptSnapshot[]> {
  const { parseContentTranslationFailureMetadata } = await import(
    "./content-translation-failure-metadata.js"
  );
  const aggregateId = buildContentTranslationWarmAggregateId(input);
  const out: ContentTranslationWarmAttemptSnapshot[] = [];

  if (useMemoryWarmOutbox()) {
    for (const record of memoryRecordsByEventId.values()) {
      const id = buildContentTranslationWarmAggregateId(record.command);
      if (id !== aggregateId) {
        continue;
      }
      const attemptAt =
        record.failedAt ??
        record.command.requestedAt;
      out.push({
        eventId: record.eventId,
        status: record.status,
        reason: record.command.reason ?? null,
        requestedAt: record.command.requestedAt,
        attemptAt,
        targetLocales: record.command.targetLocales
          ? [...record.command.targetLocales]
          : null,
        lastError: record.lastError,
        failureMetadata: parseContentTranslationFailureMetadata(record.lastError),
      });
    }
  } else {
    const collection = getMongoCollection<{
      eventId: string;
      status: string;
      eventName: string;
      aggregateId: string;
      envelope?: string;
      lastError?: string | null;
      createdAt?: string;
      publishedAt?: string | null;
    }>(MONGO_COLLECTIONS.outbox);

    const rows = await collection
      .find({
        eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
        aggregateId,
      })
      .toArray();

    for (const row of rows) {
      let payload: Record<string, unknown> | null = null;
      if (typeof row.envelope === "string") {
        try {
          const envelope = JSON.parse(row.envelope) as {
            payload?: Record<string, unknown>;
          };
          payload = envelope.payload ?? null;
        } catch {
          payload = null;
        }
      }
      const requestedAt =
        (typeof payload?.requestedAt === "string" && payload.requestedAt) ||
        (typeof row.createdAt === "string" ? row.createdAt : "") ||
        "";
      const attemptAt =
        (typeof row.publishedAt === "string" && row.status === "published"
          ? row.publishedAt
          : null) ||
        (typeof row.createdAt === "string" ? row.createdAt : requestedAt);
      const lastError = typeof row.lastError === "string" ? row.lastError : null;
      out.push({
        eventId: String(row.eventId),
        status:
          row.status === "pending" || row.status === "published" || row.status === "failed"
            ? row.status
            : "failed",
        reason: typeof payload?.reason === "string" ? payload.reason : null,
        requestedAt,
        attemptAt,
        targetLocales: parseTargetLocalesFromPayload(payload),
        lastError,
        failureMetadata: parseContentTranslationFailureMetadata(lastError),
      });
    }
  }

  return [...out].sort(compareAttemptOrder);
}

/**
 * Pack 08K.2.3 — latest warm attempt relevant to a target locale identity.
 * Never lets an older FAILED mask a newer residual-retry attempt.
 */
export async function resolveLatestContentTranslationWarmAttemptForIdentity(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode | string;
}): Promise<ContentTranslationWarmAttemptSnapshot | null> {
  const attempts = await listContentTranslationWarmAttempts(input);
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const attempt = attempts[i]!;
    if (!attemptAppliesToLocale(attempt, input.targetLocale)) {
      continue;
    }
    return attempt;
  }
  return null;
}

export async function resolveContentTranslationWarmOutboxDisposition(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale?: LanguageCode | string;
}): Promise<ContentTranslationWarmOutboxDisposition> {
  if (input.targetLocale) {
    const latest = await resolveLatestContentTranslationWarmAttemptForIdentity({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      targetLocale: input.targetLocale,
    });
    if (!latest) {
      return "none";
    }
    if (latest.status === "pending") {
      return "pending";
    }
    if (latest.status === "failed") {
      return "failed";
    }
    if (latest.status === "published") {
      return "published";
    }
    return "none";
  }

  const attempts = await listContentTranslationWarmAttempts(input);
  if (attempts.length === 0) {
    return "none";
  }
  const latest = attempts[attempts.length - 1]!;
  if (latest.status === "pending") {
    return "pending";
  }
  if (latest.status === "failed") {
    return "failed";
  }
  if (latest.status === "published") {
    return "published";
  }
  return "none";
}

/**
 * Safe outbox failure peek for residual diagnostics (no payload bodies).
 * Pack 08K.2.3 — when targetLocale is set, reads the latest locale-relevant attempt.
 */
export async function peekContentTranslationWarmOutboxFailure(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale?: LanguageCode | string;
}): Promise<{
  readonly disposition: ContentTranslationWarmOutboxDisposition;
  readonly lastErrorClass: string | null;
  readonly lastErrorRaw: string | null;
  readonly lastFailureAt: string | null;
  readonly latestAttempt: ContentTranslationWarmAttemptSnapshot | null;
  readonly failureMetadata: ReturnType<
    typeof import("./content-translation-failure-metadata.js").parseContentTranslationFailureMetadata
  >;
}> {
  const {
    classifyLegacyOutboxLastError,
    resolveLocaleFailureFromMetadata,
  } = await import("./content-translation-failure-metadata.js");

  const latest = input.targetLocale
    ? await resolveLatestContentTranslationWarmAttemptForIdentity({
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        targetLocale: input.targetLocale,
      })
    : (await listContentTranslationWarmAttempts(input)).at(-1) ?? null;

  const disposition: ContentTranslationWarmOutboxDisposition = !latest
    ? "none"
    : latest.status === "pending"
      ? "pending"
      : latest.status === "failed"
        ? "failed"
        : latest.status === "published"
          ? "published"
          : "none";

  const message = latest?.lastError ?? null;
  const failureMetadata = latest?.failureMetadata ?? null;

  if (failureMetadata && input.targetLocale) {
    const localeResolved = resolveLocaleFailureFromMetadata(
      failureMetadata,
      input.targetLocale,
    );
    if (localeResolved.attributed) {
      return {
        disposition,
        lastErrorClass: localeResolved.failureClass,
        lastErrorRaw: message,
        lastFailureAt: localeResolved.failedAt ?? latest?.attemptAt ?? null,
        latestAttempt: latest,
        failureMetadata: {
          ...failureMetadata,
          failureClass: localeResolved.failureClass ?? failureMetadata.failureClass,
          failureReasonCode:
            localeResolved.failureReasonCode ?? failureMetadata.failureReasonCode,
          retryabilityHint:
            localeResolved.retryabilityHint ?? failureMetadata.retryabilityHint,
          targetLocale: input.targetLocale,
        },
      };
    }
    // Latest attempt failed for a different locale — not this identity's failure.
    if (disposition === "failed" && !localeResolved.attributed) {
      return {
        disposition: "published",
        lastErrorClass: null,
        lastErrorRaw: null,
        lastFailureAt: null,
        latestAttempt: latest,
        failureMetadata: null,
      };
    }
  }

  if (failureMetadata) {
    return {
      disposition,
      lastErrorClass: failureMetadata.failureClass,
      lastErrorRaw: message,
      lastFailureAt: failureMetadata.failedAt || latest?.attemptAt || null,
      latestAttempt: latest,
      failureMetadata,
    };
  }

  if (disposition === "failed") {
    const legacy = classifyLegacyOutboxLastError(message);
    return {
      disposition,
      lastErrorClass: legacy.failureClass,
      lastErrorRaw: message,
      lastFailureAt: latest?.attemptAt ?? null,
      latestAttempt: latest,
      failureMetadata: null,
    };
  }

  return {
    disposition,
    lastErrorClass: null,
    lastErrorRaw: message,
    lastFailureAt: null,
    latestAttempt: latest,
    failureMetadata: null,
  };
}
