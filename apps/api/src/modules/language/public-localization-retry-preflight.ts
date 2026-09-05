/**
 * Pack 08K.2.1 — non-mutating residual retry preflight + selection contract.
 *
 * Zero provider calls. Zero writes.
 */

import type {
  ContentTranslationSourceKind,
  LanguageCode,
} from "@hu/types";

import { assertCanonicalSourceEligibleForTranslation } from "./content-translation-eligibility.js";
import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  classifyLegacyOutboxLastError,
  type ContentTranslationArchitectureRetryBasis,
  type ContentTranslationValidationReasonCode,
} from "./content-translation-failure-metadata.js";
import {
  peekContentTranslationWarmOutboxFailure,
  resolveContentTranslationWarmOutboxDisposition,
} from "./content-translation-warm-enqueue.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import { findContentTranslation } from "./persistence/content-translation.repository.js";
import {
  collectAutoTranslatableNodes,
  fingerprintPublicPresentation,
} from "./public-localized-presentation.js";
import {
  fieldsAsPublicPresentation,
  type PublicLocalizationWorkItem,
} from "./public-localization-corpus.js";

export type PublicLocalizationRetryPreflight = {
  readonly sourceResolvable: boolean;
  readonly presentationValid: boolean;
  readonly localeEligible: boolean;
  readonly currentTranslationAbsent: boolean;
  readonly terminalFailureForCurrentVersion: boolean;
  readonly activeWorkAbsent: boolean;
  readonly architectureRetryBasis: ContentTranslationArchitectureRetryBasis | null;
  readonly failureReasonCode: ContentTranslationValidationReasonCode | string | null;
  readonly ready: boolean;
  readonly readyState:
    | "MISSING_READY_FOR_WARM"
    | "BLOCKED"
    | "CURRENT"
    | "ACTIVE_WORK"
    | "NOT_APPLICABLE";
  readonly blockReason: string | null;
};

export type PublicLocalizationResidualWithPreflight = {
  readonly family: string;
  readonly presentationIdentity: {
    readonly sourceKind: string;
    readonly sourceRecordId: string;
  };
  readonly targetLocale: LanguageCode;
  readonly translationState: string;
  readonly sourceVersionMatch: "match" | "mismatch" | "no_row" | "unloaded";
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryability: string | null;
  readonly lastFailureAt: string | null;
  readonly outboxDisposition: string;
  readonly mayScheduleNewWarm: boolean;
  readonly retryPreflight: PublicLocalizationRetryPreflight;
};

export type PublicLocalizationRetrySelection = {
  readonly RETRY_READY_IDENTITIES: number;
  readonly RETRY_BLOCKED_IDENTITIES: number;
  readonly ready: readonly PublicLocalizationResidualWithPreflight[];
  readonly blocked: readonly PublicLocalizationResidualWithPreflight[];
  readonly byFamilyReady: Readonly<Record<string, number>>;
  readonly byLocaleReady: Readonly<Record<string, number>>;
};

async function isLocaleEligible(targetLanguage: LanguageCode): Promise<boolean> {
  try {
    const locales = await listAutomaticContentTranslationTargetLocales();
    return locales.includes(targetLanguage);
  } catch {
    return false;
  }
}

/**
 * Deterministic non-mutating preflight for one residual identity.
 */
export async function buildPublicLocalizationRetryPreflight(input: {
  readonly workItem: PublicLocalizationWorkItem;
}): Promise<PublicLocalizationRetryPreflight> {
  const item = input.workItem;
  const peek = await peekContentTranslationWarmOutboxFailure({
    sourceKind: item.sourceKind,
    sourceRecordId: item.sourceRecordId,
  });
  const disposition = peek.disposition;

  let sourceResolvable = false;
  let presentationValid = false;
  let liveSourceVersion: string | null = null;
  let sourceLanguage: LanguageCode | null = null;

  try {
    const source = await loadTranslatableSource({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
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

  const localeEligible = await isLocaleEligible(item.targetLanguage);
  const redundant =
    sourceLanguage !== null && item.targetLanguage === sourceLanguage;

  let currentTranslationAbsent = true;
  let terminalFailureForCurrentVersion = false;
  if (liveSourceVersion && liveSourceVersion !== "unloaded") {
    const row = await findContentTranslation({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
      sourceVersion: liveSourceVersion,
      targetLanguage: item.targetLanguage,
    });
    if (row && row.freshness === "current" && row.stale !== true) {
      currentTranslationAbsent = false;
    }
  }

  if (disposition === "failed") {
    terminalFailureForCurrentVersion = true;
  }

  const activeWorkAbsent = disposition !== "pending";

  let failureReasonCode: string | null = null;
  if (peek.failureMetadata) {
    failureReasonCode = peek.failureMetadata.failureReasonCode;
  } else if (disposition === "failed") {
    failureReasonCode = classifyLegacyOutboxLastError(peek.lastErrorRaw ?? null)
      .failureReasonCode;
  }

  let architectureRetryBasis: ContentTranslationArchitectureRetryBasis | null = null;
  let ready = false;
  let readyState: PublicLocalizationRetryPreflight["readyState"] = "BLOCKED";
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
    if (failureReasonCode === "UNKNOWN_LEGACY") {
      architectureRetryBasis =
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1;
      ready = true;
      readyState = "MISSING_READY_FOR_WARM";
      blockReason = null;
    } else if (
      failureReasonCode === "UNCHANGED_SOURCE_PROSE" ||
      failureReasonCode === "UNCHANGED_CIVIC_TITLE" ||
      failureReasonCode === "EMPTY_TRANSLATION" ||
      failureReasonCode === "MISSING_REQUIRED_PATH" ||
      failureReasonCode === "INVALID_RICH_TEXT_STRUCTURE" ||
      failureReasonCode === "OTHER_VALIDATION_FAILURE"
    ) {
      blockReason = `Terminal validation failureReasonCode=${failureReasonCode} has no proven architecture retry basis.`;
    } else {
      blockReason = `Terminal failure without proven retry basis (failureReasonCode=${failureReasonCode ?? "null"}).`;
    }
  } else {
    architectureRetryBasis =
      item.sourceKind === "collective_decision"
        ? CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.COLLECTIVE_DECISION_HYDRATE_SYNC_08K2
        : CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.VALIDATION_DIAGNOSTICS_CONTRACT_v1;
    ready = true;
    readyState = "MISSING_READY_FOR_WARM";
    blockReason = null;
  }

  return {
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
  };
}

/**
 * Explain residuals with retry preflight (read-only).
 */
export async function explainPublicLocalizationResidualsWithPreflight(input: {
  readonly workItems: readonly PublicLocalizationWorkItem[];
}): Promise<{
  readonly residuals: readonly PublicLocalizationResidualWithPreflight[];
  readonly selection: PublicLocalizationRetrySelection;
}> {
  const residuals: PublicLocalizationResidualWithPreflight[] = [];

  for (const item of input.workItems) {
    if (item.state === "CURRENT" || item.state === "MANUAL_PRESERVED") {
      continue;
    }

    const peek = await peekContentTranslationWarmOutboxFailure({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
    });
    const disposition = await resolveContentTranslationWarmOutboxDisposition({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
    });

    const preflight = await buildPublicLocalizationRetryPreflight({ workItem: item });

    let sourceVersionMatch: PublicLocalizationResidualWithPreflight["sourceVersionMatch"] =
      "no_row";
    if (item.sourceVersion === "unloaded") {
      sourceVersionMatch = "unloaded";
    } else {
      const row = await findContentTranslation({
        sourceKind: item.sourceKind,
        sourceRecordId: item.sourceRecordId,
        sourceVersion: item.sourceVersion,
        targetLanguage: item.targetLanguage,
      });
      if (row) {
        sourceVersionMatch =
          row.sourceVersion === item.sourceVersion ? "match" : "mismatch";
      }
    }

    let translationState = String(item.state);
    if (disposition === "published" && preflight.currentTranslationAbsent) {
      translationState = "MISSING_AFTER_DISPATCH";
    } else if (disposition === "failed") {
      translationState = "TERMINAL_FAILED";
    } else if (disposition === "pending") {
      translationState = "QUEUED";
    } else if (preflight.readyState === "MISSING_READY_FOR_WARM") {
      translationState = "MISSING";
    }

    let failureClass: string | null = null;
    if (peek.failureMetadata) {
      failureClass = peek.failureMetadata.failureClass;
    } else if (disposition === "failed") {
      failureClass = classifyLegacyOutboxLastError(peek.lastErrorRaw).failureClass;
    } else if (
      translationState === "MISSING" &&
      item.sourceKind === "collective_decision" &&
      preflight.architectureRetryBasis ===
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.COLLECTIVE_DECISION_HYDRATE_SYNC_08K2
    ) {
      failureClass = "HISTORICAL_MISSING_AFTER_DISPATCH";
    }

    residuals.push({
      family: item.sourceKind,
      presentationIdentity: {
        sourceKind: item.sourceKind,
        sourceRecordId: item.sourceRecordId,
      },
      targetLocale: item.targetLanguage,
      translationState,
      sourceVersionMatch,
      failureClass,
      failureReasonCode: preflight.failureReasonCode,
      retryability: preflight.ready
        ? "retryable"
        : preflight.terminalFailureForCurrentVersion
          ? "non_retryable_until_code_or_content_change"
          : preflight.blockReason
            ? "unknown"
            : null,
      lastFailureAt: peek.lastFailureAt,
      outboxDisposition: disposition,
      mayScheduleNewWarm: preflight.ready,
      retryPreflight: preflight,
    });
  }

  const ready = residuals.filter((row) => row.retryPreflight.ready);
  const blocked = residuals.filter((row) => !row.retryPreflight.ready);

  const byFamilyReady: Record<string, number> = {};
  const byLocaleReady: Record<string, number> = {};
  for (const row of ready) {
    byFamilyReady[row.family] = (byFamilyReady[row.family] ?? 0) + 1;
    byLocaleReady[row.targetLocale] = (byLocaleReady[row.targetLocale] ?? 0) + 1;
  }

  return {
    residuals,
    selection: {
      RETRY_READY_IDENTITIES: ready.length,
      RETRY_BLOCKED_IDENTITIES: blocked.length,
      ready,
      blocked,
      byFamilyReady,
      byLocaleReady,
    },
  };
}

/**
 * Presentations that may be enqueued on a gated residual retry execute
 * (ready residual identities only). Groups ready locales per presentation
 * so fan-out stays locale-precise. Does not enqueue.
 */
export type ResidualRetryPresentationSchedule = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocales: readonly LanguageCode[];
  readonly readyIdentityCount: number;
  readonly architectureRetryBases: readonly string[];
};

export function selectReadyPresentationsForResidualRetry(
  selection: PublicLocalizationRetrySelection,
): readonly ResidualRetryPresentationSchedule[] {
  const byPresentation = new Map<string, ResidualRetryPresentationSchedule>();

  for (const row of selection.ready) {
    if (!row.retryPreflight.ready) {
      continue;
    }
    const key = `${row.presentationIdentity.sourceKind}::${row.presentationIdentity.sourceRecordId}`;
    const existing = byPresentation.get(key);
    const basis = row.retryPreflight.architectureRetryBasis;
    if (existing) {
      const locales = new Set(existing.targetLocales);
      locales.add(row.targetLocale);
      const bases = new Set(existing.architectureRetryBases);
      if (basis) {
        bases.add(basis);
      }
      byPresentation.set(key, {
        sourceKind: existing.sourceKind,
        sourceRecordId: existing.sourceRecordId,
        targetLocales: [...locales].sort((a, b) => a.localeCompare(b)) as LanguageCode[],
        readyIdentityCount: existing.readyIdentityCount + 1,
        architectureRetryBases: [...bases].sort((a, b) => a.localeCompare(b)),
      });
      continue;
    }
    byPresentation.set(key, {
      sourceKind: row.presentationIdentity.sourceKind as ContentTranslationSourceKind,
      sourceRecordId: row.presentationIdentity.sourceRecordId,
      targetLocales: [row.targetLocale],
      readyIdentityCount: 1,
      architectureRetryBases: basis ? [basis] : [],
    });
  }

  return [...byPresentation.values()].sort((a, b) => {
    const kind = a.sourceKind.localeCompare(b.sourceKind);
    if (kind !== 0) {
      return kind;
    }
    return a.sourceRecordId.localeCompare(b.sourceRecordId);
  });
}

/**
 * Convert ready residual rows into wait/work identities (locale-precise).
 */
export function selectedReadyWorkItemsFromResiduals(
  ready: readonly PublicLocalizationResidualWithPreflight[],
): PublicLocalizationWorkItem[] {
  return ready
    .filter((row) => row.retryPreflight.ready)
    .map((row) => ({
      sourceKind: row.presentationIdentity.sourceKind as ContentTranslationSourceKind,
      sourceRecordId: row.presentationIdentity.sourceRecordId,
      sourceVersion: "unloaded",
      targetLanguage: row.targetLocale,
      state: "MISSING" as const,
      autoNodeCount: 0,
      missingOrStaleNodeCount: 0,
      fallbackPaths: [],
    }));
}
