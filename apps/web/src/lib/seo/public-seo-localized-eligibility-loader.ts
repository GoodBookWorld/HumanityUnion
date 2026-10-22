/**
 * Loads page-specific localized SEO evidence from existing public resolvers.
 * Does not enqueue translation, mutate Registry flags, or invent a Knowledge body owner.
 *
 * Each page family fetches only the evidence its eligibility rule reads.
 * Identical in-flight fetches are shared process-wide and capped at 8 active
 * requests. Settled results are not cached.
 */

import {
  CANONICAL_LEGAL_SOURCE_VERSIONS,
  type ContentTranslationSourceKind,
  type LegalDocumentType,
} from "@hu/types";

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
import { runSeoEvidenceFetch } from "./seo-evidence-fetch-gate";
import { withSeoEligibilityOperation } from "../system-health/web-memory-sampler";
import { normalizeCanonicalPath } from "./public-site-url";

const RESOLVE_TIMEOUT_MS = 2_500;

const EVIDENCE_FIELDS = [
  "webUiPublished",
  "brandPublishedForLocale",
  "legalPrivacyPublished",
  "legalTermsPublished",
  "civicMediaCurrent",
  "entityCurrent",
] as const;

type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

type ChromeEvidence = Omit<PublicSeoLocalizedPageEvidence, "entityCurrent">;

type EvidenceDemand = {
  readonly webUi: boolean;
  readonly brand: boolean;
  readonly privacy: boolean;
  readonly terms: boolean;
  readonly civicMedia: boolean;
  readonly entityPaths: readonly string[];
};

function emptyChrome(): ChromeEvidence {
  return {
    webUiPublished: false,
    brandPublishedForLocale: false,
    legalPrivacyPublished: false,
    legalTermsPublished: false,
    civicMediaCurrent: false,
  };
}

function positiveEvidence(): PublicSeoLocalizedPageEvidence {
  return {
    webUiPublished: true,
    brandPublishedForLocale: true,
    legalPrivacyPublished: true,
    legalTermsPublished: true,
    civicMediaCurrent: true,
    entityCurrent: true,
  };
}

/**
 * Fields whose absence flips an otherwise eligible page to ineligible.
 * Knowledge articles and unsupported paths stay empty: full evidence is still false.
 * Current rules are single-field or conjunctions, so this matches the predicate.
 */
function requiredEvidenceFields(localeFreePath: string): ReadonlySet<EvidenceField> {
  const enabled = positiveEvidence();
  const required = new Set<EvidenceField>();
  if (
    !isPublicSeoLocalizedVariantEligible({
      localeFreePath,
      evidence: enabled,
    })
  ) {
    return required;
  }
  for (const field of EVIDENCE_FIELDS) {
    const disabled: PublicSeoLocalizedPageEvidence = { ...enabled, [field]: false };
    if (
      !isPublicSeoLocalizedVariantEligible({
        localeFreePath,
        evidence: disabled,
      })
    ) {
      required.add(field);
    }
  }
  return required;
}

function demandForPaths(paths: readonly string[]): EvidenceDemand {
  let webUi = false;
  let brand = false;
  let privacy = false;
  let terms = false;
  let civicMedia = false;
  const entityPaths: string[] = [];

  for (const path of paths) {
    const required = requiredEvidenceFields(path);
    webUi = webUi || required.has("webUiPublished");
    brand = brand || required.has("brandPublishedForLocale");
    privacy = privacy || required.has("legalPrivacyPublished");
    terms = terms || required.has("legalTermsPublished");
    civicMedia = civicMedia || required.has("civicMediaCurrent");
    if (required.has("entityCurrent")) {
      entityPaths.push(path);
    }
  }

  return { webUi, brand, privacy, terms, civicMedia, entityPaths };
}

function evidenceKey(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

async function publishedWebUi(locale: string): Promise<boolean> {
  const tag = locale.trim();
  if (!tag || tag === "en") {
    return false;
  }
  return runSeoEvidenceFetch(evidenceKey(["web-ui", tag, API_BASE_URL]), async () => {
    try {
      const pack = await loadRemoteUiMessagePack(tag);
      if (!pack?.messages || typeof pack.messages !== "object") {
        return false;
      }
      return Object.keys(pack.messages).length > 0;
    } catch {
      return false;
    }
  });
}

async function brandPublished(locale: string): Promise<boolean> {
  const tag = locale.trim();
  if (!tag) {
    return false;
  }
  return runSeoEvidenceFetch(evidenceKey(["brand", tag, API_BASE_URL]), async () => {
    try {
      const brand = await resolveLocalizedBrandForLocale(tag);
      return brand?.source === "published_locale";
    } catch {
      return false;
    }
  });
}

async function legalPublished(
  documentType: LegalDocumentType,
  locale: string,
): Promise<boolean> {
  const tag = locale.trim();
  if (!tag) {
    return false;
  }
  return runSeoEvidenceFetch(
    evidenceKey([
      "legal",
      documentType,
      tag,
      CANONICAL_LEGAL_SOURCE_VERSIONS[documentType],
      API_BASE_URL,
    ]),
    async () => {
      try {
        const document = await resolveLocalizedLegalBody(documentType, tag);
        return (
          document?.source === "published_locale" &&
          document.isStaleRelativeToCanonical !== true &&
          Boolean(document.localizedBodyHtml?.trim())
        );
      } catch {
        return false;
      }
    },
  );
}

async function presentationCurrent(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly locale: string;
}): Promise<boolean> {
  const locale = input.locale.trim();
  if (!locale || !input.sourceRecordId) {
    return false;
  }
  return runSeoEvidenceFetch(
    evidenceKey([
      "presentation",
      input.sourceKind,
      input.sourceRecordId,
      locale,
      API_BASE_URL,
    ]),
    async () => {
      try {
        const url =
          `${API_BASE_URL}/api/v1/translations/resolve/${input.sourceKind}/` +
          `${encodeURIComponent(input.sourceRecordId)}?language=${encodeURIComponent(locale)}`;
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
    },
  );
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
  return withSeoEligibilityOperation(() => buildPublicSeoLocalizedVariantPredicateUncounted(input));
}

async function buildPublicSeoLocalizedVariantPredicateUncounted(input: {
  readonly localeFreePaths: readonly string[];
  readonly locales: readonly string[];
}): Promise<(localeFreePath: string, locale: string) => boolean> {
  const locales = [...new Set(input.locales.map((locale) => locale.trim()).filter(Boolean))];
  const paths = [
    ...new Set(input.localeFreePaths.map((path) => normalizeCanonicalPath(path))),
  ];
  const demand = demandForPaths(paths);

  const chromeByLocale = new Map<string, ChromeEvidence>();
  const entityKeys = new Map<string, boolean>();
  const jobs: Promise<void>[] = [];

  for (const locale of locales) {
    jobs.push(
      (async () => {
        const [webUiPublished, brandPublishedForLocale, legalPrivacyPublished, legalTermsPublished, civicMediaCurrent] =
          await Promise.all([
            demand.webUi ? publishedWebUi(locale) : Promise.resolve(false),
            demand.brand ? brandPublished(locale) : Promise.resolve(false),
            demand.privacy ? legalPublished("privacy", locale) : Promise.resolve(false),
            demand.terms ? legalPublished("terms", locale) : Promise.resolve(false),
            demand.civicMedia
              ? presentationCurrent({
                  sourceKind: "civic_media",
                  sourceRecordId: CIVIC_MEDIA_RECORD_ID,
                  locale,
                })
              : Promise.resolve(false),
          ]);
        chromeByLocale.set(locale, {
          webUiPublished,
          brandPublishedForLocale,
          legalPrivacyPublished,
          legalTermsPublished,
          civicMediaCurrent,
        });
      })().catch(() => {
        chromeByLocale.set(locale, emptyChrome());
      }),
    );

    for (const path of demand.entityPaths) {
      const identity = entityIdentity(path);
      const key = `${locale}\n${path}`;
      if (!identity) {
        entityKeys.set(key, false);
        continue;
      }
      jobs.push(
        presentationCurrent({ ...identity, locale })
          .then((current) => {
            entityKeys.set(key, current);
          })
          .catch(() => {
            entityKeys.set(key, false);
          }),
      );
    }
  }

  await Promise.all(jobs);

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
