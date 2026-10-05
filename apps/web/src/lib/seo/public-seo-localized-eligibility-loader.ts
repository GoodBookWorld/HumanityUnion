/**
 * Loads page-specific localized SEO evidence from existing public resolvers.
 * Does not enqueue translation, mutate Registry flags, or invent a Knowledge body owner.
 */

import type { ContentTranslationSourceKind } from "@hu/types";

import { API_BASE_URL } from "../api-base-url";
import { CIVIC_MEDIA_RECORD_ID } from "../../features/civic-media-center/civic-media-canonical-editorial";
import { resolveLocalizedBrandForLocale } from "../../features/brand-localization/resolve-localized-brand";
import { loadRemoteUiMessagePack } from "../../features/i18n/remote-ui-message-pack-source";
import { resolveLocalizedLegalBody } from "../../features/legal/resolve-localized-legal-body";
import {
  classifyPublicSeoLocalizedPageFamily,
  isPublicSeoLocalizedVariantEligible,
  type PublicSeoLocalizedPageEvidence,
} from "./public-seo-localized-eligibility";
import { normalizeCanonicalPath } from "./public-site-url";

const RESOLVE_TIMEOUT_MS = 2_500;

type ChromeEvidence = Omit<PublicSeoLocalizedPageEvidence, "entityCurrent">;

function emptyChrome(): ChromeEvidence {
  return {
    webUiPublished: false,
    brandPublishedForLocale: false,
    legalPrivacyPublished: false,
    legalTermsPublished: false,
    civicMediaCurrent: false,
  };
}

async function publishedWebUi(locale: string): Promise<boolean> {
  try {
    const pack = await loadRemoteUiMessagePack(locale);
    if (!pack?.messages || typeof pack.messages !== "object") {
      return false;
    }
    return Object.keys(pack.messages).length > 0;
  } catch {
    return false;
  }
}

async function presentationCurrent(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly locale: string;
}): Promise<boolean> {
  try {
    const url =
      `${API_BASE_URL}/api/v1/translations/resolve/${input.sourceKind}/` +
      `${encodeURIComponent(input.sourceRecordId)}?language=${encodeURIComponent(input.locale)}`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return false;
    }
    const envelope = (await response.json()) as {
      data?: { presentationMode?: string; isStale?: boolean };
    };
    const data = envelope.data;
    return data?.presentationMode === "preferred_translation" && data.isStale !== true;
  } catch {
    return false;
  }
}

async function loadChromeEvidence(locale: string): Promise<ChromeEvidence> {
  const [webUiPublished, brand, privacy, terms, civicMediaCurrent] = await Promise.all([
    publishedWebUi(locale),
    resolveLocalizedBrandForLocale(locale).catch(() => null),
    resolveLocalizedLegalBody("privacy", locale).catch(() => null),
    resolveLocalizedLegalBody("terms", locale).catch(() => null),
    presentationCurrent({
      sourceKind: "civic_media",
      sourceRecordId: CIVIC_MEDIA_RECORD_ID,
      locale,
    }),
  ]);

  return {
    webUiPublished,
    brandPublishedForLocale: brand?.source === "published_locale",
    legalPrivacyPublished:
      privacy?.source === "published_locale" &&
      privacy.isStaleRelativeToCanonical !== true &&
      Boolean(privacy.localizedBodyHtml?.trim()),
    legalTermsPublished:
      terms?.source === "published_locale" &&
      terms.isStaleRelativeToCanonical !== true &&
      Boolean(terms.localizedBodyHtml?.trim()),
    civicMediaCurrent,
  };
}

function entityIdentity(
  localeFreePath: string,
): { sourceKind: ContentTranslationSourceKind; sourceRecordId: string } | null {
  const family = classifyPublicSeoLocalizedPageFamily(localeFreePath);
  if (family === "initiative_detail") {
    const id = localeFreePath.slice("/initiatives/public/".length);
    return id ? { sourceKind: "initiative", sourceRecordId: id } : null;
  }
  if (family === "blog_post") {
    const slug = localeFreePath.slice("/blog/".length);
    return slug ? { sourceKind: "blog_post", sourceRecordId: slug } : null;
  }
  return null;
}

/**
 * Sync predicate after one evidence pass. Missing evidence is not eligible.
 * Safe to call for paths outside the SEO perimeter (always false).
 */
export async function buildPublicSeoLocalizedVariantPredicate(input: {
  readonly localeFreePaths: readonly string[];
  readonly locales: readonly string[];
}): Promise<(localeFreePath: string, locale: string) => boolean> {
  const locales = [...new Set(input.locales.map((locale) => locale.trim()).filter(Boolean))];
  const paths = [
    ...new Set(input.localeFreePaths.map((path) => normalizeCanonicalPath(path))),
  ];

  const chromeByLocale = new Map<string, ChromeEvidence>();
  await Promise.all(
    locales.map(async (locale) => {
      chromeByLocale.set(locale, await loadChromeEvidence(locale).catch(() => emptyChrome()));
    }),
  );

  const entityKeys = new Map<string, boolean>();
  const entityJobs: Promise<void>[] = [];
  for (const path of paths) {
    const identity = entityIdentity(path);
    if (!identity) {
      continue;
    }
    for (const locale of locales) {
      const key = `${locale}\n${path}`;
      entityJobs.push(
        presentationCurrent({ ...identity, locale }).then((current) => {
          entityKeys.set(key, current);
        }),
      );
    }
  }
  await Promise.all(entityJobs);

  const decisions = new Map<string, boolean>();
  for (const path of paths) {
    for (const locale of locales) {
      const chrome = chromeByLocale.get(locale) ?? emptyChrome();
      const eligible = isPublicSeoLocalizedVariantEligible({
        localeFreePath: path,
        evidence: {
          ...chrome,
          entityCurrent: entityKeys.get(`${locale}\n${path}`) === true,
        },
      });
      decisions.set(`${locale}\n${path}`, eligible);
    }
  }

  return (localeFreePath: string, locale: string) =>
    decisions.get(`${locale.trim()}\n${normalizeCanonicalPath(localeFreePath)}`) === true;
}
