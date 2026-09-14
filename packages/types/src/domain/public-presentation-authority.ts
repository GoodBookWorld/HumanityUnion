/**
 * Localization Authority Closure 01 — normative public presentation authority.
 *
 * Single deterministic ladder for participant-facing public presentation.
 * Subsequent Closure packs implement surface migrations against this contract.
 *
 * Relationship to older ladders (compatibility; do not delete):
 * - `PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY` — PLP build/merge provenance;
 *   aligns with this order (`MACHINE` ≡ persisted translation layer).
 * - `LOCALIZATION_RESOLUTION_PRIORITY` (Pack 08I.15) — historical ownership enum
 *   with Brand-before-Legal order. **New public presentation work MUST use
 *   `PUBLIC_PRESENTATION_AUTHORITY` (Legal before Brand).** Do not assume the
 *   Pack 08I.15 array is the public presentation contract.
 *
 * CT and PLP are persistence mechanisms beneath this authority — not parallel
 * authorities and not a merged store.
 */

import {
  getInitiativeLifecycleStageDefinition,
  type InitiativeLifecycleStageId,
} from "./initiative-lifecycle-stage.js";

// ---------------------------------------------------------------------------
// Authority ladder (highest → lowest)
// ---------------------------------------------------------------------------

/**
 * Normative public presentation authorities (highest first).
 * Canonical English is fallback only — never a competing peer authority.
 */
export const PUBLIC_PRESENTATION_AUTHORITY = [
  "PROTECTED_CANONICAL",
  "LEGAL",
  "BRAND",
  "MANUAL_AUTHOR",
  "CONTROLLED_VOCABULARY",
  "GEOGRAPHY",
  "PERSISTED_TRANSLATION",
  "CANONICAL_ENGLISH_FALLBACK",
] as const;

export type PublicPresentationAuthority =
  (typeof PUBLIC_PRESENTATION_AUTHORITY)[number];

const AUTHORITY_RANK: ReadonlyMap<PublicPresentationAuthority, number> = new Map(
  PUBLIC_PRESENTATION_AUTHORITY.map((step, index) => [step, index]),
);

/** Lower rank number = higher authority. Unknown → after fallback. */
export function publicPresentationAuthorityRank(
  authority: PublicPresentationAuthority,
): number {
  return AUTHORITY_RANK.get(authority) ?? PUBLIC_PRESENTATION_AUTHORITY.length;
}

/**
 * Compare two authorities. Negative ⇒ `a` outranks `b`.
 * Locale-independent — same order for uk, ar, zh-Hant, and every other locale.
 */
export function comparePublicPresentationAuthority(
  a: PublicPresentationAuthority,
  b: PublicPresentationAuthority,
): number {
  return publicPresentationAuthorityRank(a) - publicPresentationAuthorityRank(b);
}

export function isHigherPublicPresentationAuthority(
  candidate: PublicPresentationAuthority,
  than: PublicPresentationAuthority,
): boolean {
  return comparePublicPresentationAuthority(candidate, than) < 0;
}

// ---------------------------------------------------------------------------
// Presentation field classification (semantic ownership)
// ---------------------------------------------------------------------------

/**
 * Semantic ownership class for a public presentation field.
 * Classification decides which authorities may supply a value; the ladder
 * decides which eligible value wins. Page names must not appear here.
 */
export type PublicPresentationFieldClass =
  | "ui_system_chrome"
  | "controlled_vocabulary"
  | "dynamic_hu_owned_prose"
  | "manual_author_content"
  | "legal_content"
  | "brand_content"
  | "geography"
  | "protected_original_content";

/**
 * Authorities that may legitimately supply a value for each field class.
 * Machine/persisted translation never appears for protected, legal, brand,
 * chrome, controlled vocabulary, or geography classes.
 */
export const PUBLIC_PRESENTATION_FIELD_CLASS_ELIGIBLE_AUTHORITIES = {
  protected_original_content: ["PROTECTED_CANONICAL"],
  legal_content: ["LEGAL", "CANONICAL_ENGLISH_FALLBACK"],
  brand_content: ["BRAND", "CANONICAL_ENGLISH_FALLBACK"],
  manual_author_content: ["MANUAL_AUTHOR", "CANONICAL_ENGLISH_FALLBACK"],
  controlled_vocabulary: [
    "CONTROLLED_VOCABULARY",
    "CANONICAL_ENGLISH_FALLBACK",
  ],
  /** System/chrome/instructional text — WEB_UI catalogs; never CT/PLP. */
  ui_system_chrome: ["CONTROLLED_VOCABULARY", "CANONICAL_ENGLISH_FALLBACK"],
  geography: ["GEOGRAPHY", "CANONICAL_ENGLISH_FALLBACK"],
  /**
   * Dynamic HU-owned prose (initiative bodies, CA fields, media editorial, …).
   * Persisted CT/PLP may supply localized text; higher authorities still win
   * when a field is also Brand/Legal/controlled-token reassembled.
   */
  dynamic_hu_owned_prose: [
    "LEGAL",
    "BRAND",
    "MANUAL_AUTHOR",
    "CONTROLLED_VOCABULARY",
    "GEOGRAPHY",
    "PERSISTED_TRANSLATION",
    "CANONICAL_ENGLISH_FALLBACK",
  ],
} as const satisfies Record<
  PublicPresentationFieldClass,
  readonly PublicPresentationAuthority[]
>;

export function publicPresentationFieldClassAllowsAuthority(
  fieldClass: PublicPresentationFieldClass,
  authority: PublicPresentationAuthority,
): boolean {
  const allowed = PUBLIC_PRESENTATION_FIELD_CLASS_ELIGIBLE_AUTHORITIES[fieldClass];
  return (allowed as readonly PublicPresentationAuthority[]).includes(authority);
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

export type PublicPresentationAuthorityCandidate<T = string> = {
  readonly authority: PublicPresentationAuthority;
  readonly value: T;
  /**
   * When false, the candidate is absent (missing localized data) and must not
   * win. Distinguishes missing localization from an intentional value.
   */
  readonly eligible: boolean;
};

/**
 * Select the highest-authority eligible candidate.
 * Returns null only when no eligible candidates exist.
 */
export function selectWinningPublicPresentationCandidate<T>(
  candidates: readonly PublicPresentationAuthorityCandidate<T>[],
): PublicPresentationAuthorityCandidate<T> | null {
  let winner: PublicPresentationAuthorityCandidate<T> | null = null;
  for (const candidate of candidates) {
    if (!candidate.eligible) {
      continue;
    }
    if (
      winner === null ||
      comparePublicPresentationAuthority(candidate.authority, winner.authority) < 0
    ) {
      winner = candidate;
    }
  }
  return winner;
}

/**
 * Presence outcome for diagnostics / noindex / completeness gates.
 * Missing localized data must not be confused with intentional protected canonical.
 */
export type PublicPresentationLocalizationPresence =
  | "intentional_protected_canonical"
  | "localized_higher_authority"
  | "canonical_english_fallback_only"
  | "missing_all_authorities";

export function classifyPublicPresentationLocalizationPresence(
  winner: PublicPresentationAuthorityCandidate<unknown> | null,
): PublicPresentationLocalizationPresence {
  if (!winner) {
    return "missing_all_authorities";
  }
  if (winner.authority === "PROTECTED_CANONICAL") {
    return "intentional_protected_canonical";
  }
  if (winner.authority === "CANONICAL_ENGLISH_FALLBACK") {
    return "canonical_english_fallback_only";
  }
  return "localized_higher_authority";
}

// ---------------------------------------------------------------------------
// Controlled lifecycle / system vocabulary labels
// ---------------------------------------------------------------------------

/**
 * Controlled lifecycle label sources (Terminology → WEB_UI → Registry English).
 *
 * Invariant: when an approved WEB_UI controlled label exists and Terminology
 * preferredTerm is missing, the result MUST be the WEB_UI label — never the
 * raw Registry English label.
 */
export type ControlledLifecycleLabelCandidates = {
  /** Terminology Glossary preferredTerm for the target locale (published). */
  readonly terminologyPreferredTerm?: string | null;
  /**
   * Approved WEB_UI controlled lifecycle label for the target locale
   * (e.g. `initiativeExperience.stages.<stageId>`).
   */
  readonly webUiControlledLabel?: string | null;
  /**
   * Canonical Registry English label. Required when stageId is omitted;
   * otherwise looked up from the lifecycle stage registry.
   */
  readonly registryCanonicalEnglishLabel?: string | null;
  /** Optional stage id for Registry English lookup. */
  readonly stageId?: string | null;
};

export type ControlledLifecycleLabelSource =
  | "terminology_preferred_term"
  | "web_ui_controlled_label"
  | "registry_canonical_english";

export type ControlledLifecycleLabelResolution = {
  readonly label: string;
  readonly source: ControlledLifecycleLabelSource;
  /** Always CONTROLLED_VOCABULARY except Registry English → CANONICAL_ENGLISH_FALLBACK. */
  readonly authority: Extract<
    PublicPresentationAuthority,
    "CONTROLLED_VOCABULARY" | "CANONICAL_ENGLISH_FALLBACK"
  >;
};

function trimNonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRegistryEnglishLabel(
  input: ControlledLifecycleLabelCandidates,
): string {
  const explicit = trimNonEmpty(input.registryCanonicalEnglishLabel);
  if (explicit) {
    return explicit;
  }
  const stageId = input.stageId?.trim();
  if (stageId) {
    const def = getInitiativeLifecycleStageDefinition(stageId);
    if (def?.label) {
      return def.label;
    }
  }
  return "";
}

/**
 * Resolve a controlled lifecycle/system label for public presentation.
 * Locale-agnostic ordering — callers supply already-locale-resolved strings.
 */
export function resolveControlledLifecycleLabel(
  input: ControlledLifecycleLabelCandidates,
): ControlledLifecycleLabelResolution {
  const terminology = trimNonEmpty(input.terminologyPreferredTerm);
  if (terminology) {
    return {
      label: terminology,
      source: "terminology_preferred_term",
      authority: "CONTROLLED_VOCABULARY",
    };
  }

  const webUi = trimNonEmpty(input.webUiControlledLabel);
  if (webUi) {
    return {
      label: webUi,
      source: "web_ui_controlled_label",
      authority: "CONTROLLED_VOCABULARY",
    };
  }

  const registry = resolveRegistryEnglishLabel(input);
  return {
    label: registry,
    source: "registry_canonical_english",
    authority: "CANONICAL_ENGLISH_FALLBACK",
  };
}

/**
 * Convenience: Registry English label for a known stage id (canonical fallback only).
 */
export function registryCanonicalLifecycleStageLabel(
  stageId: InitiativeLifecycleStageId | string,
): string {
  return getInitiativeLifecycleStageDefinition(stageId)?.label ?? "";
}

// ---------------------------------------------------------------------------
// CT vs PLP — persistence beneath presentation authority
// ---------------------------------------------------------------------------

/**
 * Persistence mechanisms that may supply PERSISTED_TRANSLATION values.
 * They are not presentation authorities and must not be merged into one store.
 */
export type PersistedTranslationMechanism =
  | "content_translation"
  | "published_localized_presentation";

/**
 * Normative rule: semantic ownership / artifact contract selects the mechanism;
 * `PUBLIC_PRESENTATION_AUTHORITY` selects which value wins at presentation time.
 */
export const PERSISTED_TRANSLATION_MECHANISM_RULE =
  "CT (content_translations) and PLP (published_localized_presentations) are " +
  "persistence mechanisms beneath PERSISTED_TRANSLATION. Semantic ownership / " +
  "existing artifact architecture determines which mechanism is consulted. " +
  "PUBLIC_PRESENTATION_AUTHORITY determines which value wins. Do not merge CT " +
  "and PLP into one store. Do not move WEB_UI chrome into CT/PLP. Machine " +
  "layers must never overwrite Legal, Brand, Manual, Terminology, controlled " +
  "WEB_UI, or Geography.";

/** public_news / RSS card prose — Reset 01 PLP MACHINE (title+summary). */
export const PUBLIC_NEWS_PROTECTED_ORIGINAL_RULE =
  "public_news title/summary are MACHINE_CONTENT via bounded carousel PLP. " +
  "sourceName, URLs, IDs, and timestamps remain PROTECTED_CANONICAL. " +
  "Incomplete CURRENT falls back to the coherent canonical card.";

export const PUBLIC_PRESENTATION_AUTHORITY_INVARIANTS = [
  "Canonical English is fallback, never a competing peer authority.",
  "Machine/persisted translation must never overwrite Legal, Brand, Manual, Terminology, controlled WEB_UI, or Geography.",
  "Controlled lifecycle vocabulary in public prose resolves Terminology → WEB_UI → Registry English — never Gemini orthography.",
  "WEB_UI remains authority for system/chrome/instructional text; do not move UI prose into CT/PLP.",
  "CT/PLP remain persistence for owned translatable content; no new translation store.",
  "public_news carousel title/summary localize via PLP; identity/URL fields stay protected.",
  "Missing localized data must be distinguishable from intentional protected canonical content.",
] as const;
