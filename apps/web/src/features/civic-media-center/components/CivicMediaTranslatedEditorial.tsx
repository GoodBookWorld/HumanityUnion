"use client";

import type { CivicMediaCenterPublic } from "@hu/types";

import { useOrdinaryReadingOwner } from "../../language/use-ordinary-reading-owner";
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
 * Ordinary Civic Media editorial reading.
 *
 * Pack 1 WEB: canonical fields only (browser-native).
 * PWA Pack 01: when owner is hu-persisted, callers may pass a PLP/CT overlay
 * via `initialEditorial` (existing Media PLP / CT contract). Never generate on read.
 */
export function useCivicMediaResolvedEditorial(
  media: CivicMediaCenterPublic,
  initialEditorial?: CivicMediaResolvedEditorial,
  options?: {
    /** @deprecated Pack 1.1 — never generates; retained for call-site compatibility. */
    readonly skipClientTranslation?: boolean;
  },
): CivicMediaResolvedEditorial {
  void options;
  const { owner, ownershipReady } = useOrdinaryReadingOwner({ sourceKind: "civic_media" });

  if (ownershipReady && owner === "hu-persisted" && initialEditorial) {
    return initialEditorial;
  }

  return buildCanonicalCivicMediaEditorial(media);
}
