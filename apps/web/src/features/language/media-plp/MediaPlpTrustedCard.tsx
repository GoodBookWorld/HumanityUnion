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

  return (
    <TrustedMediaRailCard
      resource={input.resource}
      categoryTitle={input.categoryTitle}
      explanation={explanation.trim() || input.resource.explanation}
      data-hu-plp-mode={input.resolved.mode}
      data-hu-plp-entity={input.resolved.entityType}
      data-hu-plp-id={input.resolved.entityId}
      data-hu-fallback-nodes={
        input.resolved.mode === "CANONICAL_FALLBACK" ? "all" : "0"
      }
    />
  );
}
