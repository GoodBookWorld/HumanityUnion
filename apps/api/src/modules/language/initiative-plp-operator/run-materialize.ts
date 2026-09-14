/**
 * RESET 05B — thin one-entity materialize:initiative-plp runner.
 * Dry-run default: zero provider / zero PLP writes / zero Mongo writes.
 */

import type { LanguageCode } from "@hu/types";
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
  assertPublishedLocalizationMongoPersistenceActive,
  getPublishedLocalizationPersistenceMode,
  requirePublishedLocalizationMongoPersistence,
} from "../published-localized-presentation/persistence/repository.js";
import { runUniversalPlpBuild } from "../published-localized-presentation/universal/build-pipeline.js";
import { ensureInitiativeLifecyclePlpAdapterRegistered } from "../published-localized-presentation/universal/register-defaults.js";
import { verifyDurableMediaPlpCurrent } from "../media-plp-materializer/durability-verify.js";
import {
  getInitiativePlpOperatorCounters,
  markInitiativePlpMongoClosed,
  markInitiativePlpWrite,
  resetInitiativePlpOperatorCountersForTests,
} from "./counters.js";
import { INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY } from "./constants.js";
import {
  assertInitiativeMachineNodesExcludeNonMachine,
  inventoryInitiativePlpSemanticNodes,
} from "./inventory.js";
import { loadInitiativePlpOperatorLocale } from "./locale-lookup.js";
import { parseInitiativePlpOperatorArgs } from "./parse-args.js";
import { inspectInitiativePlpCurrent } from "./plp-inspect.js";
import {
  runInitiativePlpThinProvider,
  type InitiativePlpProviderResult,
} from "./provider-boundary.js";
import {
  resolveInitiativePlpOperatorSource,
  type InitiativePlpOperatorSource,
} from "./source-resolve.js";
import {
  evaluateInitiativePlpExecuteGuards,
  evaluateInitiativePlpProductionRefusal,
} from "./staging-guards.js";

export type InitiativePlpMaterializeReport = {
  readonly pack: "RESET_05B";
  readonly operation: "materialize_initiative_plp";
  readonly OPERATOR_MODE: "DRY_RUN" | "EXECUTE";
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly INITIATIVE_ID: string;
  readonly LOCALE: string;
  readonly LIFECYCLE_PROFILE: string;
  readonly SOURCE_FOUND: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly SCHEMA_VERSION: string;
  readonly PLP_PERSISTENCE_MODE: string;
  readonly MACHINE_AUTO_PATHS: readonly string[];
  readonly MACHINE_NODES_EXCLUDE_GEO_LIFECYCLE: boolean;
  readonly SEMANTIC_NODES: readonly {
    readonly path: string;
    readonly ownership: string;
    readonly machineEligible: boolean;
  }[];
  readonly REBUILD_REQUIRED: boolean;
  readonly WOULD_CALL_PROVIDER: boolean;
  readonly WOULD_PUBLISH_PLP: boolean;
  readonly LOCALIZATION_SOURCE:
    | "EXISTING_CURRENT"
    | "PROVIDER"
    | "NONE"
    | "UNCHANGED_PLP";
  readonly PROVIDER_CALLS: number;
  readonly PROVIDER_EXECUTION_BOUNDARY: string | null;
  readonly PROVIDER_TRANSPORT: string | null;
  readonly PLP_WRITES: number;
  readonly MONGO_WRITES: number;
  readonly PLP_OUTCOME: string | null;
  readonly PLP_DURABILITY_VERIFIED: boolean | null;
  readonly RESOLVER_MODE: string | null;
  readonly RESOLVER_REASON: string | null;
  readonly MONGO_CLOSED: boolean;
  readonly database: string | null;
  readonly abortReason: string | null;
};

export type InitiativePlpMaterializeDeps = {
  readonly resolveSource?: (input: {
    readonly initiativeId: string;
    readonly locale: string;
  }) => Promise<InitiativePlpOperatorSource>;
  readonly loadLocale?: typeof loadInitiativePlpOperatorLocale;
  readonly inspectPlp?: typeof inspectInitiativePlpCurrent;
  readonly runProvider?: (input: {
    readonly locale: LanguageCode;
    readonly autoValues: Readonly<Record<string, string>>;
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
  }) => Promise<InitiativePlpProviderResult>;
  readonly publishBuild?: typeof runUniversalPlpBuild;
  readonly verifyDurability?: typeof verifyDurableMediaPlpCurrent;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly skipPersistenceRequire?: boolean;
  readonly skipExecuteGuards?: boolean;
  /** Unit tests: skip PLATFORM_MODE/database production refusal. */
  readonly skipProductionRefusal?: boolean;
};

export async function runInitiativePlpMaterialize(
  argv: readonly string[],
  deps: InitiativePlpMaterializeDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: InitiativePlpMaterializeReport | null;
  readonly errorMessage: string | null;
}> {
  resetInitiativePlpOperatorCountersForTests();
  const parsed = parseInitiativePlpOperatorArgs(argv, "materialize");
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  const args = parsed.args;
  if (args.mode !== "identity") {
    return {
      exitCode: 2,
      report: null,
      errorMessage:
        "materialize:initiative-plp requires --initiative-id <id> (no discovery mode)",
    };
  }
  ensureInitiativeLifecyclePlpAdapterRegistered();

  const refusal = deps.skipProductionRefusal
    ? { refused: false as const, reason: null }
    : evaluateInitiativePlpProductionRefusal();
  if (refusal.refused) {
    return { exitCode: 2, report: null, errorMessage: refusal.reason };
  }
  if (args.execute && !deps.skipExecuteGuards) {
    const executeGuard = evaluateInitiativePlpExecuteGuards();
    if (executeGuard.refused) {
      return { exitCode: 2, report: null, errorMessage: executeGuard.reason };
    }
  }

  const isConfigured = deps.isMongoConfigured ?? isMongoConfigured;
  if (!isConfigured() && !deps.skipPersistenceRequire) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "materialize:initiative-plp --mongo requires MONGODB_URI",
    };
  }

  const connect = deps.connect ?? connectMongoClient;
  const disconnect = deps.disconnect ?? disconnectMongoClient;

  try {
    if (!deps.skipPersistenceRequire) {
      await connect();
      requirePublishedLocalizationMongoPersistence(
        "materialize:initiative-plp --mongo",
      );
      assertPublishedLocalizationMongoPersistenceActive(
        "materialize:initiative-plp --mongo",
      );
    }

    const resolveSource =
      deps.resolveSource ?? resolveInitiativePlpOperatorSource;
    const source = await resolveSource({
      initiativeId: args.initiativeId,
      locale: args.locale,
    });

    const baseReport = (
      abortReason: string | null,
      overrides: Partial<InitiativePlpMaterializeReport> = {},
    ): InitiativePlpMaterializeReport => ({
      pack: "RESET_05B",
      operation: "materialize_initiative_plp",
      OPERATOR_MODE: args.execute ? "EXECUTE" : "DRY_RUN",
      ENTITY_TYPE: source.entityType,
      ENTITY_ID: source.entityId,
      INITIATIVE_ID: source.initiativeId,
      LOCALE: args.locale,
      LIFECYCLE_PROFILE: source.lifecycleProfile,
      SOURCE_FOUND: source.FOUND,
      CANONICAL_VERSION: source.canonicalVersion,
      SCHEMA_VERSION: source.schemaVersion,
      PLP_PERSISTENCE_MODE:
        getPublishedLocalizationPersistenceMode() === "mongo"
          ? "MONGO"
          : getPublishedLocalizationPersistenceMode() === "memory"
            ? "MEMORY"
            : "UNSET",
      MACHINE_AUTO_PATHS: source.autoPaths.map((n) => n.path),
      MACHINE_NODES_EXCLUDE_GEO_LIFECYCLE:
        assertInitiativeMachineNodesExcludeNonMachine(source.autoPaths).ok,
      SEMANTIC_NODES: inventoryInitiativePlpSemanticNodes(
        source.canonicalPresentation,
      ).map((row) => ({
        path: row.path,
        ownership: row.ownership,
        machineEligible: row.machineEligible,
      })),
      REBUILD_REQUIRED: true,
      WOULD_CALL_PROVIDER: false,
      WOULD_PUBLISH_PLP: false,
      LOCALIZATION_SOURCE: "NONE",
      PROVIDER_CALLS: 0,
      PROVIDER_EXECUTION_BOUNDARY: null,
      PROVIDER_TRANSPORT: null,
      PLP_WRITES: 0,
      MONGO_WRITES: 0,
      PLP_OUTCOME: null,
      PLP_DURABILITY_VERIFIED: null,
      RESOLVER_MODE: null,
      RESOLVER_REASON: null,
      MONGO_CLOSED: false,
      database: resolveMongoConfig().database,
      abortReason,
      ...overrides,
    });

    if (!source.FOUND || !source.contract || !source.canonicalVersion) {
      return {
        exitCode: 1,
        report: baseReport("SOURCE_NOT_FOUND"),
        errorMessage: "SOURCE_NOT_FOUND",
      };
    }

    const machineCheck = assertInitiativeMachineNodesExcludeNonMachine(
      source.autoPaths,
    );
    if (!machineCheck.ok) {
      return {
        exitCode: 1,
        report: baseReport(
          `MACHINE_NODE_POLICY_VIOLATION:${machineCheck.offenders.join(",")}`,
        ),
        errorMessage: "MACHINE_NODE_POLICY_VIOLATION",
      };
    }

    const loadLocale = deps.loadLocale ?? loadInitiativePlpOperatorLocale;
    const locale = await loadLocale(args.locale);
    if (
      args.execute &&
      (!locale.LOCALE_REGISTRY_FOUND ||
        !locale.LOCALE_ENABLED ||
        !locale.CONTENT_TRANSLATION_ENABLED)
    ) {
      return {
        exitCode: 1,
        report: baseReport("LOCALE_NOT_ELIGIBLE"),
        errorMessage: "LOCALE_NOT_ELIGIBLE",
      };
    }

    const inspect = deps.inspectPlp ?? inspectInitiativePlpCurrent;
    const plp = await inspect({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: args.locale,
      liveCanonicalVersion: source.canonicalVersion,
      canonicalPresentation: source.canonicalPresentation,
    });

    const rebuildRequired = plp.REBUILD_REQUIRED;
    const wouldCallProvider = rebuildRequired && source.autoPaths.length > 0;
    const wouldPublish = rebuildRequired;

    if (!args.execute) {
      const counters = getInitiativePlpOperatorCounters();
      return {
        exitCode: 0,
        report: baseReport(null, {
          REBUILD_REQUIRED: rebuildRequired,
          WOULD_CALL_PROVIDER: wouldCallProvider,
          WOULD_PUBLISH_PLP: wouldPublish,
          LOCALIZATION_SOURCE: rebuildRequired
            ? wouldCallProvider
              ? "PROVIDER"
              : "NONE"
            : "UNCHANGED_PLP",
          PROVIDER_CALLS: counters.PROVIDER_CALLS,
          PLP_WRITES: counters.PLP_WRITES,
          MONGO_WRITES: counters.MONGO_WRITES,
          RESOLVER_MODE: plp.RESOLVER_MODE,
          RESOLVER_REASON: plp.RESOLVER_REASON,
          PLP_OUTCOME: rebuildRequired ? "WOULD_PUBLISH" : "UNCHANGED_PLP",
        }),
        errorMessage: null,
      };
    }

    // EXECUTE
    if (!rebuildRequired) {
      const counters = getInitiativePlpOperatorCounters();
      return {
        exitCode: 0,
        report: baseReport(null, {
          REBUILD_REQUIRED: false,
          WOULD_CALL_PROVIDER: false,
          WOULD_PUBLISH_PLP: false,
          LOCALIZATION_SOURCE: "UNCHANGED_PLP",
          PROVIDER_CALLS: counters.PROVIDER_CALLS,
          PLP_WRITES: counters.PLP_WRITES,
          MONGO_WRITES: counters.MONGO_WRITES,
          PLP_OUTCOME: "UNCHANGED_PLP",
          RESOLVER_MODE: plp.RESOLVER_MODE,
          RESOLVER_REASON: plp.RESOLVER_REASON,
        }),
        errorMessage: null,
      };
    }

    const autoValues: Record<string, string> = {};
    for (const node of source.autoPaths) {
      autoValues[node.path] = node.value;
    }

    const runProvider = deps.runProvider ?? runInitiativePlpThinProvider;
    const providerResult = await runProvider({
      locale: args.locale,
      autoValues,
      sourceRecordId: source.entityId,
      sourceVersion: source.canonicalVersion,
    });
    if (!providerResult.ok) {
      return {
        exitCode: 1,
        report: baseReport(providerResult.reason, {
          PROVIDER_EXECUTION_BOUNDARY:
            providerResult.PROVIDER_EXECUTION_BOUNDARY,
          PROVIDER_TRANSPORT: providerResult.PROVIDER_TRANSPORT,
          PROVIDER_CALLS: getInitiativePlpOperatorCounters().PROVIDER_CALLS,
        }),
        errorMessage: providerResult.message,
      };
    }

    const publishBuild = deps.publishBuild ?? runUniversalPlpBuild;
    const built = await publishBuild({
      contract: source.contract,
      liveCanonicalVersion: source.canonicalVersion,
      layers: [
        {
          source: "MACHINE",
          values: providerResult.values,
          provider: providerResult.PROVIDER_TRANSPORT,
        },
      ],
    });
    if (built.status === "COMPLETED") {
      markInitiativePlpWrite();
    }

    let durability: boolean | null = null;
    if (built.status === "COMPLETED" && source.canonicalVersion) {
      const verify = deps.verifyDurability ?? verifyDurableMediaPlpCurrent;
      const verified = await verify({
        entityType: source.entityType,
        entityId: source.entityId,
        locale: args.locale,
        canonicalVersion: source.canonicalVersion,
        requireMongo: !deps.skipPersistenceRequire,
      });
      durability = verified.PLP_DURABILITY_VERIFIED;
      if (!verified.ok) {
        return {
          exitCode: 1,
          report: baseReport("DURABILITY_FAILED", {
            PROVIDER_CALLS: getInitiativePlpOperatorCounters().PROVIDER_CALLS,
            PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
            PROVIDER_TRANSPORT: providerResult.PROVIDER_TRANSPORT,
            PLP_WRITES: getInitiativePlpOperatorCounters().PLP_WRITES,
            PLP_OUTCOME: built.status,
            PLP_DURABILITY_VERIFIED: false,
            LOCALIZATION_SOURCE: "PROVIDER",
            WOULD_CALL_PROVIDER: true,
            WOULD_PUBLISH_PLP: true,
            REBUILD_REQUIRED: true,
          }),
          errorMessage:
            verified.ok === false ? verified.reason : "DURABILITY_FAILED",
        };
      }
    }

    const post = await inspect({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: args.locale,
      liveCanonicalVersion: source.canonicalVersion,
      canonicalPresentation: source.canonicalPresentation,
    });

    const counters = getInitiativePlpOperatorCounters();
    return {
      exitCode: built.status === "COMPLETED" && durability !== false ? 0 : 1,
      report: baseReport(
        built.status === "COMPLETED"
          ? null
          : built.reasonCodes.join(",") || "PUBLISH_FAILED",
        {
          REBUILD_REQUIRED: true,
          WOULD_CALL_PROVIDER: true,
          WOULD_PUBLISH_PLP: true,
          LOCALIZATION_SOURCE: "PROVIDER",
          PROVIDER_CALLS: counters.PROVIDER_CALLS,
          PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
          PROVIDER_TRANSPORT: providerResult.PROVIDER_TRANSPORT,
          PLP_WRITES: counters.PLP_WRITES,
          MONGO_WRITES: counters.MONGO_WRITES,
          PLP_OUTCOME: built.status,
          PLP_DURABILITY_VERIFIED: durability,
          RESOLVER_MODE: post.RESOLVER_MODE,
          RESOLVER_REASON: post.RESOLVER_REASON,
          SCHEMA_VERSION: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        },
      ),
      errorMessage:
        built.status === "COMPLETED"
          ? null
          : built.reasonCodes.join(",") || "PUBLISH_FAILED",
    };
  } finally {
    try {
      if (!deps.skipPersistenceRequire) {
        await disconnect();
      }
      markInitiativePlpMongoClosed();
    } catch {
      // ignore
    }
  }
}

export function printInitiativePlpMaterializeReport(
  report: InitiativePlpMaterializeReport,
): void {
  console.log(JSON.stringify(report, null, 2));
}
