/**
 * Pack 08I.14B — single participant-facing public content display-language contract.
 *
 * Interface/document locale drives content display for Initiative detail, cards,
 * Discussion, and Lifecycle civic prose. Authenticated `readingLanguages[0]` must
 * not diverge the resolve language while the UI locale is different.
 */

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

/**
 * Align UI locale tags with Registry aliases used by translation resolve.
 */
export function resolvePublicContentDisplayLanguage(
  interfaceLocale: string | null | undefined,
): LanguageCode {
  const trimmed = typeof interfaceLocale === "string" ? interfaceLocale.trim() : "";
  if (!trimmed) {
    return DEFAULT_PLATFORM_LANGUAGE;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") {
    return "zh-Hant";
  }
  if (lower === "zh-hans" || lower === "zh-cn") {
    return "zh";
  }
  return normalizeLanguageCode(trimmed, DEFAULT_PLATFORM_LANGUAGE);
}
