/**
 * Reset 02 — pure build-result validator / finalizer (no provider).
 */

import type {
  BuildValidationReasonCode,
  BuildValidationResult,
  LocalizedNodeProvenance,
  PublicPresentationNode,
  PublishedLocalizationProvenanceSource,
  PublishedLocalizationSchemaVersion,
} from "@hu/types";
import {
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  isPublicProtectedValue,
} from "@hu/types";

import {
  evaluateLocalizationContentIntegrity,
  isTechnicalIdentityPath,
  normalizeLocalizationCompareValue,
} from "./content-integrity.js";
import { evaluateLocalizationStructuralIntegrity } from "./structural-integrity.js";
import {
  collectAutoPaths,
  getPresentationValueAtPath,
  setPresentationStringAtPath,
} from "./presentation-paths.js";
import {
  mayOverwriteProvenance,
  selectWinningProvenance,
} from "./provenance-priority.js";

export type ValidatePublishedBuildInput = {
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedCandidate: PublicPresentationNode;
  readonly provenance: readonly LocalizedNodeProvenance[];
  readonly canonicalVersion: string;
  readonly buildTargetCanonicalVersion: string;
  readonly localizationSchemaVersion: PublishedLocalizationSchemaVersion;
  readonly expectedLocalizationSchemaVersion?: PublishedLocalizationSchemaVersion;
  readonly locale: string;
  readonly entityType: string;
  readonly entityId: string;
};

function provenanceByPath(
  provenance: readonly LocalizedNodeProvenance[],
): Map<string, LocalizedNodeProvenance> {
  const map = new Map<string, LocalizedNodeProvenance>();
  for (const entry of provenance) {
    const existing = map.get(entry.path);
    if (!existing) {
      map.set(entry.path, entry);
      continue;
    }
    if (
      mayOverwriteProvenance({
        existing: existing.source,
        incoming: entry.source,
      })
    ) {
      map.set(entry.path, entry);
    }
  }
  return map;
}

/**
 * READY_TO_PUBLISH only when every AUTO path is localized (not left as
 * canonical+CANONICAL_FALLBACK). PARTIAL ⇒ NOT_READY — never publishable.
 */
export function validatePublishedBuildResult(
  input: ValidatePublishedBuildInput,
): BuildValidationResult {
  const reasonCodes: BuildValidationReasonCode[] = [];
  const missingPaths: string[] = [];

  if (!input.entityType.trim() || !input.entityId.trim() || !input.locale.trim()) {
    reasonCodes.push("INVALID_IDENTITY");
  }
  if (
    !input.canonicalVersion ||
    !input.buildTargetCanonicalVersion ||
    input.canonicalVersion !== input.buildTargetCanonicalVersion
  ) {
    reasonCodes.push("CANONICAL_VERSION_MISMATCH");
  }

  const expectedSchema =
    input.expectedLocalizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  if (input.localizationSchemaVersion !== expectedSchema) {
    reasonCodes.push("SCHEMA_VERSION_MISMATCH");
  }

  const canonicalAutos = collectAutoPaths(input.canonicalPresentation);
  if (
    input.localizedCandidate === null ||
    input.localizedCandidate === undefined ||
    (canonicalAutos.length > 0 &&
      typeof input.localizedCandidate === "object" &&
      !isPublicProtectedValue(input.localizedCandidate) &&
      !Array.isArray(input.localizedCandidate) &&
      Object.keys(input.localizedCandidate as object).length === 0)
  ) {
    reasonCodes.push("EMPTY_PRESENTATION");
  }

  const byPath = provenanceByPath(input.provenance);

  for (const node of canonicalAutos) {
    const localizedValue = getPresentationValueAtPath(input.localizedCandidate, node.path);
    const prov = byPath.get(node.path);

    if (typeof localizedValue !== "string" || !localizedValue.trim()) {
      missingPaths.push(node.path);
      continue;
    }

    if (localizedValue === node.value) {
      if (!prov || prov.source === "CANONICAL_FALLBACK") {
        missingPaths.push(node.path);
      }
    }
  }

  function walkProtected(tree: PublicPresentationNode, path: string): void {
    if (tree === null || tree === undefined) {
      return;
    }
    if (isPublicProtectedValue(tree)) {
      const candidate = getPresentationValueAtPath(input.localizedCandidate, path);
      if (
        !isPublicProtectedValue(candidate) ||
        candidate.category !== tree.category ||
        candidate.value !== tree.value
      ) {
        reasonCodes.push("MISSING_REQUIRED_PROTECTED");
        missingPaths.push(path || "(root)");
      }
      return;
    }
    if (Array.isArray(tree)) {
      tree.forEach((entry, index) => {
        walkProtected(entry, path ? `${path}[${index}]` : `[${index}]`);
      });
      return;
    }
    if (typeof tree === "object") {
      for (const [key, value] of Object.entries(tree)) {
        walkProtected(value, path ? `${path}.${key}` : key);
      }
    }
  }
  walkProtected(input.canonicalPresentation, "");

  for (const [path, applied] of byPath.entries()) {
    if (applied.source !== "MACHINE") {
      continue;
    }
    const higher = input.provenance.find(
      (other) =>
        other.path === path &&
        other.source !== "MACHINE" &&
        !mayOverwriteProvenance({
          existing: other.source,
          incoming: "MACHINE",
        }),
    );
    if (higher && applied.source === "MACHINE") {
      reasonCodes.push("PROVENANCE_PRIORITY_VIOLATION");
      missingPaths.push(path);
    }
  }

  if (missingPaths.length > 0) {
    reasonCodes.push("PARTIAL_AUTO_NODES");
  }

  // Reset 03E.2 — non-English candidates must actually localize translatable prose.
  // MACHINE provenance with canonical-identical values is not publishable.
  if (String(input.locale).toLowerCase() !== "en") {
    const integrity = evaluateLocalizationContentIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedCandidate,
    });
    if (integrity.status === "FAILED") {
      reasonCodes.push("LOCALIZATION_CONTENT_INTEGRITY_FAILED");
      for (const code of integrity.reasonCodes) {
        reasonCodes.push(code);
      }
      if (integrity.CANONICAL_IDENTICAL_NODE_COUNT > 0) {
        for (const node of canonicalAutos) {
          if (isTechnicalIdentityPath(node.path)) {
            continue;
          }
          const localizedValue = getPresentationValueAtPath(
            input.localizedCandidate,
            node.path,
          );
          if (
            typeof localizedValue === "string" &&
            localizedValue.trim() &&
            normalizeLocalizationCompareValue(localizedValue) ===
              normalizeLocalizationCompareValue(node.value)
          ) {
            missingPaths.push(node.path);
          }
        }
      }
      if (integrity.EMPTY_OR_MISSING_NODE_COUNT > 0) {
        for (const node of canonicalAutos) {
          if (isTechnicalIdentityPath(node.path)) {
            continue;
          }
          const localizedValue = getPresentationValueAtPath(
            input.localizedCandidate,
            node.path,
          );
          if (typeof localizedValue !== "string" || !localizedValue.trim()) {
            missingPaths.push(node.path);
          }
        }
      }
    }

    // Reset 03E.3 — structural reachability of AUTO paths in the presentation shape.
    const structural = evaluateLocalizationStructuralIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedCandidate,
    });
    if (structural.status === "FAILED") {
      reasonCodes.push("LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED");
      for (const code of structural.reasonCodes) {
        if (
          code === "BUILD_PATH_NOT_IN_PRESENTATION_SCHEMA" ||
          code === "SOURCE_WITHOUT_BUILD" ||
          code === "BUILD_WITHOUT_OUTPUT"
        ) {
          reasonCodes.push(code);
        }
      }
    }
  }

  const uniqueReasons = [...new Set(reasonCodes)];
  const uniqueMissing = [...new Set(missingPaths)];

  if (uniqueReasons.length > 0) {
    return {
      status: "NOT_READY",
      missingPaths: uniqueMissing,
      reasonCodes: uniqueReasons,
    };
  }

  return {
    status: "READY_TO_PUBLISH",
    missingPaths: [],
    reasonCodes: [],
  };
}

/**
 * Apply layered string maps by provenance priority onto canonical AUTO nodes.
 * Callers supply already-resolved Brand/Legal/Glossary/Geography/manual/machine maps —
 * this module does not duplicate those stores.
 */
export function mergeLocalizedLayersByProvenance(input: {
  readonly canonicalPresentation: PublicPresentationNode;
  readonly layers: ReadonlyArray<{
    readonly source: PublishedLocalizationProvenanceSource;
    readonly values: Readonly<Record<string, string>>;
    readonly appliedAt?: string;
    readonly provider?: string;
  }>;
}): {
  readonly presentation: PublicPresentationNode;
  readonly provenance: LocalizedNodeProvenance[];
} {
  const appliedAtDefault = new Date().toISOString();
  const winners = new Map<
    string,
    {
      source: PublishedLocalizationProvenanceSource;
      value: string;
      appliedAt: string;
      provider?: string;
    }
  >();

  for (const layer of input.layers) {
    for (const [path, value] of Object.entries(layer.values)) {
      if (typeof value !== "string" || !value.trim()) {
        continue;
      }
      const existing = winners.get(path);
      const winningSource = selectWinningProvenance({
        existing: existing?.source,
        incoming: layer.source,
      });
      if (!existing || winningSource === layer.source) {
        winners.set(path, {
          source: layer.source,
          value,
          appliedAt: layer.appliedAt ?? appliedAtDefault,
          provider: layer.provider,
        });
      }
    }
  }

  let presentation = input.canonicalPresentation;
  const provenance: LocalizedNodeProvenance[] = [];
  for (const [path, winner] of winners.entries()) {
    presentation = setPresentationStringAtPath(presentation, path, winner.value);
    provenance.push({
      path,
      source: winner.source,
      appliedAt: winner.appliedAt,
      ...(winner.provider ? { provider: winner.provider } : {}),
    });
  }

  return { presentation, provenance };
}
