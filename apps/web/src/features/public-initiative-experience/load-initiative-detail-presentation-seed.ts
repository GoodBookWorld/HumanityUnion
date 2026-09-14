/**
 * Pack 08I.9 — SSR seed for Initiative detail title/description.
 * GET resolve only — never POST generate from the server page.
 */
import type { LanguageCode } from "@hu/types";

import { resolveTranslatedContent } from "../language/translation-api";

export interface InitiativeDetailPresentationSeed {
  readonly title: string;
  readonly description: string;
}

export async function loadInitiativeDetailPresentationSeed(input: {
  readonly initiativeId: string;
  readonly language: string;
  readonly canonical: InitiativeDetailPresentationSeed;
}): Promise<InitiativeDetailPresentationSeed> {
  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      language: input.language as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      return input.canonical;
    }

    const title =
      typeof resolved.content.title === "string" && resolved.content.title.trim()
        ? resolved.content.title.trim()
        : input.canonical.title;
    const description =
      typeof resolved.content.description === "string" && resolved.content.description.trim()
        ? resolved.content.description.trim()
        : input.canonical.description;

    return { title, description };
  } catch {
    return input.canonical;
  }
}
