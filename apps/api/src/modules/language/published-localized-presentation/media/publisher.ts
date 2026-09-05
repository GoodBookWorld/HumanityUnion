/**
 * Reset 03 — bounded Media PLP publisher.
 * Unit of work: (entityType, entityId, locale, canonicalVersion).
 * No corpus fanout; no live provider.
 */

import type { PublishAtomicResult, PublicPresentationNode } from "@hu/types";

import { publishPublishedLocalizedPresentation } from "../publish-atomic.js";
import {
  buildMediaPlpCandidate,
  type MediaPlpLayerInput,
} from "./build-adapter.js";
import type { PublishedLocalizedPresentationSeo } from "@hu/types";

export type PublishMediaPlpEntityInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly layers?: readonly MediaPlpLayerInput[];
  readonly includeDeterministicMachine?: boolean;
  readonly seo?: PublishedLocalizedPresentationSeo;
  readonly snapshotId?: string;
};

/**
 * Build + validate + atomic publish for exactly one Media entity × locale × version.
 * Suitable for a future worker to call; does not invoke TranslationProvider.
 */
export async function publishMediaPlpEntity(
  input: PublishMediaPlpEntityInput,
): Promise<PublishAtomicResult> {
  const built = buildMediaPlpCandidate({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion,
    canonicalPresentation: input.canonicalPresentation,
    layers: input.layers,
    includeDeterministicMachine: input.includeDeterministicMachine,
    seo: input.seo,
  });

  if (built.validation.status === "NOT_READY") {
    return {
      ok: false,
      outcome: "NOT_READY",
      reasonCodes: built.validation.reasonCodes,
      missingPaths: built.validation.missingPaths,
    };
  }

  return publishPublishedLocalizedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion,
    contentRevision: input.contentRevision,
    canonicalPresentation: input.canonicalPresentation,
    localizedCandidate: built.presentation,
    provenance: built.provenance,
    seo: built.seo,
    snapshotId: input.snapshotId,
  });
}
