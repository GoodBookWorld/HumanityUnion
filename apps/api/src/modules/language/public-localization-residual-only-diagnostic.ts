/**
 * Pack 08K.2.4 — memory-safe residual-only failure diagnostics.
 *
 * Does NOT invoke full corpus discovery/audit or civic snapshot hydrate.
 * Discovers residuals from bounded failed-outbox rows (or explicit identities),
 * then diagnoses each identity with direct source/translation/outbox lookups.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  classifyLegacyOutboxLastError,
  isExplicitlyRetryableModernFailure,
  parseContentTranslationFailureMetadata,
  type ContentTranslationArchitectureRetryBasis,
} from "./content-translation-failure-metadata.js";
import {
  assertResidualDiagnosticDidNotHydrateFullCorpus,
  getResidualDiagnosticCounters,
  loadTranslatableSourceDirect,
  markResidualDiagnosticInFlight,
  markResidualDiagnosticOutboxRowsInspected,
  markResidualDiagnosticTranslationRowsLoaded,
  resetResidualDiagnosticCountersForTests,
} from "./content-translation-source-direct.js";
import {
  peekContentTranslationWarmOutboxFailure,
} from "./content-translation-warm-enqueue.js";
import { assertCanonicalSourceEligibleForTranslation } from "./content-translation-eligibility.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import { findContentTranslation } from "./persistence/content-translation.repository.js";
import {
  collectAutoTranslatableNodes,
  fingerprintPublicPresentation,
} from "./public-localized-presentation.js";
import { fieldsAsPublicPresentation } from "./public-localization-corpus.js";
import type { PublicLocalizationResidualWithPreflight } from "./public-localization-retry-preflight.js";

/** Default batch / scan bounds — keep small for Render memory. */
export const RESIDUAL_DIAGNOSTIC_DEFAULT_BATCH_SIZE = 25;
export const RESIDUAL_DIAGNOSTIC_DEFAULT_OUTBOX_SCAN_LIMIT = 100;
export const RESIDUAL_DIAGNOSTIC_MAX_ATTEMPTS_PER_AGGREGATE = 10;

export type ResidualDiagnosticIdentity = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
};

export type ResidualDiagnosticMemoryCounters = {
  readonly DIAGNOSTIC_IDENTITIES: number;
  readonly DIAGNOSTIC_BATCH_SIZE: number;
  readonly OUTBOX_ROWS_INSPECTED: number;
  readonly SOURCE_RECORDS_LOADED: number;
  readonly TRANSLATION_ROWS_LOADED: number;
  readonly FULL_CORPUS_HYDRATED: false;
  readonly PEAK_IN_FLIGHT_IDENTITIES: number;
};

export type ResidualOnlyDiagnosticResult = {
  readonly mode: "explain-residuals-only";
  readonly residuals: readonly PublicLocalizationResidualWithPreflight[];
  readonly RETRY_READY_IDENTITIES: number;
  readonly RETRY_BLOCKED_IDENTITIES: number;
  readonly memory: ResidualDiagnosticMemoryCounters;
  readonly note: string;
};

function parseAggregateId(aggregateId: string): {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
} | null {
  const sep = aggregateId.indexOf("::");
  if (sep <= 0) {
    return null;
  }
  const sourceKind = aggregateId.slice(0, sep) as ContentTranslationSourceKind;
  const sourceRecordId = aggregateId.slice(sep + 2).trim();
  if (!sourceKind || !sourceRecordId) {
    return null;
  }
  return { sourceKind, sourceRecordId };
}

/**
 * Discover terminal-failed residual identities from a bounded failed-outbox scan.
 * Never loads the full outbox collection.
 */
export async function discoverResidualIdentitiesFromFailedOutbox(input?: {
  readonly maxOutboxRows?: number;
  readonly maxIdentities?: number;
  /** Optional explicit identities (takes precedence / merges). */
  readonly explicit?: readonly ResidualDiagnosticIdentity[];
  /** Test injection: pre-scanned failed outbox rows. */
  readonly failedOutboxRowsForTests?: readonly {
    readonly aggregateId: string;
    readonly createdAt: string;
    readonly lastError: string | null;
    readonly payload?: Record<string, unknown> | null;
  }[];
}): Promise<readonly ResidualDiagnosticIdentity[]> {
  const maxOutboxRows = Math.min(
    500,
    Math.max(1, input?.maxOutboxRows ?? RESIDUAL_DIAGNOSTIC_DEFAULT_OUTBOX_SCAN_LIMIT),
  );
  const maxIdentities = Math.min(
    500,
    Math.max(1, input?.maxIdentities ?? RESIDUAL_DIAGNOSTIC_DEFAULT_BATCH_SIZE),
  );

  const byKey = new Map<string, ResidualDiagnosticIdentity>();

  const add = (identity: ResidualDiagnosticIdentity) => {
    const key = `${identity.sourceKind}::${identity.sourceRecordId}::${identity.targetLocale}`;
    if (!byKey.has(key) && byKey.size < maxIdentities) {
      byKey.set(key, identity);
    }
  };

  for (const row of input?.explicit ?? []) {
    add(row);
  }

  let rows = input?.failedOutboxRowsForTests ?? null;
  if (!rows) {
    if (!isMongoConfigured()) {
      markResidualDiagnosticOutboxRowsInspected(0);
      return [...byKey.values()];
    }
    await connectMongoClient();
    const collection = getMongoCollection<{
      aggregateId: string;
      createdAt?: string;
      lastError?: string | null;
      envelope?: string;
      status: string;
      eventName: string;
    }>(MONGO_COLLECTIONS.outbox);

    rows = await collection
      .find({
        eventName: CATALOGUE_EVENTS.contentTranslationWarmRequested,
        status: "failed",
      })
      .sort({ createdAt: -1 })
      .limit(maxOutboxRows)
      .toArray()
      .then((docs) =>
        docs.map((doc) => {
          let payload: Record<string, unknown> | null = null;
          if (typeof doc.envelope === "string") {
            try {
              payload =
                (JSON.parse(doc.envelope) as { payload?: Record<string, unknown> }).payload ??
                null;
            } catch {
              payload = null;
            }
          }
          return {
            aggregateId: String(doc.aggregateId),
            createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
            lastError: typeof doc.lastError === "string" ? doc.lastError : null,
            payload,
          };
        }),
      );
  }

  markResidualDiagnosticOutboxRowsInspected(rows?.length ?? 0);

  for (const row of rows ?? []) {
    if (byKey.size >= maxIdentities) {
      break;
    }
    const parsed = parseAggregateId(row.aggregateId);
    if (!parsed) {
      continue;
    }
    const meta = parseContentTranslationFailureMetadata(row.lastError);
    if (meta?.localeFailures?.length) {
      for (const localeFailure of meta.localeFailures) {
        add({
          sourceKind: parsed.sourceKind,
          sourceRecordId: parsed.sourceRecordId,
          targetLocale: localeFailure.targetLocale as LanguageCode,
        });
      }
      continue;
    }
    if (meta?.targetLocale) {
      add({
        sourceKind: parsed.sourceKind,
        sourceRecordId: parsed.sourceRecordId,
        targetLocale: meta.targetLocale as LanguageCode,
      });
      continue;
    }
    const payloadLocales = Array.isArray(row.payload?.targetLocales)
      ? row.payload.targetLocales.filter(
          (locale): locale is string => typeof locale === "string" && locale.trim().length > 0,
        )
      : [];
    if (payloadLocales.length) {
      for (const locale of payloadLocales) {
        add({
          sourceKind: parsed.sourceKind,
          sourceRecordId: parsed.sourceRecordId,
          targetLocale: locale as LanguageCode,
        });
      }
      continue;
    }
    // Legacy failed warm without locale hint — expand to automatic targets (bounded).
    try {
      const locales = await listAutomaticContentTranslationTargetLocales();
      for (const locale of locales) {
        add({
          sourceKind: parsed.sourceKind,
          sourceRecordId: parsed.sourceRecordId,
          targetLocale: locale,
        });
      }
    } catch {
      // ignore registry failure
    }
  }

  return [...byKey.values()];
}

async function diagnoseOneResidualIdentity(
  identity: ResidualDiagnosticIdentity,
): Promise<PublicLocalizationResidualWithPreflight> {
  const peek = await peekContentTranslationWarmOutboxFailure({
    sourceKind: identity.sourceKind,
    sourceRecordId: identity.sourceRecordId,
    targetLocale: identity.targetLocale,
  });

  let sourceResolvable = false;
  let presentationValid = false;
  let liveSourceVersion: string | null = null;
  let sourceLanguage: LanguageCode | null = null;

  try {
    const source = await loadTranslatableSourceDirect({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
    });
    if (source) {
      sourceResolvable = true;
      sourceLanguage = source.sourceLanguage;
      liveSourceVersion = source.sourceVersion;
      const presentation = fieldsAsPublicPresentation(source.fields);
      collectAutoTranslatableNodes(presentation);
      fingerprintPublicPresentation(presentation);
      presentationValid = true;
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
      } catch {
        presentationValid = false;
      }
    }
  } catch {
    sourceResolvable = false;
    presentationValid = false;
  }

  let localeEligible = false;
  try {
    const locales = await listAutomaticContentTranslationTargetLocales();
    localeEligible = locales.includes(identity.targetLocale);
  } catch {
    localeEligible = false;
  }
  const redundant =
    sourceLanguage !== null && identity.targetLocale === sourceLanguage;

  let currentTranslationAbsent = true;
  if (liveSourceVersion) {
    const row = await findContentTranslation({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
      sourceVersion: liveSourceVersion,
      targetLanguage: identity.targetLocale,
    });
    markResidualDiagnosticTranslationRowsLoaded(row ? 1 : 0);
    if (row && row.freshness === "current" && row.stale !== true) {
      currentTranslationAbsent = false;
    }
  }

  const disposition = peek.disposition;
  const terminalFailureForCurrentVersion = disposition === "failed";
  const activeWorkAbsent = disposition !== "pending";

  let failureReasonCode: string | null = null;
  let failureClass: string | null = null;
  if (peek.failureMetadata) {
    failureReasonCode = peek.failureMetadata.failureReasonCode;
    failureClass = peek.failureMetadata.failureClass;
  } else if (disposition === "failed") {
    const legacy = classifyLegacyOutboxLastError(peek.lastErrorRaw ?? null);
    failureReasonCode = legacy.failureReasonCode;
    failureClass = legacy.failureClass;
  }

  const modernAttempt = Boolean(
    peek.latestAttempt?.failureMetadata ||
      peek.latestAttempt?.reason === "operator_residual_retry" ||
      (typeof peek.latestAttempt?.lastError === "string" &&
        peek.latestAttempt.lastError.startsWith("CT_FAIL_META_V1:")),
  );

  let architectureRetryBasis: ContentTranslationArchitectureRetryBasis | null = null;
  let ready = false;
  let readyState:
    | "MISSING_READY_FOR_WARM"
    | "BLOCKED"
    | "CURRENT"
    | "ACTIVE_WORK"
    | "NOT_APPLICABLE" = "BLOCKED";
  let blockReason: string | null = null;

  if (!currentTranslationAbsent) {
    readyState = "CURRENT";
    blockReason = "CURRENT translation already exists for live sourceVersion.";
  } else if (!activeWorkAbsent) {
    readyState = "ACTIVE_WORK";
    blockReason = "Active queued/processing warm work exists.";
  } else if (redundant) {
    blockReason = "Target locale equals source language.";
  } else if (!sourceResolvable) {
    blockReason = "Source loader did not resolve a public presentation.";
  } else if (!presentationValid) {
    blockReason = "Presentation failed eligibility/fingerprint preflight.";
  } else if (!localeEligible) {
    blockReason = "Target locale is not enabled for content translation.";
  } else if (terminalFailureForCurrentVersion) {
    if (
      failureReasonCode === "UNKNOWN_LEGACY" &&
      !modernAttempt &&
      !peek.failureMetadata
    ) {
      architectureRetryBasis =
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1;
      ready = true;
      readyState = "MISSING_READY_FOR_WARM";
      blockReason = null;
    } else if (
      isExplicitlyRetryableModernFailure({
        failureClass,
        failureReasonCode,
      })
    ) {
      architectureRetryBasis =
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.VALIDATION_DIAGNOSTICS_CONTRACT_v1;
      ready = true;
      readyState = "MISSING_READY_FOR_WARM";
      blockReason = null;
    } else if (modernAttempt || peek.failureMetadata) {
      blockReason = `Modern terminal failureReasonCode=${failureReasonCode ?? "null"} blocks historical retry.`;
    } else {
      blockReason = `Terminal failure without proven retry basis (failureReasonCode=${failureReasonCode ?? "null"}).`;
    }
  } else {
    architectureRetryBasis =
      identity.sourceKind === "collective_decision"
        ? CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.COLLECTIVE_DECISION_HYDRATE_SYNC_08K2
        : CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.VALIDATION_DIAGNOSTICS_CONTRACT_v1;
    ready = true;
    readyState = "MISSING_READY_FOR_WARM";
    blockReason = null;
  }

  const translationState =
    disposition === "failed"
      ? "TERMINAL_FAILED"
      : disposition === "pending"
        ? "QUEUED"
        : disposition === "published" && currentTranslationAbsent
          ? "MISSING_AFTER_DISPATCH"
          : readyState === "MISSING_READY_FOR_WARM"
            ? "MISSING"
            : String(disposition);

  return {
    family: identity.sourceKind,
    presentationIdentity: {
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
    },
    targetLocale: identity.targetLocale,
    translationState,
    sourceVersionMatch: liveSourceVersion ? "unloaded" : "no_row",
    failureClass,
    failureReasonCode,
    retryability: ready
      ? "retryable"
      : terminalFailureForCurrentVersion
        ? peek.failureMetadata?.retryabilityHint ??
          "non_retryable_until_code_or_content_change"
        : blockReason
          ? "unknown"
          : null,
    lastFailureAt: peek.lastFailureAt,
    outboxDisposition: disposition,
    mayScheduleNewWarm: ready,
    retryPreflight: {
      sourceResolvable,
      presentationValid,
      localeEligible: localeEligible && !redundant,
      currentTranslationAbsent,
      terminalFailureForCurrentVersion,
      activeWorkAbsent,
      architectureRetryBasis,
      failureReasonCode,
      ready,
      readyState,
      blockReason,
    },
    latestAttemptAt: peek.latestAttempt?.attemptAt ?? peek.lastFailureAt,
    latestAttemptReason: peek.latestAttempt?.reason ?? null,
    latestAttemptTargetLocale:
      peek.failureMetadata?.targetLocale != null
        ? String(peek.failureMetadata.targetLocale)
        : identity.targetLocale,
    failureMetadataVersion: peek.failureMetadata
      ? peek.failureMetadata.schema
      : disposition === "failed"
        ? "legacy_unstructured"
        : null,
  };
}

/**
 * Bounded residual-only diagnostic — zero provider calls, zero writes.
 */
export async function explainResidualsOnly(input?: {
  readonly batchSize?: number;
  readonly maxOutboxRows?: number;
  readonly explicitIdentities?: readonly ResidualDiagnosticIdentity[];
  readonly failedOutboxRowsForTests?: readonly {
    readonly aggregateId: string;
    readonly createdAt: string;
    readonly lastError: string | null;
    readonly payload?: Record<string, unknown> | null;
  }[];
  /** Test-only direct identity list without outbox discovery. */
  readonly identitiesForTests?: readonly ResidualDiagnosticIdentity[];
}): Promise<ResidualOnlyDiagnosticResult> {
  resetResidualDiagnosticCountersForTests();
  assertResidualDiagnosticDidNotHydrateFullCorpus();

  const batchSize = Math.min(
    25,
    Math.max(1, input?.batchSize ?? RESIDUAL_DIAGNOSTIC_DEFAULT_BATCH_SIZE),
  );

  const identities =
    input?.identitiesForTests !== undefined
      ? input.identitiesForTests.slice(0, batchSize)
      : await discoverResidualIdentitiesFromFailedOutbox({
          maxOutboxRows: input?.maxOutboxRows,
          maxIdentities: batchSize,
          explicit: input?.explicitIdentities,
          failedOutboxRowsForTests: input?.failedOutboxRowsForTests,
        });

  const residuals: PublicLocalizationResidualWithPreflight[] = [];
  for (let i = 0; i < identities.length; i += batchSize) {
    const batch = identities.slice(i, i + batchSize);
    markResidualDiagnosticInFlight(batch.length);
    for (const identity of batch) {
      residuals.push(await diagnoseOneResidualIdentity(identity));
    }
  }

  const ready = residuals.filter((row) => row.retryPreflight.ready);
  const counters = getResidualDiagnosticCounters();

  return {
    mode: "explain-residuals-only",
    residuals,
    RETRY_READY_IDENTITIES: ready.length,
    RETRY_BLOCKED_IDENTITIES: residuals.length - ready.length,
    memory: {
      DIAGNOSTIC_IDENTITIES: residuals.length,
      DIAGNOSTIC_BATCH_SIZE: batchSize,
      OUTBOX_ROWS_INSPECTED: counters.OUTBOX_ROWS_INSPECTED,
      SOURCE_RECORDS_LOADED: counters.SOURCE_RECORDS_LOADED,
      TRANSLATION_ROWS_LOADED: counters.TRANSLATION_ROWS_LOADED,
      FULL_CORPUS_HYDRATED: false,
      PEAK_IN_FLIGHT_IDENTITIES: counters.PEAK_IN_FLIGHT_IDENTITIES,
    },
    note:
      "RESIDUAL-ONLY diagnostic — no full corpus hydrate/audit. Bounded outbox+source lookups only.",
  };
}

export {
  resetResidualDiagnosticCountersForTests,
  getResidualDiagnosticCounters,
};
