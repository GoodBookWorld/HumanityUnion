/**
 * Pack 08I.8 — optional SSR seed for Blog article presentation.
 * GET resolve only — never POST generate from the server page.
 */
import type { LanguageCode } from "@hu/types";

import { resolveTranslatedContent } from "../language/translation-api";
import type { BlogPresentationFields } from "./resolve-blog-post-presentation";

export async function loadBlogArticlePresentationSeed(input: {
  readonly postId: string;
  readonly language: string;
  readonly canonical: BlogPresentationFields;
  /**
   * Pack 08I.10 — when false (authenticated explicit `none`), skip warm overlay
   * and return canonical fields for first paint.
   */
  readonly preferTranslation?: boolean;
}): Promise<BlogPresentationFields> {
  if (input.preferTranslation === false) {
    return input.canonical;
  }

  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      language: input.language as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      return input.canonical;
    }

    const title =
      typeof resolved.content.title === "string" && resolved.content.title.trim()
        ? resolved.content.title.trim()
        : input.canonical.title;
    const excerpt =
      typeof resolved.content.excerpt === "string" && resolved.content.excerpt.trim()
        ? resolved.content.excerpt.trim()
        : input.canonical.excerpt;
    const contentHtml =
      typeof resolved.content.content === "string" && resolved.content.content.trim()
        ? resolved.content.content.trim()
        : input.canonical.contentHtml;

    return { title, excerpt, contentHtml };
  } catch {
    return input.canonical;
  }
}
