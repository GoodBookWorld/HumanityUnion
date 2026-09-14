/**
 * Reset 03C — Web client for Media PLP consumer resolve (SSR GET/POST only).
 * Never imports provider credentials or generate-on-miss hooks.
 * Reset 03C.2 — bounded fetch (timeout) so locale-switch transitions cannot hang.
 * Reset 03D — request counter for one-batch-per-navigation budgets.
 * Reset 03E.7 — live truth probe records safe API request metadata.
 */

import type { PublicPresentationNode } from "@hu/types";

import { apiRequest, API_BASE_URL } from "../../../lib/api-client";
import { recordMediaPlpHttpResolveRequest } from "./media-plp-locale-switch-perf";
import {
  isMediaPlpLiveTruthProbeEnabled,
  recordMediaPlpLiveTruthApiRequest,
} from "./media-plp-live-truth-probe";
import type { MediaPlpResolvedPresentation } from "./presentation";

/** Hard bound for Media PLP resolve during SSR / locale-switch refresh. */
export const MEDIA_PLP_RESOLVE_TIMEOUT_MS = 8_000;

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
  /** Reset 03E.8 — non-secret persistence probe fields from API. */
  readonly persistenceMode?: "MONGO" | "MEMORY_TEST" | "UNAVAILABLE";
  readonly lookupResult?: "FOUND" | "NOT_FOUND" | "ERROR";
};

export async function resolveMediaPlpBatch(input: {
  readonly locale: string;
  readonly items: readonly MediaPlpResolveBatchItem[];
}): Promise<readonly MediaPlpResolveBatchResultItem[]> {
  if (input.items.length === 0) {
    return [];
  }

  recordMediaPlpHttpResolveRequest();

  const routePath = "/api/v1/public/media-plp/resolve";
  if (isMediaPlpLiveTruthProbeEnabled()) {
    recordMediaPlpLiveTruthApiRequest({
      locale: input.locale,
      apiBaseUrl: API_BASE_URL,
      routePath,
      entityCount: input.items.length,
      editorialRequested: input.items.some(
        (item) =>
          item.entityType === "civic_media_editorial" &&
          item.entityId === "civic-media-center",
      ),
    });
  }

  const timeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(MEDIA_PLP_RESOLVE_TIMEOUT_MS)
      : undefined;

  const data = await apiRequest<{ results: MediaPlpResolveBatchResultItem[] }>(
    routePath,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: input.locale,
        items: input.items,
      }),
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
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
    ...(item.reasonCode ? { reasonCode: item.reasonCode } : {}),
  };
}
