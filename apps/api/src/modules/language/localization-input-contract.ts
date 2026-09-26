/**
 * STEP 15D.14.B.2 — unified localization input / currentness contract.
 *
 * An artifact must not remain READY merely because sourceVersion is unchanged
 * when translation-affecting localization inputs (terminology / policy) change.
 *
 * Bounded dependency: only terminology concepts whose canonical English term
 * appears in the source text participate in the digest (avoids global
 * invalidation on unrelated glossary edits).
 *
 * Historical rows without localizationInputVersion: legacy-compatible —
 * do not mass-mark INVALID/STALE solely for missing metadata.
 */

import { createHash } from "node:crypto";

import type { TerminologyConcept } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

/** Bumps when input composition rules change materially. */
export const LOCALIZATION_INPUT_POLICY_VERSION = "15D.14.B.2.1" as const;

export type LocalizationInputDigestLine = {
  readonly conceptId: string;
  readonly canonicalEnglishTerm: string;
  readonly preferredTerm: string;
  readonly required: boolean;
};

export type LocalizationInputParts = {
  readonly sourceVersion: string;
  readonly targetLocale: string;
  readonly terminologyDigest: string;
  readonly policyVersion: string;
};

/**
 * Whole-phrase presence (case-sensitive for Brand; case-insensitive fallback
 * for ordinary terms). Avoids matching substrings inside larger tokens when
 * possible by requiring non-letter boundaries for single-word terms.
 */
export function sourceContainsCanonicalTerm(
  sourceText: string,
  canonicalEnglishTerm: string,
): boolean {
  const needle = canonicalEnglishTerm.trim();
  if (!needle || !sourceText) {
    return false;
  }
  if (sourceText.includes(needle)) {
    return true;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary =
    /\s/.test(needle) || needle.includes("-")
      ? new RegExp(escaped, "i")
      : new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:$|[^A-Za-z0-9])`, "i");
  return boundary.test(sourceText);
}

export function collectSourceTextLeaves(
  fields: Readonly<Record<string, string>> | string | null | undefined,
): string {
  if (typeof fields === "string") {
    return fields;
  }
  if (!fields || typeof fields !== "object") {
    return "";
  }
  return Object.values(fields)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function preferredTermForLocale(
  concept: TerminologyConcept,
  targetLocale: string,
): string | undefined {
  const targetKey = normalizeLanguageRegistryLocaleKey(targetLocale);
  const direct = concept.translations[targetLocale]?.preferredTerm?.trim();
  if (direct) {
    return direct;
  }
  for (const [locale, translation] of Object.entries(concept.translations)) {
    if (normalizeLanguageRegistryLocaleKey(locale) === targetKey) {
      const preferred = translation.preferredTerm?.trim();
      if (preferred) {
        return preferred;
      }
    }
  }
  return undefined;
}

/**
 * Terms that affect translation of this source for the target locale.
 * Brand/domain with preferredTerm are required; workflow_stage with preferred
 * is required when present in source (Initiative residual English defect).
 */
export function selectEffectiveTerminologyLines(input: {
  readonly concepts: readonly TerminologyConcept[];
  readonly targetLocale: string;
  readonly sourceText: string;
}): readonly LocalizationInputDigestLine[] {
  const lines: LocalizationInputDigestLine[] = [];

  for (const concept of input.concepts) {
    if (concept.status !== "published") {
      continue;
    }
    if (!sourceContainsCanonicalTerm(input.sourceText, concept.canonicalEnglishTerm)) {
      continue;
    }
    const preferredRaw = preferredTermForLocale(concept, input.targetLocale);
    const preferredTerm = preferredRaw || concept.canonicalEnglishTerm;
    const required =
      Boolean(preferredRaw) &&
      preferredRaw !== concept.canonicalEnglishTerm &&
      (concept.category === "brand" ||
        concept.category === "domain" ||
        concept.category === "workflow_stage");
    lines.push({
      conceptId: concept.conceptId,
      canonicalEnglishTerm: concept.canonicalEnglishTerm,
      preferredTerm,
      required,
    });
  }

  return lines.sort((a, b) => a.conceptId.localeCompare(b.conceptId));
}

export function buildTerminologyDigest(
  lines: readonly LocalizationInputDigestLine[],
): string {
  if (lines.length === 0) {
    return "empty";
  }
  const payload = lines
    .map(
      (line) =>
        `${line.conceptId}=${line.preferredTerm}|req=${line.required ? "1" : "0"}`,
    )
    .join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildLocalizationInputVersion(input: {
  readonly sourceVersion: string;
  readonly targetLocale: string;
  readonly terminologyDigest: string;
  readonly policyVersion?: string;
}): string {
  const parts: LocalizationInputParts = {
    sourceVersion: input.sourceVersion.trim(),
    targetLocale: normalizeLanguageRegistryLocaleKey(input.targetLocale),
    terminologyDigest: input.terminologyDigest.trim() || "empty",
    policyVersion: input.policyVersion ?? LOCALIZATION_INPUT_POLICY_VERSION,
  };
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 24);
}

export function buildLocalizationInputVersionFromConcepts(input: {
  readonly sourceVersion: string;
  readonly targetLocale: string;
  readonly concepts: readonly TerminologyConcept[];
  readonly sourceText: string;
  readonly policyVersion?: string;
}): {
  readonly localizationInputVersion: string;
  readonly terminologyDigest: string;
  readonly lines: readonly LocalizationInputDigestLine[];
} {
  const lines = selectEffectiveTerminologyLines({
    concepts: input.concepts,
    targetLocale: input.targetLocale,
    sourceText: input.sourceText,
  });
  const terminologyDigest = buildTerminologyDigest(lines);
  return {
    localizationInputVersion: buildLocalizationInputVersion({
      sourceVersion: input.sourceVersion,
      targetLocale: input.targetLocale,
      terminologyDigest,
      policyVersion: input.policyVersion,
    }),
    terminologyDigest,
    lines,
  };
}

/**
 * Compare stored artifact input version to live.
 * Missing stored version → legacy (not a mismatch by itself).
 */
export function classifyLocalizationInputCurrentness(input: {
  readonly storedLocalizationInputVersion?: string | null;
  readonly liveLocalizationInputVersion: string;
}): "current" | "stale" | "legacy_unversioned" {
  const stored = input.storedLocalizationInputVersion?.trim() || "";
  if (!stored) {
    return "legacy_unversioned";
  }
  return stored === input.liveLocalizationInputVersion.trim()
    ? "current"
    : "stale";
}
