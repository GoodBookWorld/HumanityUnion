/**
 * Reset 03 — Web-side Media PLP presentation helpers (no translation hooks).
 * SSR/API must pass a fully resolved presentation; React only renders it.
 */

import type { PublicPresentationNode } from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPrincipleEntityId,
  mediaPlpPublicNewsEntityId,
  mediaPlpTrustedEntityId,
  unwrapPublicPresentationValue,
} from "@hu/types";

export {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPrincipleEntityId,
  mediaPlpPublicNewsEntityId,
  mediaPlpTrustedEntityId,
};

export type MediaPlpResolvedPresentation = {
  readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly presentation: PublicPresentationNode;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
};

export function readMediaPlpStringField(
  presentation: PublicPresentationNode,
  key: string,
): string {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return "";
  }
  const value = (presentation as Record<string, unknown>)[key];
  if (typeof value === "string") {
    return value;
  }
  return unwrapPublicPresentationValue(value as never) ?? "";
}

export function assertNoClientSemanticTranslationInPlpMode(): void {
  // Marker for tests: PLP mode must never call generateContentTranslation / overlays.
}
