/**
 * Pack 02G Task 04 — ContentTranslationWarmRequested consumer.
 *
 * Reloads authoritative public source + Registry targets at execution.
 * Reuses getOrCreateContentTranslation(intent=automatic_warm).
 */

import type {
  ContentTranslationSourceKind,
  ContentTranslationWarmReason,
  ContentTranslationWarmRequestedCommand,
  LanguageCode,
} from "@hu/types";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

import type { DomainEvent } from "../../infrastructure/events/domain-event.js";
import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { logger } from "../../shared/observability/logger.js";
import { getOrCreateContentTranslation, loadTranslatableSource } from "./content-translation.service.js";
import {
  assertCanonicalSourceEligibleForTranslation,
  isRedundantTargetLanguage,
} from "./content-translation-eligibility.js";
import {
  mapWithConcurrency,
  resolveContentTranslationWarmLocaleConcurrency,
} from "./content-translation-warm-concurrency.js";
import { classifyContentTranslationWarmFailure } from "./content-translation-warm-failure.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryPublishedForTests,
} from "./content-translation-warm-enqueue.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import {
  buildContentTranslationWorkIdentity,
  buildContentTranslationWorkIdentityKey,
} from "./content-translation-work-identity.js";
import { TranslationProviderError } from "./translation.config.js";

export const CONTENT_TRANSLATION_WARM_CONSUMER_ID = "content-translation-warm-v1" as const;

/** Process-local in-flight guard — persistence unique index is the multi-instance guarantee. */
const inFlightWork = new Map<string, Promise<unknown>>();

export type ContentTranslationWarmLocaleOutcome =
  | {
      readonly targetLanguage: LanguageCode;
      readonly workIdentityKey: string;
      readonly status: "skipped_existing" | "skipped_source_language" | "generated" | "skipped_ineligible";
    }
  | {
      readonly targetLanguage: LanguageCode;
      readonly workIdentityKey: string;
      readonly status: "failed";
      readonly failureClass: "retryable" | "non_retryable";
      readonly errorCode: string;
    };

export interface ContentTranslationWarmProcessResult {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string | null;
  readonly sourceLanguage: LanguageCode | null;
  readonly outcome:
    | "completed"
    | "skipped_missing_source"
    | "skipped_ineligible"
    | "failed_retryable";
  readonly locales: readonly ContentTranslationWarmLocaleOutcome[];
}

function parseWarmCommand(
  payload: Record<string, unknown>,
): ContentTranslationWarmRequestedCommand {
  const commandName = payload.commandName;
  const sourceKind = payload.sourceKind;
  const sourceRecordId = payload.sourceRecordId;
  const requestedAt = payload.requestedAt;
  const reason = payload.reason;

  if (commandName !== CONTENT_TRANSLATION_WARM_REQUESTED) {
    throw new TranslationProviderError(
      "bad_request",
      "Invalid ContentTranslationWarmRequested commandName.",
    );
  }
  if (typeof sourceKind !== "string" || !sourceKind.trim()) {
    throw new TranslationProviderError("bad_request", "Invalid warm request sourceKind.");
  }
  if (typeof sourceRecordId !== "string" || !sourceRecordId.trim()) {
    throw new TranslationProviderError("bad_request", "Invalid warm request sourceRecordId.");
  }
  if (typeof requestedAt !== "string" || !requestedAt.trim()) {
    throw new TranslationProviderError("bad_request", "Invalid warm request requestedAt.");
  }

  return {
    commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
    sourceKind: sourceKind as ContentTranslationSourceKind,
    sourceRecordId: sourceRecordId.trim(),
    requestedAt,
    reason: (typeof reason === "string" ? reason : "public_mutation") as ContentTranslationWarmReason,
  };
}

async function withWorkIdentityLock<T>(
  workIdentityKey: string,
  run: () => Promise<T>,
): Promise<T> {
  const existing = inFlightWork.get(workIdentityKey);
  if (existing) {
    await existing.catch(() => undefined);
  }
  const pending = run();
  inFlightWork.set(workIdentityKey, pending);
  try {
    return await pending;
  } finally {
    if (inFlightWork.get(workIdentityKey) === pending) {
      inFlightWork.delete(workIdentityKey);
    }
  }
}

/**
 * Core warm processor — callable from outbox handler or tests.
 */
export async function processContentTranslationWarmRequested(
  input: ContentTranslationWarmRequestedCommand | Record<string, unknown>,
): Promise<ContentTranslationWarmProcessResult> {
  const command =
    "commandName" in input && input.commandName === CONTENT_TRANSLATION_WARM_REQUESTED
      ? (input as ContentTranslationWarmRequestedCommand)
      : parseWarmCommand(input as Record<string, unknown>);

  logger.info("content_translation.warm.consume_start", {
    component: "content-translation-warm",
    sourceKind: command.sourceKind,
    sourceRecordId: command.sourceRecordId,
    reason: command.reason,
  });

  const source = await loadTranslatableSource({
    sourceKind: command.sourceKind,
    sourceRecordId: command.sourceRecordId,
  });

  if (!source) {
    logger.info("content_translation.warm.skipped_missing_source", {
      component: "content-translation-warm",
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
    });
    return {
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
      sourceVersion: null,
      sourceLanguage: null,
      outcome: "skipped_missing_source",
      locales: [],
    };
  }

  try {
    assertCanonicalSourceEligibleForTranslation({
      source: {
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceLanguage: source.sourceLanguage,
        fields: source.fields,
        sourceVersion: source.sourceVersion,
        isPublished: source.isPublished,
        safetyCleared: true,
      },
      intent: "automatic_warm",
    });
  } catch (error) {
    logger.info("content_translation.warm.skipped_ineligible", {
      component: "content-translation-warm",
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: source.sourceLanguage,
      outcome: "skipped_ineligible",
      locales: [],
    };
  }

  const targets = await listAutomaticContentTranslationTargetLocales({
    excludeSourceLanguage: source.sourceLanguage,
  });

  const concurrency = resolveContentTranslationWarmLocaleConcurrency();
  let sawRetryableFailure = false;

  const locales = await mapWithConcurrency(targets, concurrency, async (targetLanguage) => {
    const identity = buildContentTranslationWorkIdentity({
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      targetLanguage,
    });
    const workIdentityKey = buildContentTranslationWorkIdentityKey(identity);

    if (
      isRedundantTargetLanguage({
        sourceLanguage: source.sourceLanguage,
        targetLanguage,
      })
    ) {
      return {
        targetLanguage,
        workIdentityKey,
        status: "skipped_source_language" as const,
      };
    }

    try {
      const result = await withWorkIdentityLock(workIdentityKey, () =>
        getOrCreateContentTranslation({
          sourceKind: source.sourceKind,
          sourceRecordId: source.sourceRecordId,
          targetLanguage,
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      );

      const status = result.generated
        ? ("generated" as const)
        : result.translation
          ? ("skipped_existing" as const)
          : ("skipped_ineligible" as const);

      logger.info("content_translation.warm.locale_result", {
        component: "content-translation-warm",
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceVersion: source.sourceVersion,
        targetLanguage,
        workIdentityKey,
        status,
        generated: result.generated,
      });

      return { targetLanguage, workIdentityKey, status };
    } catch (error) {
      const failureClass = classifyContentTranslationWarmFailure(error);
      const errorCode =
        error instanceof TranslationProviderError ? error.code : "unknown";

      logger.warn("content_translation.warm.locale_failed", {
        component: "content-translation-warm",
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceVersion: source.sourceVersion,
        targetLanguage,
        workIdentityKey,
        failureClass,
        errorCode,
        error: error instanceof Error ? error.message : String(error),
      });

      if (failureClass === "retryable") {
        sawRetryableFailure = true;
      }

      return {
        targetLanguage,
        workIdentityKey,
        status: "failed" as const,
        failureClass,
        errorCode,
      };
    }
  });

  if (sawRetryableFailure) {
    const err = new TranslationProviderError(
      "unavailable",
      "One or more automatic warm locale translations failed with a retryable error.",
    );
    logger.warn("content_translation.warm.consume_retryable", {
      component: "content-translation-warm",
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
    });
    // Attach locale outcomes for tests via cause-like property.
    (err as Error & { warmResult?: ContentTranslationWarmProcessResult }).warmResult = {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: source.sourceLanguage,
      outcome: "failed_retryable",
      locales,
    };
    throw err;
  }

  logger.info("content_translation.warm.consume_complete", {
    component: "content-translation-warm",
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    localeCount: locales.length,
  });

  return {
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    sourceLanguage: source.sourceLanguage,
    outcome: "completed",
    locales,
  };
}

export async function handleContentTranslationWarmRequestedEvent(
  envelope: DomainEvent<Record<string, unknown>>,
): Promise<void> {
  if (envelope.eventName !== CATALOGUE_EVENTS.contentTranslationWarmRequested) {
    return;
  }
  await processContentTranslationWarmRequested(envelope.payload);
}

export function registerContentTranslationWarmHandlers(): void {
  registerDomainEventHandler({
    consumerId: CONTENT_TRANSLATION_WARM_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
    handle: async (envelope) => {
      await handleContentTranslationWarmRequestedEvent(
        envelope as DomainEvent<Record<string, unknown>>,
      );
    },
  });
}

/**
 * Drain memory warm queue for unit tests (no Mongo dispatcher).
 */
export async function processContentTranslationWarmMemoryQueueForTests(): Promise<
  readonly ContentTranslationWarmProcessResult[]
> {
  const pending = listContentTranslationWarmMemoryPendingForTests();
  const results: ContentTranslationWarmProcessResult[] = [];
  for (const row of pending) {
    const result = await processContentTranslationWarmRequested(row.command);
    markContentTranslationWarmMemoryPublishedForTests(row.eventId);
    results.push(result);
  }
  return results;
}
