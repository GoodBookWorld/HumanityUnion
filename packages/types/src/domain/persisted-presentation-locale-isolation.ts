/**
 * Locale isolation for persisted localized presentations (PLP / CT apply).
 *
 * A presentation must never be applied when its locale differs from the
 * requested participant/document presentation locale.
 */

import { normalizeLanguageRegistryLocaleKey } from "./language-registry.js";

/**
 * True when normalized presentation locale equals normalized requested locale.
 * Empty/missing presentation locale is never considered a match.
 */
export function persistedPresentationLocaleMatchesRequested(input: {
  readonly presentationLocale: string | null | undefined;
  readonly requestedLocale: string | null | undefined;
}): boolean {
  const presentation = normalizeLanguageRegistryLocaleKey(
    typeof input.presentationLocale === "string" ? input.presentationLocale : "",
  );
  const requested = normalizeLanguageRegistryLocaleKey(
    typeof input.requestedLocale === "string" ? input.requestedLocale : "",
  );
  if (!presentation || !requested) {
    return false;
  }
  return presentation === requested;
}

/**
 * Guard for applying a persisted localized presentation.
 *
 * Fail closed: apply ONLY when mode is exactly PUBLISHED_LOCALIZED AND
 * normalized presentation locale equals normalized requested locale.
 * Missing/null/unknown mode, CANONICAL_FALLBACK, or locale mismatch ⇒ reject.
 */
export function mayApplyPersistedLocalizedPresentation(input: {
  readonly presentationLocale: string | null | undefined;
  readonly requestedLocale: string | null | undefined;
  readonly mode?: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | string | null;
}): boolean {
  if (input.mode !== "PUBLISHED_LOCALIZED") {
    return false;
  }
  return persistedPresentationLocaleMatchesRequested({
    presentationLocale: input.presentationLocale,
    requestedLocale: input.requestedLocale,
  });
}
