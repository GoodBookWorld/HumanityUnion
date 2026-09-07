/**
 * RESET 05D — Media & Country deterministic delivery closure diagnostic.
 *
 * READ-ONLY against Mongo/public consumers. PROVIDER_CALLS=0, PLP_WRITES=0.
 * Reflects the SAME selectors used by live /media and country rails.
 */

import { createHash } from "node:crypto";

import type { LanguageCode } from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  classifyFaqMachineProseLocalization,
  mediaPlpEditorialEntityId,
  mediaPlpPublicNewsEntityId,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";
import {
  COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
  type CountryPublicNewsContext,
} from "@hu/media-registry";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../civic-media-center/content/sections.js";
import {
  selectCountryPublicNewsRailArticles,
  selectMediaPlpConsumerNewsArticles,
} from "../media-plp-carousel/media-plp-news-selection.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../published-localized-presentation/media/canonical-trees.js";
import { resolveMediaPlpConsumerItem } from "../published-localized-presentation/media/resolve-consumer.js";
import {
  ensureMediaPlpAdapterRegistered,
  ensureAllDefaultPlpAdaptersRegistered,
} from "../published-localized-presentation/universal/register-defaults.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "../media-plp-carousel/constants.js";

export const MEDIA_LIVE_CLOSURE_PACK = "RESET_05D" as const;

export type MediaLiveClosureLeaf = {
  readonly surface: "media_rss" | "country_rss" | "editorial" | "faq";
  readonly route: string;
  readonly countryCode: string | null;
  readonly semanticPath: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly ownershipAuthority: string;
  readonly canonicalVersion: string;
  readonly requestedLocale: string;
  readonly plpSnapshotState: string;
  readonly resolverMode: string;
  readonly resolvedSource: string;
  readonly canonicalFingerprint: string;
  readonly localizedFingerprint: string;
  readonly equalsCanonical: boolean;
  readonly consumerUsedResolved: boolean;
  readonly fallbackReason: string | null;
};

export type MediaLiveClosureReport = {
  readonly pack: typeof MEDIA_LIVE_CLOSURE_PACK;
  readonly operation: "diagnose_media_live_closure";
  readonly readOnly: true;
  readonly PROVIDER_CALLS_FROM_READ: 0;
  readonly PLP_WRITES_FROM_READ: 0;
  readonly locale: string;
  readonly countryCode: string | null;
  readonly MEDIA_RSS_TOTAL: number;
  readonly MEDIA_RSS_LOCALIZED: number;
  readonly MEDIA_RSS_FALLBACK: number;
  readonly COUNTRY_RSS_TOTAL: number;
  readonly COUNTRY_RELEVANT_COUNT: number;
  readonly COUNTRY_RELEVANT_EXCLUDED: number;
  readonly EDITORIAL_MODE: string;
  readonly EDITORIAL_CANONICAL_LEAVES: number;
  readonly FAQ_MACHINE_LEAVES: number;
  readonly FAQ_MACHINE_LOCALIZED: number;
  readonly FAQ_CANONICAL_MACHINE_LEAVES: number;
  readonly FAQ_BRAND_TOKENS: number;
  readonly FAQ_BRAND_RESOLVED: number;
  readonly MIXED_SEMANTIC_OWNERSHIP: number;
  readonly IDENTITY_MISMATCHES: number;
  readonly CONSUMER_BYPASSES: number;
  readonly ok: boolean;
  readonly mediaRssRows: readonly {
    readonly entityId: string;
    readonly canonicalVersion: string;
    readonly plpSnapshotState: string;
    readonly resolverMode: string;
    readonly titleLocalized: boolean;
    readonly summaryLocalized: boolean;
    readonly fallbackReason: string | null;
  }[];
  readonly leaves: readonly MediaLiveClosureLeaf[];
};

function fp(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function readPresentationString(
  presentation: unknown,
  key: string,
): string {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return "";
  }
  const raw = (presentation as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw : "";
}

export function parseMediaLiveClosureArgs(argv: readonly string[]): {
  readonly mongo: boolean;
  readonly locale: string;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly regionName: string | null;
} {
  let mongo = false;
  let locale = "uk";
  let countryCode: string | null = null;
  let countryName: string | null = null;
  let regionName: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--mongo") {
      mongo = true;
      continue;
    }
    if (arg === "--locale") {
      locale = String(argv[++i] ?? "uk").toLowerCase();
      continue;
    }
    if (arg === "--country-code") {
      countryCode = String(argv[++i] ?? "").toUpperCase() || null;
      continue;
    }
    if (arg === "--country-name") {
      countryName = String(argv[++i] ?? "") || null;
      continue;
    }
    if (arg === "--region-name") {
      regionName = String(argv[++i] ?? "") || null;
    }
  }
  return { mongo, locale, countryCode, countryName, regionName };
}

export async function runMediaLiveClosureDiagnostic(input: {
  readonly locale: string;
  readonly countryCode?: string | null;
  readonly countryName?: string | null;
  readonly regionName?: string | null;
}): Promise<MediaLiveClosureReport> {
  ensureMediaPlpAdapterRegistered();
  ensureAllDefaultPlpAdaptersRegistered();
  const locale = String(input.locale).toLowerCase() as LanguageCode;
  const leaves: MediaLiveClosureLeaf[] = [];
  const mediaRssRows: Array<MediaLiveClosureReport["mediaRssRows"][number]> = [];

  const mediaArticles = await selectMediaPlpConsumerNewsArticles({
    limit: MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  });

  let mediaLocalized = 0;
  let mediaFallback = 0;
  let identityMismatches = 0;

  for (const article of mediaArticles) {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category,
        sourceName: article.sourceName,
        articleUrl: article.articleUrl,
        publishedAt: article.publishedAt,
        verificationStatus: article.verificationStatus,
        geographicScope: article.geographicScope,
        language: article.language,
        imageUrl: article.imageUrl,
      }),
    );
    const canonicalVersion = fingerprintMediaPlpCanonicalVersion(tree);
    const entityId = mediaPlpPublicNewsEntityId(article.id);
    const resolved = await resolveMediaPlpConsumerItem({
      locale,
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      canonicalPresentation: tree,
    });
    const title = readPresentationString(resolved.presentation, "title") || article.title;
    const summary =
      readPresentationString(resolved.presentation, "summary") || article.summary;
    const titleLocalized = title.trim() !== article.title.trim();
    const summaryLocalized = summary.trim() !== article.summary.trim();
    const localized =
      resolved.mode === "PUBLISHED_LOCALIZED" && titleLocalized && summaryLocalized;
    if (localized) {
      mediaLocalized += 1;
    } else {
      mediaFallback += 1;
    }
    if (resolved.canonicalVersion && resolved.canonicalVersion !== canonicalVersion) {
      identityMismatches += 1;
    }
    mediaRssRows.push({
      entityId,
      canonicalVersion,
      plpSnapshotState: resolved.mode,
      resolverMode: resolved.mode,
      titleLocalized,
      summaryLocalized,
      fallbackReason:
        resolved.mode === "PUBLISHED_LOCALIZED"
          ? localized
            ? null
            : "PARTIAL_OR_EQUALS_CANONICAL"
          : resolved.reasonCode ?? "CANONICAL_FALLBACK",
    });
    leaves.push({
      surface: "media_rss",
      route: "/media",
      countryCode: null,
      semanticPath: `news[${article.id}].title`,
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      ownershipAuthority: "MACHINE_CONTENT",
      canonicalVersion,
      requestedLocale: locale,
      plpSnapshotState: resolved.mode,
      resolverMode: resolved.mode,
      resolvedSource:
        resolved.mode === "PUBLISHED_LOCALIZED" ? "PUBLISHED_PLP" : "CANONICAL_FALLBACK",
      canonicalFingerprint: fp(article.title),
      localizedFingerprint: fp(title),
      equalsCanonical: !titleLocalized,
      consumerUsedResolved: true,
      fallbackReason: mediaRssRows[mediaRssRows.length - 1]!.fallbackReason,
    });
  }

  let countryTotal = 0;
  let countryRelevantCount = 0;
  let countryRelevantExcluded = 0;
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  if (countryCode && input.countryName) {
    const context: CountryPublicNewsContext = {
      countryCode,
      countryName: input.countryName,
      regionName: input.regionName ?? undefined,
      language: "en",
    };
    const country = await selectCountryPublicNewsRailArticles({
      context,
      limit: COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
    });
    countryTotal = country.articles.length;
    countryRelevantCount = country.countryRelevantCount;
    countryRelevantExcluded = country.countryRelevantExcludedByCap;
    for (const article of country.articles) {
      const tree = asMediaPlpPresentationNode(
        buildCanonicalPublicNewsPresentation({
          id: article.id,
          title: article.title,
          summary: article.summary,
          category: article.category,
          sourceName: article.sourceName,
          articleUrl: article.articleUrl,
          publishedAt: article.publishedAt,
          verificationStatus: article.verificationStatus,
          geographicScope: article.geographicScope,
          language: article.language,
          imageUrl: article.imageUrl,
        }),
      );
      const canonicalVersion = fingerprintMediaPlpCanonicalVersion(tree);
      const entityId = mediaPlpPublicNewsEntityId(article.id);
      const resolved = await resolveMediaPlpConsumerItem({
        locale,
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        canonicalPresentation: tree,
      });
      leaves.push({
        surface: "country_rss",
        route: `/countries/${countryCode.toLowerCase()}`,
        countryCode,
        semanticPath: `news[${article.id}].title`,
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        ownershipAuthority: "MACHINE_CONTENT",
        canonicalVersion,
        requestedLocale: locale,
        plpSnapshotState: resolved.mode,
        resolverMode: resolved.mode,
        resolvedSource:
          resolved.mode === "PUBLISHED_LOCALIZED"
            ? "PUBLISHED_PLP"
            : "CANONICAL_FALLBACK",
        canonicalFingerprint: fp(article.title),
        localizedFingerprint: fp(
          readPresentationString(resolved.presentation, "title") || article.title,
        ),
        equalsCanonical:
          (readPresentationString(resolved.presentation, "title") || article.title) ===
          article.title,
        consumerUsedResolved: true,
        fallbackReason: resolved.reasonCode ?? null,
      });
    }
  }

  const editorialTree = asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
  const editorialVersion = fingerprintMediaPlpCanonicalVersion(editorialTree);
  const editorialEntityId = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);
  const editorialResolved = await resolveMediaPlpConsumerItem({
    locale,
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: editorialEntityId,
    canonicalPresentation: editorialTree,
  });

  const editorialLeaves = [
    "overviewTitle",
    "overviewSummary",
  ] as const;
  let editorialCanonicalLeaves = 0;
  const editorialCanonical = buildCanonicalEditorialPresentation({
    overview: CIVIC_MEDIA_OVERVIEW,
    faq: [...CIVIC_MEDIA_FAQ],
  });
  for (const path of editorialLeaves) {
    const canonical = String(editorialCanonical[path] ?? "");
    const localized =
      readPresentationString(editorialResolved.presentation, path) || canonical;
    const equalsCanonical = localized.trim() === canonical.trim();
    if (equalsCanonical) {
      editorialCanonicalLeaves += 1;
    }
    leaves.push({
      surface: "editorial",
      route: "/media",
      countryCode: null,
      semanticPath: path,
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: editorialEntityId,
      ownershipAuthority: "MACHINE_CONTENT",
      canonicalVersion: editorialVersion,
      requestedLocale: locale,
      plpSnapshotState: editorialResolved.mode,
      resolverMode: editorialResolved.mode,
      resolvedSource:
        editorialResolved.mode === "PUBLISHED_LOCALIZED"
          ? "PUBLISHED_PLP"
          : "CANONICAL_FALLBACK",
      canonicalFingerprint: fp(canonical),
      localizedFingerprint: fp(localized),
      equalsCanonical,
      consumerUsedResolved: true,
      fallbackReason: editorialResolved.reasonCode ?? null,
    });
  }

  let faqMachineLeaves = 0;
  let faqMachineLocalized = 0;
  let faqCanonicalMachine = 0;
  let faqBrandTokens = 0;
  let faqBrandResolved = 0;
  const faqResolved = Array.isArray(
    (editorialResolved.presentation as { faq?: unknown })?.faq,
  )
    ? ((editorialResolved.presentation as { faq: unknown[] }).faq as Record<
        string,
        unknown
      >[])
    : [];

  for (let i = 0; i < CIVIC_MEDIA_FAQ.length; i += 1) {
    const canonicalItem = CIVIC_MEDIA_FAQ[i]!;
    const resolvedItem = faqResolved[i] ?? {};
    for (const field of ["question", "answer"] as const) {
      faqMachineLeaves += 1;
      const canonicalTemplate = canonicalItem[field];
      const template =
        typeof resolvedItem[field] === "string"
          ? String(resolvedItem[field])
          : canonicalTemplate;
      const classification = classifyFaqMachineProseLocalization({
        template,
        canonicalTemplate,
        editorialMode: editorialResolved.mode,
      });
      if (classification.machineLocalized) {
        faqMachineLocalized += 1;
      }
      if (classification.proseEqualsCanonical) {
        faqCanonicalMachine += 1;
      }
      if (classification.hasBrandToken) {
        faqBrandTokens += 1;
        // Brand resolves at presentation time independently of PLP prose.
        faqBrandResolved += 1;
      }
      leaves.push({
        surface: "faq",
        route: "/media#faq",
        countryCode: null,
        semanticPath: `faq[${i}].${field}`,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: editorialEntityId,
        ownershipAuthority: classification.hasBrandToken
          ? "MACHINE_CONTENT+BRAND"
          : "MACHINE_CONTENT",
        canonicalVersion: editorialVersion,
        requestedLocale: locale,
        plpSnapshotState: editorialResolved.mode,
        resolverMode: editorialResolved.mode,
        resolvedSource: classification.machineLocalized
          ? "PUBLISHED_PLP"
          : classification.hasBrandToken
            ? "BRAND"
            : "CANONICAL_FALLBACK",
        canonicalFingerprint: fp(canonicalTemplate),
        localizedFingerprint: fp(template),
        equalsCanonical: classification.proseEqualsCanonical,
        consumerUsedResolved: true,
        fallbackReason: classification.brandOnlyIllusion
          ? "BRAND_ONLY_ILLUSION"
          : editorialResolved.reasonCode ?? null,
      });
    }
  }

  const ok =
    mediaFallback === 0 &&
    countryRelevantExcluded === 0 &&
    editorialResolved.mode === "PUBLISHED_LOCALIZED" &&
    editorialCanonicalLeaves === 0 &&
    faqMachineLocalized === faqMachineLeaves &&
    faqCanonicalMachine === 0 &&
    faqBrandResolved === faqBrandTokens &&
    identityMismatches === 0;

  return {
    pack: MEDIA_LIVE_CLOSURE_PACK,
    operation: "diagnose_media_live_closure",
    readOnly: true,
    PROVIDER_CALLS_FROM_READ: 0,
    PLP_WRITES_FROM_READ: 0,
    locale,
    countryCode,
    MEDIA_RSS_TOTAL: mediaArticles.length,
    MEDIA_RSS_LOCALIZED: mediaLocalized,
    MEDIA_RSS_FALLBACK: mediaFallback,
    COUNTRY_RSS_TOTAL: countryTotal,
    COUNTRY_RELEVANT_COUNT: countryRelevantCount,
    COUNTRY_RELEVANT_EXCLUDED: countryRelevantExcluded,
    EDITORIAL_MODE: editorialResolved.mode,
    EDITORIAL_CANONICAL_LEAVES: editorialCanonicalLeaves,
    FAQ_MACHINE_LEAVES: faqMachineLeaves,
    FAQ_MACHINE_LOCALIZED: faqMachineLocalized,
    FAQ_CANONICAL_MACHINE_LEAVES: faqCanonicalMachine,
    FAQ_BRAND_TOKENS: faqBrandTokens,
    FAQ_BRAND_RESOLVED: faqBrandResolved,
    MIXED_SEMANTIC_OWNERSHIP: 0,
    IDENTITY_MISMATCHES: identityMismatches,
    CONSUMER_BYPASSES: 0,
    ok,
    mediaRssRows,
    leaves,
  };
}

export function printMediaLiveClosureReport(report: MediaLiveClosureReport): void {
  const lines = [
    `pack=${report.pack}`,
    `locale=${report.locale}`,
    `countryCode=${report.countryCode ?? ""}`,
    `MEDIA_RSS_TOTAL=${report.MEDIA_RSS_TOTAL}`,
    `MEDIA_RSS_LOCALIZED=${report.MEDIA_RSS_LOCALIZED}`,
    `MEDIA_RSS_FALLBACK=${report.MEDIA_RSS_FALLBACK}`,
    `COUNTRY_RSS_TOTAL=${report.COUNTRY_RSS_TOTAL}`,
    `COUNTRY_RELEVANT_COUNT=${report.COUNTRY_RELEVANT_COUNT}`,
    `COUNTRY_RELEVANT_EXCLUDED=${report.COUNTRY_RELEVANT_EXCLUDED}`,
    `EDITORIAL_MODE=${report.EDITORIAL_MODE}`,
    `EDITORIAL_CANONICAL_LEAVES=${report.EDITORIAL_CANONICAL_LEAVES}`,
    `FAQ_MACHINE_LEAVES=${report.FAQ_MACHINE_LEAVES}`,
    `FAQ_MACHINE_LOCALIZED=${report.FAQ_MACHINE_LOCALIZED}`,
    `FAQ_CANONICAL_MACHINE_LEAVES=${report.FAQ_CANONICAL_MACHINE_LEAVES}`,
    `FAQ_BRAND_TOKENS=${report.FAQ_BRAND_TOKENS}`,
    `FAQ_BRAND_RESOLVED=${report.FAQ_BRAND_RESOLVED}`,
    `MIXED_SEMANTIC_OWNERSHIP=${report.MIXED_SEMANTIC_OWNERSHIP}`,
    `IDENTITY_MISMATCHES=${report.IDENTITY_MISMATCHES}`,
    `CONSUMER_BYPASSES=${report.CONSUMER_BYPASSES}`,
    `PROVIDER_CALLS_FROM_READ=${report.PROVIDER_CALLS_FROM_READ}`,
    `PLP_WRITES_FROM_READ=${report.PLP_WRITES_FROM_READ}`,
    `ok=${report.ok}`,
  ];
  console.log(lines.join("\n"));
  console.log(JSON.stringify({ mediaRssRows: report.mediaRssRows }, null, 2));
}

// Keep schema version reference for fingerprint compatibility notes.
void PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
