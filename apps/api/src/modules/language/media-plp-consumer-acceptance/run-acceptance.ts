/**
 * Reset 03C — read-only Media PLP consumer acceptance diagnostic.
 * Inspects one identity × locale: PUBLISHED_LOCALIZED vs CANONICAL_FALLBACK.
 * No body/translated text output. No writes. No provider.
 */

import type { LanguageCode, MediaPlpEntityType } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPES } from "@hu/types";

import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import {
  getMediaPlpInstrumentationCounters,
  loadMediaPlpLiveCanonicalSource,
  requirePublishedLocalizationMongoPersistence,
  resetMediaPlpInstrumentationForTests,
  resolveMediaPlpConsumerItem,
} from "../published-localized-presentation/index.js";
import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";

export type MediaPlpConsumerAcceptanceReport = {
  readonly pack: "RESET_03C";
  readonly operation: "diagnose_media_plp_consumer";
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly LOCALE: string;
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly LIVE_CANONICAL_VERSION: string | null;
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_MATCHES_LIVE: boolean;
  readonly CONSUMER_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | null;
  readonly CONSUMER_REASON: string | null;
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly PROVIDER_CALL_COUNT: number;
  readonly CONTENT_TRANSLATION_WRITE_COUNT: number;
  readonly PLP_WRITES: number;
  readonly SOURCE_WRITES: number;
  readonly RSS_START_MB: number;
  readonly RSS_PEAK_MB: number;
  readonly database: string | null;
  readonly abortReason: string | null;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

export function parseMediaPlpConsumerAcceptanceArgs(argv: readonly string[]): {
  readonly ok: true;
  readonly args: {
    readonly entityType: MediaPlpEntityType;
    readonly entityId: string;
    readonly locale: LanguageCode;
    readonly mongo: boolean;
  };
} | { readonly ok: false; readonly errorMessage: string } {
  const args = argv.slice(2);
  let entityType: string | null = null;
  let entityId: string | null = null;
  let locale: string | null = null;
  let mongo = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--mongo") {
      mongo = true;
      continue;
    }
    if (arg === "--entity-type") {
      entityType = args[++i] ?? null;
      continue;
    }
    if (arg === "--entity-id") {
      entityId = args[++i] ?? null;
      continue;
    }
    if (arg === "--locale") {
      locale = args[++i] ?? null;
      continue;
    }
  }

  if (!mongo) {
    return { ok: false, errorMessage: "--mongo is required (durable PLP read)." };
  }
  if (!entityType || !entityId || !locale) {
    return {
      ok: false,
      errorMessage: "--entity-type, --entity-id, and --locale are required.",
    };
  }
  if (!(MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return { ok: false, errorMessage: `Unsupported entityType=${entityType}` };
  }
  if (locale.includes(",") || args.filter((a) => a === "--locale").length > 1) {
    return { ok: false, errorMessage: "Exactly one --locale is required." };
  }

  return {
    ok: true,
    args: {
      entityType: entityType as MediaPlpEntityType,
      entityId,
      locale: locale as LanguageCode,
      mongo: true,
    },
  };
}

export async function runMediaPlpConsumerAcceptance(
  argv: readonly string[],
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpConsumerAcceptanceReport | null;
  readonly errorMessage: string | null;
}> {
  const rssStart = rssMb();
  let peak = rssStart;
  const bump = () => {
    const now = rssMb();
    if (now > peak) peak = now;
    return now;
  };

  resetMediaPlpInstrumentationForTests();

  const parsed = parseMediaPlpConsumerAcceptanceArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  const { args } = parsed;

  if (!isMongoConfigured()) {
    return { exitCode: 1, report: null, errorMessage: "MONGODB_URI is not configured." };
  }

  try {
    requirePublishedLocalizationMongoPersistence(
      "diagnose:media-plp-consumer --mongo requires durable PLP persistence",
    );
  } catch (error) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: error instanceof Error ? error.message : "Mongo PLP persistence required",
    };
  }

  let connected = false;
  try {
    await connectMongoClient();
    connected = true;
    bump();

    const source = await loadMediaPlpLiveCanonicalSource({
      entityType: args.entityType,
      entityId: args.entityId,
    });
    bump();

    if (!source.SOURCE_FOUND || !source.canonicalPresentation || !source.CANONICAL_VERSION) {
      const report: MediaPlpConsumerAcceptanceReport = {
        pack: "RESET_03C",
        operation: "diagnose_media_plp_consumer",
        ENTITY_TYPE: args.entityType,
        ENTITY_ID: args.entityId,
        LOCALE: args.locale,
        SOURCE_FOUND: false,
        SOURCE_PUBLIC: false,
        LIVE_CANONICAL_VERSION: null,
        PLP_CURRENT_FOUND: false,
        PLP_STATE: null,
        PLP_CANONICAL_VERSION: null,
        PLP_MATCHES_LIVE: false,
        CONSUMER_MODE: null,
        CONSUMER_REASON: "SOURCE_NOT_FOUND",
        HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
        PROVIDER_CALL_COUNT: 0,
        CONTENT_TRANSLATION_WRITE_COUNT: 0,
        PLP_WRITES: 0,
        SOURCE_WRITES: 0,
        RSS_START_MB: rssStart,
        RSS_PEAK_MB: peak,
        database: resolveMongoConfig().database,
        abortReason: "SOURCE_NOT_FOUND",
      };
      return { exitCode: 1, report, errorMessage: "Source not found." };
    }

    const current = await findCurrentPublishedPresentation({
      entityType: args.entityType,
      entityId: args.entityId,
      locale: args.locale,
    });
    bump();

    const resolved = await resolveMediaPlpConsumerItem({
      locale: args.locale,
      entityType: args.entityType,
      entityId: args.entityId,
      canonicalPresentation: source.canonicalPresentation,
    });
    bump();

    const counters = getMediaPlpInstrumentationCounters();
    const report: MediaPlpConsumerAcceptanceReport = {
      pack: "RESET_03C",
      operation: "diagnose_media_plp_consumer",
      ENTITY_TYPE: args.entityType,
      ENTITY_ID: args.entityId,
      LOCALE: args.locale,
      SOURCE_FOUND: true,
      SOURCE_PUBLIC: source.SOURCE_PUBLIC,
      LIVE_CANONICAL_VERSION: source.CANONICAL_VERSION,
      PLP_CURRENT_FOUND: Boolean(current),
      PLP_STATE: current?.state ?? null,
      PLP_CANONICAL_VERSION: current?.identity.canonicalVersion ?? null,
      PLP_MATCHES_LIVE:
        Boolean(current) &&
        current!.state === "PUBLISHED" &&
        current!.identity.canonicalVersion === source.CANONICAL_VERSION,
      CONSUMER_MODE: resolved.mode,
      CONSUMER_REASON: resolved.reasonCode ?? null,
      HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
      PROVIDER_CALL_COUNT: counters.PROVIDER_CALL_COUNT,
      CONTENT_TRANSLATION_WRITE_COUNT: counters.CONTENT_TRANSLATION_WRITE_COUNT,
      PLP_WRITES: 0,
      SOURCE_WRITES: 0,
      RSS_START_MB: rssStart,
      RSS_PEAK_MB: peak,
      database: resolveMongoConfig().database,
      abortReason: null,
    };

    return { exitCode: 0, report, errorMessage: null };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: error instanceof Error ? error.message : "unknown",
    };
  } finally {
    if (connected) {
      try {
        await disconnectMongoClient();
      } catch {
        // ignore
      }
    }
  }
}

export function printMediaPlpConsumerAcceptanceReport(
  report: MediaPlpConsumerAcceptanceReport,
): void {
  const lines = [
    `pack=${report.pack}`,
    `operation=${report.operation}`,
    `ENTITY_TYPE=${report.ENTITY_TYPE}`,
    `ENTITY_ID=${report.ENTITY_ID}`,
    `LOCALE=${report.LOCALE}`,
    `SOURCE_FOUND=${report.SOURCE_FOUND}`,
    `SOURCE_PUBLIC=${report.SOURCE_PUBLIC}`,
    `LIVE_CANONICAL_VERSION=${report.LIVE_CANONICAL_VERSION ?? ""}`,
    `PLP_CURRENT_FOUND=${report.PLP_CURRENT_FOUND}`,
    `PLP_STATE=${report.PLP_STATE ?? ""}`,
    `PLP_CANONICAL_VERSION=${report.PLP_CANONICAL_VERSION ?? ""}`,
    `PLP_MATCHES_LIVE=${report.PLP_MATCHES_LIVE}`,
    `CONSUMER_MODE=${report.CONSUMER_MODE ?? ""}`,
    `CONSUMER_REASON=${report.CONSUMER_REASON ?? ""}`,
    `HU_MEDIA_PLP_ENABLED=${report.HU_MEDIA_PLP_ENABLED}`,
    `PROVIDER_CALL_COUNT=${report.PROVIDER_CALL_COUNT}`,
    `CONTENT_TRANSLATION_WRITE_COUNT=${report.CONTENT_TRANSLATION_WRITE_COUNT}`,
    `PLP_WRITES=${report.PLP_WRITES}`,
    `SOURCE_WRITES=${report.SOURCE_WRITES}`,
    `RSS_START_MB=${report.RSS_START_MB}`,
    `RSS_PEAK_MB=${report.RSS_PEAK_MB}`,
    `database=${report.database ?? ""}`,
    `abortReason=${report.abortReason ?? ""}`,
  ];
  console.log(lines.join("\n"));
}
