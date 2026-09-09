/**
 * Pack 08J.1 — generic localized presentation boundary for public Web surfaces.
 *
 * Pack 1.1 — participant reads are cache-only (GET resolve). Never POST /generate.
 * Missing/stale/partial → canonical fallback. Async warm builds CURRENT elsewhere.
 *
 * Contract:
 * - Interface/document locale drives resolve language (not readingLanguages[0]).
 * - readingContext supplies ready + translationPreference only.
 * - Always GET warm resolve when ready; never on-demand generate.
 * - Applies resolved field bags via the generic walker when a nested projection
 *   shape is provided; flat bags merge by key (per-field canonical fill).
 * - Stale async responses cannot overwrite a newer locale request.
 */

import type {
  ContentTranslationSourceKind,
  LanguageCode,
  ResolvedTranslatedDisplay,
} from "@hu/types";

import { applyTranslatedPresentationFields } from "./translate-presentation";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "./translation-api";
import { emitPublicTranslationDiagnostic } from "./public-translation-presentation-lifecycle";

/** Detect incomplete translated field bags (Pack 08K.3.2 PARTIAL). */
export function isPartialTranslatedFieldBag(input: {
  readonly canonicalFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>>;
}): boolean {
  let present = 0;
  let missing = 0;
  for (const [key, sourceValue] of Object.entries(input.canonicalFields)) {
    if (!sourceValue.trim()) {
      continue;
    }
    const translated = input.translatedFields[key];
    if (typeof translated === "string" && translated.trim()) {
      present += 1;
    } else {
      missing += 1;
    }
  }
  return present > 0 && missing > 0;
}

export interface LocalizedPresentationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  /** @deprecated Pack 1.1 — unused; retained for injectable test deps shape. */
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: LocalizedPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

export interface LocalizedPresentationRequest {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  /** UI / document locale (Pack 08I.14B / 08J.1). */
  readonly displayLanguage: LanguageCode | string;
  readonly ready: boolean;
  readonly translationPreference: string;
  /**
   * @deprecated Pack 1.1 — participant on-demand generation is retired; ignored.
   */
  readonly enableOnDemandGenerate?: boolean;
  /**
   * Monotonic request generation — callers bump when locale/source changes so
   * stale responses cannot overwrite a newer locale.
   */
  readonly requestGeneration?: number;
}

export interface LocalizedPresentationResult<TProjection = Record<string, string>> {
  readonly fields: Record<string, string>;
  readonly projection: TProjection;
  readonly presentationMode: ResolvedTranslatedDisplay["presentationMode"];
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly isMachineTranslated: boolean;
  readonly isStale: boolean;
  readonly canViewOriginal: boolean;
  readonly canViewTranslation: boolean;
  readonly requestGeneration: number;
}

/**
 * Resolve CURRENT/manual translation for a source and return a field bag ready
 * for walker application. Never calls Gemini / TranslationProvider.
 */
export async function resolveLocalizedPresentation(input: {
  readonly request: LocalizedPresentationRequest;
  readonly canonicalFields: Record<string, string>;
  readonly canonicalProjection?: unknown;
  readonly deps?: LocalizedPresentationDeps;
}): Promise<LocalizedPresentationResult> {
  const deps = input.deps ?? defaultDeps;
  const requestGeneration = input.request.requestGeneration ?? 0;
  const displayLanguage = input.request.displayLanguage;

  if (!input.request.ready) {
    emitPublicTranslationDiagnostic({
      phase: "TRANSLATION_NOT_REQUESTED",
      sourceKind: input.request.sourceKind,
      sourceRecordId: input.request.sourceRecordId,
      language: displayLanguage,
    });
    return {
      fields: input.canonicalFields,
      projection: (input.canonicalProjection ?? input.canonicalFields) as Record<string, string>,
      presentationMode: "original",
      activeLanguage: displayLanguage as LanguageCode,
      originalLanguage: displayLanguage as LanguageCode,
      isMachineTranslated: false,
      isStale: false,
      canViewOriginal: false,
      canViewTranslation: false,
      requestGeneration,
    };
  }

  try {
    const resolved = await deps.resolveTranslatedContent({
      sourceKind: input.request.sourceKind,
      sourceRecordId: input.request.sourceRecordId,
      language: displayLanguage as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      emitPublicTranslationDiagnostic({
        phase: resolved.isStale ? "TRANSLATION_STALE" : "TRANSLATION_CACHE_MISS",
        sourceKind: input.request.sourceKind,
        sourceRecordId: input.request.sourceRecordId,
        language: displayLanguage,
        presentationMode: "original",
      });
      return {
        fields: input.canonicalFields,
        projection: (input.canonicalProjection ?? input.canonicalFields) as Record<string, string>,
        presentationMode: "original",
        activeLanguage: resolved.activeLanguage,
        originalLanguage: resolved.originalLanguage,
        isMachineTranslated: false,
        isStale: resolved.isStale,
        canViewOriginal: resolved.canViewOriginal,
        canViewTranslation: resolved.canViewTranslation,
        requestGeneration,
      };
    }

    // Reject locale drift — caller may have switched language mid-flight.
    if (resolved.activeLanguage !== displayLanguage) {
      return {
        fields: input.canonicalFields,
        projection: (input.canonicalProjection ?? input.canonicalFields) as Record<string, string>,
        presentationMode: "original",
        activeLanguage: resolved.activeLanguage,
        originalLanguage: resolved.originalLanguage,
        isMachineTranslated: false,
        isStale: resolved.isStale,
        canViewOriginal: resolved.canViewOriginal,
        canViewTranslation: resolved.canViewTranslation,
        requestGeneration,
      };
    }

    // Per-field merge: missing translated keys keep canonical (PARTIAL-safe).
    const fields: Record<string, string> = { ...input.canonicalFields };
    for (const [key, value] of Object.entries(resolved.content)) {
      if (typeof value === "string" && value.trim()) {
        fields[key] = value;
      }
    }

    const projection =
      input.canonicalProjection !== undefined
        ? applyTranslatedPresentationFields(
            input.canonicalProjection as Parameters<typeof applyTranslatedPresentationFields>[0],
            fields,
          )
        : fields;

    emitPublicTranslationDiagnostic({
      phase: "TRANSLATION_DISPLAYED",
      sourceKind: input.request.sourceKind,
      sourceRecordId: input.request.sourceRecordId,
      language: displayLanguage,
      presentationMode: resolved.presentationMode,
    });

    return {
      fields,
      projection: projection as Record<string, string>,
      presentationMode: resolved.presentationMode,
      activeLanguage: resolved.activeLanguage,
      originalLanguage: resolved.originalLanguage,
      isMachineTranslated: resolved.isMachineTranslated,
      isStale: resolved.isStale,
      canViewOriginal: resolved.canViewOriginal,
      canViewTranslation: resolved.canViewTranslation,
      requestGeneration,
    };
  } catch {
    return {
      fields: input.canonicalFields,
      projection: (input.canonicalProjection ?? input.canonicalFields) as Record<string, string>,
      presentationMode: "original",
      activeLanguage: displayLanguage as LanguageCode,
      originalLanguage: displayLanguage as LanguageCode,
      isMachineTranslated: false,
      isStale: false,
      canViewOriginal: false,
      canViewTranslation: false,
      requestGeneration,
    };
  }
}
