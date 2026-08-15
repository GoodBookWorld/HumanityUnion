import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativePublicImpactReport } from "@hu/types";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { createLegacyFileStoreMongoBridge } from "../../infrastructure/mongodb/legacy-file-store-mongo-bridge.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";

interface ReportSnapshot {
  version: 1;
  reports: Record<string, InitiativePublicImpactReport>;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE_PATH = path.resolve(
  MODULE_DIR,
  "../../../.runtime/initiative-public-impact-reports.json",
);

function emptySnapshot(): ReportSnapshot {
  return { version: 1, reports: {} };
}

const bridge = createLegacyFileStoreMongoBridge<ReportSnapshot>({
  envKey: "INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE",
  defaultFilePath: DEFAULT_FILE_PATH,
  filePathEnvKey: "INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE_PATH",
  createEmpty: emptySnapshot,
  isValidSnapshot: (value): value is ReportSnapshot =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as ReportSnapshot).version === 1 &&
        typeof (value as ReportSnapshot).reports === "object",
    ),
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativePublicImpactReports,
      idField: "reportId",
      select: (snapshot) => snapshot.reports as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        reports: records as unknown as Record<string, InitiativePublicImpactReport>,
      }),
    },
  ],
});

const reports = new Map<string, InitiativePublicImpactReport>(
  Object.entries(bridge.loadInitial().reports).map(([id, report]) => [id, structuredClone(report)]),
);

function replaceFromSnapshot(snapshot: ReportSnapshot): void {
  reports.clear();
  for (const [id, report] of Object.entries(snapshot.reports)) {
    reports.set(id, structuredClone(report));
  }
}

function persist(): void {
  const reportRecord: Record<string, InitiativePublicImpactReport> = {};
  for (const [id, report] of reports) {
    reportRecord[id] = structuredClone(report);
  }
  bridge.save({ version: 1, reports: reportRecord });
}

export async function hydrateInitiativePublicImpactReportMongoPersistence(): Promise<void> {
  await bridge.hydrate();
  if (isMongoPersistenceMode("INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE")) {
    replaceFromSnapshot(bridge.loadMongoCache());
  }
}

export async function flushInitiativePublicImpactReportMongoPersistence(): Promise<void> {
  await bridge.flush();
}

export function getReportById(reportId: string): InitiativePublicImpactReport | null {
  const report = reports.get(reportId);
  return report ? structuredClone(report) : null;
}

export function getReportByInitiativeId(initiativeId: string): InitiativePublicImpactReport | null {
  const matches = Array.from(reports.values())
    .filter((report) => report.initiativeId === initiativeId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  return matches[0] ? structuredClone(matches[0]) : null;
}

export function upsertReport(report: InitiativePublicImpactReport): InitiativePublicImpactReport {
  reports.set(report.reportId, structuredClone(report));
  persist();
  return structuredClone(report);
}

export function deleteReportsByInitiativeIdForTests(initiativeId: string): number {
  let removed = 0;
  for (const [id, report] of reports.entries()) {
    if (report.initiativeId === initiativeId) {
      reports.delete(id);
      removed += 1;
    }
  }
  if (removed > 0) {
    persist();
  }
  return removed;
}
