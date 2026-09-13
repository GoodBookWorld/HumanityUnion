/**
 * Step 07D — optional cache/read-only blog_post metadata translation fields.
 * Uses GET resolve only — never POST generate or schedule warm work.
 *
 * Compact Search discovery CT (title + excerpt) is sufficient for SEO overlay.
 */
import type { LanguageCode } from "@hu/types";

import { resolveTranslatedContent } from "../../features/language/translation-api";

export async function loadBlogMetadataTranslationFields(input: {
  readonly postId: string;
  readonly language: string;
}): Promise<{
  readonly translatedTitle?: string;
  readonly translatedDescription?: string;
}> {
  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
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
    // Compact discovery / SEO description maps from excerpt (not body content).
    const description =
      typeof content.excerpt === "string" && content.excerpt.trim()
        ? content.excerpt.trim()
        : undefined;

    return {
      ...(title ? { translatedTitle: title } : {}),
      ...(description ? { translatedDescription: description } : {}),
    };
  } catch {
    // Cache miss / unavailable / stale → keep canonical metadata.
    return {};
  }
}
