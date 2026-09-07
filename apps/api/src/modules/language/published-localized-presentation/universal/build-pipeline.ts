/**
 * RESET 04 — universal localization build pipeline (domain-neutral).
 *
 * Canonical projection → field policy → merge layers → validate → atomic publish.
 * PARTIAL ⇒ not publishable. Stale canonicalVersion ⇒ SUPERSEDED (no overwrite).
 * No Gemini in this module — adapters/tests supply layers.
 */

import type {
  PlpBuildRequestStatus,
  PlpLocalizableEntityContract,
  PublishedLocalizationProvenanceSource,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { publishPublishedLocalizedPresentation } from "../publish-atomic.js";
import {
  mergeLocalizedLayersByProvenance,
  validatePublishedBuildResult,
} from "../validate-build-result.js";
import { getPlpDomainAdapter } from "./domain-adapter-registry.js";
import { isPlpBuildStaleAgainstLive } from "./build-request-queue.js";
import { notifyPlpSearchSeoInvalidation } from "./search-seo-hooks.js";
import { isCollectedPathMachineEligible } from "./field-authority.js";

export type PlpLocalizationLayerInput = {
  readonly source: PublishedLocalizationProvenanceSource;
  readonly values: Readonly<Record<string, string>>;
  readonly provider?: string;
};

export type RunUniversalPlpBuildInput = {
  readonly contract: PlpLocalizableEntityContract;
  readonly layers: readonly PlpLocalizationLayerInput[];
  /** Live fingerprint at publish time — must match contract.canonicalVersion. */
  readonly liveCanonicalVersion: string;
};

export type RunUniversalPlpBuildResult = {
  readonly status: PlpBuildRequestStatus;
  readonly reasonCodes: readonly string[];
  readonly snapshotId: string | null;
};

/**
 * Domain-neutral build+publish. Never calls provider.
 */
export async function runUniversalPlpBuild(
  input: RunUniversalPlpBuildInput,
): Promise<RunUniversalPlpBuildResult> {
  if (
    isPlpBuildStaleAgainstLive({
      buildTargetCanonicalVersion: input.contract.canonicalVersion,
      liveCanonicalVersion: input.liveCanonicalVersion,
    })
  ) {
    return {
      status: "SUPERSEDED",
      reasonCodes: ["STALE_CANONICAL_VERSION"],
      snapshotId: null,
    };
  }

  const adapter = getPlpDomainAdapter(input.contract.entityType);
  if (!adapter) {
    return {
      status: "FAILED",
      reasonCodes: ["ADAPTER_NOT_REGISTERED"],
      snapshotId: null,
    };
  }

  // Drop MACHINE values for non-machine paths (controlled vocab etc.).
  // Nested leaves inherit eligibility from parent policy roots (05D.2).
  const sanitizedLayers = input.layers.map((layer) => {
    if (layer.source !== "MACHINE") {
      return layer;
    }
    const values: Record<string, string> = {};
    for (const [path, value] of Object.entries(layer.values)) {
      if (isCollectedPathMachineEligible(path, input.contract.fieldPolicy)) {
        values[path] = value;
      }
    }
    return { ...layer, values };
  });

  const appliedAt = new Date().toISOString();
  const merged = mergeLocalizedLayersByProvenance({
    canonicalPresentation: input.contract.canonicalPresentation,
    layers: sanitizedLayers.map((layer) => ({
      source: layer.source,
      values: layer.values,
      provider: layer.provider,
      appliedAt,
    })),
  });

  const validation = validatePublishedBuildResult({
    canonicalPresentation: input.contract.canonicalPresentation,
    localizedCandidate: merged.presentation,
    provenance: merged.provenance,
    canonicalVersion: input.contract.canonicalVersion,
    buildTargetCanonicalVersion: input.liveCanonicalVersion,
    localizationSchemaVersion:
      input.contract.localizationSchemaVersion ??
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    locale: input.contract.targetLocale,
    entityType: input.contract.entityType,
    entityId: input.contract.entityId,
  });

  if (validation.status === "NOT_READY") {
    const partial = validation.reasonCodes.includes("PARTIAL_AUTO_NODES");
    return {
      status: partial ? "REJECTED_PARTIAL" : "FAILED",
      reasonCodes: validation.reasonCodes,
      snapshotId: null,
    };
  }

  const published = await publishPublishedLocalizedPresentation({
    entityType: input.contract.entityType,
    entityId: input.contract.entityId,
    locale: String(input.contract.targetLocale),
    canonicalVersion: input.contract.canonicalVersion,
    contentRevision: input.contract.contentRevision,
    localizationSchemaVersion: input.contract.localizationSchemaVersion,
    canonicalPresentation: input.contract.canonicalPresentation,
    localizedCandidate: merged.presentation as PublicPresentationNode,
    provenance: merged.provenance,
    seo: input.contract.seo,
  });

  if (!published.ok) {
    return {
      status: "FAILED",
      reasonCodes: published.reasonCodes ?? ["PUBLISH_FAILED"],
      snapshotId: null,
    };
  }

  notifyPlpSearchSeoInvalidation({
    entityType: input.contract.entityType,
    entityId: input.contract.entityId,
    locale: String(input.contract.targetLocale),
    canonicalVersion: input.contract.canonicalVersion,
    snapshotId: published.record.snapshotId,
    publishedAt: published.record.publishedAt ?? published.record.updatedAt,
  });

  return {
    status: "COMPLETED",
    reasonCodes: [],
    snapshotId: published.record.snapshotId,
  };
}
