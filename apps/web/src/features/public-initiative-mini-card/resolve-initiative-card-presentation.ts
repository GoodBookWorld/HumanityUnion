/**
 * Pack 08I.7 — reusable Initiative card presentation resolver (title / summary).
 * Uses existing content_translations pipeline only — no second translation engine.
 * Canonical initiative fields are never overwritten.
 */

import type { LanguageCode, ResolvedTranslatedDisplay } from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import type { PublicContentReadingContext } from "../language/use-public-content-reading-context";

export interface InitiativeCardPresentationFields {
  readonly title: string;
  readonly summary: string;
}

export interface ResolvedInitiativeCardPresentation extends InitiativeCardPresentationFields {
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
}

export interface InitiativeCardPresentationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: InitiativeCardPresentationDeps = {
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

/**
 * Resolve eligible Initiative card presentation fields for the current reading context.
 * Missing/stale translation → canonical fallbacks.
 * TRANSLATION_EXISTS path: resolveTranslatedContent returns non-original → map title/description.
 *
 * `deps` is injectable for fixture tests that prove an existing translation reaches presentation.
 */
export async function resolveInitiativeCardPresentation(
  input: {
    readonly initiativeId: string;
    readonly canonical: InitiativeCardPresentationFields;
    readonly readingContext: Pick<
      PublicContentReadingContext,
      "ready" | "readingLanguage" | "translationPreference"
    >;
  },
  deps: InitiativeCardPresentationDeps = defaultDeps,
): Promise<ResolvedInitiativeCardPresentation> {
  const { canonical, readingContext } = input;

  if (!readingContext.ready || readingContext.translationPreference === "none") {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }

  try {
    let resolved = await deps.resolveTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      language: readingContext.readingLanguage as LanguageCode,
    });

    if (
      readingContext.translationPreference === "preferred" &&
      resolved.presentationMode === "original" &&
      readingContext.readingLanguage !== resolved.originalLanguage &&
      !resolved.isStale
    ) {
      try {
        const generated = await deps.generateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: input.initiativeId,
          targetLanguage: readingContext.readingLanguage as LanguageCode,
        });
        resolved = generated.display;
      } catch {
        // keep resolve result
      }
    }

    if (resolved.presentationMode === "original") {
      return {
        ...canonical,
        presentationMode: "original",
        isStale: Boolean(resolved.isStale),
      };
    }

    return {
      title: pickTranslatedField(resolved, "title", canonical.title),
      summary: pickTranslatedField(resolved, "description", canonical.summary),
      presentationMode: "translated",
      isStale: Boolean(resolved.isStale),
    };
  } catch {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }
}
