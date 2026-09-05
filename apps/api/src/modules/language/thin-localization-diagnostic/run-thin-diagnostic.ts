/**
 * Pack 08K.2.8 — thin read-only localization residual diagnostic runner.
 *
 * Connects Mongo only. Never seeds registry, never ensures full indexes,
 * never hydrates civic Maps, never imports reconcile/provider/worker graphs.
 */

import { isMongoConfigured, resolveMongoConfig } from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import { getThinLocalizationImportGuards } from "./import-guards.js";
import {
  captureThinLocalizationAfterDbConnect,
  captureThinLocalizationAfterIdentityLookups,
  captureThinLocalizationAfterImports,
  captureThinLocalizationAfterRegistry,
  captureThinLocalizationProcessStart,
  getThinLocalizationMemoryPhases,
} from "./memory-phases.js";
import { parseThinResidualIdentityArgs } from "./parse-residual-args.js";
import {
  resolveThinResidualState,
  type ThinResidualLookupDeps,
} from "./resolve-thin-residual.js";
import {
  getThinLocalizationCounters,
  markThinMongoClosed,
} from "./thin-counters.js";

export type ThinLocalizationDiagnosticReport = {
  readonly pack: "08K.2.8";
  readonly operation: "diagnose_localization_residuals";
  readonly mode: "read-only";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly FULL_APPLICATION_GRAPH_IMPORTED: boolean;
  readonly FULL_CORPUS_HYDRATED: boolean;
  readonly PROVIDER_MODULE_IMPORTED: boolean;
  readonly WORKER_MODULE_IMPORTED: boolean;
  readonly PRESENTATION_TREE_BUILT: boolean;
  readonly database: string | null;
  readonly DIAGNOSTIC_IDENTITIES: number;
  readonly SOURCE_RECORDS_LOADED: number;
  readonly TRANSLATION_ROWS_LOADED: number;
  readonly OUTBOX_ROWS_INSPECTED: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getThinLocalizationMemoryPhases>;
  readonly identities: Awaited<ReturnType<typeof resolveThinResidualState>>[];
  readonly note: string;
};

export async function runThinLocalizationResidualDiagnostic(
  argv: readonly string[],
  deps?: ThinResidualLookupDeps,
): Promise<{
  readonly exitCode: number;
  readonly report: ThinLocalizationDiagnosticReport | null;
  readonly errorMessage: string | null;
}> {
  captureThinLocalizationProcessStart();
  captureThinLocalizationAfterImports();

  const identities = parseThinResidualIdentityArgs(argv);
  if (identities.length === 0) {
    return {
      exitCode: 2,
      report: null,
      errorMessage:
        "diagnose:localization-residuals requires one or more --residual sourceKind:id:locale",
    };
  }

  if (!argv.includes("--mongo")) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "diagnose:localization-residuals requires --mongo",
    };
  }

  if (argv.includes("--execute")) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "diagnose:localization-residuals is READ-ONLY; omit --execute",
    };
  }

  if (!isMongoConfigured() && !deps) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  let connected = false;
  try {
    if (!deps) {
      await connectMongoClient();
      connected = true;
    }
    captureThinLocalizationAfterDbConnect();

    // Locale validity is a per-identity narrow find — no full registry seed/hydrate.
    captureThinLocalizationAfterRegistry();

    const rows = [];
    for (const identity of identities) {
      rows.push(await resolveThinResidualState(identity, deps));
    }
    captureThinLocalizationAfterIdentityLookups();

    const guards = getThinLocalizationImportGuards();
    const counters = getThinLocalizationCounters();
    const mongo = isMongoConfigured() ? resolveMongoConfig() : null;

    const report: ThinLocalizationDiagnosticReport = {
      pack: "08K.2.8",
      operation: "diagnose_localization_residuals",
      mode: "read-only",
      OPERATOR_MODE: guards.OPERATOR_MODE,
      FULL_APPLICATION_GRAPH_IMPORTED: guards.FULL_APPLICATION_GRAPH_IMPORTED,
      FULL_CORPUS_HYDRATED: guards.FULL_CORPUS_HYDRATED,
      PROVIDER_MODULE_IMPORTED: guards.PROVIDER_MODULE_IMPORTED,
      WORKER_MODULE_IMPORTED: guards.WORKER_MODULE_IMPORTED,
      PRESENTATION_TREE_BUILT: guards.PRESENTATION_TREE_BUILT,
      database: mongo?.database ?? null,
      DIAGNOSTIC_IDENTITIES: rows.length,
      SOURCE_RECORDS_LOADED: counters.SOURCE_RECORDS_LOADED,
      TRANSLATION_ROWS_LOADED: counters.TRANSLATION_ROWS_LOADED,
      OUTBOX_ROWS_INSPECTED: counters.OUTBOX_ROWS_INSPECTED,
      WRITES_PERFORMED: counters.WRITES_PERFORMED,
      PROVIDER_CALLS: counters.PROVIDER_CALLS,
      MONGO_CLOSED: false,
      memory: getThinLocalizationMemoryPhases(),
      identities: rows,
      note:
        "THIN_READ_ONLY — direct bounded Mongo reads only; no provider calls, no writes, no corpus/presentation hydrate.",
    };

    return { exitCode: 0, report, errorMessage: null };
  } finally {
    if (connected) {
      try {
        await disconnectMongoClient();
        markThinMongoClosed();
      } catch {
        // ignore disconnect errors
      }
    }
  }
}

export function printThinLocalizationDiagnosticReport(
  report: ThinLocalizationDiagnosticReport,
): void {
  const counters = getThinLocalizationCounters();
  console.log(
    JSON.stringify(
      {
        ...report,
        MONGO_CLOSED: counters.MONGO_CLOSED,
        memory: getThinLocalizationMemoryPhases(),
      },
      null,
      2,
    ),
  );
}
