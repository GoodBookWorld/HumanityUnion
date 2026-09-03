/**
 * Pack 08I.8 — shared Initiative detail presentation (title + description).
 * Used by PIE hero and Overview so neither invents a private translation path.
 */

import type { LanguageCode, ResolvedTranslatedDisplay } from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import {
  emitPublicTranslationDiagnostic,
  shouldAttemptOnDemandContentTranslation,
} from "../language/public-translation-presentation-lifecycle";
import type { PublicContentReadingContext } from "../language/use-public-content-reading-context";

export interface InitiativeDetailPresentationFields {
  readonly title: string;
  readonly description: string;
}

export interface ResolvedInitiativeDetailPresentation extends InitiativeDetailPresentationFields {
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly originalTitle: string;
  readonly originalDescription: string;
  readonly isMachineTranslated: boolean;
  readonly canViewOriginal: boolean;
  readonly canViewTranslation: boolean;
}

export interface InitiativeDetailPresentationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: InitiativeDetailPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

function pickTranslatedField(
  resolved: ResolvedTranslatedDisplay<Record<string, string>>,
  key: string,
  fallback: string,
): string {
  const value = resolved.content[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

function pickOriginalField(
  resolved: ResolvedTranslatedDisplay<Record<string, string>>,
  key: string,
  fallback: string,
): string {
  const value = resolved.originalContent?.[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

/**
 * Resolve Initiative title + description for preferred reading language.
 * `deps` injectable for fixtures proving EXISTING translations reach presentation.
 */
export async function resolveInitiativeDetailPresentation(
  input: {
    readonly initiativeId: string;
    readonly canonical: InitiativeDetailPresentationFields;
    readonly readingContext: Pick<
      PublicContentReadingContext,
      "ready" | "readingLanguage" | "translationPreference"
    >;
  },
  deps: InitiativeDetailPresentationDeps = defaultDeps,
): Promise<ResolvedInitiativeDetailPresentation> {
  const { canonical, readingContext } = input;

  const originalFallback: ResolvedInitiativeDetailPresentation = {
    title: canonical.title,
    description: canonical.description,
    presentationMode: "original",
    isStale: false,
    activeLanguage: readingContext.readingLanguage as LanguageCode,
    originalLanguage: "en",
    originalTitle: canonical.title,
    originalDescription: canonical.description,
    isMachineTranslated: false,
    canViewOriginal: false,
    canViewTranslation: false,
  };

  if (!readingContext.ready || readingContext.translationPreference === "none") {
    return originalFallback;
  }

  try {
    let resolved = await deps.resolveTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      language: readingContext.readingLanguage as LanguageCode,
    });

    if (
      shouldAttemptOnDemandContentTranslation({
        ready: readingContext.ready,
        translationPreference: readingContext.translationPreference,
        readingLanguage: readingContext.readingLanguage,
        resolvePresentationMode: resolved.presentationMode,
        originalLanguage: resolved.originalLanguage,
        isStale: resolved.isStale,
      })
    ) {
      emitPublicTranslationDiagnostic({
        phase: "TRANSLATION_GENERATION_STARTED",
        sourceKind: "initiative",
        sourceRecordId: input.initiativeId,
        language: readingContext.readingLanguage,
        presentationMode: resolved.presentationMode,
      });
      try {
        const generated = await deps.generateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: input.initiativeId,
          targetLanguage: readingContext.readingLanguage as LanguageCode,
        });
        resolved = generated.display;
      } catch {
        emitPublicTranslationDiagnostic({
          phase: "TRANSLATION_GENERATION_FAILED",
          sourceKind: "initiative",
          sourceRecordId: input.initiativeId,
          language: readingContext.readingLanguage,
        });
      }
    }

    const originalTitle = pickOriginalField(resolved, "title", canonical.title);
    const originalDescription = pickOriginalField(
      resolved,
      "description",
      canonical.description,
    );

    if (resolved.presentationMode === "original") {
      emitPublicTranslationDiagnostic({
        phase: "TRANSLATION_CACHE_MISS",
        sourceKind: "initiative",
        sourceRecordId: input.initiativeId,
        language: readingContext.readingLanguage,
        presentationMode: "original",
      });
      return {
        ...originalFallback,
        isStale: Boolean(resolved.isStale),
        activeLanguage: resolved.activeLanguage,
        originalLanguage: resolved.originalLanguage,
        originalTitle,
        originalDescription,
        canViewOriginal: resolved.canViewOriginal,
        canViewTranslation: resolved.canViewTranslation,
      };
    }

    emitPublicTranslationDiagnostic({
      phase: "TRANSLATION_DISPLAYED",
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      language: readingContext.readingLanguage,
      presentationMode: resolved.presentationMode,
    });

    return {
      title: pickTranslatedField(resolved, "title", canonical.title),
      description: pickTranslatedField(resolved, "description", canonical.description),
      presentationMode: "translated",
      isStale: Boolean(resolved.isStale),
      activeLanguage: resolved.activeLanguage,
      originalLanguage: resolved.originalLanguage,
      originalTitle,
      originalDescription,
      isMachineTranslated: resolved.isMachineTranslated,
      canViewOriginal: resolved.canViewOriginal,
      canViewTranslation: resolved.canViewTranslation,
    };
  } catch {
    return originalFallback;
  }
}
