/**
 * Reset 03E.3 — localization structural integrity (LSI.1).
 *
 * Build/read contract: every required AUTO prose path from the canonical tree
 * must exist as a non-empty string in the localized presentation shape.
 *
 * Render-authority path parity (rendered markers ↔ apply) is evaluated in
 * web test/dev (`media-structural-integrity.ts`), not in the thin API operator.
 */

import type {
  LocalizationStructuralIntegrityReport,
  LocalizationStructuralIntegritySubreason,
  PublicPresentationNode,
} from "@hu/types";

import { isTechnicalIdentityPath } from "./content-integrity.js";
import {
  collectAutoPaths,
  getPresentationValueAtPath,
} from "./presentation-paths.js";

export const LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION = "LSI.1" as const;

export function listRequiredLocalizationSourcePaths(
  canonicalPresentation: PublicPresentationNode,
): readonly string[] {
  return collectAutoPaths(canonicalPresentation)
    .filter((node) => !isTechnicalIdentityPath(node.path))
    .map((node) => node.path);
}

/**
 * Evaluate whether a localized presentation structurally covers every required
 * canonical AUTO prose path (shape completeness — not content difference).
 */
export function evaluateLocalizationStructuralIntegrity(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  /** Optional build AUTO map keys (defaults to canonical source paths). */
  readonly buildInputPaths?: readonly string[];
  readonly evaluatedAt?: string;
}): LocalizationStructuralIntegrityReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const sourcePaths = listRequiredLocalizationSourcePaths(
    input.canonicalPresentation,
  );
  const buildPaths = [
    ...new Set(
      (input.buildInputPaths ?? sourcePaths).filter(
        (path) => !isTechnicalIdentityPath(path),
      ),
    ),
  ];

  if (String(input.locale).toLowerCase() === "en") {
    return {
      version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
      status: "NOT_APPLICABLE_EN",
      CANONICAL_SOURCE_PATHS: sourcePaths.length,
      BUILD_INPUT_PATHS: buildPaths.length,
      LOCALIZED_OUTPUT_PATHS: sourcePaths.length,
      STRUCTURAL_MISMATCH_COUNT: 0,
      reasonCodes: [],
      evaluatedAt,
    };
  }

  const reasonCodes = new Set<LocalizationStructuralIntegritySubreason>();
  let mismatch = 0;
  let outputPresent = 0;

  const sourceSet = new Set(sourcePaths);
  const buildSet = new Set(buildPaths);

  for (const path of sourcePaths) {
    if (!buildSet.has(path)) {
      mismatch += 1;
      reasonCodes.add("SOURCE_WITHOUT_BUILD");
    }
  }
  for (const path of buildPaths) {
    if (!sourceSet.has(path)) {
      // Extra build paths are ignored for publish readiness; still counted.
      reasonCodes.add("RENDERED_PATH_NOT_IN_CANONICAL_LOCALIZATION_SOURCE");
    }
    const value = getPresentationValueAtPath(
      input.localizedPresentation,
      path,
    );
    if (typeof value !== "string" || !value.trim()) {
      mismatch += 1;
      reasonCodes.add("BUILD_PATH_NOT_IN_PRESENTATION_SCHEMA");
      reasonCodes.add("BUILD_WITHOUT_OUTPUT");
      continue;
    }
    outputPresent += 1;
  }

  return {
    version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
    status: mismatch > 0 ? "FAILED" : "PASSED",
    CANONICAL_SOURCE_PATHS: sourcePaths.length,
    BUILD_INPUT_PATHS: buildPaths.length,
    LOCALIZED_OUTPUT_PATHS: outputPresent,
    STRUCTURAL_MISMATCH_COUNT: mismatch,
    reasonCodes: [...reasonCodes],
    evaluatedAt,
  };
}

export function resolveLocalizationStructuralIntegrityForRead(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly persisted?: LocalizationStructuralIntegrityReport | null;
}): {
  readonly report: LocalizationStructuralIntegrityReport;
  readonly allowPublishedLocalized: boolean;
  readonly reasonCode:
    | "OK"
    | "LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED"
    | "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING";
} {
  if (String(input.locale).toLowerCase() === "en") {
    const report = evaluateLocalizationStructuralIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedPresentation,
    });
    return { report, allowPublishedLocalized: true, reasonCode: "OK" };
  }

  const report = evaluateLocalizationStructuralIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedPresentation,
  });

  if (
    !input.persisted ||
    input.persisted.version !== LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION
  ) {
    return {
      report: {
        ...report,
        status: report.status === "PASSED" ? "UNKNOWN_LEGACY" : report.status,
      },
      allowPublishedLocalized: false,
      reasonCode: "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING",
    };
  }

  if (report.status !== "PASSED" || input.persisted.status !== "PASSED") {
    return {
      report,
      allowPublishedLocalized: false,
      reasonCode: "LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED",
    };
  }

  return { report, allowPublishedLocalized: true, reasonCode: "OK" };
}
