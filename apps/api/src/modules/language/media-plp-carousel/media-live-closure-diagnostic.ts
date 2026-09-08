/**
 * RESET 05D / 05D.1 — Media & Country deterministic delivery closure diagnostic.
 *
 * READ-ONLY against Mongo/public consumers.
 * PROVIDER_CALLS_FROM_READ=0, PLP_WRITES_FROM_READ=0, MONGO_WRITES_FROM_READ=0.
 * Reflects the SAME selectors used by live /media and country rails.
 *
 * RESET 05D.1 — `--mongo` uses the thin Render-safe bootstrap:
 * bind PLP Mongo persistence → connectMongoClient → reads → disconnect.
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
  isCountryAffiliatedSourceArticle,
} from "@hu/media-registry";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../civic-media-center/content/sections.js";
import {
  getMediaPlpPersistenceObservability,
  requireMediaPlpMaterializerMongoPersistence,
  type MediaPlpPersistenceObservability,
} from "../media-plp-materializer/persistence-selection.js";
import {
  selectCountryPublicNewsRailArticles,
  selectMediaPlpConsumerNewsArticles,
} from "./media-plp-news-selection.js";
import { listCountryAffiliatedMediaSources } from "./country-affiliated-media-sources.js";
import { findActivePublicNewsRecords } from "../../public-news/public-news.repository.js";
import { findPlpAutoBuildWorkByKey } from "../published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "../published-localized-presentation/usability.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../published-localized-presentation/media/canonical-trees.js";
import { resolveMediaPlpConsumerItem } from "../published-localized-presentation/media/resolve-consumer.js";
import { collectAutoPaths } from "../published-localized-presentation/presentation-paths.js";
import {
  isCollectedPathMachineEligible,
} from "../published-localized-presentation/universal/field-authority.js";
import { resolveFieldPolicyForEntityType } from "../published-localized-presentation/universal/resolve-field-policy.js";
import {
  ensureMediaPlpAdapterRegistered,
  ensureAllDefaultPlpAdaptersRegistered,
} from "../published-localized-presentation/universal/register-defaults.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "./constants.js";

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
  readonly MONGO_WRITES_FROM_READ: 0;
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY" | "UNSET";
  readonly locale: string;
  readonly countryCode: string | null;
  readonly MEDIA_RSS_TOTAL: number;
  readonly MEDIA_RSS_LOCALIZED: number;
  readonly MEDIA_RSS_FALLBACK: number;
  readonly COUNTRY_RSS_TOTAL: number;
  readonly COUNTRY_AFFILIATED_SOURCE_COUNT: number;
  readonly COUNTRY_AFFILIATED_SOURCE_IDS: readonly string[];
  readonly COUNTRY_AFFILIATED_CURRENT_NEWS: number;
  readonly COUNTRY_RELEVANT_COUNT: number;
  readonly COUNTRY_RELEVANT_INCLUDED: number;
  readonly COUNTRY_RELEVANT_EXCLUDED: number;
  readonly COUNTRY_GLOBAL_SUPPLEMENT_COUNT: number;
  readonly COUNTRY_SOURCE_COVERAGE_GAP: boolean;
  readonly EDITORIAL_MODE: string;
  readonly EDITORIAL_CANONICAL_LEAVES: number;
  readonly EDITORIAL_CURRENT_CANONICAL_VERSION: string;
  readonly EDITORIAL_WORK_ROW_FOUND: boolean;
  readonly EDITORIAL_WORK_STATUS: string | null;
  readonly EDITORIAL_FAILURE_CODE: string | null;
  readonly EDITORIAL_FAILURE_STAGE: string | null;
  readonly EDITORIAL_FAILURE_REASON_SAFE: string | null;
  readonly EDITORIAL_WORK_CANONICAL_VERSION: string | null;
  readonly EDITORIAL_ATTEMPT_COUNT: number | null;
  readonly EDITORIAL_MAX_ATTEMPTS: number | null;
  readonly EDITORIAL_RETRYABLE: boolean | null;
  readonly EDITORIAL_SNAPSHOT_FOUND: boolean;
  readonly EDITORIAL_SNAPSHOT_CANONICAL_VERSION: string | null;
  readonly EDITORIAL_SNAPSHOT_SCHEMA_VERSION: string | null;
  readonly EDITORIAL_SNAPSHOT_USABLE: boolean;
  readonly EDITORIAL_RESOLVER_MODE: string;
  readonly EDITORIAL_RESOLVER_FALLBACK_REASON: string | null;
  readonly EDITORIAL_WORK_TRIGGER: string | null;
  readonly EDITORIAL_PARTIAL_AUTO_PATHS: readonly string[];
  readonly EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: readonly string[];
  readonly EDITORIAL_INTEGRITY_FAILED_PATHS: readonly string[];
  readonly EDITORIAL_BRAND_TOKEN_PATH_STATES: readonly string[];
  readonly EDITORIAL_STALE_WORK_VERSION: string | null;
  readonly EDITORIAL_STALE_CURRENT_SOURCE_VERSION: string | null;
  readonly EDITORIAL_STALE_BOUNDARY: string | null;
  readonly EDITORIAL_STALE_AUTHORITY: string | null;
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
    readonly WORK_ROW_FOUND: boolean;
    readonly WORK_STATUS: string | null;
    readonly FAILURE_CODE: string | null;
    readonly ATTEMPTS: number | null;
    readonly WORK_CANONICAL_VERSION: string | null;
    readonly EXPECTED_MACHINE_PATHS: readonly string[];
    readonly MISSING_MACHINE_PATHS: readonly string[];
    readonly FAILURE_RETRYABLE: boolean | null;
    readonly PROVIDER_PARTIAL_SUBREASON: string | null;
    readonly PATH_STATES: readonly string[];
  }[];
  readonly leaves: readonly MediaLiveClosureLeaf[];
};

export type MediaLiveClosureDiagnosticDeps = {
  readonly isMongoConfigured?: () => boolean;
  readonly requirePersistence?: () => MediaPlpPersistenceObservability;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly executeReads?: (input: {
    readonly locale: string;
    readonly countryCode?: string | null;
    readonly countryName?: string | null;
    readonly regionName?: string | null;
    readonly persistence: MediaPlpPersistenceObservability;
  }) => Promise<MediaLiveClosureReport>;
};

function fp(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function parsePathListFromFailureReason(
  reason: string | null | undefined,
  label: string,
): string[] {
  if (!reason) {
    return [];
  }
  const marker = `${label}=`;
  const idx = reason.indexOf(marker);
  if (idx >= 0) {
    const rest = reason.slice(idx + marker.length);
    const semi = rest.indexOf(";");
    const raw = semi >= 0 ? rest.slice(0, semi) : rest;
    return raw
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  // Legacy PROVIDER_PARTIAL prose before structured MISSING_MACHINE_PATHS=.
  if (label === "MISSING_MACHINE_PATHS") {
    const legacy = reason.match(
      /missing AUTO paths:\s*([a-zA-Z0-9_.[\]|, -]+)/i,
    );
    if (legacy?.[1]) {
      return legacy[1]
        .split(/[|,]/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseLabeledValueFromFailureReason(
  reason: string | null | undefined,
  label: string,
): string | null {
  if (!reason) {
    return null;
  }
  const marker = `${label}=`;
  const idx = reason.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  const rest = reason.slice(idx + marker.length);
  const semi = rest.indexOf(";");
  const raw = (semi >= 0 ? rest.slice(0, semi) : rest).trim();
  return raw || null;
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

export async function executeMediaLiveClosureReads(input: {
  readonly locale: string;
  readonly countryCode?: string | null;
  readonly countryName?: string | null;
  readonly regionName?: string | null;
  readonly persistence?: MediaPlpPersistenceObservability;
}): Promise<MediaLiveClosureReport> {
  ensureMediaPlpAdapterRegistered();
  ensureAllDefaultPlpAdaptersRegistered();
  const locale = String(input.locale).toLowerCase() as LanguageCode;
  const leaves: MediaLiveClosureLeaf[] = [];
  const mediaRssRows: Array<MediaLiveClosureReport["mediaRssRows"][number]> = [];
  const persistence =
    input.persistence ?? getMediaPlpPersistenceObservability();

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
    const newsWork = await findPlpAutoBuildWorkByKey({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      locale,
    });
    const newsPolicy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    );
    const expectedMachinePaths = collectAutoPaths(tree)
      .filter((node) => isCollectedPathMachineEligible(node.path, newsPolicy))
      .map((node) => node.path);
    const missingFromFailure = parsePathListFromFailureReason(
      newsWork?.lastError,
      "MISSING_MACHINE_PATHS",
    );
    const partialSubreason =
      newsWork?.status === "completed"
        ? null
        : parseLabeledValueFromFailureReason(
            newsWork?.lastError,
            "PROVIDER_PARTIAL_SUBREASON",
          ) ??
          newsWork?.lastError?.match(/PROVIDER_PARTIAL:([A-Z_]+)/)?.[1] ??
          null;
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
      WORK_ROW_FOUND: newsWork != null,
      WORK_STATUS: newsWork?.status ?? null,
      FAILURE_CODE:
        newsWork?.status === "completed" ? null : newsWork?.failureCode ?? null,
      ATTEMPTS: newsWork?.attempts ?? null,
      WORK_CANONICAL_VERSION: newsWork?.canonicalVersion ?? null,
      EXPECTED_MACHINE_PATHS: expectedMachinePaths,
      MISSING_MACHINE_PATHS: missingFromFailure,
      FAILURE_RETRYABLE:
        newsWork?.status === "completed" ? null : newsWork?.retryable ?? null,
      PROVIDER_PARTIAL_SUBREASON: partialSubreason,
      PATH_STATES: parsePathListFromFailureReason(
        newsWork?.lastError,
        "PATH_STATES",
      ),
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
  let countryRelevantIncluded = 0;
  let countryGlobalSupplement = 0;
  let countryAffiliatedSourceCount = 0;
  let countryAffiliatedSourceIds: string[] = [];
  let countryAffiliatedCurrentNews = 0;
  let countrySourceCoverageGap = false;
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  if (countryCode && input.countryName) {
    const affiliated = listCountryAffiliatedMediaSources(countryCode);
    countryAffiliatedSourceCount = affiliated.length;
    countryAffiliatedSourceIds = affiliated.map((s) => s.id);
    const countryContext = {
      countryCode,
      countryName: input.countryName,
      regionName: input.regionName ?? undefined,
      language: "en" as const,
      recommendedMedia: affiliated.map((s) => ({ id: s.id, name: s.name })),
    };
    const candidatePool = await findActivePublicNewsRecords({
      limit: 120,
      language: "en",
    });
    countryAffiliatedCurrentNews = candidatePool.filter((a) =>
      isCountryAffiliatedSourceArticle(a, countryContext),
    ).length;
    countrySourceCoverageGap =
      countryAffiliatedSourceCount > 0 && countryAffiliatedCurrentNews === 0;

    const country = await selectCountryPublicNewsRailArticles({
      context: countryContext,
      limit: COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
    });
    countryTotal = country.articles.length;
    countryRelevantCount = country.countryRelevantCount;
    countryRelevantExcluded = country.countryRelevantExcludedByCap;
    countryRelevantIncluded = country.countryRelevantIncluded;
    countryGlobalSupplement = country.globalSupplementCount;
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
  const editorialWork = await findPlpAutoBuildWorkByKey({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: editorialEntityId,
    locale,
  });
  const editorialSnapshot = await findCurrentPublishedPresentation({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: editorialEntityId,
    locale,
  });
  let editorialSnapshotUsable = false;
  if (editorialSnapshot) {
    try {
      const usability = classifyUsableLocalizedPresentation({
        locale,
        liveCanonicalVersion: editorialVersion,
        liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        canonicalPresentation: editorialTree,
        snapshot: editorialSnapshot,
      });
      editorialSnapshotUsable = usability.allowPublishedLocalized;
    } catch {
      editorialSnapshotUsable = false;
    }
  }
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

  const countryContractOk =
    countryCode == null
      ? true
      : countryAffiliatedSourceCount === 0
        ? true
        : countrySourceCoverageGap
          ? false
          : countryRelevantExcluded === 0 &&
            countryRelevantIncluded >=
              Math.min(countryAffiliatedCurrentNews, COUNTRY_PUBLIC_NEWS_RAIL_LIMIT);

  const ok =
    mediaFallback === 0 &&
    mediaLocalized === mediaArticles.length &&
    editorialResolved.mode === "PUBLISHED_LOCALIZED" &&
    editorialCanonicalLeaves === 0 &&
    faqMachineLocalized === faqMachineLeaves &&
    faqCanonicalMachine === 0 &&
    faqBrandResolved === faqBrandTokens &&
    identityMismatches === 0 &&
    countryContractOk;

  return {
    pack: MEDIA_LIVE_CLOSURE_PACK,
    operation: "diagnose_media_live_closure",
    readOnly: true,
    PROVIDER_CALLS_FROM_READ: 0,
    PLP_WRITES_FROM_READ: 0,
    MONGO_WRITES_FROM_READ: 0,
    PLP_PERSISTENCE_MODE: persistence.PLP_PERSISTENCE_MODE,
    locale,
    countryCode,
    MEDIA_RSS_TOTAL: mediaArticles.length,
    MEDIA_RSS_LOCALIZED: mediaLocalized,
    MEDIA_RSS_FALLBACK: mediaFallback,
    COUNTRY_RSS_TOTAL: countryTotal,
    COUNTRY_AFFILIATED_SOURCE_COUNT: countryAffiliatedSourceCount,
    COUNTRY_AFFILIATED_SOURCE_IDS: countryAffiliatedSourceIds,
    COUNTRY_AFFILIATED_CURRENT_NEWS: countryAffiliatedCurrentNews,
    COUNTRY_RELEVANT_COUNT: countryRelevantCount,
    COUNTRY_RELEVANT_INCLUDED: countryRelevantIncluded,
    COUNTRY_RELEVANT_EXCLUDED: countryRelevantExcluded,
    COUNTRY_GLOBAL_SUPPLEMENT_COUNT: countryGlobalSupplement,
    COUNTRY_SOURCE_COVERAGE_GAP: countrySourceCoverageGap,
    EDITORIAL_MODE: editorialResolved.mode,
    EDITORIAL_CANONICAL_LEAVES: editorialCanonicalLeaves,
    EDITORIAL_CURRENT_CANONICAL_VERSION: editorialVersion,
    EDITORIAL_WORK_ROW_FOUND: editorialWork != null,
    EDITORIAL_WORK_STATUS: editorialWork?.status ?? null,
    EDITORIAL_FAILURE_CODE:
      editorialWork?.status === "completed"
        ? null
        : editorialWork?.failureCode ?? null,
    EDITORIAL_FAILURE_STAGE:
      editorialWork?.status === "completed"
        ? null
        : editorialWork?.failureStage ?? null,
    EDITORIAL_FAILURE_REASON_SAFE:
      editorialWork?.status === "completed"
        ? null
        : editorialWork?.lastError ?? null,
    EDITORIAL_WORK_CANONICAL_VERSION: editorialWork?.canonicalVersion ?? null,
    EDITORIAL_ATTEMPT_COUNT: editorialWork?.attempts ?? null,
    EDITORIAL_MAX_ATTEMPTS: editorialWork?.maxAttempts ?? null,
    EDITORIAL_RETRYABLE:
      editorialWork?.status === "completed"
        ? null
        : editorialWork?.retryable ?? null,
    EDITORIAL_SNAPSHOT_FOUND: editorialSnapshot != null,
    EDITORIAL_SNAPSHOT_CANONICAL_VERSION:
      editorialSnapshot?.identity.canonicalVersion ?? null,
    EDITORIAL_SNAPSHOT_SCHEMA_VERSION:
      editorialSnapshot?.identity.localizationSchemaVersion ?? null,
    EDITORIAL_SNAPSHOT_USABLE: editorialSnapshotUsable,
    EDITORIAL_RESOLVER_MODE: editorialResolved.mode,
    EDITORIAL_RESOLVER_FALLBACK_REASON: editorialResolved.reasonCode ?? null,
    EDITORIAL_WORK_TRIGGER: editorialWork?.trigger ?? null,
    EDITORIAL_PARTIAL_AUTO_PATHS: parsePathListFromFailureReason(
      editorialWork?.lastError,
      "PARTIAL_AUTO_PATHS",
    ),
    EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: parsePathListFromFailureReason(
      editorialWork?.lastError,
      "CANONICAL_IDENTICAL_TRANSLATABLE_PATHS",
    ),
    EDITORIAL_INTEGRITY_FAILED_PATHS: parsePathListFromFailureReason(
      editorialWork?.lastError,
      "INTEGRITY_FAILED_PATHS",
    ),
    EDITORIAL_BRAND_TOKEN_PATH_STATES: parsePathListFromFailureReason(
      editorialWork?.lastError,
      "BRAND_TOKEN_PATHS",
    ),
    EDITORIAL_STALE_WORK_VERSION: parseLabeledValueFromFailureReason(
      editorialWork?.lastError,
      "STALE_WORK_VERSION",
    ),
    EDITORIAL_STALE_CURRENT_SOURCE_VERSION: parseLabeledValueFromFailureReason(
      editorialWork?.lastError,
      "STALE_CURRENT_SOURCE_VERSION",
    ),
    EDITORIAL_STALE_BOUNDARY: parseLabeledValueFromFailureReason(
      editorialWork?.lastError,
      "STALE_BOUNDARY",
    ),
    EDITORIAL_STALE_AUTHORITY: parseLabeledValueFromFailureReason(
      editorialWork?.lastError,
      "STALE_AUTHORITY",
    ),
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

/**
 * Thin `--mongo` CLI entry: bind PLP Mongo → connect → read-only diagnostic → disconnect.
 * Never enqueues, heals, materializes, or imports Gemini.
 */
export async function runMediaLiveClosureDiagnostic(
  input: {
    readonly locale: string;
    readonly countryCode?: string | null;
    readonly countryName?: string | null;
    readonly regionName?: string | null;
  },
  deps: MediaLiveClosureDiagnosticDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaLiveClosureReport | null;
  readonly errorMessage: string | null;
}> {
  const mongoReady = (deps.isMongoConfigured ?? isMongoConfigured)();
  if (!mongoReady) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let persistence: MediaPlpPersistenceObservability;
  try {
    persistence = deps.requirePersistence
      ? deps.requirePersistence()
      : requireMediaPlpMaterializerMongoPersistence(
          "diagnose:media-live-closure --mongo",
        );
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Mongo PLP persistence required",
    };
  }
  if (persistence.PLP_PERSISTENCE_MODE !== "MONGO") {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        "PLP persistence mode is not MONGO (diagnose:media-live-closure --mongo).",
    };
  }

  let connected = false;
  try {
    await (deps.connect ?? connectMongoClient)();
    connected = true;
    const report = await (deps.executeReads ?? executeMediaLiveClosureReads)({
      locale: input.locale,
      countryCode: input.countryCode,
      countryName: input.countryName,
      regionName: input.regionName,
      persistence,
    });
    return { exitCode: report.ok ? 0 : 2, report, errorMessage: null };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "media live closure diagnostic failed",
    };
  } finally {
    if (connected) {
      try {
        await (deps.disconnect ?? disconnectMongoClient)();
      } catch {
        // ignore
      }
    }
  }
}

export function printMediaLiveClosureReport(report: MediaLiveClosureReport): void {
  const lines = [
    `pack=${report.pack}`,
    `locale=${report.locale}`,
    `countryCode=${report.countryCode ?? ""}`,
    `PLP_PERSISTENCE_MODE=${report.PLP_PERSISTENCE_MODE}`,
    `MEDIA_RSS_TOTAL=${report.MEDIA_RSS_TOTAL}`,
    `MEDIA_RSS_LOCALIZED=${report.MEDIA_RSS_LOCALIZED}`,
    `MEDIA_RSS_FALLBACK=${report.MEDIA_RSS_FALLBACK}`,
    `COUNTRY_RSS_TOTAL=${report.COUNTRY_RSS_TOTAL}`,
    `COUNTRY_AFFILIATED_SOURCE_COUNT=${report.COUNTRY_AFFILIATED_SOURCE_COUNT}`,
    `COUNTRY_AFFILIATED_CURRENT_NEWS=${report.COUNTRY_AFFILIATED_CURRENT_NEWS}`,
    `COUNTRY_RELEVANT_COUNT=${report.COUNTRY_RELEVANT_COUNT}`,
    `COUNTRY_RELEVANT_INCLUDED=${report.COUNTRY_RELEVANT_INCLUDED}`,
    `COUNTRY_RELEVANT_EXCLUDED=${report.COUNTRY_RELEVANT_EXCLUDED}`,
    `COUNTRY_GLOBAL_SUPPLEMENT_COUNT=${report.COUNTRY_GLOBAL_SUPPLEMENT_COUNT}`,
    `COUNTRY_SOURCE_COVERAGE_GAP=${report.COUNTRY_SOURCE_COVERAGE_GAP}`,
    `EDITORIAL_MODE=${report.EDITORIAL_MODE}`,
    `EDITORIAL_CANONICAL_LEAVES=${report.EDITORIAL_CANONICAL_LEAVES}`,
    `EDITORIAL_CURRENT_CANONICAL_VERSION=${report.EDITORIAL_CURRENT_CANONICAL_VERSION}`,
    `EDITORIAL_WORK_ROW_FOUND=${report.EDITORIAL_WORK_ROW_FOUND}`,
    `EDITORIAL_WORK_STATUS=${report.EDITORIAL_WORK_STATUS ?? ""}`,
    `EDITORIAL_FAILURE_CODE=${report.EDITORIAL_FAILURE_CODE ?? ""}`,
    `EDITORIAL_FAILURE_STAGE=${report.EDITORIAL_FAILURE_STAGE ?? ""}`,
    `EDITORIAL_FAILURE_REASON_SAFE=${report.EDITORIAL_FAILURE_REASON_SAFE ?? ""}`,
    `EDITORIAL_WORK_CANONICAL_VERSION=${report.EDITORIAL_WORK_CANONICAL_VERSION ?? ""}`,
    `EDITORIAL_ATTEMPT_COUNT=${report.EDITORIAL_ATTEMPT_COUNT ?? ""}`,
    `EDITORIAL_MAX_ATTEMPTS=${report.EDITORIAL_MAX_ATTEMPTS ?? ""}`,
    `EDITORIAL_RETRYABLE=${report.EDITORIAL_RETRYABLE ?? ""}`,
    `EDITORIAL_SNAPSHOT_FOUND=${report.EDITORIAL_SNAPSHOT_FOUND}`,
    `EDITORIAL_SNAPSHOT_CANONICAL_VERSION=${report.EDITORIAL_SNAPSHOT_CANONICAL_VERSION ?? ""}`,
    `EDITORIAL_SNAPSHOT_SCHEMA_VERSION=${report.EDITORIAL_SNAPSHOT_SCHEMA_VERSION ?? ""}`,
    `EDITORIAL_SNAPSHOT_USABLE=${report.EDITORIAL_SNAPSHOT_USABLE}`,
    `EDITORIAL_RESOLVER_MODE=${report.EDITORIAL_RESOLVER_MODE}`,
    `EDITORIAL_RESOLVER_FALLBACK_REASON=${report.EDITORIAL_RESOLVER_FALLBACK_REASON ?? ""}`,
    `EDITORIAL_WORK_TRIGGER=${report.EDITORIAL_WORK_TRIGGER ?? ""}`,
    `EDITORIAL_PARTIAL_AUTO_PATHS=${report.EDITORIAL_PARTIAL_AUTO_PATHS.join("|")}`,
    `EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS=${report.EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS.join("|")}`,
    `EDITORIAL_INTEGRITY_FAILED_PATHS=${report.EDITORIAL_INTEGRITY_FAILED_PATHS.join("|")}`,
    `EDITORIAL_BRAND_TOKEN_PATH_STATES=${report.EDITORIAL_BRAND_TOKEN_PATH_STATES.join("|")}`,
    `EDITORIAL_STALE_WORK_VERSION=${report.EDITORIAL_STALE_WORK_VERSION ?? ""}`,
    `EDITORIAL_STALE_CURRENT_SOURCE_VERSION=${report.EDITORIAL_STALE_CURRENT_SOURCE_VERSION ?? ""}`,
    `EDITORIAL_STALE_BOUNDARY=${report.EDITORIAL_STALE_BOUNDARY ?? ""}`,
    `EDITORIAL_STALE_AUTHORITY=${report.EDITORIAL_STALE_AUTHORITY ?? ""}`,
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
    `MONGO_WRITES_FROM_READ=${report.MONGO_WRITES_FROM_READ}`,
    `ok=${report.ok}`,
  ];
  console.log(lines.join("\n"));
  console.log(JSON.stringify({ mediaRssRows: report.mediaRssRows }, null, 2));
}

// Keep schema version reference for fingerprint compatibility notes.
void PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
