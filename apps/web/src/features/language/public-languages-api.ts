/**
 * Production Completion Pack 02C Task 03 — public Language Registry client.
 *
 * Pack 02C Hotfix 02 — Admin enable/disable must propagate without Web restart:
 * - Write validation (`loadEnabledPublicLocaleCatalog` / POST /api/hu-lang) always
 *   fetches authoritative Registry state (no process-lifetime cache).
 * - Client selectors keep a short TTL + in-flight dedup (Task 04) only.
 *
 * Pack 02F staging-smoke runtime fix — Admin language mutations must invalidate
 * the short-lived client cache and notify mounted selectors in-session.
 *
 * SSR document locale uses its own no-store fetch in resolve-document-locale.ts
 * (does not share this module cache).
 */

import type {
  LanguageRegistryPublic,
  LanguageRegistryPublicListResponse,
  RuntimeLocaleCatalogEntry,
} from "@hu/types";

import { API_BASE_URL } from "../../lib/api-base-url";

export interface SelectablePublicLanguage {
  readonly languageId: string;
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: "ltr" | "rtl";
}

/** Client selector session window — Task 04 duplicate-fetch reduction. */
export const PUBLIC_LANGUAGES_CLIENT_CACHE_TTL_MS = 15_000;

/** Dispatched after Admin Registry mutations invalidate the client selector cache. */
export const PUBLIC_LANGUAGES_CHANGED_EVENT = "hu:public-languages-changed";

function toSelectable(row: LanguageRegistryPublic): SelectablePublicLanguage {
  return {
    languageId: row.languageId,
    locale: row.locale,
    englishName: row.englishName,
    nativeName: row.nativeName,
    textDirection: row.textDirection,
  };
}

function toCatalogEntry(row: LanguageRegistryPublic): RuntimeLocaleCatalogEntry {
  return {
    languageId: row.languageId,
    locale: row.locale,
    textDirection: row.textDirection,
    aliases: [...row.aliases],
  };
}

interface ClientCacheEntry {
  readonly data: LanguageRegistryPublicListResponse;
  fetchedAtMs: number;
}

let clientLanguagesCache: ClientCacheEntry | null = null;
let clientLanguagesInFlight: Promise<LanguageRegistryPublicListResponse> | null = null;

/**
 * Drop short-lived client cache and notify mounted LanguageSelectors.
 * Call after authoritative Admin create/enable/disable/update succeeds.
 */
export function invalidatePublicLanguagesClientCache(): void {
  clientLanguagesCache = null;
  clientLanguagesInFlight = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PUBLIC_LANGUAGES_CHANGED_EVENT));
  }
}

/** Test-only — clear client language list cache / in-flight. */
export function resetPublicLanguagesCacheForTests(): void {
  clientLanguagesCache = null;
  clientLanguagesInFlight = null;
}

/** Test-only — force client TTL expiry without waiting. */
export function expirePublicLanguagesClientCacheForTests(): void {
  if (clientLanguagesCache) {
    clientLanguagesCache.fetchedAtMs = 0;
  }
}

function parseLanguagesEnvelope(payload: unknown): LanguageRegistryPublicListResponse {
  const envelope = payload as {
    success?: boolean;
    data?: LanguageRegistryPublicListResponse;
  };

  if (!envelope.data?.languages || !Array.isArray(envelope.data.languages)) {
    throw new Error("Languages response was invalid.");
  }

  return envelope.data;
}

/**
 * Authoritative Registry fetch — always hits the API (cache: no-store).
 * Used by POST /api/hu-lang write validation. Never process-lifetime cached.
 */
export async function fetchPublicLanguagesAuthoritative(): Promise<LanguageRegistryPublicListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error("Unable to load languages.");
  }

  return parseLanguagesEnvelope(await response.json());
}

async function fetchPublicLanguagesForClient(): Promise<LanguageRegistryPublicListResponse> {
  const now = Date.now();
  if (
    clientLanguagesCache &&
    now - clientLanguagesCache.fetchedAtMs < PUBLIC_LANGUAGES_CLIENT_CACHE_TTL_MS
  ) {
    return clientLanguagesCache.data;
  }

  if (clientLanguagesInFlight) {
    return clientLanguagesInFlight;
  }

  clientLanguagesInFlight = (async () => {
    const data = await fetchPublicLanguagesAuthoritative();
    clientLanguagesCache = { data, fetchedAtMs: Date.now() };
    return data;
  })();

  try {
    return await clientLanguagesInFlight;
  } catch (error) {
    clientLanguagesInFlight = null;
    throw error;
  } finally {
    clientLanguagesInFlight = null;
  }
}

/** Enabled languages only — for selector UI (short-lived client cache). */
export async function listSelectablePublicLanguages(): Promise<
  readonly SelectablePublicLanguage[]
> {
  const data = await fetchPublicLanguagesForClient();
  return data.languages.map(toSelectable);
}

/**
 * Enabled catalog with aliases — for cookie canonicalize / write validation.
 * Always authoritative (Admin enable/disable must apply without Web restart).
 */
export async function loadEnabledPublicLocaleCatalog(): Promise<
  readonly RuntimeLocaleCatalogEntry[]
> {
  const data = await fetchPublicLanguagesAuthoritative();
  return data.languages.map(toCatalogEntry);
}

export function formatLanguageOptionLabel(option: SelectablePublicLanguage): string {
  if (option.nativeName === option.englishName) {
    return option.nativeName;
  }
  return `${option.nativeName} (${option.englishName})`;
}
