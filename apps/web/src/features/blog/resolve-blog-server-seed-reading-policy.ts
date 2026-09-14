/**
 * Pack 08I.10 — server reading policy for Blog article SSR seeds.
 * Guest / unknown → document locale + prefer translation.
 * Authenticated explicit `none` → canonical seed only (no warm overlay).
 * Authenticated preferred → readingLanguages[0] when present.
 */
import type { LanguageCode, MemberPreferences } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";
import { cookies } from "next/headers";

import { API_BASE_URL } from "../../lib/api-base-url";
import { deriveAuthenticatedReadingLanguage } from "../language/public-content-reading-language";
import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale";

export interface BlogServerSeedReadingPolicy {
  readonly language: string;
  readonly preferTranslation: boolean;
}

async function tryLoadAuthenticatedPreferences(): Promise<MemberPreferences | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((entry) => `${entry.name}=${entry.value}`)
      .join("; ");

    const response = await fetch(`${API_BASE_URL}/api/v1/preferences/me`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      signal: AbortSignal.timeout(2_500),
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }
    if (!response.ok) {
      return null;
    }

    const envelope = (await response.json()) as {
      success?: boolean;
      data?: MemberPreferences;
    };
    return envelope.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve language + whether SSR Blog seed may overlay warm translations.
 */
export async function resolveBlogServerSeedReadingPolicy(): Promise<BlogServerSeedReadingPolicy> {
  const documentLocale = await resolveDocumentHtmlLocale();
  const preferences = await tryLoadAuthenticatedPreferences();

  if (!preferences) {
    return {
      language: documentLocale.locale,
      preferTranslation: true,
    };
  }

  const experience = preferences.experiencePreferences;
  const preference = experience.translationPreference || "none";
  if (preference === "none") {
    return {
      language: documentLocale.locale,
      preferTranslation: false,
    };
  }

  const readingLanguage = deriveAuthenticatedReadingLanguage(experience.readingLanguages);
  return {
    language: (readingLanguage || documentLocale.locale || DEFAULT_PLATFORM_LANGUAGE) as LanguageCode,
    preferTranslation: true,
  };
}
