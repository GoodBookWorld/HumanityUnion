/**
 * Pack 08I.12 — shared public translation presentation lifecycle helpers.
 *
 * Distinguishes cache miss / generation / display without logging secrets
 * or participant content bodies.
 */

import type { LanguageCode, ResolvedContentPresentationMode } from "@hu/types";

export type PublicTranslationDiagnosticPhase =
  | "TRANSLATION_NOT_REQUESTED"
  | "TRANSLATION_CACHE_MISS"
  | "TRANSLATION_STALE"
  | "TRANSLATION_GENERATION_STARTED"
  | "TRANSLATION_GENERATION_FAILED"
  | "TRANSLATION_AVAILABLE"
  | "TRANSLATION_DISPLAYED";

export interface PublicTranslationDiagnosticEvent {
  readonly phase: PublicTranslationDiagnosticPhase;
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly language?: string;
  readonly presentationMode?: ResolvedContentPresentationMode | "translated" | "original";
}

/**
 * Whether preferred reading context should attempt on-demand generation after
 * a cache-only resolve returned original.
 *
 * SSR seeds are cache-only GET — client hydration MUST still be allowed to
 * POST generate when preferred translation is missing. Canonical SSR seed is
 * never treated as authoritative "do not generate".
 */
export function shouldAttemptOnDemandContentTranslation(input: {
  readonly ready: boolean;
  readonly translationPreference: string;
  readonly readingLanguage: string;
  readonly resolvePresentationMode: string;
  readonly originalLanguage?: string | null;
  readonly isStale?: boolean;
}): boolean {
  if (!input.ready) {
    return false;
  }
  if (input.translationPreference !== "preferred") {
    return false;
  }
  if (input.resolvePresentationMode !== "original") {
    return false;
  }
  if (input.isStale) {
    return false;
  }
  const original = input.originalLanguage;
  if (typeof original === "string" && original.length > 0) {
    return input.readingLanguage !== original;
  }
  return true;
}

export function classifyResolvedTranslationPhase(input: {
  readonly requested: boolean;
  readonly presentationMode: string;
  readonly isStale?: boolean;
  readonly displayedTranslated: boolean;
}): PublicTranslationDiagnosticPhase {
  if (!input.requested) {
    return "TRANSLATION_NOT_REQUESTED";
  }
  if (input.isStale) {
    return "TRANSLATION_STALE";
  }
  if (input.presentationMode === "original") {
    return "TRANSLATION_CACHE_MISS";
  }
  if (input.displayedTranslated) {
    return "TRANSLATION_DISPLAYED";
  }
  return "TRANSLATION_AVAILABLE";
}

/** Dev-only diagnostic — never logs content payloads. */
export function emitPublicTranslationDiagnostic(
  event: PublicTranslationDiagnosticEvent,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (typeof console === "undefined" || typeof console.debug !== "function") {
    return;
  }
  console.debug("[public-translation]", {
    phase: event.phase,
    sourceKind: event.sourceKind,
    sourceRecordId: event.sourceRecordId,
    language: event.language,
    presentationMode: event.presentationMode,
  });
}

export function readingLanguagesEqual(
  a: LanguageCode | string,
  b: LanguageCode | string,
): boolean {
  return a === b;
}
