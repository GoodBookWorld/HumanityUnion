/**
 * Reset 03E.3 / RESET 05D.3 — localization structural integrity (LSI.1).
 *
 * Required paths = MACHINE_CONTENT leaves from the shared ownership resolver.
 */

import type {
  LocalizationStructuralIntegrityReport,
  LocalizationStructuralIntegritySubreason,
  PlpFieldPolicyMap,
  PublicPresentationNode,
} from "@hu/types";

import {
  collectAutoPaths,
  getPresentationValueAtPath,
} from "./presentation-paths.js";
import { isCollectedPathLocalizationRequired } from "./universal/field-authority.js";

export const LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION = "LSI.1" as const;

export function listRequiredLocalizationSourcePaths(
  canonicalPresentation: PublicPresentationNode,
  fieldPolicy: PlpFieldPolicyMap,
): readonly string[] {
  return collectAutoPaths(canonicalPresentation)
    .filter((node) =>
      isCollectedPathLocalizationRequired(node.path, fieldPolicy),
    )
    .map((node) => node.path);
}

export function evaluateLocalizationStructuralIntegrity(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly fieldPolicy: PlpFieldPolicyMap;
  readonly buildInputPaths?: readonly string[];
  readonly evaluatedAt?: string;
}): LocalizationStructuralIntegrityReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const sourcePaths = listRequiredLocalizationSourcePaths(
    input.canonicalPresentation,
    input.fieldPolicy,
  );
  const buildPaths = [
    ...new Set(
      (input.buildInputPaths ?? sourcePaths).filter((path) =>
        isCollectedPathLocalizationRequired(path, input.fieldPolicy),
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
  readonly fieldPolicy: PlpFieldPolicyMap;
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
      fieldPolicy: input.fieldPolicy,
    });
    return { report, allowPublishedLocalized: true, reasonCode: "OK" };
  }

  const report = evaluateLocalizationStructuralIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedPresentation,
    fieldPolicy: input.fieldPolicy,
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
