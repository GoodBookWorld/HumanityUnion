/**
 * Pack 08K.3.2 — run thin Media localization diagnostic.
 */

import { isMongoConfigured, resolveMongoConfig } from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import { getThinLocalizationImportGuards } from "../thin-localization-diagnostic/import-guards.js";
import {
  captureThinLocalizationAfterDbConnect,
  captureThinLocalizationAfterIdentityLookups,
  captureThinLocalizationAfterImports,
  captureThinLocalizationAfterRegistry,
  captureThinLocalizationProcessStart,
  getThinLocalizationMemoryPhases,
} from "../thin-localization-diagnostic/memory-phases.js";
import {
  getThinLocalizationCounters,
  markThinMongoClosed,
} from "../thin-localization-diagnostic/thin-counters.js";
import {
  discoverThinMediaLocalizationPresentations,
  parseMediaLocalizationLocaleArg,
  type MediaLocalizationPresentationRow,
} from "./discover-media-presentations.js";

export type ThinMediaLocalizationDiagnosticReport = {
  readonly pack: "08K.3.2";
  readonly operation: "diagnose_media_localization";
  readonly mode: "read-only";
  readonly OPERATOR_MODE: "THIN_READ_ONLY";
  readonly FULL_APPLICATION_GRAPH_IMPORTED: boolean;
  readonly FULL_CORPUS_HYDRATED: boolean;
  readonly PROVIDER_MODULE_IMPORTED: boolean;
  readonly WORKER_MODULE_IMPORTED: boolean;
  readonly PRESENTATION_TREE_BUILT: boolean;
  readonly database: string | null;
  readonly locale: string;
  readonly MEDIA_PRESENTATIONS: number;
  readonly MEDIA_SEMANTIC_NODES: number;
  readonly MEDIA_LOCALIZED_NODES: number;
  readonly MEDIA_CANONICAL_FALLBACK_NODES: number;
  readonly MEDIA_PRESENTATIONS_WITH_FALLBACK: number;
  readonly MEDIA_PARTIAL_PRESENTATIONS: number;
  readonly RSS_IDENTITY_COLLISIONS: number;
  readonly RSS_DUPLICATE_IDENTITIES: number;
  readonly RSS_UNSTABLE_IDENTITIES: number;
  readonly SOURCE_RECORDS_LOADED: number;
  readonly TRANSLATION_ROWS_LOADED: number;
  readonly WRITES_PERFORMED: number;
  readonly PROVIDER_CALLS: number;
  readonly MONGO_CLOSED: boolean;
  readonly memory: ReturnType<typeof getThinLocalizationMemoryPhases>;
  readonly presentations: readonly MediaLocalizationPresentationRow[];
};

function redactProse(report: ThinMediaLocalizationDiagnosticReport): ThinMediaLocalizationDiagnosticReport {
  // Structural only — path diagnostics never include text values.
  return report;
}

export async function runThinMediaLocalizationDiagnostic(
  argv: readonly string[],
): Promise<{
  readonly exitCode: number;
  readonly report: ThinMediaLocalizationDiagnosticReport | null;
  readonly errorMessage: string | null;
}> {
  captureThinLocalizationProcessStart();
  captureThinLocalizationAfterImports();

  if (!argv.includes("--mongo")) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "diagnose:media-localization requires --mongo",
    };
  }
  if (argv.includes("--execute")) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: "diagnose:media-localization is READ-ONLY; omit --execute",
    };
  }
  if (!isMongoConfigured()) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: "MONGODB_URI is not configured.",
    };
  }

  const locale = parseMediaLocalizationLocaleArg(argv);
  let connected = false;
  try {
    await connectMongoClient();
    connected = true;
    captureThinLocalizationAfterDbConnect();
    captureThinLocalizationAfterRegistry();

    const { presentations, rssAudit } = await discoverThinMediaLocalizationPresentations({
      locale,
    });
    captureThinLocalizationAfterIdentityLookups();

    const guards = getThinLocalizationImportGuards();
    const counters = getThinLocalizationCounters();

    let semantic = 0;
    let localized = 0;
    let fallback = 0;
    let withFallback = 0;
    let partial = 0;
    for (const row of presentations) {
      semantic += row.semanticNodeCount;
      localized += row.localizedNodeCount;
      fallback += row.canonicalFallbackNodeCount;
      if (row.canonicalFallbackNodeCount > 0) {
        withFallback += 1;
      }
      if (row.translationState === "PARTIAL") {
        partial += 1;
      }
    }

    const report: ThinMediaLocalizationDiagnosticReport = redactProse({
      pack: "08K.3.2",
      operation: "diagnose_media_localization",
      mode: "read-only",
      OPERATOR_MODE: "THIN_READ_ONLY",
      FULL_APPLICATION_GRAPH_IMPORTED: guards.FULL_APPLICATION_GRAPH_IMPORTED,
      FULL_CORPUS_HYDRATED: guards.FULL_CORPUS_HYDRATED,
      PROVIDER_MODULE_IMPORTED: guards.PROVIDER_MODULE_IMPORTED,
      WORKER_MODULE_IMPORTED: guards.WORKER_MODULE_IMPORTED,
      PRESENTATION_TREE_BUILT: true,
      database: resolveMongoConfig().database,
      locale,
      MEDIA_PRESENTATIONS: presentations.length,
      MEDIA_SEMANTIC_NODES: semantic,
      MEDIA_LOCALIZED_NODES: localized,
      MEDIA_CANONICAL_FALLBACK_NODES: fallback,
      MEDIA_PRESENTATIONS_WITH_FALLBACK: withFallback,
      MEDIA_PARTIAL_PRESENTATIONS: partial,
      RSS_IDENTITY_COLLISIONS: rssAudit.RSS_IDENTITY_COLLISIONS,
      RSS_DUPLICATE_IDENTITIES: rssAudit.RSS_DUPLICATE_IDENTITIES,
      RSS_UNSTABLE_IDENTITIES: rssAudit.RSS_UNSTABLE_IDENTITIES,
      SOURCE_RECORDS_LOADED: counters.SOURCE_RECORDS_LOADED,
      TRANSLATION_ROWS_LOADED: counters.TRANSLATION_ROWS_LOADED,
      WRITES_PERFORMED: counters.WRITES_PERFORMED,
      PROVIDER_CALLS: counters.PROVIDER_CALLS,
      MONGO_CLOSED: false,
      memory: getThinLocalizationMemoryPhases(),
      presentations,
    });

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
      markThinMongoClosed();
    }
  }
}

export function printThinMediaLocalizationDiagnosticReport(
  report: ThinMediaLocalizationDiagnosticReport,
): void {
  const lines: string[] = [
    `OPERATOR_MODE=${report.OPERATOR_MODE}`,
    `FULL_APPLICATION_GRAPH_IMPORTED=${report.FULL_APPLICATION_GRAPH_IMPORTED}`,
    `FULL_CORPUS_HYDRATED=${report.FULL_CORPUS_HYDRATED}`,
    `PROVIDER_MODULE_IMPORTED=${report.PROVIDER_MODULE_IMPORTED}`,
    `WORKER_MODULE_IMPORTED=${report.WORKER_MODULE_IMPORTED}`,
    `PRESENTATION_TREE_BUILT=${report.PRESENTATION_TREE_BUILT}`,
    `locale=${report.locale}`,
    `MEDIA_PRESENTATIONS=${report.MEDIA_PRESENTATIONS}`,
    `MEDIA_SEMANTIC_NODES=${report.MEDIA_SEMANTIC_NODES}`,
    `MEDIA_LOCALIZED_NODES=${report.MEDIA_LOCALIZED_NODES}`,
    `MEDIA_CANONICAL_FALLBACK_NODES=${report.MEDIA_CANONICAL_FALLBACK_NODES}`,
    `MEDIA_PRESENTATIONS_WITH_FALLBACK=${report.MEDIA_PRESENTATIONS_WITH_FALLBACK}`,
    `MEDIA_PARTIAL_PRESENTATIONS=${report.MEDIA_PARTIAL_PRESENTATIONS}`,
    `RSS_IDENTITY_COLLISIONS=${report.RSS_IDENTITY_COLLISIONS}`,
    `RSS_DUPLICATE_IDENTITIES=${report.RSS_DUPLICATE_IDENTITIES}`,
    `RSS_UNSTABLE_IDENTITIES=${report.RSS_UNSTABLE_IDENTITIES}`,
    `SOURCE_RECORDS_LOADED=${report.SOURCE_RECORDS_LOADED}`,
    `TRANSLATION_ROWS_LOADED=${report.TRANSLATION_ROWS_LOADED}`,
    `WRITES_PERFORMED=${report.WRITES_PERFORMED}`,
    `PROVIDER_CALLS=${report.PROVIDER_CALLS}`,
    `MONGO_CLOSED=${getThinLocalizationCounters().MONGO_CLOSED}`,
    `PROCESS_START_RSS_MB=${report.memory.PROCESS_START_RSS_MB}`,
    `AFTER_IMPORTS_RSS_MB=${report.memory.AFTER_IMPORTS_RSS_MB}`,
    `AFTER_DB_CONNECT_RSS_MB=${report.memory.AFTER_DB_CONNECT_RSS_MB}`,
    `AFTER_REGISTRY_RSS_MB=${report.memory.AFTER_REGISTRY_RSS_MB}`,
    `AFTER_IDENTITY_LOOKUPS_RSS_MB=${report.memory.AFTER_IDENTITY_LOOKUPS_RSS_MB}`,
    `PEAK_RSS_MB=${report.memory.PEAK_RSS_MB}`,
  ];

  for (const row of report.presentations) {
    lines.push(
      [
        `mediaFamily=${row.mediaFamily}`,
        `sourceKind=${row.sourceKind}`,
        `sourceRecordId=${row.sourceRecordId}`,
        `locale=${row.locale}`,
        `sourceVersion=${row.sourceVersion}`,
        `translationRowExists=${row.translationRowExists}`,
        `translationSourceVersion=${row.translationSourceVersion ?? ""}`,
        `translationState=${row.translationState}`,
        `semanticNodeCount=${row.semanticNodeCount}`,
        `localizedNodeCount=${row.localizedNodeCount}`,
        `canonicalFallbackNodeCount=${row.canonicalFallbackNodeCount}`,
        `protectedNodeCount=${row.protectedNodeCount}`,
        `generationState=${row.generationState}`,
        `fallbackPaths=${JSON.stringify(row.fallbackPaths)}`,
      ].join(" "),
    );
    for (const pathRow of row.pathDiagnostics) {
      lines.push(
        [
          `path=${pathRow.path}`,
          `ownership=${pathRow.ownership}`,
          `fingerprinted=${pathRow.fingerprinted}`,
          `translationPathExists=${pathRow.translationPathExists}`,
          `localizedValueApplied=${pathRow.localizedValueApplied}`,
          `fallbackReason=${pathRow.fallbackReason ?? ""}`,
        ].join(" "),
      );
    }
  }

  console.log(lines.join("\n"));
}
