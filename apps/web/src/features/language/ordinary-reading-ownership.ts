/**
 * Language Architecture Pack 02 / Version 5.0 — Registry-driven ordinary-reading ownership.
 *
 * NORMAL WEB: browser-native (canonical → browser Translate).
 * STANDALONE PWA + Registry activation gates: hu-persisted (CURRENT → visible;
 * missing/stale → per-artifact canonical fallback).
 * Public News RSS cards: always browser-native / source original (sourceKind-based).
 *
 * Version 5.0 invariant: `pwaPersistedReadingReady` is Admin/activation only —
 * it must not gate individual runtime persisted reads.
 */

import type {
  ContentTranslationSourceKind,
  LanguageCode,
  PwaPersistedOrdinaryReadingEligibility,
} from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isPwaPersistedOrdinaryReadingEligible,
} from "@hu/types";

import type { HuPresentationMode } from "../pwa/presentation-mode";

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

/**
 * Single ordinary-reading ownership decision for visible civic prose.
 * Search/SEO/Brand/Legal/Glossary are out of scope.
 *
 * When `pwaEligibility` is null/undefined (catalog not loaded yet), ownership
 * stays browser-native (safe hydration default).
 */
export function resolveOrdinaryReadingOwner(input: {
  readonly presentationMode: HuPresentationMode;
  readonly preferredReadingLanguage: LanguageCode | string;
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
  readonly pwaEligibility?: PwaPersistedOrdinaryReadingEligibility | null;
}): OrdinaryReadingOwner {
  if (isOrdinaryReadingPublicNewsExclusion(input.sourceKind)) {
    return "browser-native";
  }

  if (input.presentationMode !== "standalone") {
    return "browser-native";
  }

  const language = (input.preferredReadingLanguage || DEFAULT_PLATFORM_LANGUAGE).trim();
  if (!language || language === DEFAULT_PLATFORM_LANGUAGE) {
    return "browser-native";
  }

  if (!input.pwaEligibility || !isPwaPersistedOrdinaryReadingEligible(input.pwaEligibility)) {
    return "browser-native";
  }

  return "hu-persisted";
}

/** True when visible reading may cache-only resolve CURRENT persisted translation. */
export function shouldResolveHuPersistedOrdinaryReading(input: {
  readonly presentationMode: HuPresentationMode;
  readonly preferredReadingLanguage: LanguageCode | string;
  readonly sourceKind?: ContentTranslationSourceKind | string | null;
  readonly pwaEligibility?: PwaPersistedOrdinaryReadingEligibility | null;
}): boolean {
  return resolveOrdinaryReadingOwner(input) === "hu-persisted";
}
