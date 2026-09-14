/**
 * Media PLP materializer — Registry locale identity (not LanguageCode base collapse).
 *
 * `normalizeLanguageCode` collapses `zh-Hant` → `zh` for priority bases.
 * Materialization / eligibility must keep the Language Registry locale key so
 * script/region tags remain distinct identities.
 */

import {
  normalizeLanguageRegistryLocaleKey,
  type LanguageCode,
} from "@hu/types";

/**
 * Normalize operator `--locale` for Media PLP Registry identity.
 * Case-insensitive; does not strip script/region subtags.
 */
export function normalizeMediaPlpRegistryLocaleIdentity(
  value: string,
): LanguageCode {
  return normalizeLanguageRegistryLocaleKey(value) as LanguageCode;
}
