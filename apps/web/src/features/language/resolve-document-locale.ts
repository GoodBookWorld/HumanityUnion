/**
 * Production Completion Pack 02C Task 02 — server document locale resolution.
 *
 * Uses the shared `@hu/types` catalog resolver (same precedence as API).
 * Does not use legacy base-tag collapse helpers for html lang/dir.
 *
 * Authenticated Participant interfaceLanguage is applied on API requests via
 * `runtimeLocaleMiddleware`. Web SSR cannot read API host-only auth cookies,
 * so HTML uses cookie + Accept-Language against the enabled public catalog.
 */

import {
  ENGLISH_RUNTIME_LOCALE_FALLBACK,
  HU_LANG_COOKIE_NAME,
  resolveRuntimeLocaleFromCatalog,
  type LanguageRegistryPublicListResponse,
  type ResolvedRuntimeLocale,
  type RuntimeLocaleCatalogEntry,
} from "@hu/types";
import { cookies, headers } from "next/headers";

import { API_BASE_URL } from "../../lib/api-base-url";

const ENGLISH_ONLY_CATALOG: readonly RuntimeLocaleCatalogEntry[] = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr",
    aliases: [],
  },
];

async function fetchEnabledLocaleCatalog(): Promise<readonly RuntimeLocaleCatalogEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/languages`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) {
      return ENGLISH_ONLY_CATALOG;
    }
    const envelope = (await response.json()) as {
      success?: boolean;
      data?: LanguageRegistryPublicListResponse;
    };
    const languages = envelope.data?.languages;
    if (!Array.isArray(languages) || languages.length === 0) {
      return ENGLISH_ONLY_CATALOG;
    }
    return languages.map((row) => ({
      languageId: row.languageId,
      locale: row.locale,
      textDirection: row.textDirection,
      aliases: [...row.aliases],
    }));
  } catch {
    return ENGLISH_ONLY_CATALOG;
  }
}

/**
 * Resolve document locale for the current Next.js request (server-only).
 * Pure catalog precedence — resolved on the server before paint.
 */
export async function resolveDocumentHtmlLocale(
  overrides?: {
    readonly huLangCookie?: string | null;
    readonly acceptLanguageHeader?: string | null;
    readonly catalog?: readonly RuntimeLocaleCatalogEntry[];
    readonly authenticated?: boolean;
    readonly participantInterfaceLanguage?: string | null;
  },
): Promise<ResolvedRuntimeLocale> {
  const catalog = overrides?.catalog ?? (await fetchEnabledLocaleCatalog());

  let huLangCookie = overrides?.huLangCookie ?? null;
  let acceptLanguageHeader = overrides?.acceptLanguageHeader ?? null;

  if (overrides?.huLangCookie === undefined || overrides?.acceptLanguageHeader === undefined) {
    try {
      if (overrides?.huLangCookie === undefined) {
        const cookieStore = await cookies();
        huLangCookie = cookieStore.get(HU_LANG_COOKIE_NAME)?.value ?? null;
      }
      if (overrides?.acceptLanguageHeader === undefined) {
        const headerStore = await headers();
        acceptLanguageHeader = headerStore.get("accept-language");
      }
    } catch {
      // Outside a request context (tests / build) — keep overrides / nulls.
    }
  }

  return resolveRuntimeLocaleFromCatalog(
    {
      authenticated: overrides?.authenticated === true,
      participantInterfaceLanguage: overrides?.participantInterfaceLanguage ?? null,
      huLangCookie,
      acceptLanguageHeader,
    },
    catalog,
  );
}

export function englishDocumentLocaleFallback(): ResolvedRuntimeLocale {
  return ENGLISH_RUNTIME_LOCALE_FALLBACK;
}
