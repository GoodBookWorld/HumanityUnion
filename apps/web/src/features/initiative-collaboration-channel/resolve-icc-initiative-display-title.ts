/**
 * HU-LC-05C.4C.7F.7N — ICC sidebar title presentation (cache-only).
 *
 * Title-only CURRENT CT read. Missing/stale/partial → canonical original.
 * Never POST /generate; never mutates Initiative.
 */

import type { ResolvedTranslatedDisplay } from "@hu/types";

import { resolvePublicContentTranslationDisplay } from "../language/resolve-public-content-translation-display";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import type { PublicContentReadingContext } from "../language/use-public-content-reading-context";

export interface IccInitiativeDisplayTitleDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: IccInitiativeDisplayTitleDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

function pickTranslatedTitle(
  resolved: ResolvedTranslatedDisplay<Record<string, string>>,
  fallback: string,
): string {
  const value = resolved.content.title;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

/**
 * Resolve ICC header title for the active reading locale.
 * Uses existing public CT display resolve only — no Gemini / no generate.
 */
export async function resolveIccInitiativeDisplayTitle(
  input: {
    readonly initiativeId: string;
    readonly canonicalTitle: string;
    readonly readingContext: Pick<
      PublicContentReadingContext,
      "ready" | "readingLanguage" | "translationPreference"
    >;
  },
  deps: IccInitiativeDisplayTitleDeps = defaultDeps,
): Promise<string> {
  const canonical = input.canonicalTitle.trim();
  if (!canonical) {
    return input.canonicalTitle;
  }

  const resolved = await resolvePublicContentTranslationDisplay({
    sourceKind: "initiative",
    sourceRecordId: input.initiativeId,
    readingContext: input.readingContext,
    deps,
  });

  if (!resolved || resolved.presentationMode === "original") {
    return canonical;
  }

  return pickTranslatedTitle(resolved, canonical);
}
