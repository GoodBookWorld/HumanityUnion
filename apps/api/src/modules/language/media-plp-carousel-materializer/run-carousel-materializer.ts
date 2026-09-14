/**
 * Reset 03E.10 — bounded sequential Media carousel materializer.
 * Reuses 03E.9 inventory + proven one-entity materialize:media-plp.
 * Default DRY_RUN. --execute required for provider/writes (staging only).
 */

import type { LanguageCode } from "@hu/types";
import { isMediaPlpEntityType } from "@hu/types";

import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import {
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK,
  classifyMediaPlpCarouselEntity,
  discoverMediaPlpCarouselEntities,
  type MediaPlpCarouselEntityRow,
} from "../media-plp-carousel/index.js";
import {
  evaluateMediaPlpMaterializerExecuteGuards,
  evaluateMediaPlpMaterializerProductionRefusal,
  getMediaPlpPersistenceObservability,
  requireMediaPlpMaterializerMongoPersistence,
  resetMediaPlpMaterializerCountersForTests,
  runMediaPlpMaterializer,
  type MediaPlpMaterializerDeps,
  type MediaPlpMaterializerReport,
  type MediaPlpPersistenceObservability,
} from "../media-plp-materializer/index.js";
import {
  resolveMediaPlpOperatorMaxRssMb,
  resolveMediaPlpOperatorPreProviderMaxRssMb,
} from "../media-plp-materializer/constants.js";
import { normalizeMediaPlpRegistryLocaleIdentity } from "../media-plp-materializer/locale-identity.js";
import { assertMediaPlpCarouselMaterializerImportIsolation } from "./import-guards.js";
import {
  parseMediaPlpCarouselMaterializerArgs,
  type MediaPlpCarouselMaterializerArgs,
} from "./parse-args.js";
import {
  selectMediaPlpCarouselMaterializeEntities,
  type MediaPlpCarouselSelectionResult,
} from "./select-eligible.js";

export type MediaPlpCarouselMaterializeEntityOutcome =
  | "PUBLISHED"
  | "UNCHANGED"
  | "FAILED"
  | "SKIPPED_NOT_RUN"
  | "DRY_RUN_SELECTED";

export type MediaPlpCarouselMaterializeEntityResult = {
  readonly ENTITY_INDEX: number;
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly OUTCOME: MediaPlpCarouselMaterializeEntityOutcome;
  readonly PROVIDER_CALLS: number;
  readonly PLP_WRITES: number;
  readonly CONTENT_TRANSLATION_WRITES: number;
  readonly SOURCE_WRITES: number;
  readonly DURABILITY_VERIFIED: boolean | null;
  readonly RSS_PEAK_MB: number;
  readonly reason: string | null;
  readonly abortReason: string | null;
};

export type MediaPlpCarouselMaterializeReport = {
  readonly pack: typeof MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK;
  readonly operation: "materialize_media_plp_carousel";
  readonly OPERATOR_MODE: "DRY_RUN" | "EXECUTE";
  readonly LOCALE: string;
  readonly COUNTRY_CODE: string | null;
  readonly LIMIT: number;
  readonly PLP_PERSISTENCE_MODE: MediaPlpPersistenceObservability["PLP_PERSISTENCE_MODE"];
  readonly selection: MediaPlpCarouselSelectionResult;
  readonly entities: readonly MediaPlpCarouselMaterializeEntityResult[];
  readonly SELECTED: number;
  readonly PUBLISHED: number;
  readonly UNCHANGED: number;
  readonly FAILED: number;
  readonly PROVIDER_CALLS_TOTAL: number;
  readonly PLP_WRITES_TOTAL: number;
  readonly CONTENT_TRANSLATION_WRITES_TOTAL: number;
  readonly SOURCE_WRITES_TOTAL: number;
  readonly ABORT_REASON: string | null;
  readonly RSS_PEAK_MB: number;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly database: string | null;
};

export type MediaPlpCarouselMaterializeDeps = {
  readonly discoverRows?: (input: {
    readonly locale: LanguageCode;
    readonly countryCode: string | null;
  }) => Promise<readonly MediaPlpCarouselEntityRow[]>;
  readonly materializeOne?: (input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly locale: LanguageCode;
    readonly execute: boolean;
  }) => Promise<{
    readonly exitCode: number;
    readonly report: MediaPlpMaterializerReport | null;
    readonly errorMessage: string | null;
  }>;
  readonly materializerDeps?: MediaPlpMaterializerDeps;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly resolveDatabase?: () => string | null;
  readonly platformMode?: string | null;
  readonly currentRssMb?: () => number;
  readonly maxRssMb?: number;
  readonly preProviderMaxRssMb?: number;
  readonly skipImportBoundaryCheck?: boolean;
  readonly skipMongoPersistenceRequire?: boolean;
  /** Unit/fixture override; production CLI uses requireMediaPlpMaterializerMongoPersistence. */
  readonly requirePersistence?: () => MediaPlpPersistenceObservability;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

async function defaultDiscoverRows(input: {
  readonly locale: LanguageCode;
  readonly countryCode: string | null;
}): Promise<readonly MediaPlpCarouselEntityRow[]> {
  const refs = await discoverMediaPlpCarouselEntities({
    countryCode: input.countryCode,
    includeNews: true,
  });
  const rows: MediaPlpCarouselEntityRow[] = [];
  for (const ref of refs) {
    rows.push(
      await classifyMediaPlpCarouselEntity({
        ref,
        locale: input.locale,
      }),
    );
  }
  return rows;
}

function classifyOutcome(
  report: MediaPlpMaterializerReport | null,
  errorMessage: string | null,
): MediaPlpCarouselMaterializeEntityOutcome {
  if (errorMessage || !report) {
    return "FAILED";
  }
  if (report.abortReason) {
    return "FAILED";
  }
  if (report.OPERATOR_MODE === "DRY_RUN") {
    return "DRY_RUN_SELECTED";
  }
  if (report.LOCALIZATION_SOURCE === "UNCHANGED_PLP" || report.PLP_OUTCOME === "UNCHANGED") {
    return "UNCHANGED";
  }
  if (report.PLP_WRITES > 0 || report.PLP_OUTCOME === "PUBLISHED") {
    return "PUBLISHED";
  }
  if (report.EXISTING_PLP_USABILITY === "USABLE_LOCALIZED" && !report.REBUILD_REQUIRED) {
    return "UNCHANGED";
  }
  return "FAILED";
}

export async function runMediaPlpCarouselMaterializer(
  argv: readonly string[],
  deps: MediaPlpCarouselMaterializeDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpCarouselMaterializeReport | null;
  readonly errorMessage: string | null;
}> {
  // Fixture paths inject discoverRows; keep RSS measurement deterministic so
  // unit execute tests are not coupled to host process RSS / module-graph size.
  const readRssMb =
    deps.currentRssMb ?? (deps.discoverRows ? () => 50 : rssMb);
  const peakTracker = { value: readRssMb() };
  const bump = () => {
    const now = readRssMb();
    if (now > peakTracker.value) peakTracker.value = now;
    return now;
  };

  if (!deps.skipImportBoundaryCheck) {
    const isolation = assertMediaPlpCarouselMaterializerImportIsolation();
    if (!isolation.ok) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `materialize:media-plp-carousel import boundary violated: ${isolation.violations.join(", ")}`,
      };
    }
  }

  const parsed = parseMediaPlpCarouselMaterializerArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  let args = parsed.args;

  const production = evaluateMediaPlpMaterializerProductionRefusal({
    database: deps.resolveDatabase?.() ?? undefined,
    platformMode: deps.platformMode,
  });
  if (production.refused) {
    return { exitCode: 2, report: null, errorMessage: production.reason };
  }

  if (args.execute) {
    const executeGuards = evaluateMediaPlpMaterializerExecuteGuards({
      database: deps.resolveDatabase?.() ?? undefined,
      platformMode: deps.platformMode,
    });
    if (executeGuards.refused) {
      return { exitCode: 2, report: null, errorMessage: executeGuards.reason };
    }
  }

  const mongoReady = (deps.isMongoConfigured ?? isMongoConfigured)();
  if (!mongoReady && !deps.discoverRows && !deps.skipMongoPersistenceRequire) {
    return { exitCode: 1, report: null, errorMessage: "MONGODB_URI is not configured." };
  }

  // Fail-closed Mongo PLP bind BEFORE any carousel PLP read/classify (parity with
  // materialize:media-plp). Never discover against accidental MEMORY while URI is set.
  let persistence: MediaPlpPersistenceObservability;
  try {
    if (deps.requirePersistence) {
      persistence = deps.requirePersistence();
    } else if (deps.skipMongoPersistenceRequire) {
      persistence = getMediaPlpPersistenceObservability();
    } else {
      persistence = requireMediaPlpMaterializerMongoPersistence(
        "materialize:media-plp-carousel --mongo",
      );
    }
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: error instanceof Error ? error.message : "PLP Mongo persistence required",
    };
  }
  if (persistence.PLP_PERSISTENCE_MODE !== "MONGO" && !deps.skipMongoPersistenceRequire) {
    return {
      exitCode: 1,
      report: null,
      errorMessage:
        "PLP persistence mode is not MONGO (materialize:media-plp-carousel --mongo). Refusing silent memory fallback.",
    };
  }

  const maxRss = deps.maxRssMb ?? resolveMediaPlpOperatorMaxRssMb();
  const preProviderMax =
    deps.preProviderMaxRssMb ?? resolveMediaPlpOperatorPreProviderMaxRssMb();

  let connected = false;
  try {
    if (!deps.discoverRows) {
      await (deps.connect ?? connectMongoClient)();
      connected = true;
    } else if (deps.connect) {
      await deps.connect();
      connected = true;
    }
    bump();

    const localeInfo = deps.materializerDeps?.loadLocale
      ? await deps.materializerDeps.loadLocale(args.locale)
      : deps.discoverRows
        ? {
            // Fixture/discover override path: preserve Registry-style identity
            // without requiring a live Language Registry Mongo round-trip.
            LOCALE_REGISTRY_FOUND: true,
            LOCALE_ENABLED: true,
            CONTENT_TRANSLATION_ENABLED: true,
            CANONICAL_LOCALE: normalizeMediaPlpRegistryLocaleIdentity(args.locale),
          }
        : await (
            await import("../media-plp-materializer/locale-lookup.js")
          ).loadMediaPlpMaterializerLocale(args.locale);
    args = {
      ...args,
      locale:
        localeInfo.CANONICAL_LOCALE ??
        normalizeMediaPlpRegistryLocaleIdentity(args.locale),
    };

    const rows = await (deps.discoverRows ?? defaultDiscoverRows)({
      locale: args.locale,
      countryCode: args.countryCode,
    });
    bump();

    const selection = selectMediaPlpCarouselMaterializeEntities(rows, args.limit);

    if (!args.execute) {
      const report: MediaPlpCarouselMaterializeReport = {
        pack: MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK,
        operation: "materialize_media_plp_carousel",
        OPERATOR_MODE: "DRY_RUN",
        LOCALE: args.locale,
        COUNTRY_CODE: args.countryCode,
        LIMIT: args.limit,
        PLP_PERSISTENCE_MODE: persistence.PLP_PERSISTENCE_MODE,
        selection,
        entities: selection.selected.map((item, index) => ({
          ENTITY_INDEX: index + 1,
          ENTITY_TYPE: item.entityType,
          ENTITY_ID: item.entityId,
          OUTCOME: "DRY_RUN_SELECTED",
          PROVIDER_CALLS: 0,
          PLP_WRITES: 0,
          CONTENT_TRANSLATION_WRITES: 0,
          SOURCE_WRITES: 0,
          DURABILITY_VERIFIED: null,
          RSS_PEAK_MB: peakTracker.value,
          reason: item.rebuildReason,
          abortReason: null,
        })),
        SELECTED: selection.SELECTED_BY_LIMIT,
        PUBLISHED: 0,
        UNCHANGED: 0,
        FAILED: 0,
        PROVIDER_CALLS_TOTAL: 0,
        PLP_WRITES_TOTAL: 0,
        CONTENT_TRANSLATION_WRITES_TOTAL: 0,
        SOURCE_WRITES_TOTAL: 0,
        ABORT_REASON: null,
        RSS_PEAK_MB: peakTracker.value,
        IMPORT_BOUNDARY_OK: true,
        database:
          persistence.PLP_READ_DATABASE ??
          deps.resolveDatabase?.() ??
          resolveMongoConfig().database,
      };
      return { exitCode: 0, report, errorMessage: null };
    }

    const entityResults: MediaPlpCarouselMaterializeEntityResult[] = [];
    let published = 0;
    let unchanged = 0;
    let failed = 0;
    let providerTotal = 0;
    let plpWritesTotal = 0;
    let ctWritesTotal = 0;
    let sourceWritesTotal = 0;
    let abortReason: string | null = null;

    const materializeOne =
      deps.materializeOne ??
      (async (input: {
        readonly entityType: string;
        readonly entityId: string;
        readonly locale: LanguageCode;
        readonly execute: boolean;
      }) => {
        if (!isMediaPlpEntityType(input.entityType)) {
          return {
            exitCode: 2,
            report: null,
            errorMessage: `Unsupported entityType=${input.entityType}`,
          };
        }
        resetMediaPlpMaterializerCountersForTests();
        const oneArgv = [
          "node",
          "materialize-media-plp.ts",
          "--mongo",
          "--entity-type",
          input.entityType,
          "--entity-id",
          input.entityId,
          "--locale",
          input.locale,
          ...(input.execute ? ["--execute"] : []),
        ];
        return runMediaPlpMaterializer(oneArgv, {
          ...deps.materializerDeps,
          // Shared connection: carousel runner owns connect/disconnect.
          connect: async () => undefined,
          disconnect: async () => undefined,
          skipImportBoundaryCheck: true,
          // Persistence already bound above; keep the same MONGO repository.
          requirePersistence: () => persistence,
          skipMongoPersistenceRequire: deps.skipMongoPersistenceRequire,
          platformMode: deps.platformMode,
          resolveDatabase: deps.resolveDatabase,
          currentRssMb: deps.currentRssMb ?? rssMb,
          maxRssMb: maxRss,
          preProviderMaxRssMb: preProviderMax,
        });
      });

    for (let i = 0; i < selection.selected.length; i += 1) {
      const item = selection.selected[i]!;
      const rssNow = bump();
      if (rssNow > preProviderMax || rssNow > maxRss) {
        abortReason = `RSS_GUARD_EXCEEDED:${rssNow}>${Math.min(preProviderMax, maxRss)}`;
        entityResults.push({
          ENTITY_INDEX: i + 1,
          ENTITY_TYPE: item.entityType,
          ENTITY_ID: item.entityId,
          OUTCOME: "SKIPPED_NOT_RUN",
          PROVIDER_CALLS: 0,
          PLP_WRITES: 0,
          CONTENT_TRANSLATION_WRITES: 0,
          SOURCE_WRITES: 0,
          DURABILITY_VERIFIED: null,
          RSS_PEAK_MB: peakTracker.value,
          reason: item.rebuildReason,
          abortReason,
        });
        for (let j = i + 1; j < selection.selected.length; j += 1) {
          const later = selection.selected[j]!;
          entityResults.push({
            ENTITY_INDEX: j + 1,
            ENTITY_TYPE: later.entityType,
            ENTITY_ID: later.entityId,
            OUTCOME: "SKIPPED_NOT_RUN",
            PROVIDER_CALLS: 0,
            PLP_WRITES: 0,
            CONTENT_TRANSLATION_WRITES: 0,
            SOURCE_WRITES: 0,
            DURABILITY_VERIFIED: null,
            RSS_PEAK_MB: peakTracker.value,
            reason: later.rebuildReason,
            abortReason,
          });
        }
        break;
      }

      // Strictly sequential — await before next provider call.
      const result = await materializeOne({
        entityType: item.entityType,
        entityId: item.entityId,
        locale: args.locale,
        execute: true,
      });
      bump();

      const outcome = classifyOutcome(result.report, result.errorMessage);
      const providerCalls = result.report?.PROVIDER_CALL_COUNT ?? 0;
      const plpWrites = result.report?.PLP_WRITES ?? 0;
      const ctWrites = result.report?.CONTENT_TRANSLATION_WRITES ?? 0;
      const sourceWrites = result.report?.SOURCE_WRITES ?? 0;
      providerTotal += providerCalls;
      plpWritesTotal += plpWrites;
      ctWritesTotal += ctWrites;
      sourceWritesTotal += sourceWrites;

      const entityAbort =
        result.errorMessage ??
        result.report?.abortReason ??
        (outcome === "FAILED" ? "ENTITY_MATERIALIZE_FAILED" : null);

      if (outcome === "PUBLISHED") published += 1;
      else if (outcome === "UNCHANGED") unchanged += 1;
      else if (outcome === "FAILED") failed += 1;

      entityResults.push({
        ENTITY_INDEX: i + 1,
        ENTITY_TYPE: item.entityType,
        ENTITY_ID: item.entityId,
        OUTCOME: outcome,
        PROVIDER_CALLS: providerCalls,
        PLP_WRITES: plpWrites,
        CONTENT_TRANSLATION_WRITES: ctWrites,
        SOURCE_WRITES: sourceWrites,
        DURABILITY_VERIFIED: result.report?.PLP_DURABILITY_VERIFIED ?? null,
        RSS_PEAK_MB: peakTracker.value,
        reason: item.rebuildReason,
        abortReason: entityAbort,
      });

      if (outcome === "FAILED") {
        abortReason = entityAbort ?? "ENTITY_MATERIALIZE_FAILED";
        // Fail-fast: do not continue provider execution.
        for (let j = i + 1; j < selection.selected.length; j += 1) {
          const later = selection.selected[j]!;
          entityResults.push({
            ENTITY_INDEX: j + 1,
            ENTITY_TYPE: later.entityType,
            ENTITY_ID: later.entityId,
            OUTCOME: "SKIPPED_NOT_RUN",
            PROVIDER_CALLS: 0,
            PLP_WRITES: 0,
            CONTENT_TRANSLATION_WRITES: 0,
            SOURCE_WRITES: 0,
            DURABILITY_VERIFIED: null,
            RSS_PEAK_MB: peakTracker.value,
            reason: later.rebuildReason,
            abortReason,
          });
        }
        break;
      }
    }

    const report: MediaPlpCarouselMaterializeReport = {
      pack: MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK,
      operation: "materialize_media_plp_carousel",
      OPERATOR_MODE: "EXECUTE",
      LOCALE: args.locale,
      COUNTRY_CODE: args.countryCode,
      LIMIT: args.limit,
      PLP_PERSISTENCE_MODE: persistence.PLP_PERSISTENCE_MODE,
      selection,
      entities: entityResults,
      SELECTED: selection.SELECTED_BY_LIMIT,
      PUBLISHED: published,
      UNCHANGED: unchanged,
      FAILED: failed,
      PROVIDER_CALLS_TOTAL: providerTotal,
      PLP_WRITES_TOTAL: plpWritesTotal,
      CONTENT_TRANSLATION_WRITES_TOTAL: ctWritesTotal,
      SOURCE_WRITES_TOTAL: sourceWritesTotal,
      ABORT_REASON: abortReason,
      RSS_PEAK_MB: peakTracker.value,
      IMPORT_BOUNDARY_OK: true,
      database:
        persistence.PLP_READ_DATABASE ??
        deps.resolveDatabase?.() ??
        resolveMongoConfig().database,
    };

    return {
      exitCode: abortReason || failed > 0 ? 1 : 0,
      report,
      errorMessage: abortReason,
    };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: error instanceof Error ? error.message : "carousel materializer failed",
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

export function printMediaPlpCarouselMaterializeReport(
  report: MediaPlpCarouselMaterializeReport,
): void {
  console.log(
    JSON.stringify(
      {
        pack: report.pack,
        operation: report.operation,
        OPERATOR_MODE: report.OPERATOR_MODE,
        LOCALE: report.LOCALE,
        COUNTRY_CODE: report.COUNTRY_CODE,
        LIMIT: report.LIMIT,
        PLP_PERSISTENCE_MODE: report.PLP_PERSISTENCE_MODE,
        database: report.database,
        IMPORT_BOUNDARY_OK: report.IMPORT_BOUNDARY_OK,
      },
      null,
      2,
    ),
  );

  console.log("--- SELECTION ---");
  console.log(`TOTAL_DISCOVERED=${report.selection.TOTAL_DISCOVERED}`);
  console.log(`ELIGIBLE=${report.selection.ELIGIBLE}`);
  console.log(`SKIPPED_USABLE=${report.selection.SKIPPED_USABLE}`);
  console.log(`SKIPPED_ZERO_NODES=${report.selection.SKIPPED_ZERO_NODES}`);
  console.log(`SKIPPED_DOMAIN=${report.selection.SKIPPED_DOMAIN}`);
  console.log(`SELECTED_BY_LIMIT=${report.selection.SELECTED_BY_LIMIT}`);

  console.log("--- SELECTED ---");
  for (const item of report.selection.selected) {
    console.log(
      [
        item.entityType,
        item.entityId,
        `reason=${item.rebuildReason}`,
        `nodes=${item.nodes}`,
        `bytes=${item.bytes ?? "-"}`,
        `wouldCallProvider=${item.wouldCallProvider ? "yes" : "no"}`,
        `wouldPublish=${item.wouldPublish ? "yes" : "no"}`,
      ].join(" | "),
    );
  }

  if (report.OPERATOR_MODE === "EXECUTE") {
    console.log("--- ENTITY_RESULTS ---");
    for (const row of report.entities) {
      console.log(
        [
          `ENTITY_INDEX=${row.ENTITY_INDEX}`,
          `ENTITY_TYPE=${row.ENTITY_TYPE}`,
          `ENTITY_ID=${row.ENTITY_ID}`,
          `OUTCOME=${row.OUTCOME}`,
          `PROVIDER_CALLS=${row.PROVIDER_CALLS}`,
          `PLP_WRITES=${row.PLP_WRITES}`,
          `DURABILITY_VERIFIED=${row.DURABILITY_VERIFIED ?? "-"}`,
          `RSS_PEAK_MB=${row.RSS_PEAK_MB}`,
        ].join(" | "),
      );
    }
  }

  console.log("--- TOTALS ---");
  console.log(`SELECTED=${report.SELECTED}`);
  console.log(`PUBLISHED=${report.PUBLISHED}`);
  console.log(`UNCHANGED=${report.UNCHANGED}`);
  console.log(`FAILED=${report.FAILED}`);
  console.log(`PROVIDER_CALLS_TOTAL=${report.PROVIDER_CALLS_TOTAL}`);
  console.log(`PLP_WRITES_TOTAL=${report.PLP_WRITES_TOTAL}`);
  console.log(`ABORT_REASON=${report.ABORT_REASON ?? "-"}`);
  console.log(`RSS_PEAK_MB=${report.RSS_PEAK_MB}`);
}
