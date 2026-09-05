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
import {
  classifyContentTranslationMaterializationFailure,
  classifyContentTranslationWarmFailure,
} from "./content-translation-warm-failure.js";
import {
  encodeContentTranslationFailureMetadata,
  resolveValidationReasonCodeFromError,
} from "./content-translation-failure-metadata.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryFailedForTests,
  markContentTranslationWarmMemoryPublishedForTests,
} from "./content-translation-warm-enqueue.js";
import { buildContentTranslationWarmTargetDiagnostic } from "./content-translation-warm-diagnostic.js";
import { resolveAutomaticContentTranslationWarmTargets } from "./content-translation-warm-targets.js";
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
      readonly failureReasonCode: string | null;
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
    | "failed_retryable"
    /** Pack 08I.14B.3 — locale failure without CURRENT; must not mark warm success. */
    | "failed_terminal";
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
    logger.warn("content_translation.warm.skipped_missing_source", {
      component: "content-translation-warm",
      sourceKind: command.sourceKind,
      sourceRecordId: command.sourceRecordId,
      // Pack 08K.2 — must not ack outbox success: that left identities MISSING
      // forever after Collective Decision Map sync failures.
      outcome: "failed_retryable",
      failureClass: "SOURCE_UNAVAILABLE",
    });
    throw new TranslationProviderError(
      "unavailable",
      `Content translation warm source unavailable for ${command.sourceKind}.`,
    );
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

  const { registryCandidates, warmTargetLocales: targets } =
    await resolveAutomaticContentTranslationWarmTargets({
      excludeSourceLanguage: source.sourceLanguage,
    });

  logger.info("content_translation.warm.target_resolution", {
    ...buildContentTranslationWarmTargetDiagnostic({
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: source.sourceLanguage,
      registryCandidates,
      warmTargetLocales: targets,
    }),
  });

  const concurrency = resolveContentTranslationWarmLocaleConcurrency();
  let sawRetryableFailure = false;
  let sawNonRetryableFailure = false;

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

      // Pack 08I.14B.3 — enqueue/skip without CURRENT translation is not success.
      const status = result.generated
        ? ("generated" as const)
        : result.translation && !result.translation.stale
          ? ("skipped_existing" as const)
          : ("skipped_ineligible" as const);

      if (status === "skipped_ineligible") {
        sawNonRetryableFailure = true;
      }

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
      const failureReasonCode = resolveValidationReasonCodeFromError(error);

      logger.warn("content_translation.warm.locale_failed", {
        component: "content-translation-warm",
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceVersion: source.sourceVersion,
        targetLanguage,
        workIdentityKey,
        failureClass,
        errorCode,
        failureReasonCode,
        error: error instanceof Error ? error.message : String(error),
      });

      if (failureClass === "retryable") {
        sawRetryableFailure = true;
      } else {
        sawNonRetryableFailure = true;
      }

      return {
        targetLanguage,
        workIdentityKey,
        status: "failed" as const,
        failureClass,
        errorCode,
        failureReasonCode,
      };
    }
  });

  const materializedOk = locales.every(
    (locale) =>
      locale.status === "generated" ||
      locale.status === "skipped_existing" ||
      locale.status === "skipped_source_language",
  );

  if (!materializedOk || sawRetryableFailure || sawNonRetryableFailure) {
    const outcome = sawRetryableFailure ? "failed_retryable" : "failed_terminal";
    const firstFailed = locales.find((locale) => locale.status === "failed");
    const diagnostic = firstFailed
      ? classifyContentTranslationMaterializationFailure(
          firstFailed.errorCode === "timeout"
            ? new TranslationProviderError("timeout", "timeout")
            : firstFailed.errorCode === "malformed_response"
              ? new TranslationProviderError("malformed_response", "malformed")
              : firstFailed.errorCode === "unavailable"
                ? new TranslationProviderError("unavailable", "unavailable")
                : new TranslationProviderError("bad_request", "validation"),
        )
      : classifyContentTranslationMaterializationFailure(
          new TranslationProviderError("bad_request", "validation"),
        );
    const reasonCode =
      (firstFailed && "failureReasonCode" in firstFailed
        ? firstFailed.failureReasonCode
        : null) ??
      diagnostic.failureClass ??
      "UNKNOWN_LEGACY";

    const metaMessage = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: diagnostic.failureClass,
      failureReasonCode: String(reasonCode),
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      targetLocale: firstFailed?.targetLanguage ?? null,
      failedAt: new Date().toISOString(),
      retryabilityHint: diagnostic.retryability,
    });

    const err = new TranslationProviderError(
      sawRetryableFailure ? "unavailable" : "bad_request",
      metaMessage,
    );
    logger.warn(
      sawRetryableFailure
        ? "content_translation.warm.consume_retryable"
        : "content_translation.warm.consume_terminal_failure",
      {
        component: "content-translation-warm",
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceVersion: source.sourceVersion,
        outcome,
        failureClass: diagnostic.failureClass,
        failureReasonCode: reasonCode,
        localeStatuses: locales.map((locale) => locale.status),
      },
    );
    // Attach locale outcomes for tests / operator diagnostics.
    (err as Error & { warmResult?: ContentTranslationWarmProcessResult }).warmResult = {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: source.sourceLanguage,
      outcome,
      locales,
    };
    throw err;
  }

  logger.info("content_translation.warm.consume_complete", {
    component: "content-translation-warm",
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    sourceLanguage: source.sourceLanguage,
    warmTargetLocales: targets,
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
    try {
      const result = await processContentTranslationWarmRequested(row.command);
      markContentTranslationWarmMemoryPublishedForTests(row.eventId);
      results.push(result);
    } catch (error) {
      markContentTranslationWarmMemoryFailedForTests(
        row.eventId,
        error instanceof Error ? error.message : "warm memory drain failure",
      );
      throw error;
    }
  }
  return results;
}
