/**
 * Pack 08I.9 — SSR seed for Civic Media structured editorial.
 * GET resolve only — never POST generate from the server page.
 */
import type { CivicMediaCenterPublic, LanguageCode } from "@hu/types";

import { resolveTranslatedContent } from "../language/translation-api";
import {
  buildCanonicalCivicMediaEditorial,
  CIVIC_MEDIA_RECORD_ID,
  overlayCivicMediaEditorialFromFields,
  type CivicMediaResolvedEditorial,
} from "./components/CivicMediaTranslatedEditorial";

export async function loadCivicMediaEditorialSeed(input: {
  readonly media: CivicMediaCenterPublic;
  readonly language: string;
}): Promise<CivicMediaResolvedEditorial> {
  const canonical = buildCanonicalCivicMediaEditorial(input.media);

  try {
    const resolved = await resolveTranslatedContent({
      sourceKind: "civic_media",
      sourceRecordId: CIVIC_MEDIA_RECORD_ID,
      language: input.language as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      return canonical;
    }

    return overlayCivicMediaEditorialFromFields(input.media, resolved.content, {
      activeLanguage: resolved.activeLanguage,
      originalLanguage: resolved.originalLanguage,
      isMachineTranslated: resolved.isMachineTranslated,
      isStale: resolved.isStale,
      canViewOriginal: resolved.canViewOriginal,
      presentationMode: resolved.presentationMode,
    });
  } catch {
    return canonical;
  }
}
