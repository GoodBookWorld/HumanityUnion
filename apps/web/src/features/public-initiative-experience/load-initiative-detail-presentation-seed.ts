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

/**
 * CURRENT translation fields, with each missing field falling back to canonical.
 * `original` presentation and resolve failure stay fully canonical.
 */
export function selectInitiativeDocumentPresentationSeed(input: {
  readonly canonical: InitiativeDetailPresentationSeed;
  readonly presentationMode: string;
  readonly content?: { readonly title?: unknown; readonly description?: unknown } | null;
}): InitiativeDetailPresentationSeed {
  if (input.presentationMode === "original") {
    return input.canonical;
  }

  const content = input.content ?? {};
  const title =
    typeof content.title === "string" && content.title.trim()
      ? content.title.trim()
      : input.canonical.title;
  const description =
    typeof content.description === "string" && content.description.trim()
      ? content.description.trim()
      : input.canonical.description;

  return { title, description };
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

    return selectInitiativeDocumentPresentationSeed({
      canonical: input.canonical,
      presentationMode: resolved.presentationMode,
      content: resolved.content,
    });
  } catch {
    return input.canonical;
  }
}
