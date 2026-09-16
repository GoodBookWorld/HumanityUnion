"use client";

import type { CivicMediaCenterPublic } from "@hu/types";

import {
  buildCanonicalCivicMediaEditorial,
  type CivicMediaResolvedEditorial,
} from "../civic-media-canonical-editorial";

export {
  buildCanonicalCivicMediaEditorial,
  buildTrustedExplanationsById,
  CIVIC_MEDIA_RECORD_ID,
  overlayCivicMediaEditorialFromFields,
  parseCivicMediaJsonArray,
  parseInitiativeFlowStages,
  type CivicMediaResolvedEditorial,
  type CivicMediaTrustedExplanationsById,
} from "../civic-media-canonical-editorial";

/**
 * Ordinary Civic Media editorial reading — canonical fields only.
 *
 * Unify Ordinary Public Reading:
 * - Do not asynchronously resolve or apply CT into visible editorial DOM.
 * - PLP/CT overlay helpers remain exported for seeds and non-reading infra.
 * - `initialEditorial` / skipClientTranslation kept for call-site compatibility.
 */
export function useCivicMediaResolvedEditorial(
  media: CivicMediaCenterPublic,
  initialEditorial?: CivicMediaResolvedEditorial,
  options?: {
    /** @deprecated Ordinary reading always uses canonical; CT/PLP are not applied. */
    readonly skipClientTranslation?: boolean;
  },
): CivicMediaResolvedEditorial {
  void initialEditorial;
  void options;
  return buildCanonicalCivicMediaEditorial(media);
}
