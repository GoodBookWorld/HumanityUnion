/**
 * Reset 03C.1 — PLP trusted card uses shared TrustedMediaRailCard structure.
 */

"use client";

import type { TrustedMediaResource } from "@hu/types";

import { TrustedMediaRailCard } from "../../civic-media-center/components/TrustedMediaRailCard";
import type { MediaPlpResolvedPresentation } from "./presentation";
import { readMediaPlpStringField } from "./presentation";

export function MediaPlpTrustedCard(input: {
  readonly resource: TrustedMediaResource;
  readonly resolved: MediaPlpResolvedPresentation;
  readonly categoryTitle?: string;
}) {
  const explanation = readMediaPlpStringField(input.resolved.presentation, "explanation");
  const usedLocalized =
    input.resolved.mode === "PUBLISHED_LOCALIZED" && explanation.trim().length > 0;

  return (
    <TrustedMediaRailCard
      resource={input.resource}
      categoryTitle={input.categoryTitle}
      explanation={usedLocalized ? explanation.trim() : undefined}
      data-hu-plp-mode={input.resolved.mode}
      data-hu-plp-entity={input.resolved.entityType}
      data-hu-plp-id={input.resolved.entityId}
      data-hu-fallback-nodes={
        usedLocalized ? "0" : "all"
      }
    />
  );
}
