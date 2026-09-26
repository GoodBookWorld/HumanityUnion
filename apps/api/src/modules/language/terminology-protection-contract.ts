/**
 * STEP 15D.14.B.2 — shared terminology / Brand protection for CT + PLP producers.
 *
 * Precedence (effective translation contract):
 * 1. Brand / protected identity terms (category=brand) — REQUIRED preferredTerm
 * 2. Admin Terminology preferred terms (domain / workflow_stage with preferred)
 * 3. Ordinary provider translation of remaining prose
 *
 * Prompt advice alone is insufficient for REQUIRED terms: provider output that
 * retains the English canonical (or omits the preferredTerm) must not become READY.
 *
 * No locale-specific branches. No hard-coded "Humanity Union" runtime paths —
 * that string is only a regression fixture via the seeded concept catalog.
 */

import type { TerminologyConcept } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  selectEffectiveTerminologyLines,
  sourceContainsCanonicalTerm,
  type LocalizationInputDigestLine,
} from "./localization-input-contract.js";
import { resolveProviderTerminologyContext } from "./terminology-glossary/terminology-glossary.provider-context.js";
import { listTerminologyConcepts } from "./terminology-glossary/terminology-glossary.repository.js";

export type RequiredTerminologyViolation = {
  readonly conceptId: string;
  readonly canonicalEnglishTerm: string;
  readonly preferredTerm: string;
  readonly reason: "missing_preferred" | "residual_canonical";
};

export type TerminologyProtectionAssessment = {
  readonly lines: readonly LocalizationInputDigestLine[];
  readonly requiredLines: readonly LocalizationInputDigestLine[];
  readonly violations: readonly RequiredTerminologyViolation[];
  readonly ok: boolean;
};

/**
 * Shared producer helper — same live glossary context for CT and PLP.
 */
export async function resolveSharedProviderTerminologyContext(
  targetLocaleOrAlias: string,
): Promise<string> {
  return resolveProviderTerminologyContext(targetLocaleOrAlias);
}

export async function loadPublishedTerminologyConcepts(): Promise<
  readonly TerminologyConcept[]
> {
  return listTerminologyConcepts();
}

/**
 * Validate provider output against REQUIRED preferred/protected terms present
 * in the source. Reject (do not silently READY); do not rewrite strings.
 */
export function assessRequiredTerminologyProtection(input: {
  readonly concepts: readonly TerminologyConcept[];
  readonly targetLocale: string;
  readonly sourceText: string;
  readonly translatedText: string;
}): TerminologyProtectionAssessment {
  const lines = selectEffectiveTerminologyLines({
    concepts: input.concepts,
    targetLocale: input.targetLocale,
    sourceText: input.sourceText,
  });
  const requiredLines = lines.filter((line) => line.required);
  const violations: RequiredTerminologyViolation[] = [];
  const translated = input.translatedText;

  for (const line of requiredLines) {
    const hasPreferred = translated.includes(line.preferredTerm);
    const hasResidualCanonical = sourceContainsCanonicalTerm(
      translated,
      line.canonicalEnglishTerm,
    );
    if (!hasPreferred) {
      violations.push({
        conceptId: line.conceptId,
        canonicalEnglishTerm: line.canonicalEnglishTerm,
        preferredTerm: line.preferredTerm,
        reason: "missing_preferred",
      });
      continue;
    }
    // Preferred present but English canonical still residual (mixed titles).
    if (
      hasResidualCanonical &&
      line.preferredTerm !== line.canonicalEnglishTerm
    ) {
      violations.push({
        conceptId: line.conceptId,
        canonicalEnglishTerm: line.canonicalEnglishTerm,
        preferredTerm: line.preferredTerm,
        reason: "residual_canonical",
      });
    }
  }

  return {
    lines,
    requiredLines,
    violations,
    ok: violations.length === 0,
  };
}

export function assertRequiredTerminologyProtection(input: {
  readonly concepts: readonly TerminologyConcept[];
  readonly targetLocale: string;
  readonly sourceText: string;
  readonly translatedText: string;
}): TerminologyProtectionAssessment {
  const assessment = assessRequiredTerminologyProtection(input);
  if (!assessment.ok) {
    const detail = assessment.violations
      .map(
        (v) =>
          `${v.conceptId}:${v.reason}(expected=${v.preferredTerm}, canonical=${v.canonicalEnglishTerm})`,
      )
      .join("; ");
    throw new TerminologyProtectionViolationError(detail, assessment.violations);
  }
  return assessment;
}

export class TerminologyProtectionViolationError extends Error {
  readonly code = "TERMINOLOGY_PROTECTION_VIOLATION" as const;
  readonly violations: readonly RequiredTerminologyViolation[];

  constructor(
    message: string,
    violations: readonly RequiredTerminologyViolation[],
  ) {
    super(`TERMINOLOGY_PROTECTION_VIOLATION: ${message}`);
    this.name = "TerminologyProtectionViolationError";
    this.violations = violations;
  }
}

/** Locale key used when looking up preferredTerm on concepts. */
export function terminologyLocaleKey(targetLocale: string): string {
  return normalizeLanguageRegistryLocaleKey(targetLocale);
}
