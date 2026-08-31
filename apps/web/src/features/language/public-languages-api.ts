/**
 * Production Completion Pack 02C Task 03 — public Language Registry client.
 *
 * Task 04: shared in-flight cache avoids duplicate client fetches when multiple
 * selectors / sync helpers resolve in the same session window.
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

let publicLanguagesInFlight: Promise<LanguageRegistryPublicListResponse> | null = null;
let publicLanguagesCache: LanguageRegistryPublicListResponse | null = null;

/** Test-only — clear client language list cache. */
export function resetPublicLanguagesCacheForTests(): void {
  publicLanguagesInFlight = null;
  publicLanguagesCache = null;
}

async function fetchPublicLanguagesEnvelope(): Promise<LanguageRegistryPublicListResponse> {
  if (publicLanguagesCache) {
    return publicLanguagesCache;
  }

  if (publicLanguagesInFlight) {
    return publicLanguagesInFlight;
  }

  publicLanguagesInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error("Unable to load languages.");
    }

    const envelope = (await response.json()) as {
      success?: boolean;
      data?: LanguageRegistryPublicListResponse;
    };

    if (!envelope.data?.languages || !Array.isArray(envelope.data.languages)) {
      throw new Error("Languages response was invalid.");
    }

    publicLanguagesCache = envelope.data;
    return envelope.data;
  })();

  try {
    return await publicLanguagesInFlight;
  } catch (error) {
    publicLanguagesInFlight = null;
    throw error;
  } finally {
    publicLanguagesInFlight = null;
  }
}

/** Enabled languages only — for selector UI. */
export async function listSelectablePublicLanguages(): Promise<
  readonly SelectablePublicLanguage[]
> {
  const data = await fetchPublicLanguagesEnvelope();
  return data.languages.map(toSelectable);
}

/** Enabled catalog with aliases — for cookie canonicalize / SSR helpers. */
export async function loadEnabledPublicLocaleCatalog(): Promise<
  readonly RuntimeLocaleCatalogEntry[]
> {
  const data = await fetchPublicLanguagesEnvelope();
  return data.languages.map(toCatalogEntry);
}

export function formatLanguageOptionLabel(option: SelectablePublicLanguage): string {
  if (option.nativeName === option.englishName) {
    return option.nativeName;
  }
  return `${option.nativeName} (${option.englishName})`;
}
