/**
 * Reset 03 — Media localization build adapter (no real provider).
 * Deterministic machine layer for tests; optional manual/brand/term/geo layers.
 */

import type {
  BuildValidationResult,
  LocalizedNodeProvenance,
  PublicPresentationNode,
  PublishedLocalizationProvenanceSource,
  PublishedLocalizedPresentationSeo,
} from "@hu/types";

import { collectAutoPaths } from "../presentation-paths.js";
import {
  mergeLocalizedLayersByProvenance,
  validatePublishedBuildResult,
} from "../validate-build-result.js";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";
import { resolveFieldPolicyForEntityType } from "../universal/resolve-field-policy.js";
import { isCollectedPathMachineEligible } from "../universal/field-authority.js";

export type MediaPlpLayerInput = {
  readonly source: PublishedLocalizationProvenanceSource;
  readonly values: Readonly<Record<string, string>>;
  readonly provider?: string;
};

/**
 * Deterministic fake machine localization — prefixes AUTO nodes with [locale].
 * Does not call Gemini / TranslationProvider.
 */
export function buildDeterministicMachineLayer(input: {
  readonly canonicalPresentation: PublicPresentationNode;
  readonly locale: string;
  readonly fieldPolicy?: import("@hu/types").PlpFieldPolicyMap;
  readonly entityType?: string;
}): MediaPlpLayerInput {
  const fieldPolicy =
    input.fieldPolicy ??
    (input.entityType
      ? resolveFieldPolicyForEntityType(input.entityType)
      : {});
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(input.canonicalPresentation)) {
    if (
      Object.keys(fieldPolicy).length > 0 &&
      !isCollectedPathMachineEligible(node.path, fieldPolicy)
    ) {
      continue;
    }
    values[node.path] = `[${input.locale}] ${node.value}`;
  }
  return {
    source: "MACHINE",
    values,
    provider: "deterministic",
  };
}

export type BuildMediaPlpCandidateInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly canonicalPresentation: PublicPresentationNode;
  /** Higher-priority layers first or any order — merge resolves by provenance rank. */
  readonly layers?: readonly MediaPlpLayerInput[];
  /** When true (default), append deterministic machine layer for remaining AUTO gaps. */
  readonly includeDeterministicMachine?: boolean;
  readonly seo?: PublishedLocalizedPresentationSeo;
};

export type BuildMediaPlpCandidateResult = {
  readonly validation: BuildValidationResult;
  readonly presentation: PublicPresentationNode;
  readonly provenance: readonly LocalizedNodeProvenance[];
  readonly seo?: PublishedLocalizedPresentationSeo;
};

export function buildMediaPlpCandidate(
  input: BuildMediaPlpCandidateInput,
): BuildMediaPlpCandidateResult {
  const layers: MediaPlpLayerInput[] = [...(input.layers ?? [])];
  if (input.includeDeterministicMachine !== false) {
    layers.push(
      buildDeterministicMachineLayer({
        canonicalPresentation: input.canonicalPresentation,
        locale: input.locale,
        entityType: input.entityType,
      }),
    );
  }

  const merged = mergeLocalizedLayersByProvenance({
    canonicalPresentation: input.canonicalPresentation,
    layers,
  });

  const validation = validatePublishedBuildResult({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
    canonicalVersion: input.canonicalVersion,
    buildTargetCanonicalVersion: input.canonicalVersion,
    localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: input.canonicalPresentation,
    localizedCandidate: merged.presentation,
    provenance: merged.provenance,
    fieldPolicy: resolveFieldPolicyForEntityType(input.entityType),
  });

  return {
    validation,
    presentation: merged.presentation,
    provenance: merged.provenance,
    seo: input.seo,
  };
}
