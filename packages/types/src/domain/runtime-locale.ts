/**
 * Production Completion Pack 02C — canonical runtime locale resolution contract.
 *
 * Interface language only. Reading/writing languages remain separate preference fields.
 * Pure catalog resolver is shared by API (Registry-backed) and Web SSR.
 */

import { DEFAULT_PLATFORM_LANGUAGE } from "./language.js";
import type {
  LanguageRegistryId,
  LanguageRegistryLocale,
  LanguageTextDirection,
} from "./language-registry.js";
import { normalizeLanguageRegistryLocaleKey } from "./language-registry.js";
import {
  expandLocaleLookupCandidates,
  listAcceptLanguageLookupTags,
} from "./accept-language.js";

/** How the active interface locale was chosen. */
export type RuntimeLocaleResolutionSource =
  | "participant"
  | "cookie"
  | "browser"
  | "platform_default"
  | "english_fallback";

/**
 * Result of canonical locale resolution for layout / runtime use.
 * Always an ENABLED Language Registry locale (or English fallback).
 */
export interface ResolvedRuntimeLocale {
  readonly locale: LanguageRegistryLocale;
  readonly languageId: LanguageRegistryId;
  readonly textDirection: LanguageTextDirection;
  readonly source: RuntimeLocaleResolutionSource;
}

/** Enabled-locale catalog entry used by the pure resolver (API + Web). */
export interface RuntimeLocaleCatalogEntry {
  readonly languageId: LanguageRegistryId;
  readonly locale: LanguageRegistryLocale;
  readonly textDirection: LanguageTextDirection;
  readonly aliases: readonly LanguageRegistryLocale[];
}

export interface ResolveRuntimeLocaleInput {
  /**
   * When true, Participant preference is tried first.
   * When false/undefined, anonymous precedence is used (cookie first).
   */
  readonly authenticated?: boolean;
  /** Participant `interfaceLanguage` preference (canonical locale or alias). */
  readonly participantInterfaceLanguage?: string | null;
  /** Raw `hu_lang` cookie value (may be invalid/disabled). */
  readonly huLangCookie?: string | null;
  /** Raw Accept-Language header. */
  readonly acceptLanguageHeader?: string | null;
  /**
   * Platform default locale when browser/cookie/participant do not resolve.
   * Defaults to `DEFAULT_PLATFORM_LANGUAGE` (`en`). No Admin setting exists yet.
   */
  readonly platformDefaultLocale?: string | null;
}

/** Canonical guest preference cookie name. */
export const HU_LANG_COOKIE_NAME = "hu_lang" as const;

/** Default Max-Age for `hu_lang` (365 days). */
export const HU_LANG_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Absolute English fallback when catalog cannot resolve `en`. */
export const ENGLISH_RUNTIME_LOCALE_FALLBACK: ResolvedRuntimeLocale = {
  locale: DEFAULT_PLATFORM_LANGUAGE,
  languageId: "lang-en",
  textDirection: "ltr",
  source: "english_fallback",
};

function toResolved(
  entry: RuntimeLocaleCatalogEntry,
  source: RuntimeLocaleResolutionSource,
): ResolvedRuntimeLocale {
  return {
    locale: entry.locale,
    languageId: entry.languageId,
    textDirection: entry.textDirection,
    source,
  };
}

/**
 * Build a case-insensitive lookup index for enabled locales + aliases.
 * Canonical locale keys win over alias keys when both somehow collide.
 */
export function buildRuntimeLocaleCatalogIndex(
  catalog: readonly RuntimeLocaleCatalogEntry[],
): Map<string, RuntimeLocaleCatalogEntry> {
  const index = new Map<string, RuntimeLocaleCatalogEntry>();

  for (const entry of catalog) {
    for (const alias of entry.aliases) {
      const aliasKey = normalizeLanguageRegistryLocaleKey(alias);
      if (aliasKey && !index.has(aliasKey)) {
        index.set(aliasKey, entry);
      }
    }
  }

  for (const entry of catalog) {
    const localeKey = normalizeLanguageRegistryLocaleKey(entry.locale);
    if (localeKey) {
      index.set(localeKey, entry);
    }
  }

  return index;
}

/**
 * Resolve one candidate tag against an enabled catalog (exact / alias / regional truncation).
 * Never collapses a successful `zh-Hant` hit to `zh`.
 */
export function resolveEnabledCatalogEntryForCandidate(
  input: string | null | undefined,
  index: Map<string, RuntimeLocaleCatalogEntry>,
): RuntimeLocaleCatalogEntry | null {
  if (typeof input !== "string") {
    return null;
  }

  for (const candidate of expandLocaleLookupCandidates(input)) {
    const hit = index.get(normalizeLanguageRegistryLocaleKey(candidate));
    if (hit) {
      return hit;
    }
  }

  return null;
}

/**
 * Pure canonical locale resolution against an ENABLED catalog.
 * Single precedence implementation for API + Web SSR.
 *
 * Anonymous: cookie → Accept-Language → platform default → en
 * Authenticated: Participant → cookie → Accept-Language → platform default → en
 */
export function resolveRuntimeLocaleFromCatalog(
  input: ResolveRuntimeLocaleInput,
  catalog: readonly RuntimeLocaleCatalogEntry[],
): ResolvedRuntimeLocale {
  const index = buildRuntimeLocaleCatalogIndex(catalog);
  const authenticated = input.authenticated === true;
  const platformDefault =
    typeof input.platformDefaultLocale === "string" &&
    input.platformDefaultLocale.trim().length > 0
      ? input.platformDefaultLocale.trim()
      : DEFAULT_PLATFORM_LANGUAGE;

  if (authenticated) {
    const fromParticipant = resolveEnabledCatalogEntryForCandidate(
      input.participantInterfaceLanguage,
      index,
    );
    if (fromParticipant) {
      return toResolved(fromParticipant, "participant");
    }
  }

  const fromCookie = resolveEnabledCatalogEntryForCandidate(input.huLangCookie, index);
  if (fromCookie) {
    return toResolved(fromCookie, "cookie");
  }

  for (const tag of listAcceptLanguageLookupTags(input.acceptLanguageHeader)) {
    const fromBrowser = resolveEnabledCatalogEntryForCandidate(tag, index);
    if (fromBrowser) {
      return toResolved(fromBrowser, "browser");
    }
  }

  const fromPlatform = resolveEnabledCatalogEntryForCandidate(platformDefault, index);
  if (fromPlatform) {
    return toResolved(fromPlatform, "platform_default");
  }

  const english = resolveEnabledCatalogEntryForCandidate(DEFAULT_PLATFORM_LANGUAGE, index);
  if (english) {
    return toResolved(english, "english_fallback");
  }

  return ENGLISH_RUNTIME_LOCALE_FALLBACK;
}
