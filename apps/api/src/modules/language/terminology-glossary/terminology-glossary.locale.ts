/**
 * Pack 02F — Language Registry locale rules for glossary mutations.
 *
 * Disabled languages may retain stored translations but are not runtime authority.
 * Locale aliases (e.g. zh-TW) canonicalize to Registry locale (zh-Hant).
 * Glossary term aliases are unrelated to Registry locale aliases.
 */

import type { TerminologyLocaleTranslation } from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language-registry/language-registry.repository.js";
import { TerminologyGlossaryValidationError } from "./terminology-glossary.errors.js";
import { normalizeLocaleTranslation } from "./terminology-glossary.integrity.js";

/**
 * Resolve each translation map key through the Language Registry.
 * Unknown locales are rejected. Disabled locales are allowed for storage.
 */
export async function canonicalizeGlossaryTranslationLocales(
  translations: Readonly<Record<string, TerminologyLocaleTranslation>>,
): Promise<Record<string, TerminologyLocaleTranslation>> {
  const result: Record<string, TerminologyLocaleTranslation> = {};

  for (const [localeOrAlias, translation] of Object.entries(translations)) {
    const trimmed = localeOrAlias.trim();
    if (!trimmed) {
      throw new TerminologyGlossaryValidationError("Translation locale is required.");
    }

    const record = await resolveLanguageRegistryLocale(trimmed);
    if (!record) {
      throw new TerminologyGlossaryValidationError(
        `Unknown glossary translation locale: ${trimmed}`,
      );
    }

    const canonicalLocale = record.locale;
    if (result[canonicalLocale]) {
      throw new TerminologyGlossaryValidationError(
        `Duplicate glossary translation for canonical locale "${canonicalLocale}" (from "${trimmed}").`,
      );
    }

    result[canonicalLocale] = normalizeLocaleTranslation(translation);
  }

  return result;
}

/**
 * Resolve locale/alias tags for removal through the Language Registry.
 * Unknown locales rejected; disabled locales allowed; duplicates collapse.
 */
export async function canonicalizeGlossaryLocaleKeys(
  localesOrAliases: readonly string[],
): Promise<readonly string[]> {
  const canonical = new Set<string>();

  for (const localeOrAlias of localesOrAliases) {
    const trimmed = localeOrAlias.trim();
    if (!trimmed) {
      throw new TerminologyGlossaryValidationError("Translation locale is required.");
    }
    const record = await resolveLanguageRegistryLocale(trimmed);
    if (!record) {
      throw new TerminologyGlossaryValidationError(
        `Unknown glossary translation locale: ${trimmed}`,
      );
    }
    canonical.add(record.locale);
  }

  return [...canonical].sort();
}
