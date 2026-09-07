/**
 * Reset 02 / RESET 05D.3 — pure build-result validator / finalizer (no provider).
 *
 * Path ownership comes from the shared field-authority resolver — the same
 * MACHINE set used by collectMachineAutoValues.
 */

import type {
  BuildValidationPathDiagnostics,
  BuildValidationReasonCode,
  BuildValidationResult,
  LocalizedNodeProvenance,
  PlpFieldPolicyMap,
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
import {
  isCollectedPathLocalizationRequired,
  isTechnicalIdentityPath,
  resolveCollectedPathOwnership,
} from "./universal/field-authority.js";

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
  /** RESET 05D.3 — required for path-aware MACHINE vs protected classification. */
  readonly fieldPolicy: PlpFieldPolicyMap;
};

function emptyPathDiagnostics(): BuildValidationPathDiagnostics {
  return {
    PARTIAL_AUTO_PATHS: [],
    CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: [],
    INTEGRITY_FAILED_PATHS: [],
  };
}

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
 * READY_TO_PUBLISH only when every MACHINE_CONTENT path is localized.
 * Technical / protected paths may remain canonical. PARTIAL ⇒ NOT_READY.
 */
export function validatePublishedBuildResult(
  input: ValidatePublishedBuildInput,
): BuildValidationResult {
  const reasonCodes: BuildValidationReasonCode[] = [];
  const partialAutoPaths: string[] = [];
  const canonicalIdenticalPaths: string[] = [];
  const integrityFailedPaths: string[] = [];

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
  const machinePaths = canonicalAutos.filter((node) =>
    isCollectedPathLocalizationRequired(node.path, input.fieldPolicy),
  );

  if (
    input.localizedCandidate === null ||
    input.localizedCandidate === undefined ||
    (machinePaths.length > 0 &&
      typeof input.localizedCandidate === "object" &&
      !isPublicProtectedValue(input.localizedCandidate) &&
      !Array.isArray(input.localizedCandidate) &&
      Object.keys(input.localizedCandidate as object).length === 0)
  ) {
    reasonCodes.push("EMPTY_PRESENTATION");
  }

  const byPath = provenanceByPath(input.provenance);

  for (const node of machinePaths) {
    const localizedValue = getPresentationValueAtPath(
      input.localizedCandidate,
      node.path,
    );
    const prov = byPath.get(node.path);

    if (typeof localizedValue !== "string" || !localizedValue.trim()) {
      partialAutoPaths.push(node.path);
      continue;
    }

    if (localizedValue === node.value) {
      if (!prov || prov.source === "CANONICAL_FALLBACK") {
        partialAutoPaths.push(node.path);
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
        partialAutoPaths.push(path || "(root)");
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
    const ownership = resolveCollectedPathOwnership(path, input.fieldPolicy);
    if (ownership !== "MACHINE_CONTENT") {
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
      partialAutoPaths.push(path);
    }
  }

  if (partialAutoPaths.length > 0) {
    reasonCodes.push("PARTIAL_AUTO_NODES");
  }

  if (String(input.locale).toLowerCase() !== "en") {
    const integrity = evaluateLocalizationContentIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedCandidate,
      fieldPolicy: input.fieldPolicy,
    });
    if (integrity.status === "FAILED") {
      reasonCodes.push("LOCALIZATION_CONTENT_INTEGRITY_FAILED");
      for (const code of integrity.reasonCodes) {
        reasonCodes.push(code);
      }
      for (const path of integrity.CANONICAL_IDENTICAL_PATHS ?? []) {
        canonicalIdenticalPaths.push(path);
        integrityFailedPaths.push(path);
      }
      for (const path of integrity.EMPTY_OR_MISSING_PATHS ?? []) {
        integrityFailedPaths.push(path);
        if (!partialAutoPaths.includes(path)) {
          partialAutoPaths.push(path);
        }
      }
    }

    const structural = evaluateLocalizationStructuralIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedCandidate,
      fieldPolicy: input.fieldPolicy,
      buildInputPaths: machinePaths.map((n) => n.path),
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

  // Recompute PARTIAL flag if integrity added empty paths.
  if (partialAutoPaths.length > 0 && !reasonCodes.includes("PARTIAL_AUTO_NODES")) {
    reasonCodes.push("PARTIAL_AUTO_NODES");
  }

  const uniqueReasons = [...new Set(reasonCodes)];
  const uniquePartial = [...new Set(partialAutoPaths)];
  const uniqueIdentical = [...new Set(canonicalIdenticalPaths)];
  const uniqueIntegrity = [...new Set(integrityFailedPaths)];
  const pathDiagnostics: BuildValidationPathDiagnostics = {
    PARTIAL_AUTO_PATHS: uniquePartial,
    CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: uniqueIdentical,
    INTEGRITY_FAILED_PATHS: uniqueIntegrity,
  };

  if (uniqueReasons.length > 0) {
    return {
      status: "NOT_READY",
      missingPaths: uniquePartial.length > 0 ? uniquePartial : uniqueIntegrity,
      reasonCodes: uniqueReasons,
      pathDiagnostics,
    };
  }

  return {
    status: "READY_TO_PUBLISH",
    missingPaths: [],
    reasonCodes: [],
    pathDiagnostics: emptyPathDiagnostics(),
  };
}

/**
 * Apply layered string maps by provenance priority onto canonical AUTO nodes.
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

// Re-export for callers that imported technical-id helper from validate historically.
export { isTechnicalIdentityPath };
