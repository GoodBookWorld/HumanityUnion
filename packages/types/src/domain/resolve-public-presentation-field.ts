/**
 * Localization Authority Closure 02 — executable public presentation resolver.
 *
 * Normative runtime selection for public localized values.
 * Ordering comes only from `PUBLIC_PRESENTATION_AUTHORITY` (Closure 01).
 * Never depends on Pack 08I.15 `LOCALIZATION_RESOLUTION_PRIORITY` (Brand > Legal).
 *
 * Cache/read only: no provider invocation, no generate, no localization writes.
 */

import {
  classifyPublicPresentationLocalizationPresence,
  publicPresentationFieldClassAllowsAuthority,
  resolveControlledLifecycleLabel,
  selectWinningPublicPresentationCandidate,
  type ControlledLifecycleLabelCandidates,
  type ControlledLifecycleLabelSource,
  type PersistedTranslationMechanism,
  type PublicPresentationAuthority,
  type PublicPresentationAuthorityCandidate,
  type PublicPresentationFieldClass,
  type PublicPresentationLocalizationPresence,
} from "./public-presentation-authority.js";

function trimEligible(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pushCandidate(
  out: PublicPresentationAuthorityCandidate<string>[],
  authority: PublicPresentationAuthority,
  value: string | null | undefined,
  fieldClass: PublicPresentationFieldClass | undefined,
): void {
  const trimmed = trimEligible(value);
  if (!trimmed) {
    return;
  }
  if (
    fieldClass &&
    !publicPresentationFieldClassAllowsAuthority(fieldClass, authority)
  ) {
    return;
  }
  out.push({ authority, value: trimmed, eligible: true });
}

/**
 * Named authority candidates for a single public presentation field.
 * Adapters obtain CT/PLP/Brand/Legal/etc.; this resolver only selects the winner.
 */
export type ResolvePublicPresentationFieldInput = {
  /**
   * Optional semantic field class. When set, candidates whose authority is not
   * eligible for the class are ignored (e.g. machine never wins for chrome).
   */
  readonly fieldClass?: PublicPresentationFieldClass;
  readonly protectedCanonical?: string | null;
  readonly legal?: string | null;
  readonly brand?: string | null;
  readonly manualAuthor?: string | null;
  /** Pre-resolved controlled vocabulary string (already Terminology/WEB_UI/…). */
  readonly controlledVocabulary?: string | null;
  /**
   * When set, resolved via Closure 01 `resolveControlledLifecycleLabel`
   * (Terminology → WEB_UI → Registry English) and entered as CONTROLLED_VOCABULARY
   * or CANONICAL_ENGLISH_FALLBACK.
   */
  readonly controlledLifecycle?: ControlledLifecycleLabelCandidates;
  readonly geography?: string | null;
  /** CT or PLP localized value — mechanism is metadata only. */
  readonly persistedTranslation?: string | null;
  readonly persistedTranslationMechanism?: PersistedTranslationMechanism;
  readonly canonicalEnglishFallback?: string | null;
};

export type ResolvePublicPresentationFieldResult = {
  readonly value: string;
  readonly authority: PublicPresentationAuthority;
  readonly presence: PublicPresentationLocalizationPresence;
  /** Set when `controlledLifecycle` participated and won (or supplied the controlled path). */
  readonly controlledLifecycleSource?: ControlledLifecycleLabelSource;
  /** Echo of input mechanism when persisted translation won. */
  readonly persistedTranslationMechanism?: PersistedTranslationMechanism;
};

/**
 * Select the winning public presentation value under Closure 01 authority.
 *
 * - Ignores absent/blank candidates
 * - Never generates or writes translations
 * - Locale-agnostic ordering (callers supply already-locale-resolved strings)
 */
export function resolvePublicPresentationField(
  input: ResolvePublicPresentationFieldInput,
): ResolvePublicPresentationFieldResult | null {
  const fieldClass = input.fieldClass;
  const candidates: PublicPresentationAuthorityCandidate<string>[] = [];

  let lifecycleResolution:
    | ReturnType<typeof resolveControlledLifecycleLabel>
    | undefined;

  if (input.controlledLifecycle) {
    lifecycleResolution = resolveControlledLifecycleLabel(input.controlledLifecycle);
    if (trimEligible(lifecycleResolution.label)) {
      pushCandidate(
        candidates,
        lifecycleResolution.authority,
        lifecycleResolution.label,
        fieldClass,
      );
    }
  }

  pushCandidate(
    candidates,
    "PROTECTED_CANONICAL",
    input.protectedCanonical,
    fieldClass,
  );
  pushCandidate(candidates, "LEGAL", input.legal, fieldClass);
  pushCandidate(candidates, "BRAND", input.brand, fieldClass);
  pushCandidate(candidates, "MANUAL_AUTHOR", input.manualAuthor, fieldClass);
  pushCandidate(
    candidates,
    "CONTROLLED_VOCABULARY",
    input.controlledVocabulary,
    fieldClass,
  );
  pushCandidate(candidates, "GEOGRAPHY", input.geography, fieldClass);
  pushCandidate(
    candidates,
    "PERSISTED_TRANSLATION",
    input.persistedTranslation,
    fieldClass,
  );
  pushCandidate(
    candidates,
    "CANONICAL_ENGLISH_FALLBACK",
    input.canonicalEnglishFallback,
    fieldClass,
  );

  const winner = selectWinningPublicPresentationCandidate(candidates);
  if (!winner) {
    return null;
  }

  const presence = classifyPublicPresentationLocalizationPresence(winner);
  const result: ResolvePublicPresentationFieldResult = {
    value: winner.value,
    authority: winner.authority,
    presence,
  };

  if (
    lifecycleResolution &&
    winner.value === lifecycleResolution.label &&
    winner.authority === lifecycleResolution.authority
  ) {
    return {
      ...result,
      controlledLifecycleSource: lifecycleResolution.source,
    };
  }

  if (
    winner.authority === "PERSISTED_TRANSLATION" &&
    input.persistedTranslationMechanism
  ) {
    return {
      ...result,
      persistedTranslationMechanism: input.persistedTranslationMechanism,
    };
  }

  return result;
}

/**
 * Convenience: resolve a public_news / RSS original as protected canonical.
 * Machine translation candidates are ignored by field-class eligibility.
 */
export function resolveProtectedPublicNewsField(input: {
  readonly originalTitleOrSummary: string;
  readonly persistedTranslation?: string | null;
}): ResolvePublicPresentationFieldResult | null {
  return resolvePublicPresentationField({
    fieldClass: "protected_original_content",
    protectedCanonical: input.originalTitleOrSummary,
    persistedTranslation: input.persistedTranslation,
  });
}
