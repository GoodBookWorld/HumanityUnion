/**
 * Reset 03A / 03A.1 — thin one-entity Media PLP safety preflight runner.
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
  evaluateLocalizationContentIntegrity,
  resolveLocalizationContentIntegrityForRead,
} from "../published-localized-presentation/content-integrity.js";
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
import {
  parseMediaPlpPreflightArgs,
  type MediaPlpPreflightIdentityArgs,
} from "./parse-args.js";
import { loadMediaPlpPreflightCurrent } from "./plp-lookup.js";
import { evaluateMediaPlpPreflightProductionRefusal } from "./production-refusal.js";
import {
  discoverMediaPlpSampleOne,
  type MediaPlpSampleDiscoveryResult,
} from "./sample-discovery.js";
import { loadMediaPlpPreflightSource } from "./source-lookup.js";
import type { MediaPlpPreflightLocaleLookup } from "./language-registry-lookup.js";
import type { MediaPlpPreflightPlpLookup } from "./plp-lookup.js";
import type { MediaPlpPreflightSourceLookup } from "./source-lookup.js";

export type MediaPlpPreflightIdentityReport = {
  readonly pack: "RESET_03A";
  readonly operation: "diagnose_media_plp_preflight";
  readonly mode: "read-only";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly reportKind: "identity";
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
  /** Reset 03E.2 — bounded integrity counts (no body text). */
  readonly TRANSLATABLE_NODE_COUNT: number | null;
  readonly LOCALIZED_VALUE_NODE_COUNT: number | null;
  readonly CANONICAL_IDENTICAL_NODE_COUNT: number | null;
  readonly EMPTY_OR_MISSING_NODE_COUNT: number | null;
  readonly PROTECTED_CANONICAL_NODE_COUNT: number | null;
  readonly CONTENT_INTEGRITY_STATUS: string | null;
  readonly CONTENT_INTEGRITY_REASON: string | null;
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
  readonly database: string | null;
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly SOURCE_LOOKUP_COUNT: number;
  readonly PLP_LOOKUP_COUNT: number;
  readonly LANGUAGE_REGISTRY_LOOKUP_COUNT: number;
  readonly SAMPLE_DISCOVERY_COUNT: number;
  readonly TOTAL_BOUNDED_LOOKUPS: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getMediaPlpPreflightMemoryPhases>;
};

export type MediaPlpPreflightSampleReport = {
  readonly pack: "RESET_03A.1";
  readonly operation: "diagnose_media_plp_preflight_sample_one";
  readonly mode: "read-only";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly reportKind: "sample-one";
  readonly SAMPLE_FOUND: boolean;
  readonly SAMPLE_ENTITY_TYPE: string;
  readonly SAMPLE_ENTITY_ID: string | null;
  readonly database: string | null;
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly SOURCE_LOOKUP_COUNT: number;
  readonly PLP_LOOKUP_COUNT: number;
  readonly LANGUAGE_REGISTRY_LOOKUP_COUNT: number;
  readonly SAMPLE_DISCOVERY_COUNT: number;
  readonly TOTAL_BOUNDED_LOOKUPS: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getMediaPlpPreflightMemoryPhases>;
};

export type MediaPlpPreflightReport =
  | MediaPlpPreflightIdentityReport
  | MediaPlpPreflightSampleReport;

export type MediaPlpPreflightDeps = {
  readonly loadSource?: (
    args: MediaPlpPreflightIdentityArgs,
  ) => Promise<MediaPlpPreflightSourceLookup>;
  readonly loadPlp?: (
    args: MediaPlpPreflightIdentityArgs,
  ) => Promise<MediaPlpPreflightPlpLookup>;
  readonly loadLocale?: (
    locale: MediaPlpPreflightIdentityArgs["locale"],
  ) => Promise<MediaPlpPreflightLocaleLookup>;
  readonly sampleOne?: (
    entityType: MediaPlpPreflightIdentityArgs["entityType"],
  ) => Promise<MediaPlpSampleDiscoveryResult>;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly resolveDatabase?: () => string | null;
  readonly skipImportBoundaryCheck?: boolean;
};

function computeContentIntegrityFields(input: {
  readonly locale: string;
  readonly source: MediaPlpPreflightSourceLookup;
  readonly plp: MediaPlpPreflightPlpLookup;
}): {
  readonly TRANSLATABLE_NODE_COUNT: number | null;
  readonly LOCALIZED_VALUE_NODE_COUNT: number | null;
  readonly CANONICAL_IDENTICAL_NODE_COUNT: number | null;
  readonly EMPTY_OR_MISSING_NODE_COUNT: number | null;
  readonly PROTECTED_CANONICAL_NODE_COUNT: number | null;
  readonly CONTENT_INTEGRITY_STATUS: string | null;
  readonly CONTENT_INTEGRITY_REASON: string | null;
} {
  if (
    !input.plp.PLP_CURRENT_FOUND ||
    !input.source.canonicalPresentation ||
    input.plp.presentation == null
  ) {
    return {
      TRANSLATABLE_NODE_COUNT: null,
      LOCALIZED_VALUE_NODE_COUNT: null,
      CANONICAL_IDENTICAL_NODE_COUNT: null,
      EMPTY_OR_MISSING_NODE_COUNT: null,
      PROTECTED_CANONICAL_NODE_COUNT: null,
      CONTENT_INTEGRITY_STATUS: input.plp.PLP_CURRENT_FOUND
        ? "UNAVAILABLE"
        : null,
      CONTENT_INTEGRITY_REASON: input.plp.PLP_CURRENT_FOUND
        ? "PRESENTATION_OR_CANONICAL_MISSING"
        : null,
    };
  }

  const gate = resolveLocalizationContentIntegrityForRead({
    locale: input.locale,
    canonicalPresentation: input.source.canonicalPresentation,
    localizedPresentation: input.plp.presentation,
    persisted: input.plp.contentIntegrity ?? null,
  });

  // Prefer recomputed counts; status/reason reflect read-path gate.
  const report =
    gate.report.status === "UNKNOWN_LEGACY"
      ? evaluateLocalizationContentIntegrity({
          locale: input.locale,
          canonicalPresentation: input.source.canonicalPresentation,
          localizedPresentation: input.plp.presentation,
        })
      : gate.report;

  return {
    TRANSLATABLE_NODE_COUNT: report.TRANSLATABLE_NODE_COUNT,
    LOCALIZED_VALUE_NODE_COUNT: report.LOCALIZED_VALUE_NODE_COUNT,
    CANONICAL_IDENTICAL_NODE_COUNT: report.CANONICAL_IDENTICAL_NODE_COUNT,
    EMPTY_OR_MISSING_NODE_COUNT: report.EMPTY_OR_MISSING_NODE_COUNT,
    PROTECTED_CANONICAL_NODE_COUNT: report.PROTECTED_CANONICAL_NODE_COUNT,
    CONTENT_INTEGRITY_STATUS:
      gate.reasonCode === "OK"
        ? report.status
        : gate.reasonCode === "LOCALIZATION_CONTENT_INTEGRITY_MISSING"
          ? "UNKNOWN_LEGACY"
          : "FAILED",
    CONTENT_INTEGRITY_REASON:
      gate.reasonCode === "OK"
        ? report.reasonCodes[0] ?? null
        : gate.reasonCode,
  };
}

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

function safetyCounterFields(): Pick<
  MediaPlpPreflightSampleReport,
  | "SOURCE_LOOKUP_COUNT"
  | "PLP_LOOKUP_COUNT"
  | "LANGUAGE_REGISTRY_LOOKUP_COUNT"
  | "SAMPLE_DISCOVERY_COUNT"
  | "TOTAL_BOUNDED_LOOKUPS"
  | "WRITES_PERFORMED"
  | "PROVIDER_CALLS"
  | "MONGO_CLOSED"
  | "memory"
> {
  const counters = getMediaPlpPreflightCounters();
  return {
    SOURCE_LOOKUP_COUNT: counters.SOURCE_LOOKUP_COUNT,
    PLP_LOOKUP_COUNT: counters.PLP_LOOKUP_COUNT,
    LANGUAGE_REGISTRY_LOOKUP_COUNT: counters.LANGUAGE_REGISTRY_LOOKUP_COUNT,
    SAMPLE_DISCOVERY_COUNT: counters.SAMPLE_DISCOVERY_COUNT,
    TOTAL_BOUNDED_LOOKUPS: counters.TOTAL_BOUNDED_LOOKUPS,
    WRITES_PERFORMED: counters.WRITES_PERFORMED,
    PROVIDER_CALLS: counters.PROVIDER_CALLS,
    MONGO_CLOSED: false,
    memory: getMediaPlpPreflightMemoryPhases(),
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

  const needsMongo =
    parsed.args.mode === "identity" ||
    parsed.args.entityType !== "civic_media_principle";
  const mongoReady = (deps.isMongoConfigured ?? isMongoConfigured)();
  if (
    needsMongo &&
    !mongoReady &&
    !deps.loadSource &&
    !deps.sampleOne
  ) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let connected = false;
  try {
    const shouldConnect =
      !deps.loadSource &&
      !deps.sampleOne &&
      (parsed.args.mode === "identity" ||
        parsed.args.entityType !== "civic_media_principle");
    if (shouldConnect) {
      await (deps.connect ?? connectMongoClient)();
      connected = true;
    } else if (deps.connect && (deps.loadSource || deps.sampleOne)) {
      // Fixture path may still want connect/disconnect bookkeeping.
      await deps.connect();
      connected = true;
    }
    captureMediaPlpPreflightAfterMongoConnect();

    if (parsed.args.mode === "sample-one") {
      const sample = await (deps.sampleOne ?? discoverMediaPlpSampleOne)(
        parsed.args.entityType,
      );
      captureMediaPlpPreflightAfterSourceLookup();
      captureMediaPlpPreflightAfterPlpLookup();

      const database =
        deps.resolveDatabase?.() ??
        (isMongoConfigured() ? resolveMongoConfig().database : null);

      const report: MediaPlpPreflightSampleReport = {
        pack: "RESET_03A.1",
        operation: "diagnose_media_plp_preflight_sample_one",
        mode: "read-only",
        OPERATOR_MODE: "THIN_READ_ONLY",
        reportKind: "sample-one",
        SAMPLE_FOUND: sample.SAMPLE_FOUND,
        SAMPLE_ENTITY_TYPE: sample.SAMPLE_ENTITY_TYPE,
        SAMPLE_ENTITY_ID: sample.SAMPLE_ENTITY_ID,
        database,
        HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
        IMPORT_BOUNDARY_OK: true,
        ...safetyCounterFields(),
      };
      return {
        exitCode: sample.SAMPLE_FOUND ? 0 : 1,
        report,
        errorMessage: null,
      };
    }

    const identityArgs = parsed.args;
    const loadSource = deps.loadSource ?? loadMediaPlpPreflightSource;
    const loadPlp = deps.loadPlp ?? loadMediaPlpPreflightCurrent;
    const loadLocale = deps.loadLocale ?? loadMediaPlpPreflightLocale;

    const source = await loadSource(identityArgs);
    captureMediaPlpPreflightAfterSourceLookup();

    if (source.identityCollision) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `Source lookup returned multiple identities for ${identityArgs.entityType}/${identityArgs.entityId}`,
      };
    }

    const plp = await loadPlp(identityArgs);
    captureMediaPlpPreflightAfterPlpLookup();

    if (plp.identityCollision) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `PLP current lookup returned multiple identities for ${identityArgs.entityType}/${identityArgs.entityId}/${identityArgs.locale}`,
      };
    }

    const localeInfo = await loadLocale(identityArgs.locale);
    const match = computeMatch({ source, plp });
    const integrity = computeContentIntegrityFields({
      locale: identityArgs.locale,
      source,
      plp,
    });
    const database =
      deps.resolveDatabase?.() ??
      (isMongoConfigured() ? resolveMongoConfig().database : null);

    const report: MediaPlpPreflightIdentityReport = {
      pack: "RESET_03A",
      operation: "diagnose_media_plp_preflight",
      mode: "read-only",
      OPERATOR_MODE: "THIN_READ_ONLY",
      reportKind: "identity",
      ENTITY_TYPE: identityArgs.entityType,
      ENTITY_ID: identityArgs.entityId,
      LOCALE: identityArgs.locale,
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
      TRANSLATABLE_NODE_COUNT: integrity.TRANSLATABLE_NODE_COUNT,
      LOCALIZED_VALUE_NODE_COUNT: integrity.LOCALIZED_VALUE_NODE_COUNT,
      CANONICAL_IDENTICAL_NODE_COUNT: integrity.CANONICAL_IDENTICAL_NODE_COUNT,
      EMPTY_OR_MISSING_NODE_COUNT: integrity.EMPTY_OR_MISSING_NODE_COUNT,
      PROTECTED_CANONICAL_NODE_COUNT: integrity.PROTECTED_CANONICAL_NODE_COUNT,
      CONTENT_INTEGRITY_STATUS: integrity.CONTENT_INTEGRITY_STATUS,
      CONTENT_INTEGRITY_REASON: integrity.CONTENT_INTEGRITY_REASON,
      LOCALE_REGISTRY_FOUND: localeInfo.LOCALE_REGISTRY_FOUND,
      LOCALE_ENABLED: localeInfo.LOCALE_ENABLED,
      CONTENT_TRANSLATION_ENABLED: localeInfo.CONTENT_TRANSLATION_ENABLED,
      database,
      HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
      IMPORT_BOUNDARY_OK: true,
      ...safetyCounterFields(),
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
  if (report.reportKind === "sample-one") {
    const lines = [
      `OPERATOR_MODE=${report.OPERATOR_MODE}`,
      `SAMPLE_FOUND=${report.SAMPLE_FOUND}`,
      `SAMPLE_ENTITY_TYPE=${report.SAMPLE_ENTITY_TYPE}`,
      `SAMPLE_ENTITY_ID=${report.SAMPLE_ENTITY_ID ?? ""}`,
      `IMPORT_BOUNDARY_OK=${report.IMPORT_BOUNDARY_OK}`,
      `SOURCE_LOOKUP_COUNT=${report.SOURCE_LOOKUP_COUNT}`,
      `PLP_LOOKUP_COUNT=${report.PLP_LOOKUP_COUNT}`,
      `LANGUAGE_REGISTRY_LOOKUP_COUNT=${report.LANGUAGE_REGISTRY_LOOKUP_COUNT}`,
      `SAMPLE_DISCOVERY_COUNT=${report.SAMPLE_DISCOVERY_COUNT}`,
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
    return;
  }

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
    `SAMPLE_DISCOVERY_COUNT=${report.SAMPLE_DISCOVERY_COUNT}`,
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
