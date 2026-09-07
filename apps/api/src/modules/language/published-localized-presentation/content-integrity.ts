/**
 * Reset 03E.2 / RESET 05D.3 — localization content integrity.
 *
 * Only MACHINE_CONTENT paths (shared ownership resolver) must differ from
 * canonical for non-English locales. Technical / protected paths may match.
 */

import type {
  LocalizationContentIntegrityReport,
  LocalizationContentIntegritySubreason,
  PlpFieldPolicyMap,
  PublicPresentationNode,
} from "@hu/types";
import { isPublicProtectedValue } from "@hu/types";

import {
  collectAutoPaths,
  getPresentationValueAtPath,
} from "./presentation-paths.js";
import {
  isCollectedPathLocalizationRequired,
  isTechnicalIdentityPath,
  resolveCollectedPathOwnership,
} from "./universal/field-authority.js";

export const LOCALIZATION_CONTENT_INTEGRITY_VERSION = "CLI.1" as const;

export function normalizeLocalizationCompareValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** @deprecated Prefer isTechnicalIdentityPath from field-authority — kept for import stability. */
export { isTechnicalIdentityPath };

function countProtectedNodes(tree: PublicPresentationNode): number {
  let count = 0;
  function walk(node: PublicPresentationNode): void {
    if (node === null || node === undefined) {
      return;
    }
    if (isPublicProtectedValue(node)) {
      count += 1;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      for (const value of Object.values(node)) {
        walk(value as PublicPresentationNode);
      }
    }
  }
  walk(tree);
  return count;
}

export type LocalizationContentIntegrityPathReport =
  LocalizationContentIntegrityReport & {
    readonly CANONICAL_IDENTICAL_PATHS: readonly string[];
    readonly EMPTY_OR_MISSING_PATHS: readonly string[];
  };

/**
 * Evaluate whether MACHINE_CONTENT paths actually changed for the target locale.
 */
export function evaluateLocalizationContentIntegrity(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly fieldPolicy: PlpFieldPolicyMap;
  readonly evaluatedAt?: string;
}): LocalizationContentIntegrityPathReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const protectedCount = countProtectedNodes(input.canonicalPresentation);
  const autos = collectAutoPaths(input.canonicalPresentation);
  const technicalProtected = autos.filter((n) =>
    isTechnicalIdentityPath(n.path),
  ).length;
  const ownershipProtected = autos.filter((n) => {
    const ownership = resolveCollectedPathOwnership(n.path, input.fieldPolicy);
    return (
      ownership === "PROTECTED_CANONICAL" ||
      ownership === "NON_LOCALIZABLE_DATA"
    );
  }).length;

  if (String(input.locale).toLowerCase() === "en") {
    return {
      version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
      status: "NOT_APPLICABLE_EN",
      TRANSLATABLE_NODE_COUNT: 0,
      LOCALIZED_VALUE_NODE_COUNT: 0,
      CANONICAL_IDENTICAL_NODE_COUNT: 0,
      EMPTY_OR_MISSING_NODE_COUNT: 0,
      PROTECTED_CANONICAL_NODE_COUNT: protectedCount + ownershipProtected,
      reasonCodes: [],
      evaluatedAt,
      CANONICAL_IDENTICAL_PATHS: [],
      EMPTY_OR_MISSING_PATHS: [],
    };
  }

  let translatable = 0;
  let localized = 0;
  let identical = 0;
  let emptyOrMissing = 0;
  const identicalPaths: string[] = [];
  const emptyPaths: string[] = [];
  const reasonCodes = new Set<LocalizationContentIntegritySubreason>();

  for (const node of autos) {
    if (!isCollectedPathLocalizationRequired(node.path, input.fieldPolicy)) {
      continue;
    }
    translatable += 1;
    const raw = getPresentationValueAtPath(
      input.localizedPresentation,
      node.path,
    );
    if (typeof raw !== "string" || !raw.trim()) {
      emptyOrMissing += 1;
      emptyPaths.push(node.path);
      reasonCodes.add("MISSING_TRANSLATED_VALUE");
      continue;
    }
    if (
      normalizeLocalizationCompareValue(raw) ===
      normalizeLocalizationCompareValue(node.value)
    ) {
      identical += 1;
      identicalPaths.push(node.path);
      reasonCodes.add("CANONICAL_IDENTICAL_TRANSLATABLE_VALUE");
      continue;
    }
    localized += 1;
  }

  if (
    input.localizedPresentation === null ||
    input.localizedPresentation === undefined ||
    (translatable > 0 &&
      typeof input.localizedPresentation === "object" &&
      !isPublicProtectedValue(input.localizedPresentation) &&
      !Array.isArray(input.localizedPresentation) &&
      Object.keys(input.localizedPresentation as object).length === 0)
  ) {
    reasonCodes.add("STRUCTURAL_TRANSLATION_MISMATCH");
  }

  const failed =
    emptyOrMissing > 0 ||
    identical > 0 ||
    reasonCodes.has("STRUCTURAL_TRANSLATION_MISMATCH");

  return {
    version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
    status: failed ? "FAILED" : "PASSED",
    TRANSLATABLE_NODE_COUNT: translatable,
    LOCALIZED_VALUE_NODE_COUNT: localized,
    CANONICAL_IDENTICAL_NODE_COUNT: identical,
    EMPTY_OR_MISSING_NODE_COUNT: emptyOrMissing,
    PROTECTED_CANONICAL_NODE_COUNT: protectedCount + Math.max(technicalProtected, ownershipProtected),
    reasonCodes: [...reasonCodes],
    evaluatedAt,
    CANONICAL_IDENTICAL_PATHS: identicalPaths,
    EMPTY_OR_MISSING_PATHS: emptyPaths,
  };
}

export function resolveLocalizationContentIntegrityForRead(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly fieldPolicy: PlpFieldPolicyMap;
  readonly persisted?: LocalizationContentIntegrityReport | null;
}): {
  readonly report: LocalizationContentIntegrityPathReport;
  readonly allowPublishedLocalized: boolean;
  readonly reasonCode:
    | "OK"
    | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
    | "LOCALIZATION_CONTENT_INTEGRITY_MISSING";
} {
  if (String(input.locale).toLowerCase() === "en") {
    const report = evaluateLocalizationContentIntegrity({
      locale: input.locale,
      canonicalPresentation: input.canonicalPresentation,
      localizedPresentation: input.localizedPresentation,
      fieldPolicy: input.fieldPolicy,
    });
    return { report, allowPublishedLocalized: true, reasonCode: "OK" };
  }

  const report = evaluateLocalizationContentIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedPresentation,
    fieldPolicy: input.fieldPolicy,
  });

  if (
    !input.persisted ||
    input.persisted.version !== LOCALIZATION_CONTENT_INTEGRITY_VERSION
  ) {
    return {
      report: {
        ...report,
        status: report.status === "PASSED" ? "UNKNOWN_LEGACY" : report.status,
      },
      allowPublishedLocalized: false,
      reasonCode: "LOCALIZATION_CONTENT_INTEGRITY_MISSING",
    };
  }

  if (report.status !== "PASSED" || input.persisted.status !== "PASSED") {
    return {
      report,
      allowPublishedLocalized: false,
      reasonCode: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
    };
  }

  return { report, allowPublishedLocalized: true, reasonCode: "OK" };
}
