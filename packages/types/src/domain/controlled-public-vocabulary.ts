/**
 * Localization Authority Closure 02 — controlled public vocabulary safety.
 *
 * Cache-only substitution of *known* controlled lifecycle/domain terms inside
 * already-loaded public prose (e.g. after CT/PLP resolve).
 *
 * Reuses lifecycle stage token form `{lifecycleStage:<stageId>}` from Pack 03C.5.
 * Does NOT create a parallel token system, call providers, mutate CT/PLP, or
 * fuzzy-translate arbitrary prose.
 */

import {
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
  type InitiativeLifecycleStageId,
} from "./initiative-lifecycle-stage.js";
import {
  lifecycleStageToken,
  textContainsLifecycleStageToken,
} from "./lifecycle-stage-token-composition.js";
import {
  resolveControlledLifecycleLabel,
  type ControlledLifecycleLabelCandidates,
  type ControlledLifecycleLabelResolution,
  type ControlledLifecycleLabelSource,
} from "./public-presentation-authority.js";

/** Domain controlled concepts that are not lifecycle stage ids. */
export const CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS = [
  "ready_to_collaborate",
  "helpful",
  "not_helpful",
  "active_allies",
] as const;

export type ControlledPublicDomainConceptId =
  (typeof CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS)[number];

export type ControlledPublicVocabularyConceptId =
  | InitiativeLifecycleStageId
  | ControlledPublicDomainConceptId;

export type ControlledPublicVocabularyEntry = {
  readonly conceptId: ControlledPublicVocabularyConceptId;
  /** When set, English Registry label comes from the lifecycle stage registry. */
  readonly stageId?: InitiativeLifecycleStageId;
  /**
   * Canonical English surface forms recognized in prose (longest first).
   * Matching is exact (case-sensitive) with Unicode letter boundaries.
   */
  readonly canonicalEnglishForms: readonly string[];
};

const DOMAIN_ENTRIES: readonly ControlledPublicVocabularyEntry[] = [
  {
    conceptId: "ready_to_collaborate",
    canonicalEnglishForms: [
      "Ready to Collaborate",
      "Ready-to-Collaborate",
      "ready to collaborate",
    ],
  },
  {
    conceptId: "helpful",
    canonicalEnglishForms: ["Helpful"],
  },
  {
    conceptId: "not_helpful",
    canonicalEnglishForms: ["Not Helpful"],
  },
  {
    conceptId: "active_allies",
    canonicalEnglishForms: ["Active Allies", "Active Ally"],
  },
];

function buildStageEntries(): readonly ControlledPublicVocabularyEntry[] {
  return INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => {
    const forms = new Set<string>([stage.label]);
    // Singular / title glossary-style variants for Improvement Proposals.
    if (stage.stageId === "proposal") {
      forms.add("Improvement Proposal");
      forms.add("Proposal");
    }
    return {
      conceptId: stage.stageId,
      stageId: stage.stageId,
      canonicalEnglishForms: [...forms].sort((a, b) => b.length - a.length),
    };
  });
}

/** Known controlled concepts Closure 03+ may localize without provider calls. */
export const CONTROLLED_PUBLIC_VOCABULARY_REGISTRY: readonly ControlledPublicVocabularyEntry[] =
  [...buildStageEntries(), ...DOMAIN_ENTRIES];

const ENTRY_BY_CONCEPT = new Map(
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.map((entry) => [entry.conceptId, entry]),
);

export function getControlledPublicVocabularyEntry(
  conceptId: string,
): ControlledPublicVocabularyEntry | null {
  return ENTRY_BY_CONCEPT.get(conceptId as ControlledPublicVocabularyConceptId) ?? null;
}

export type ControlledVocabularyLabelLookup = Readonly<
  Partial<Record<ControlledPublicVocabularyConceptId, ControlledLifecycleLabelCandidates>>
>;

export type ControlledPublicVocabularySubstitution = {
  readonly conceptId: ControlledPublicVocabularyConceptId;
  readonly from: string;
  readonly to: string;
  readonly source: ControlledLifecycleLabelSource;
};

export type ApplyControlledPublicVocabularyResult = {
  readonly text: string;
  readonly substitutions: readonly ControlledPublicVocabularySubstitution[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a boundary-aware pattern for a multi-word English controlled label.
 * Avoids matching inside larger words (e.g. "Initiative" inside "InitiativesX").
 */
function englishFormPattern(form: string): RegExp {
  const escaped = escapeRegExp(form);
  // Unicode letter boundaries: not preceded/followed by a letter.
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "gu");
}

function resolveLabelMap(
  lookup: ControlledVocabularyLabelLookup,
): Map<ControlledPublicVocabularyConceptId, ControlledLifecycleLabelResolution> {
  const resolved = new Map<
    ControlledPublicVocabularyConceptId,
    ControlledLifecycleLabelResolution
  >();
  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const candidates = lookup[entry.conceptId];
    if (!candidates) {
      continue;
    }
    const withRegistry: ControlledLifecycleLabelCandidates = {
      ...candidates,
      stageId: candidates.stageId ?? entry.stageId ?? null,
      registryCanonicalEnglishLabel:
        candidates.registryCanonicalEnglishLabel ??
        (entry.stageId
          ? INITIATIVE_LIFECYCLE_STAGE_REGISTRY.find((s) => s.stageId === entry.stageId)
              ?.label
          : entry.canonicalEnglishForms[0]) ??
        null,
    };
    resolved.set(entry.conceptId, resolveControlledLifecycleLabel(withRegistry));
  }
  return resolved;
}

/**
 * Substitute known controlled tokens and canonical English forms in prose
 * using Closure 01 controlled-label authority (Terminology → WEB_UI → Registry).
 *
 * Provider-free. Does not mutate storage. Only touches registered concepts.
 */
export function applyControlledPublicVocabularyToProse(input: {
  readonly prose: string;
  readonly labelLookup: ControlledVocabularyLabelLookup;
}): ApplyControlledPublicVocabularyResult {
  const resolved = resolveLabelMap(input.labelLookup);
  const substitutions: ControlledPublicVocabularySubstitution[] = [];
  let text = input.prose;

  // 1) Semantic lifecycle tokens first (Pack 03C.5 form).
  if (textContainsLifecycleStageToken(text)) {
    for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
      if (!entry.stageId) {
        continue;
      }
      const label = resolved.get(entry.conceptId);
      if (!label || !label.label.trim()) {
        continue;
      }
      const token = lifecycleStageToken(entry.stageId);
      if (!text.includes(token)) {
        continue;
      }
      text = text.split(token).join(label.label);
      substitutions.push({
        conceptId: entry.conceptId,
        from: token,
        to: label.label,
        source: label.source,
      });
    }
  }

  // 2) Canonical English surface forms (longest forms first via registry order).
  for (const entry of CONTROLLED_PUBLIC_VOCABULARY_REGISTRY) {
    const label = resolved.get(entry.conceptId);
    if (!label || !label.label.trim()) {
      continue;
    }
    // Skip when resolution is still English registry and form equals label —
    // no observable change; still OK if other forms differ.
    for (const form of entry.canonicalEnglishForms) {
      if (form === label.label) {
        continue;
      }
      const pattern = englishFormPattern(form);
      if (!pattern.test(text)) {
        // Reset lastIndex after test with /g
        pattern.lastIndex = 0;
        continue;
      }
      pattern.lastIndex = 0;
      const next = text.replace(pattern, label.label);
      if (next !== text) {
        text = next;
        substitutions.push({
          conceptId: entry.conceptId,
          from: form,
          to: label.label,
          source: label.source,
        });
      }
    }
  }

  return { text, substitutions };
}

/**
 * Concepts required for Collaborative Analysis Closure 03 examples.
 * Semantic ids — not raw-English ownership.
 */
export const COLLABORATIVE_ANALYSIS_CONTROLLED_CONCEPT_IDS = [
  "initiative",
  "discussion",
  "analysis",
  "proposal",
  "ready_to_collaborate",
] as const satisfies readonly ControlledPublicVocabularyConceptId[];
