/**
 * Reset 03B — thin single-entity Media PLP materializer runner.
 * Default DRY RUN: zero writes, zero provider imports/calls.
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
import { publishMediaPlpEntity } from "../published-localized-presentation/media/publisher.js";
import {
  getMediaPlpMaterializerCounters,
  markMaterializerMongoClosed,
  markMaterializerPlpWrite,
} from "./counters.js";
import {
  resolveMediaPlpOperatorMaxProviderInputBytes,
  resolveMediaPlpOperatorMaxRssMb,
} from "./constants.js";
import { assertMediaPlpMaterializerImportIsolation } from "./import-guards.js";
import { loadMediaPlpMaterializerLocale } from "./locale-lookup.js";
import {
  captureMaterializerAfterImport,
  captureMaterializerAfterMongoConnect,
  captureMaterializerAfterPublish,
  captureMaterializerAfterProvider,
  captureMaterializerAfterSourceLookup,
  captureMaterializerAfterTranslationLookup,
  captureMaterializerBeforeProvider,
  captureMaterializerStart,
  currentMaterializerRssMb,
  getMediaPlpMaterializerMemoryPhases,
} from "./memory-phases.js";
import { parseMediaPlpMaterializerArgs } from "./parse-args.js";
import { inspectMediaPlpCurrent } from "./plp-inspect.js";
import { resolveMediaPlpMaterializerSource } from "./source-resolve.js";
import {
  evaluateMediaPlpMaterializerExecuteGuards,
  evaluateMediaPlpMaterializerProductionRefusal,
} from "./staging-guards.js";
import { lookupExistingMediaPlpTranslation } from "./translation-reuse.js";
import type { MediaPlpMaterializerArgs } from "./parse-args.js";
import type { MediaPlpMaterializerSourceResolve } from "./source-resolve.js";
import type { MediaPlpExistingTranslationLookup } from "./translation-reuse.js";
import type { MediaPlpMaterializerPlpInspect } from "./plp-inspect.js";
import type { MediaPlpMaterializerLocaleLookup } from "./locale-lookup.js";
import type { TranslationProvider } from "../translation-provider.js";
import type { ProviderBoundaryResult } from "./provider-boundary.js";

export type MediaPlpMaterializerReport = {
  readonly pack: "RESET_03B";
  readonly operation: "materialize_media_plp";
  readonly OPERATOR_MODE: "DRY_RUN" | "EXECUTE";
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly LOCALE: string;
  readonly CANONICAL_VERSION: string | null;
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly PLP_CURRENT_FOUND: boolean;
  readonly EXISTING_TRANSLATION_STATE: string;
  readonly EXISTING_TRANSLATION_COMPLETE: boolean;
  readonly WOULD_REUSE_EXISTING_TRANSLATION: boolean;
  readonly WOULD_CALL_PROVIDER: boolean;
  readonly WOULD_PUBLISH_PLP: boolean;
  readonly LOCALIZATION_SOURCE: "EXISTING_CURRENT" | "PROVIDER" | "NONE" | "UNCHANGED_PLP";
  readonly PROVIDER_IMPORTED: boolean;
  readonly PROVIDER_CALL_COUNT: number;
  readonly AUTO_NODE_COUNT: number;
  readonly PROVIDER_INPUT_BYTES: number;
  readonly PLP_WRITES: number;
  readonly CONTENT_TRANSLATION_WRITES: number;
  readonly SOURCE_WRITES: number;
  readonly PLP_OUTCOME: string | null;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly RSS_GUARD_MB: number;
  readonly PROVIDER_INPUT_LIMIT_BYTES: number;
  readonly HU_MEDIA_PLP_ENABLED: string;
  readonly database: string | null;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getMediaPlpMaterializerMemoryPhases>;
  readonly abortReason: string | null;
};

export type MediaPlpMaterializerDeps = {
  readonly resolveSource?: (
    args: MediaPlpMaterializerArgs,
  ) => Promise<MediaPlpMaterializerSourceResolve>;
  readonly inspectPlp?: (input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly locale: string;
    readonly canonicalVersion: string | null;
  }) => Promise<MediaPlpMaterializerPlpInspect>;
  readonly lookupTranslation?: (input: {
    readonly entityType: MediaPlpMaterializerArgs["entityType"];
    readonly entityId: string;
    readonly locale: MediaPlpMaterializerArgs["locale"];
    readonly autoPaths: readonly string[];
  }) => Promise<MediaPlpExistingTranslationLookup>;
  readonly loadLocale?: (
    locale: MediaPlpMaterializerArgs["locale"],
  ) => Promise<MediaPlpMaterializerLocaleLookup>;
  readonly importProvider?: () => Promise<TranslationProvider>;
  readonly publish?: typeof publishMediaPlpEntity;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly resolveDatabase?: () => string | null;
  readonly platformMode?: string | null;
  readonly maxRssMb?: number;
  readonly maxProviderInputBytes?: number;
  readonly currentRssMb?: () => number;
  readonly skipImportBoundaryCheck?: boolean;
};

function buildReport(input: {
  readonly args: MediaPlpMaterializerArgs;
  readonly source: MediaPlpMaterializerSourceResolve;
  readonly plp: MediaPlpMaterializerPlpInspect;
  readonly translation: MediaPlpExistingTranslationLookup;
  readonly wouldReuse: boolean;
  readonly wouldCallProvider: boolean;
  readonly wouldPublish: boolean;
  readonly localizationSource: MediaPlpMaterializerReport["LOCALIZATION_SOURCE"];
  readonly providerInputBytes: number;
  readonly plpOutcome: string | null;
  readonly abortReason: string | null;
  readonly database: string | null;
}): MediaPlpMaterializerReport {
  const counters = getMediaPlpMaterializerCounters();
  return {
    pack: "RESET_03B",
    operation: "materialize_media_plp",
    OPERATOR_MODE: input.args.execute ? "EXECUTE" : "DRY_RUN",
    ENTITY_TYPE: input.args.entityType,
    ENTITY_ID: input.args.entityId,
    LOCALE: input.args.locale,
    CANONICAL_VERSION: input.source.CANONICAL_VERSION,
    SOURCE_FOUND: input.source.SOURCE_FOUND,
    SOURCE_PUBLIC: input.source.SOURCE_PUBLIC,
    PLP_CURRENT_FOUND: input.plp.PLP_CURRENT_FOUND,
    EXISTING_TRANSLATION_STATE: input.translation.EXISTING_TRANSLATION_STATE,
    EXISTING_TRANSLATION_COMPLETE: input.translation.EXISTING_TRANSLATION_COMPLETE,
    WOULD_REUSE_EXISTING_TRANSLATION: input.wouldReuse,
    WOULD_CALL_PROVIDER: input.wouldCallProvider,
    WOULD_PUBLISH_PLP: input.wouldPublish,
    LOCALIZATION_SOURCE: input.localizationSource,
    PROVIDER_IMPORTED: counters.PROVIDER_IMPORTED,
    PROVIDER_CALL_COUNT: counters.PROVIDER_CALL_COUNT,
    AUTO_NODE_COUNT: input.source.autoPaths.length,
    PROVIDER_INPUT_BYTES: input.providerInputBytes,
    PLP_WRITES: counters.PLP_WRITES,
    CONTENT_TRANSLATION_WRITES: counters.CONTENT_TRANSLATION_WRITES,
    SOURCE_WRITES: counters.SOURCE_WRITES,
    PLP_OUTCOME: input.plpOutcome,
    IMPORT_BOUNDARY_OK: true,
    RSS_GUARD_MB: resolveMediaPlpOperatorMaxRssMb(),
    PROVIDER_INPUT_LIMIT_BYTES: resolveMediaPlpOperatorMaxProviderInputBytes(),
    HU_MEDIA_PLP_ENABLED: process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)",
    database: input.database,
    MONGO_CLOSED: false,
    memory: getMediaPlpMaterializerMemoryPhases(),
    abortReason: input.abortReason,
  };
}

export async function runMediaPlpMaterializer(
  argv: readonly string[],
  deps: MediaPlpMaterializerDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpMaterializerReport | null;
  readonly errorMessage: string | null;
}> {
  captureMaterializerStart();
  captureMaterializerAfterImport();

  if (!deps.skipImportBoundaryCheck) {
    const isolation = assertMediaPlpMaterializerImportIsolation();
    if (!isolation.ok) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `materialize:media-plp import boundary violated: ${isolation.violations.join(", ")}`,
      };
    }
  }

  const parsed = parseMediaPlpMaterializerArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  const args = parsed.args;

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
  if (!mongoReady && !deps.resolveSource) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let connected = false;
  try {
    if (!deps.resolveSource) {
      await (deps.connect ?? connectMongoClient)();
      connected = true;
    } else if (deps.connect) {
      await deps.connect();
      connected = true;
    }
    captureMaterializerAfterMongoConnect();

    const source = await (deps.resolveSource ?? resolveMediaPlpMaterializerSource)(args);
    captureMaterializerAfterSourceLookup();

    if (source.identityCollision) {
      return {
        exitCode: 2,
        report: null,
        errorMessage: `Source lookup returned multiple identities for ${args.entityType}/${args.entityId}`,
      };
    }

    const plp = await (deps.inspectPlp ?? inspectMediaPlpCurrent)({
      entityType: args.entityType,
      entityId: args.entityId,
      locale: args.locale,
      canonicalVersion: source.CANONICAL_VERSION,
    });

    const translation = await (deps.lookupTranslation ?? lookupExistingMediaPlpTranslation)({
      entityType: args.entityType,
      entityId: args.entityId,
      locale: args.locale,
      autoPaths: source.autoPaths.map((n) => n.path),
    });
    captureMaterializerAfterTranslationLookup();

    const localeInfo = await (deps.loadLocale ?? loadMediaPlpMaterializerLocale)(args.locale);

    const database =
      deps.resolveDatabase?.() ??
      (isMongoConfigured() ? resolveMongoConfig().database : null);

    const wouldReuse = translation.EXISTING_TRANSLATION_COMPLETE;
    const alreadyCurrent = plp.PLP_MATCHES_CURRENT_SOURCE;
    const wouldCallProvider =
      source.SOURCE_FOUND &&
      source.SOURCE_PUBLIC &&
      !alreadyCurrent &&
      !wouldReuse &&
      source.autoPaths.length > 0;
    const wouldPublish =
      source.SOURCE_FOUND &&
      source.SOURCE_PUBLIC &&
      Boolean(source.CANONICAL_VERSION) &&
      !alreadyCurrent &&
      (wouldReuse || wouldCallProvider);

    const autoCanonicalValues: Record<string, string> = {};
    for (const node of source.autoPaths) {
      autoCanonicalValues[node.path] = node.value;
    }
    const estimatedProviderBytes = Buffer.byteLength(
      JSON.stringify(autoCanonicalValues),
      "utf8",
    );

    if (!args.execute) {
      const report = buildReport({
        args,
        source,
        plp,
        translation,
        wouldReuse,
        wouldCallProvider,
        wouldPublish,
        localizationSource: alreadyCurrent
          ? "UNCHANGED_PLP"
          : wouldReuse
            ? "EXISTING_CURRENT"
            : wouldCallProvider
              ? "PROVIDER"
              : "NONE",
        providerInputBytes: wouldCallProvider ? estimatedProviderBytes : 0,
        plpOutcome: null,
        abortReason: null,
        database,
      });
      return { exitCode: 0, report, errorMessage: null };
    }

    // ---- EXECUTE path ----
    if (!source.SOURCE_FOUND || !source.SOURCE_PUBLIC || !source.CANONICAL_VERSION) {
      const report = buildReport({
        args,
        source,
        plp,
        translation,
        wouldReuse,
        wouldCallProvider: false,
        wouldPublish: false,
        localizationSource: "NONE",
        providerInputBytes: 0,
        plpOutcome: null,
        abortReason: "SOURCE_NOT_PUBLIC_OR_MISSING",
        database,
      });
      return { exitCode: 1, report, errorMessage: "Source missing or not public." };
    }

    if (
      !localeInfo.LOCALE_REGISTRY_FOUND ||
      !localeInfo.LOCALE_ENABLED ||
      !localeInfo.CONTENT_TRANSLATION_ENABLED
    ) {
      const report = buildReport({
        args,
        source,
        plp,
        translation,
        wouldReuse,
        wouldCallProvider: false,
        wouldPublish: false,
        localizationSource: "NONE",
        providerInputBytes: 0,
        plpOutcome: null,
        abortReason: "LOCALE_NOT_ELIGIBLE",
        database,
      });
      return {
        exitCode: 1,
        report,
        errorMessage: "Locale missing/disabled/contentTranslationEnabled=false.",
      };
    }

    if (alreadyCurrent) {
      const report = buildReport({
        args,
        source,
        plp,
        translation,
        wouldReuse: false,
        wouldCallProvider: false,
        wouldPublish: false,
        localizationSource: "UNCHANGED_PLP",
        providerInputBytes: 0,
        plpOutcome: "IDEMPOTENT",
        abortReason: null,
        database,
      });
      return { exitCode: 0, report, errorMessage: null };
    }

    let localizationValues: Record<string, string> = {};
    let localizationSource: MediaPlpMaterializerReport["LOCALIZATION_SOURCE"] = "NONE";
    let providerInputBytes = 0;

    if (wouldReuse) {
      localizationValues = { ...translation.values };
      localizationSource = "EXISTING_CURRENT";
    } else {
      const maxRss = deps.maxRssMb ?? resolveMediaPlpOperatorMaxRssMb();
      const rssNow = (deps.currentRssMb ?? currentMaterializerRssMb)();
      captureMaterializerBeforeProvider();
      if (rssNow >= maxRss) {
        const report = buildReport({
          args,
          source,
          plp,
          translation,
          wouldReuse: false,
          wouldCallProvider: true,
          wouldPublish: false,
          localizationSource: "NONE",
          providerInputBytes: estimatedProviderBytes,
          plpOutcome: null,
          abortReason: "RSS_GUARD_BEFORE_PROVIDER",
          database,
        });
        return {
          exitCode: 1,
          report,
          errorMessage: `RSS guard aborted before provider (${rssNow} >= ${maxRss} MB).`,
        };
      }

      const maxBytes =
        deps.maxProviderInputBytes ?? resolveMediaPlpOperatorMaxProviderInputBytes();
      if (estimatedProviderBytes > maxBytes) {
        const report = buildReport({
          args,
          source,
          plp,
          translation,
          wouldReuse: false,
          wouldCallProvider: true,
          wouldPublish: false,
          localizationSource: "NONE",
          providerInputBytes: estimatedProviderBytes,
          plpOutcome: null,
          abortReason: "PAYLOAD_LIMIT",
          database,
        });
        return {
          exitCode: 1,
          report,
          errorMessage: `Provider payload ${estimatedProviderBytes} exceeds limit ${maxBytes}.`,
        };
      }

      const providerModule = await import("./provider-boundary.js");
      const provider =
        (await (deps.importProvider ?? providerModule.importMediaPlpMaterializerProvider)()) as TranslationProvider;
      const providerResult: ProviderBoundaryResult =
        await providerModule.callMediaPlpMaterializerProviderOnce({
          provider,
          locale: args.locale,
          autoValues: autoCanonicalValues,
          sourceRecordId: `${args.entityType}:${args.entityId}`,
          sourceVersion: source.CANONICAL_VERSION,
          maxInputBytes: maxBytes,
        });
      captureMaterializerAfterProvider();

      if (!providerResult.ok) {
        const report = buildReport({
          args,
          source,
          plp,
          translation,
          wouldReuse: false,
          wouldCallProvider: true,
          wouldPublish: false,
          localizationSource: "NONE",
          providerInputBytes: providerResult.PROVIDER_INPUT_BYTES,
          plpOutcome: null,
          abortReason: providerResult.reason,
          database,
        });
        return { exitCode: 1, report, errorMessage: providerResult.message };
      }

      const rssAfter = (deps.currentRssMb ?? currentMaterializerRssMb)();
      if (rssAfter >= maxRss) {
        const report = buildReport({
          args,
          source,
          plp,
          translation,
          wouldReuse: false,
          wouldCallProvider: true,
          wouldPublish: false,
          localizationSource: "NONE",
          providerInputBytes: providerResult.PROVIDER_INPUT_BYTES,
          plpOutcome: null,
          abortReason: "RSS_GUARD_AFTER_PROVIDER",
          database,
        });
        return {
          exitCode: 1,
          report,
          errorMessage: `RSS guard aborted after provider (${rssAfter} >= ${maxRss} MB); no PLP write.`,
        };
      }

      localizationValues = { ...providerResult.values };
      localizationSource = "PROVIDER";
      providerInputBytes = providerResult.PROVIDER_INPUT_BYTES;
    }

    const contentRevision = (plp.PLP_CONTENT_REVISION ?? 0) + 1;
    const publish = deps.publish ?? publishMediaPlpEntity;
    const publishResult = await publish({
      entityType: args.entityType,
      entityId: args.entityId,
      locale: args.locale,
      canonicalVersion: source.CANONICAL_VERSION,
      contentRevision,
      canonicalPresentation: source.canonicalPresentation!,
      layers: [
        {
          source: "MACHINE",
          values: localizationValues,
          provider: localizationSource === "PROVIDER" ? "materializer" : "existing_current",
        },
      ],
      includeDeterministicMachine: false,
    });

    if (!publishResult.ok) {
      const report = buildReport({
        args,
        source,
        plp,
        translation,
        wouldReuse,
        wouldCallProvider: localizationSource === "PROVIDER",
        wouldPublish: true,
        localizationSource,
        providerInputBytes,
        plpOutcome: publishResult.outcome,
        abortReason:
          publishResult.outcome === "NOT_READY" ? "PARTIAL_OR_NOT_READY" : publishResult.outcome,
        database,
      });
      return {
        exitCode: 1,
        report,
        errorMessage: `PLP publish failed: ${publishResult.outcome}`,
      };
    }

    markMaterializerPlpWrite();
    captureMaterializerAfterPublish();

    const report = buildReport({
      args,
      source,
      plp,
      translation,
      wouldReuse,
      wouldCallProvider: localizationSource === "PROVIDER",
      wouldPublish: true,
      localizationSource,
      providerInputBytes,
      plpOutcome: publishResult.outcome,
      abortReason: null,
      database,
    });
    // Ensure schema constant referenced for execute gate documentation.
    void PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
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
        // ignore
      }
      markMaterializerMongoClosed();
    }
  }
}

export function printMediaPlpMaterializerReport(
  report: MediaPlpMaterializerReport,
): void {
  const lines = [
    `OPERATOR_MODE=${report.OPERATOR_MODE}`,
    `ENTITY_TYPE=${report.ENTITY_TYPE}`,
    `ENTITY_ID=${report.ENTITY_ID}`,
    `LOCALE=${report.LOCALE}`,
    `CANONICAL_VERSION=${report.CANONICAL_VERSION ?? ""}`,
    `SOURCE_FOUND=${report.SOURCE_FOUND}`,
    `SOURCE_PUBLIC=${report.SOURCE_PUBLIC}`,
    `PLP_CURRENT_FOUND=${report.PLP_CURRENT_FOUND}`,
    `EXISTING_TRANSLATION_STATE=${report.EXISTING_TRANSLATION_STATE}`,
    `EXISTING_TRANSLATION_COMPLETE=${report.EXISTING_TRANSLATION_COMPLETE}`,
    `WOULD_REUSE_EXISTING_TRANSLATION=${report.WOULD_REUSE_EXISTING_TRANSLATION}`,
    `WOULD_CALL_PROVIDER=${report.WOULD_CALL_PROVIDER}`,
    `WOULD_PUBLISH_PLP=${report.WOULD_PUBLISH_PLP}`,
    `LOCALIZATION_SOURCE=${report.LOCALIZATION_SOURCE}`,
    `PROVIDER_IMPORTED=${report.PROVIDER_IMPORTED}`,
    `PROVIDER_CALL_COUNT=${report.PROVIDER_CALL_COUNT}`,
    `AUTO_NODE_COUNT=${report.AUTO_NODE_COUNT}`,
    `PROVIDER_INPUT_BYTES=${report.PROVIDER_INPUT_BYTES}`,
    `PLP_WRITES=${report.PLP_WRITES}`,
    `CONTENT_TRANSLATION_WRITES=${report.CONTENT_TRANSLATION_WRITES}`,
    `SOURCE_WRITES=${report.SOURCE_WRITES}`,
    `PLP_OUTCOME=${report.PLP_OUTCOME ?? ""}`,
    `IMPORT_BOUNDARY_OK=${report.IMPORT_BOUNDARY_OK}`,
    `RSS_GUARD_MB=${report.RSS_GUARD_MB}`,
    `PROVIDER_INPUT_LIMIT_BYTES=${report.PROVIDER_INPUT_LIMIT_BYTES}`,
    `HU_MEDIA_PLP_ENABLED=${report.HU_MEDIA_PLP_ENABLED}`,
    `database=${report.database ?? ""}`,
    `abortReason=${report.abortReason ?? ""}`,
    `MONGO_CLOSED=${getMediaPlpMaterializerCounters().MONGO_CLOSED}`,
    `RSS_START_MB=${report.memory.RSS_START_MB}`,
    `RSS_AFTER_IMPORT_MB=${report.memory.RSS_AFTER_IMPORT_MB}`,
    `RSS_AFTER_MONGO_CONNECT_MB=${report.memory.RSS_AFTER_MONGO_CONNECT_MB}`,
    `RSS_AFTER_SOURCE_LOOKUP_MB=${report.memory.RSS_AFTER_SOURCE_LOOKUP_MB}`,
    `RSS_AFTER_TRANSLATION_LOOKUP_MB=${report.memory.RSS_AFTER_TRANSLATION_LOOKUP_MB}`,
    `RSS_BEFORE_PROVIDER_MB=${report.memory.RSS_BEFORE_PROVIDER_MB ?? ""}`,
    `RSS_AFTER_PROVIDER_MB=${report.memory.RSS_AFTER_PROVIDER_MB ?? ""}`,
    `RSS_AFTER_PUBLISH_MB=${report.memory.RSS_AFTER_PUBLISH_MB ?? ""}`,
    `RSS_PEAK_MB=${report.memory.RSS_PEAK_MB}`,
  ];
  console.log(lines.join("\n"));
}
