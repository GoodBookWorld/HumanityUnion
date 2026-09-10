/**
 * Localization Authority Closure 03 / 04 / reusable Closure 06 foundation —
 * fail when localized Initiative/CA/Improvement Proposal presentation still
 * contains registered canonical English controlled terms while an authoritative
 * localized label exists.
 *
 * Deterministic presentation-output helper — not a browser crawler.
 */

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  type ControlledVocabularyLabelLookup,
  resolveControlledLifecycleLabel,
} from "@hu/types";

export type ControlledEnglishLeakFinding = {
  readonly conceptId: string;
  readonly englishForm: string;
  readonly expectedLocalizedLabel: string;
  readonly source: string;
};

export type HardcodedSystemLabelLeakFinding = {
  readonly englishLabel: string;
  readonly kind: "cap02_field_meta" | "system_chrome";
};

/** Cap02 CIVIC_TRANSLATION_FIELD_META.improvement_proposal English chrome — must not appear on Part D public. */
export const IMPROVEMENT_PROPOSAL_CAP02_ENGLISH_FIELD_LABELS = [
  "Target section",
  "Current issue",
  "Proposed change",
  "Rationale",
  "Expected improvement",
  "References",
  "Steward decision note",
] as const;

/**
 * Scan final presentation text for registered English controlled forms that
 * should already have been substituted for a non-English document locale.
 */
export function findControlledEnglishLifecycleLeaks(input: {
  readonly presentationText: string;
  readonly documentLocale: string;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): readonly ControlledEnglishLeakFinding[] {
  if (input.documentLocale === "en") {
    return [];
  }

  const findings: ControlledEnglishLeakFinding[] = [];
  const text = input.presentationText;

  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const candidates = input.labelLookup[entry.conceptId];
    if (!candidates) {
      continue;
    }
    const resolved = resolveControlledLifecycleLabel({
      ...candidates,
      stageId: candidates.stageId ?? entry.stageId ?? null,
      registryCanonicalEnglishLabel:
        candidates.registryCanonicalEnglishLabel ?? entry.canonicalEnglishForms[0],
    });

    if (
      resolved.source === "registry_canonical_english" ||
      !resolved.label.trim() ||
      resolved.label === entry.canonicalEnglishForms[0]
    ) {
      // No higher-authority localized value — English is intentional fallback.
      continue;
    }

    for (const form of entry.canonicalEnglishForms) {
      if (form === resolved.label) {
        continue;
      }
      // Exact phrase presence (presentation already boundary-aware when substituting).
      if (text.includes(form)) {
        findings.push({
          conceptId: entry.conceptId,
          englishForm: form,
          expectedLocalizedLabel: resolved.label,
          source: resolved.source,
        });
      }
    }
  }

  return findings;
}

/**
 * Closure 04 — fail when Cap02 English field-meta headings appear in Part D
 * public presentation (those must come from WEB_UI author.proposal.fields.*).
 * Does not flag arbitrary participant-authored English prose.
 */
export function findHardcodedImprovementProposalSystemLabelLeaks(input: {
  readonly presentationText: string;
  readonly documentLocale: string;
}): readonly HardcodedSystemLabelLeakFinding[] {
  if (input.documentLocale === "en") {
    return [];
  }
  const findings: HardcodedSystemLabelLeakFinding[] = [];
  for (const englishLabel of IMPROVEMENT_PROPOSAL_CAP02_ENGLISH_FIELD_LABELS) {
    if (input.presentationText.includes(englishLabel)) {
      findings.push({ englishLabel, kind: "cap02_field_meta" });
    }
  }
  return findings;
}

export function assertNoControlledEnglishLifecycleLeaks(input: {
  readonly presentationText: string;
  readonly documentLocale: string;
  readonly labelLookup: ControlledVocabularyLabelLookup;
  readonly surfaceId?: string;
}): void {
  const leaks = findControlledEnglishLifecycleLeaks(input);
  if (leaks.length === 0) {
    return;
  }
  const detail = leaks
    .map(
      (row) =>
        `${row.conceptId}: found "${row.englishForm}" expected "${row.expectedLocalizedLabel}" (${row.source})`,
    )
    .join("; ");
  throw new Error(
    `CONTROLLED_ENGLISH_LIFECYCLE_LEAK` +
      (input.surfaceId ? ` surface=${input.surfaceId}` : "") +
      ` locale=${input.documentLocale}: ${detail}`,
  );
}

export function assertNoHardcodedImprovementProposalSystemLabelLeaks(input: {
  readonly presentationText: string;
  readonly documentLocale: string;
  readonly surfaceId?: string;
}): void {
  const leaks = findHardcodedImprovementProposalSystemLabelLeaks(input);
  if (leaks.length === 0) {
    return;
  }
  const detail = leaks.map((row) => row.englishLabel).join("; ");
  throw new Error(
    `HARDCODED_PROPOSAL_SYSTEM_LABEL_LEAK` +
      (input.surfaceId ? ` surface=${input.surfaceId}` : "") +
      ` locale=${input.documentLocale}: ${detail}`,
  );
}

/** Closure 06 — prefer the unified public integrity gate for new call sites. */
export {
  assertPublicLocalizationIntegrity,
  inspectPublicLocalizationIntegrity,
} from "../language/assert-public-localization-integrity";
