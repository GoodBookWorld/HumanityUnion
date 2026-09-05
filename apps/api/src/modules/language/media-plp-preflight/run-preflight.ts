/**
 * Reset 03A — thin one-entity Media PLP safety preflight runner.
 * READ-ONLY. Never publishes, never calls provider, never hydrates corpus.
 */

import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import {
  getMediaPlpPreflightCounters,
  markMediaPlpPreflightMongoClosed,
} from "./counters.js";
import { assertMediaPlpPreflightImportIsolation } from "./import-guards.js";
import { loadMediaPlpPreflightLocale } from "./language-registry-lookup.js";
import {
  captureMediaPlpPreflightAfterImport,
  captureMediaPlpPreflightAfterMongoConnect,
  captureMediaPlpPreflightAfterPlpLookup,
  captureMediaPlpPreflightAfterSourceLookup,
  captureMediaPlpPreflightStart,
  getMediaPlpPreflightMemoryPhases,
} from "./memory-phases.js";
import { parseMediaPlpPreflightArgs } from "./parse-args.js";
import { loadMediaPlpPreflightCurrent } from "./plp-lookup.js";
import { evaluateMediaPlpPreflightProductionRefusal } from "./production-refusal.js";
import { loadMediaPlpPreflightSource } from "./source-lookup.js";
import type { MediaPlpPreflightLocaleLookup } from "./language-registry-lookup.js";
import type { MediaPlpPreflightPlpLookup } from "./plp-lookup.js";
import type { MediaPlpPreflightSourceLookup } from "./source-lookup.js";
import type { MediaPlpPreflightArgs } from "./parse-args.js";

export type MediaPlpPreflightReport = {
  readonly pack: "RESET_03A";
  readonly operation: "diagnose_media_plp_preflight";
  readonly mode: "read-only";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly LOCALE: string;
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly PLP_MATCHES_CURRENT_SOURCE: boolean;
  readonly WOULD_REQUIRE_BUILD: boolean;
  readonly SOURCE_DOCUMENT_BYTES: number;
  readonly PLP_DOCUMENT_BYTES: number;
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
  readonly database: string | null;
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly SOURCE_LOOKUP_COUNT: number;
  readonly PLP_LOOKUP_COUNT: number;
  readonly LANGUAGE_REGISTRY_LOOKUP_COUNT: number;
  readonly TOTAL_BOUNDED_LOOKUPS: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getMediaPlpPreflightMemoryPhases>;
};

export type MediaPlpPreflightDeps = {
  readonly loadSource?: (
    args: MediaPlpPreflightArgs,
  ) => Promise<MediaPlpPreflightSourceLookup>;
  readonly loadPlp?: (
    args: MediaPlpPreflightArgs,
  ) => Promise<MediaPlpPreflightPlpLookup>;
  readonly loadLocale?: (
    locale: MediaPlpPreflightArgs["locale"],
  ) => Promise<MediaPlpPreflightLocaleLookup>;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly resolveDatabase?: () => string | null;
  readonly skipImportBoundaryCheck?: boolean;
};

function computeMatch(input: {
  readonly source: MediaPlpPreflightSourceLookup;
  readonly plp: MediaPlpPreflightPlpLookup;
}): { readonly matches: boolean; readonly wouldRequireBuild: boolean } {
  const matches =
    input.source.SOURCE_FOUND &&
    Boolean(input.source.CANONICAL_VERSION) &&
    input.plp.PLP_CURRENT_FOUND &&
    input.plp.PLP_STATE === "PUBLISHED" &&
    input.plp.PLP_CANONICAL_VERSION === input.source.CANONICAL_VERSION &&
    input.plp.PLP_SCHEMA_VERSION === PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  return {
    matches,
    wouldRequireBuild: !matches,
  };
}

export async function runMediaPlpPreflight(
  argv: readonly string[],
  deps: MediaPlpPreflightDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpPreflightReport | null;
  readonly errorMessage: string | null;
}> {
  captureMediaPlpPreflightStart();
  captureMediaPlpPreflightAfterImport();

  if (!deps.skipImportBoundaryCheck) {
    const isolation = assertMediaPlpPreflightImportIsolation();
    if (!isolation.ok) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `Media PLP preflight import boundary violated: ${isolation.violations.join(", ")}`,
      };
    }
  }

  const parsed = parseMediaPlpPreflightArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }

  const production = evaluateMediaPlpPreflightProductionRefusal({
    database: deps.resolveDatabase?.() ?? undefined,
  });
  if (production.refused) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: production.reason,
    };
  }

  const mongoReady = (deps.isMongoConfigured ?? isMongoConfigured)();
  if (!mongoReady && !deps.loadSource) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let connected = false;
  try {
    if (!deps.loadSource) {
      await (deps.connect ?? connectMongoClient)();
      connected = true;
    }
    captureMediaPlpPreflightAfterMongoConnect();

    const loadSource = deps.loadSource ?? loadMediaPlpPreflightSource;
    const loadPlp = deps.loadPlp ?? loadMediaPlpPreflightCurrent;
    const loadLocale = deps.loadLocale ?? loadMediaPlpPreflightLocale;

    const source = await loadSource(parsed.args);
    captureMediaPlpPreflightAfterSourceLookup();

    if (source.identityCollision) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `Source lookup returned multiple identities for ${parsed.args.entityType}/${parsed.args.entityId}`,
      };
    }

    const plp = await loadPlp(parsed.args);
    captureMediaPlpPreflightAfterPlpLookup();

    if (plp.identityCollision) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `PLP current lookup returned multiple identities for ${parsed.args.entityType}/${parsed.args.entityId}/${parsed.args.locale}`,
      };
    }

    const localeInfo = await loadLocale(parsed.args.locale);
    const match = computeMatch({ source, plp });
    const counters = getMediaPlpPreflightCounters();
    const database =
      deps.resolveDatabase?.() ??
      (isMongoConfigured() ? resolveMongoConfig().database : null);

    const report: MediaPlpPreflightReport = {
      pack: "RESET_03A",
      operation: "diagnose_media_plp_preflight",
      mode: "read-only",
      OPERATOR_MODE: "THIN_READ_ONLY",
      ENTITY_TYPE: parsed.args.entityType,
      ENTITY_ID: parsed.args.entityId,
      LOCALE: parsed.args.locale,
      SOURCE_FOUND: source.SOURCE_FOUND,
      SOURCE_PUBLIC: source.SOURCE_PUBLIC,
      CANONICAL_VERSION: source.CANONICAL_VERSION,
      PLP_CURRENT_FOUND: plp.PLP_CURRENT_FOUND,
      PLP_STATE: plp.PLP_STATE,
      PLP_CANONICAL_VERSION: plp.PLP_CANONICAL_VERSION,
      PLP_SCHEMA_VERSION: plp.PLP_SCHEMA_VERSION,
      PLP_MATCHES_CURRENT_SOURCE: match.matches,
      WOULD_REQUIRE_BUILD: match.wouldRequireBuild,
      SOURCE_DOCUMENT_BYTES: source.SOURCE_DOCUMENT_BYTES,
      PLP_DOCUMENT_BYTES: plp.PLP_DOCUMENT_BYTES,
      LOCALE_REGISTRY_FOUND: localeInfo.LOCALE_REGISTRY_FOUND,
      LOCALE_ENABLED: localeInfo.LOCALE_ENABLED,
      CONTENT_TRANSLATION_ENABLED: localeInfo.CONTENT_TRANSLATION_ENABLED,
      database,
      HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
      IMPORT_BOUNDARY_OK: true,
      SOURCE_LOOKUP_COUNT: counters.SOURCE_LOOKUP_COUNT,
      PLP_LOOKUP_COUNT: counters.PLP_LOOKUP_COUNT,
      LANGUAGE_REGISTRY_LOOKUP_COUNT: counters.LANGUAGE_REGISTRY_LOOKUP_COUNT,
      TOTAL_BOUNDED_LOOKUPS: counters.TOTAL_BOUNDED_LOOKUPS,
      WRITES_PERFORMED: counters.WRITES_PERFORMED,
      PROVIDER_CALLS: counters.PROVIDER_CALLS,
      MONGO_CLOSED: false,
      memory: getMediaPlpPreflightMemoryPhases(),
    };

    return { exitCode: 0, report, errorMessage: null };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: error instanceof Error ? error.message : "unknown",
    };
  } finally {
    if (connected || deps.disconnect) {
      try {
        await (deps.disconnect ?? disconnectMongoClient)();
      } catch {
        // ignore disconnect errors
      }
      markMediaPlpPreflightMongoClosed();
    }
  }
}

export function printMediaPlpPreflightReport(report: MediaPlpPreflightReport): void {
  const lines = [
    `OPERATOR_MODE=${report.OPERATOR_MODE}`,
    `ENTITY_TYPE=${report.ENTITY_TYPE}`,
    `ENTITY_ID=${report.ENTITY_ID}`,
    `LOCALE=${report.LOCALE}`,
    `SOURCE_FOUND=${report.SOURCE_FOUND}`,
    `SOURCE_PUBLIC=${report.SOURCE_PUBLIC}`,
    `CANONICAL_VERSION=${report.CANONICAL_VERSION ?? ""}`,
    `PLP_CURRENT_FOUND=${report.PLP_CURRENT_FOUND}`,
    `PLP_STATE=${report.PLP_STATE ?? ""}`,
    `PLP_CANONICAL_VERSION=${report.PLP_CANONICAL_VERSION ?? ""}`,
    `PLP_SCHEMA_VERSION=${report.PLP_SCHEMA_VERSION ?? ""}`,
    `PLP_MATCHES_CURRENT_SOURCE=${report.PLP_MATCHES_CURRENT_SOURCE}`,
    `WOULD_REQUIRE_BUILD=${report.WOULD_REQUIRE_BUILD}`,
    `SOURCE_DOCUMENT_BYTES=${report.SOURCE_DOCUMENT_BYTES}`,
    `PLP_DOCUMENT_BYTES=${report.PLP_DOCUMENT_BYTES}`,
    `LOCALE_REGISTRY_FOUND=${report.LOCALE_REGISTRY_FOUND}`,
    `LOCALE_ENABLED=${report.LOCALE_ENABLED}`,
    `CONTENT_TRANSLATION_ENABLED=${report.CONTENT_TRANSLATION_ENABLED}`,
    `database=${report.database ?? ""}`,
    `HU_MEDIA_PLP_ENABLED=${report.HU_MEDIA_PLP_ENABLED}`,
    `IMPORT_BOUNDARY_OK=${report.IMPORT_BOUNDARY_OK}`,
    `SOURCE_LOOKUP_COUNT=${report.SOURCE_LOOKUP_COUNT}`,
    `PLP_LOOKUP_COUNT=${report.PLP_LOOKUP_COUNT}`,
    `LANGUAGE_REGISTRY_LOOKUP_COUNT=${report.LANGUAGE_REGISTRY_LOOKUP_COUNT}`,
    `TOTAL_BOUNDED_LOOKUPS=${report.TOTAL_BOUNDED_LOOKUPS}`,
    `WRITES_PERFORMED=${report.WRITES_PERFORMED}`,
    `PROVIDER_CALLS=${report.PROVIDER_CALLS}`,
    `MONGO_CLOSED=${getMediaPlpPreflightCounters().MONGO_CLOSED}`,
    `RSS_START_MB=${report.memory.RSS_START_MB}`,
    `RSS_AFTER_IMPORT_MB=${report.memory.RSS_AFTER_IMPORT_MB}`,
    `RSS_AFTER_MONGO_CONNECT_MB=${report.memory.RSS_AFTER_MONGO_CONNECT_MB}`,
    `RSS_AFTER_SOURCE_LOOKUP_MB=${report.memory.RSS_AFTER_SOURCE_LOOKUP_MB}`,
    `RSS_AFTER_PLP_LOOKUP_MB=${report.memory.RSS_AFTER_PLP_LOOKUP_MB}`,
    `RSS_PEAK_MB=${report.memory.RSS_PEAK_MB}`,
  ];
  console.log(lines.join("\n"));
}
