/**
 * Reset 03C.1 — apply Media PLP entity presentations onto canonical editorial.
 * Atomic entity localization only: principles + trusted explanations.
 * Overview/FAQ/initiative flow stay canonical until those entities are PLP-backed.
 */

import type {
  CivicMediaCenterPublic,
  CivicMediaSelectionPrinciple,
} from "@hu/types";

import type { CivicMediaResolvedEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import { buildCanonicalCivicMediaEditorial } from "../../civic-media-center/components/CivicMediaTranslatedEditorial";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

export function applyMediaPlpPresentationsToEditorial(input: {
  readonly media: CivicMediaCenterPublic;
  readonly trustedById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
  readonly principlesById: Readonly<Record<string, MediaPlpResolvedPresentation>>;
}): CivicMediaResolvedEditorial {
  const canonical = buildCanonicalCivicMediaEditorial(input.media);

  const selectionPrinciples: CivicMediaSelectionPrinciple[] =
    canonical.selectionPrinciples.map((principle) => {
      const resolved = input.principlesById[principle.id];
      if (!resolved) {
        return principle;
      }
      const title = readMediaPlpStringField(resolved.presentation, "title");
      const description = readMediaPlpStringField(resolved.presentation, "description");
      return {
        ...principle,
        title: title.trim() || principle.title,
        description: description.trim() || principle.description,
      };
    });

  const trustedExplanationsById: Record<string, string> = {
    ...canonical.trustedExplanationsById,
  };
  for (const resource of input.media.trustedMedia) {
    const resolved = input.trustedById[resource.id];
    if (!resolved) {
      continue;
    }
    const explanation = readMediaPlpStringField(resolved.presentation, "explanation");
    if (explanation.trim()) {
      trustedExplanationsById[resource.id] = explanation;
    }
  }

  return {
    ...canonical,
    selectionPrinciples,
    trustedExplanationsById,
    translationChrome: {
      ...canonical.translationChrome,
      presentationMode: "plp_consumer",
    },
  };
}
