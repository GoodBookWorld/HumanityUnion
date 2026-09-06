/**
 * Reset 03C — Web client for Media PLP consumer resolve (SSR GET/POST only).
 * Never imports provider credentials or generate-on-miss hooks.
 */

import type { PublicPresentationNode } from "@hu/types";

import { apiRequest } from "../../../lib/api-client";
import type { MediaPlpResolvedPresentation } from "./presentation";

export type MediaPlpResolveBatchItem = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalPresentation: PublicPresentationNode;
};

export type MediaPlpResolveBatchResultItem = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly presentation: PublicPresentationNode;
  readonly canonicalVersion: string;
  readonly reasonCode?: string;
};

export async function resolveMediaPlpBatch(input: {
  readonly locale: string;
  readonly items: readonly MediaPlpResolveBatchItem[];
}): Promise<readonly MediaPlpResolveBatchResultItem[]> {
  if (input.items.length === 0) {
    return [];
  }
  const data = await apiRequest<{ results: MediaPlpResolveBatchResultItem[] }>(
    "/api/v1/public/media-plp/resolve",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: input.locale,
        items: input.items,
      }),
    },
  );
  return data.results;
}

export function toMediaPlpResolvedPresentation(
  item: MediaPlpResolveBatchResultItem,
): MediaPlpResolvedPresentation {
  return {
    mode: item.mode,
    presentation: item.presentation,
    entityType: item.entityType,
    entityId: item.entityId,
    locale: item.locale,
    canonicalVersion: item.canonicalVersion,
  };
}
