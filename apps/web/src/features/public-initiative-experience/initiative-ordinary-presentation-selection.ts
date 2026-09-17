/**
 * Version 5.0 — Initiative ordinary presentation selection (pure).
 *
 * NORMAL WEB / browser-native: canonical only (never consume CT/SSR seed).
 * INSTALLED PWA / hu-persisted: SSR seed (when locale-matched) + cache-only resolve.
 */

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import type { ResolvedInitiativeDetailPresentation } from "./resolve-initiative-detail-presentation";
import {
  selectInitiativePublicPresentation,
  type InitiativePublicPresentation,
  type InitiativePublicPresentationCanonical,
} from "./initiative-public-presentation";

export function isDistinctInitiativePresentationSeed(
  canonical: InitiativePublicPresentationCanonical,
  seed: InitiativePublicPresentationCanonical | null | undefined,
): boolean {
  if (!seed) {
    return false;
  }
  return (
    seed.title.trim() !== canonical.title.trim() ||
    seed.description.trim() !== canonical.description.trim()
  );
}

/** Normal Web / non-PWA ordinary reading — canonical English bag only. */
export function selectBrowserNativeInitiativePresentation(
  canonical: InitiativePublicPresentationCanonical,
): InitiativePublicPresentation {
  return selectInitiativePublicPresentation({
    canonical,
    presentationMode: "original",
    activeLanguage: DEFAULT_PLATFORM_LANGUAGE,
    originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
    canViewOriginal: false,
    canViewTranslation: false,
    isMachineTranslated: false,
  });
}

/**
 * PWA settling / locale-switch interim: show canonical for the target display
 * language until CURRENT resolve lands. Never keeps another locale's translation.
 */
export function selectHuPersistedInitiativeLocaleInterim(input: {
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly displayLanguage: LanguageCode;
  readonly originalLanguage?: LanguageCode;
}): InitiativePublicPresentation {
  return selectInitiativePublicPresentation({
    canonical: input.canonical,
    presentationMode: "original",
    activeLanguage: input.displayLanguage,
    originalLanguage: input.originalLanguage ?? DEFAULT_PLATFORM_LANGUAGE,
    canViewOriginal: false,
    canViewTranslation: false,
    isMachineTranslated: false,
  });
}

/**
 * Apply a locale-matched SSR seed as first-paint / settling translated bag.
 * Seed must differ from canonical; caller must ensure seed locale === displayLanguage.
 */
export function selectHuPersistedInitiativeSeedPresentation(input: {
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly seed: InitiativePublicPresentationCanonical;
  readonly displayLanguage: LanguageCode;
}): InitiativePublicPresentation {
  return selectInitiativePublicPresentation({
    canonical: input.canonical,
    translated: input.seed,
    presentationMode: "translated",
    activeLanguage: input.displayLanguage,
    originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
    canViewOriginal: true,
    canViewTranslation: true,
    isMachineTranslated: true,
  });
}

/** Map cache-only resolve result into the Initiative presentation object. */
export function selectHuPersistedInitiativeResolvedPresentation(
  resolved: ResolvedInitiativeDetailPresentation,
): InitiativePublicPresentation {
  return selectInitiativePublicPresentation({
    canonical: {
      title: resolved.originalTitle,
      description: resolved.originalDescription,
    },
    translated:
      resolved.presentationMode === "translated"
        ? { title: resolved.title, description: resolved.description }
        : null,
    presentationMode: resolved.presentationMode,
    activeLanguage: resolved.activeLanguage,
    originalLanguage: resolved.originalLanguage,
    isMachineTranslated: resolved.isMachineTranslated,
    isStale: resolved.isStale,
    canViewOriginal: resolved.canViewOriginal,
    canViewTranslation: resolved.canViewTranslation,
  });
}

/**
 * Ownership-phase selection for tests and hook orchestration.
 *
 * - browser-native / not-ready-for-PWA → canonical (WEB invariant)
 * - hu-persisted + seed eligible for displayLanguage → seed translated bag
 * - hu-persisted + resolved CURRENT → translated or canonical fallback
 * - hu-persisted settling without usable seed → locale interim canonical
 */
export function selectOrdinaryInitiativePresentationForOwnerPhase(input: {
  readonly owner: "browser-native" | "hu-persisted";
  readonly ownershipReady: boolean;
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly displayLanguage: LanguageCode;
  readonly initialPresentation?: InitiativePublicPresentationCanonical | null;
  /** SSR seed is only valid for this Preferred Reading / interface locale. */
  readonly seedLocale: LanguageCode | null;
  readonly resolved?: ResolvedInitiativeDetailPresentation | null;
}): InitiativePublicPresentation {
  if (!input.ownershipReady || input.owner !== "hu-persisted") {
    return selectBrowserNativeInitiativePresentation(input.canonical);
  }

  if (input.resolved) {
    return selectHuPersistedInitiativeResolvedPresentation(input.resolved);
  }

  if (
    input.seedLocale === input.displayLanguage &&
    isDistinctInitiativePresentationSeed(input.canonical, input.initialPresentation)
  ) {
    return selectHuPersistedInitiativeSeedPresentation({
      canonical: input.canonical,
      seed: input.initialPresentation!,
      displayLanguage: input.displayLanguage,
    });
  }

  return selectHuPersistedInitiativeLocaleInterim({
    canonical: input.canonical,
    displayLanguage: input.displayLanguage,
  });
}
