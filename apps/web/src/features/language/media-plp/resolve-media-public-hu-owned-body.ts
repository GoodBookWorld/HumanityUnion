/**
 * Closure 06 — when PLP owns public Media HU-owned bodies, legacy CT must not win.
 * Presentation-selection contract (deterministic); does not mutate stores.
 */

export type MediaPublicHuOwnedBodySource =
  | "plp"
  | "canonical"
  | "legacy_ct_only_when_plp_disabled";

export type MediaPublicHuOwnedBodyResolution = {
  readonly value: string;
  readonly authority: "PERSISTED_TRANSLATION" | "CANONICAL_ENGLISH_FALLBACK";
  readonly source: MediaPublicHuOwnedBodySource;
};

/**
 * Prefer PLP over legacy CT whenever the PLP public path is active.
 * Legacy CT may only win when PLP is explicitly disabled (FORCE_LEGACY / flag off).
 */
export function resolveMediaPublicHuOwnedBody(input: {
  readonly plpEnabled: boolean;
  readonly plpLocalizedBody?: string | null;
  readonly legacyCtBody?: string | null;
  readonly canonicalEnglishBody: string;
}): MediaPublicHuOwnedBodyResolution {
  const canonical = input.canonicalEnglishBody.trim();
  if (input.plpEnabled) {
    const plp = input.plpLocalizedBody?.trim();
    if (plp) {
      return {
        value: plp,
        authority: "PERSISTED_TRANSLATION",
        source: "plp",
      };
    }
    return {
      value: canonical,
      authority: "CANONICAL_ENGLISH_FALLBACK",
      source: "canonical",
    };
  }

  const legacy = input.legacyCtBody?.trim();
  if (legacy) {
    return {
      value: legacy,
      authority: "PERSISTED_TRANSLATION",
      source: "legacy_ct_only_when_plp_disabled",
    };
  }
  return {
    value: canonical,
    authority: "CANONICAL_ENGLISH_FALLBACK",
    source: "canonical",
  };
}
