/**
 * RESET 05B — read-only diagnose:initiative-plp runner.
 */

import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import {
  requirePublishedLocalizationMongoPersistence,
  assertPublishedLocalizationMongoPersistenceActive,
  getPublishedLocalizationPersistenceMode,
} from "../published-localized-presentation/persistence/repository.js";
import { ensureInitiativeLifecyclePlpAdapterRegistered } from "../published-localized-presentation/universal/register-defaults.js";
import {
  getInitiativePlpOperatorCounters,
  markInitiativePlpMongoClosed,
  resetInitiativePlpOperatorCountersForTests,
} from "./counters.js";
import {
  assertInitiativeMachineNodesExcludeNonMachine,
  inventoryInitiativePlpSemanticNodes,
} from "./inventory.js";
import { loadInitiativePlpOperatorLocale } from "./locale-lookup.js";
import { parseInitiativePlpOperatorArgs } from "./parse-args.js";
import { inspectInitiativePlpCurrent } from "./plp-inspect.js";
import {
  resolveInitiativePlpOperatorSource,
  type InitiativePlpOperatorSource,
} from "./source-resolve.js";

export type InitiativePlpDiagnoseReport = {
  readonly pack: "RESET_05B";
  readonly operation: "diagnose_initiative_plp";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly ENTITY_TYPE: string;
  readonly ENTITY_ID: string;
  readonly INITIATIVE_ID: string;
  readonly LOCALE: string;
  readonly LIFECYCLE_PROFILE: string;
  readonly SOURCE_FOUND: boolean;
  readonly SOURCE_PUBLIC: boolean;
  readonly CANONICAL_VERSION: string | null;
  readonly SCHEMA_VERSION: string;
  readonly PLP_PERSISTENCE_MODE: string;
  readonly LOCALE_REGISTRY_FOUND: boolean;
  readonly LOCALE_ENABLED: boolean;
  readonly CONTENT_TRANSLATION_ENABLED: boolean;
  readonly SEMANTIC_NODES: readonly {
    readonly path: string;
    readonly ownership: string;
    readonly machineEligible: boolean;
    readonly valuePreview: string | null;
  }[];
  readonly MACHINE_AUTO_PATHS: readonly string[];
  readonly MACHINE_NODES_EXCLUDE_GEO_LIFECYCLE: boolean;
  readonly FIELD_OWNERSHIP: Readonly<Record<string, string>>;
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly EXISTING_PLP_USABILITY: string | null;
  readonly EXISTING_PLP_USABILITY_REASON: string | null;
  readonly REBUILD_REQUIRED: boolean;
  readonly RESOLVER_MODE: string | null;
  readonly RESOLVER_REASON: string | null;
  readonly PROVIDER_CALLS: number;
  readonly PLP_WRITES: number;
  readonly MONGO_WRITES: number;
  readonly MONGO_CLOSED: boolean;
  readonly database: string | null;
  readonly HU_INITIATIVE_PLP_ENABLED: string;
  readonly abortReason: string | null;
};

export type InitiativePlpDiagnoseDeps = {
  readonly resolveSource?: (input: {
    readonly initiativeId: string;
    readonly locale: string;
  }) => Promise<InitiativePlpOperatorSource>;
  readonly loadLocale?: typeof loadInitiativePlpOperatorLocale;
  readonly inspectPlp?: typeof inspectInitiativePlpCurrent;
  readonly connect?: () => Promise<void>;
  readonly disconnect?: () => Promise<void>;
  readonly isMongoConfigured?: () => boolean;
  readonly skipPersistenceRequire?: boolean;
};

export async function runInitiativePlpDiagnose(
  argv: readonly string[],
  deps: InitiativePlpDiagnoseDeps = {},
): Promise<{
  readonly exitCode: number;
  readonly report: InitiativePlpDiagnoseReport | null;
  readonly errorMessage: string | null;
}> {
  resetInitiativePlpOperatorCountersForTests();
  const parsed = parseInitiativePlpOperatorArgs(argv, "diagnose");
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }
  const args = parsed.args;
  ensureInitiativeLifecyclePlpAdapterRegistered();

  const isConfigured = deps.isMongoConfigured ?? isMongoConfigured;
  if (!isConfigured()) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "diagnose:initiative-plp --mongo requires MONGODB_URI",
    };
  }

  const connect = deps.connect ?? connectMongoClient;
  const disconnect = deps.disconnect ?? disconnectMongoClient;

  try {
    await connect();
    if (!deps.skipPersistenceRequire) {
      requirePublishedLocalizationMongoPersistence("diagnose:initiative-plp --mongo");
      assertPublishedLocalizationMongoPersistenceActive("diagnose:initiative-plp --mongo");
    }

    const resolveSource =
      deps.resolveSource ?? resolveInitiativePlpOperatorSource;
    const source = await resolveSource({
      initiativeId: args.initiativeId,
      locale: args.locale,
    });
    const loadLocale = deps.loadLocale ?? loadInitiativePlpOperatorLocale;
    const locale = await loadLocale(args.locale);
    const inspect = deps.inspectPlp ?? inspectInitiativePlpCurrent;
    const plp = await inspect({
      entityType: source.entityType,
      entityId: source.entityId,
      locale: args.locale,
      liveCanonicalVersion: source.canonicalVersion,
      canonicalPresentation: source.canonicalPresentation,
    });

    const machineCheck = assertInitiativeMachineNodesExcludeNonMachine(
      source.autoPaths,
    );
    const counters = getInitiativePlpOperatorCounters();
    const report: InitiativePlpDiagnoseReport = {
      pack: "RESET_05B",
      operation: "diagnose_initiative_plp",
      OPERATOR_MODE: "THIN_READ_ONLY",
      ENTITY_TYPE: source.entityType,
      ENTITY_ID: source.entityId,
      INITIATIVE_ID: source.initiativeId,
      LOCALE: args.locale,
      LIFECYCLE_PROFILE: source.lifecycleProfile,
      SOURCE_FOUND: source.FOUND,
      SOURCE_PUBLIC: source.PUBLIC,
      CANONICAL_VERSION: source.canonicalVersion,
      SCHEMA_VERSION: source.schemaVersion,
      PLP_PERSISTENCE_MODE:
        plp.PLP_PERSISTENCE_MODE ||
        (getPublishedLocalizationPersistenceMode() === "mongo"
          ? "MONGO"
          : "UNSET"),
      LOCALE_REGISTRY_FOUND: locale.LOCALE_REGISTRY_FOUND,
      LOCALE_ENABLED: locale.LOCALE_ENABLED,
      CONTENT_TRANSLATION_ENABLED: locale.CONTENT_TRANSLATION_ENABLED,
      SEMANTIC_NODES: inventoryInitiativePlpSemanticNodes(
        source.canonicalPresentation,
      ),
      MACHINE_AUTO_PATHS: source.autoPaths.map((n) => n.path),
      MACHINE_NODES_EXCLUDE_GEO_LIFECYCLE: machineCheck.ok,
      FIELD_OWNERSHIP: source.fieldOwnership,
      PLP_CURRENT_FOUND: plp.PLP_CURRENT_FOUND,
      PLP_STATE: plp.PLP_STATE,
      PLP_CANONICAL_VERSION: plp.PLP_CANONICAL_VERSION,
      PLP_SCHEMA_VERSION: plp.PLP_SCHEMA_VERSION,
      EXISTING_PLP_USABILITY: plp.EXISTING_PLP_USABILITY,
      EXISTING_PLP_USABILITY_REASON: plp.EXISTING_PLP_USABILITY_REASON,
      REBUILD_REQUIRED: plp.REBUILD_REQUIRED,
      RESOLVER_MODE: plp.RESOLVER_MODE,
      RESOLVER_REASON: plp.RESOLVER_REASON,
      PROVIDER_CALLS: counters.PROVIDER_CALLS,
      PLP_WRITES: counters.PLP_WRITES,
      MONGO_WRITES: counters.MONGO_WRITES,
      MONGO_CLOSED: false,
      database: resolveMongoConfig().database,
      HU_INITIATIVE_PLP_ENABLED: process.env.HU_INITIATIVE_PLP_ENABLED ?? "",
      abortReason: !source.FOUND
        ? "SOURCE_NOT_FOUND"
        : !machineCheck.ok
          ? `MACHINE_NODE_POLICY_VIOLATION:${machineCheck.offenders.join(",")}`
          : null,
    };

    return {
      exitCode: report.abortReason ? 1 : 0,
      report,
      errorMessage: report.abortReason,
    };
  } finally {
    try {
      await disconnect();
      markInitiativePlpMongoClosed();
    } catch {
      // ignore
    }
  }
}

export function printInitiativePlpDiagnoseReport(
  report: InitiativePlpDiagnoseReport,
): void {
  console.log(JSON.stringify(report, null, 2));
}
