/**
 * Reset 03E.2 — localization content integrity.
 *
 * PUBLISHED_LOCALIZED means the translatable semantic payload was actually
 * localized for the requested locale. Publication state alone is insufficient.
 */

import type {
  LocalizationContentIntegrityReport,
  LocalizationContentIntegritySubreason,
  PublicPresentationNode,
} from "@hu/types";
import { isPublicProtectedValue } from "@hu/types";

import {
  collectAutoPaths,
  getPresentationValueAtPath,
} from "./presentation-paths.js";

export const LOCALIZATION_CONTENT_INTEGRITY_VERSION = "CLI.1" as const;

/**
 * Normalize for equality: trim + collapse internal whitespace.
 * No language detection / fuzzy semantics.
 */
export function normalizeLocalizationCompareValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Technical identity paths (entity-local ids) may remain canonical-identical.
 * Paths look like `overviewPoints[0].id` or `faq[2].id`.
 */
export function isTechnicalIdentityPath(path: string): boolean {
  return path === "id" || path.endsWith(".id");
}

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

/**
 * Evaluate whether a localized presentation actually changed translatable prose
 * relative to canonical for the target locale.
 */
export function evaluateLocalizationContentIntegrity(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly evaluatedAt?: string;
}): LocalizationContentIntegrityReport {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const protectedCount = countProtectedNodes(input.canonicalPresentation);
  const autos = collectAutoPaths(input.canonicalPresentation);

  if (String(input.locale).toLowerCase() === "en") {
    return {
      version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
      status: "NOT_APPLICABLE_EN",
      TRANSLATABLE_NODE_COUNT: 0,
      LOCALIZED_VALUE_NODE_COUNT: 0,
      CANONICAL_IDENTICAL_NODE_COUNT: 0,
      EMPTY_OR_MISSING_NODE_COUNT: 0,
      PROTECTED_CANONICAL_NODE_COUNT:
        protectedCount +
        autos.filter((n) => isTechnicalIdentityPath(n.path)).length,
      reasonCodes: [],
      evaluatedAt,
    };
  }

  let translatable = 0;
  let localized = 0;
  let identical = 0;
  let emptyOrMissing = 0;
  let technicalProtected = 0;
  const reasonCodes = new Set<LocalizationContentIntegritySubreason>();

  for (const node of autos) {
    if (isTechnicalIdentityPath(node.path)) {
      technicalProtected += 1;
      continue;
    }
    translatable += 1;
    const raw = getPresentationValueAtPath(
      input.localizedPresentation,
      node.path,
    );
    if (typeof raw !== "string" || !raw.trim()) {
      emptyOrMissing += 1;
      reasonCodes.add("MISSING_TRANSLATED_VALUE");
      continue;
    }
    if (
      normalizeLocalizationCompareValue(raw) ===
      normalizeLocalizationCompareValue(node.value)
    ) {
      identical += 1;
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
    PROTECTED_CANONICAL_NODE_COUNT: protectedCount + technicalProtected,
    reasonCodes: [...reasonCodes],
    evaluatedAt,
  };
}

/**
 * Resolve-time gate for persisted snapshots.
 * Missing CLI.1 metadata on non-English → fail closed (UNKNOWN_LEGACY).
 * Always recompute against live canonical — do not trust stale PASSED alone.
 */
export function resolveLocalizationContentIntegrityForRead(input: {
  readonly locale: string;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedPresentation: PublicPresentationNode;
  readonly persisted?: LocalizationContentIntegrityReport | null;
}): {
  readonly report: LocalizationContentIntegrityReport;
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
    });
    return { report, allowPublishedLocalized: true, reasonCode: "OK" };
  }

  const report = evaluateLocalizationContentIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedPresentation,
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
