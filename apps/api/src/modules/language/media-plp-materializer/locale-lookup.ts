/**
 * Reset 03B — Language Registry eligibility lookup for Media PLP materializer.
 *
 * Canonical locale / alias resolution via the Registry repository module only.
 * Avoid the language-registry barrel entrypoint: it re-exports HTTP routes,
 * Admin service, auth, and search-index invalidation modules, which inflated
 * dry-run RSS past the Render 512 MB limit after the locale-identity fix.
 *
 * Does not collapse script/region tags to a base languageCode.
 */

import type { LanguageCode } from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language-registry/language-registry.repository.js";
import { markMaterializerLanguageRegistryLookup } from "./counters.js";
import { normalizeMediaPlpRegistryLocaleIdentity } from "./locale-identity.js";

export type MediaPlpMaterializerLocaleLookup = {
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
  /**
   * Canonical Registry `locale` when found; otherwise the Registry-normalized
   * request key (script/region preserved; not LanguageCode base-collapsed).
   * Optional on test mocks — runner falls back to the request locale.
   */
  readonly CANONICAL_LOCALE?: LanguageCode;
};

export async function loadMediaPlpMaterializerLocale(
  locale: LanguageCode | string,
): Promise<MediaPlpMaterializerLocaleLookup> {
  markMaterializerLanguageRegistryLookup();
  const requested = normalizeMediaPlpRegistryLocaleIdentity(String(locale));
  const record = await resolveLanguageRegistryLocale(requested);
  if (!record) {
    return {
      LOCALE_REGISTRY_FOUND: false,
      LOCALE_ENABLED: false,
      CONTENT_TRANSLATION_ENABLED: false,
      CANONICAL_LOCALE: requested,
    };
  }
  return {
    LOCALE_REGISTRY_FOUND: true,
    LOCALE_ENABLED: record.enabled === true,
    CONTENT_TRANSLATION_ENABLED: record.contentTranslationEnabled === true,
    CANONICAL_LOCALE: record.locale as LanguageCode,
  };
}
