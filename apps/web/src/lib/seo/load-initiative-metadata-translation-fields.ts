/**
 * Pack 02I — optional cache/read-only initiative metadata translation fields.
 * Uses GET resolve only — never POST generate / Gemini.
 */
import type { LanguageCode } from "@hu/types";

import { resolveTranslatedContent } from "../../features/language/translation-api";

export async function loadInitiativeMetadataTranslationFields(input: {
  readonly initiativeId: string;
  readonly language: string;
}): Promise<{
  readonly translatedTitle?: string;
  readonly translatedDescription?: string;
}> {
  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      language: input.language as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      return {};
    }

    const content = resolved.content;
    if (!content || typeof content !== "object") {
      return {};
    }

    const title =
      typeof content.title === "string" && content.title.trim()
        ? content.title.trim()
        : undefined;
    const description =
      typeof content.description === "string" && content.description.trim()
        ? content.description.trim()
        : undefined;

    return {
      ...(title ? { translatedTitle: title } : {}),
      ...(description ? { translatedDescription: description } : {}),
    };
  } catch {
    // Cache miss / unavailable — keep canonical metadata.
    return {};
  }
}
