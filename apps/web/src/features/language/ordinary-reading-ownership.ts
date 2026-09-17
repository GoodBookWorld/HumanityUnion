/**
 * PWA Full Translation Pack 01 — centralized ordinary-reading ownership.
 *
 * NORMAL WEB: browser-native (canonical → browser Translate).
 * STANDALONE PWA + uk|ar|zh-Hant: hu-persisted (CURRENT CT/PLP → visible).
 * Public News RSS cards: always browser-native / source original (explicit exclusion).
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import type { HuPresentationMode } from "../pwa/presentation-mode";

/** Pack 01 — persisted ordinary PWA presentation locales only. */
export const PWA_PERSISTED_ORDINARY_READING_LANGUAGES = [
  "uk",
  "ar",
  "zh-Hant",
] as const;

export type PwaPersistedOrdinaryReadingLanguage =
  (typeof PWA_PERSISTED_ORDINARY_READING_LANGUAGES)[number];

export type OrdinaryReadingOwner = "browser-native" | "hu-persisted";

/**
 * Visible Public News RSS card ordinary reading never uses HU persisted
 * translation (CT or PLP) in WEB or PWA.
 */
export function isOrdinaryReadingPublicNewsExclusion(
  sourceKind: ContentTranslationSourceKind | string | null | undefined,
): boolean {
  return sourceKind === "public_news";
}

export function isPwaPersistedOrdinaryReadingLanguage(
  language: string | null | undefined,
): language is PwaPersistedOrdinaryReadingLanguage {
  return (PWA_PERSISTED_ORDINARY_READING_LANGUAGES as readonly string[]).includes(
    language ?? "",
  );
}

/**
 * Single ordinary-reading ownership decision for visible civic prose.
 * Search/SEO/Brand/Legal/Glossary are out of scope.
 */
export function resolveOrdinaryReadingOwner(input: {
  readonly presentationMode: HuPresentationMode;
  readonly preferredReadingLanguage: LanguageCode | string;
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
}): OrdinaryReadingOwner {
  if (isOrdinaryReadingPublicNewsExclusion(input.sourceKind)) {
    return "browser-native";
  }

  if (input.presentationMode !== "standalone") {
    return "browser-native";
  }

  const language = (input.preferredReadingLanguage || DEFAULT_PLATFORM_LANGUAGE).trim();
  if (!isPwaPersistedOrdinaryReadingLanguage(language)) {
    return "browser-native";
  }

  return "hu-persisted";
}

/** True when visible reading may cache-only resolve CURRENT persisted translation. */
export function shouldResolveHuPersistedOrdinaryReading(input: {
  readonly presentationMode: HuPresentationMode;
  readonly preferredReadingLanguage: LanguageCode | string;
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
}): boolean {
  return resolveOrdinaryReadingOwner(input) === "hu-persisted";
}
