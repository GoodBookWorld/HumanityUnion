import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeOfficialResponsePackage, InitiativeOfficialResponseRecord } from "@hu/types";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { createLegacyFileStoreMongoBridge } from "../../infrastructure/mongodb/legacy-file-store-mongo-bridge.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { emptyOfficialResponseNoResponseDetail } from "./initiative-official-response-outcome.js";

interface PackageAndRecordSnapshot {
  version: 1;
  packages: Record<string, InitiativeOfficialResponsePackage>;
  responses: Record<string, InitiativeOfficialResponseRecord>;
}

function normalizePackage(pkg: InitiativeOfficialResponsePackage): InitiativeOfficialResponsePackage {
  return {
    ...pkg,
    outcomeKind:
      pkg.outcomeKind === "no_official_response_received" || pkg.outcomeKind === "responses_received"
        ? pkg.outcomeKind
        : pkg.responseIds.length === 0
          ? "no_official_response_received"
          : "responses_received",
    noResponseDetail: pkg.noResponseDetail
      ? {
          contactedOrganizations: [...pkg.noResponseDetail.contactedOrganizations],
          contactedDates: [...pkg.noResponseDetail.contactedDates],
          note: pkg.noResponseDetail.note,
        }
      : emptyOfficialResponseNoResponseDetail(),
    responseIds: [...pkg.responseIds],
  };
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE_PATH = path.resolve(
  MODULE_DIR,
  "../../../.runtime/initiative-official-response-packages.json",
);

function emptySnapshot(): PackageAndRecordSnapshot {
  return { version: 1, packages: {}, responses: {} };
}

const bridge = createLegacyFileStoreMongoBridge<PackageAndRecordSnapshot>({
  envKey: "INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE",
  defaultFilePath: DEFAULT_FILE_PATH,
  filePathEnvKey: "INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE_PATH",
  createEmpty: emptySnapshot,
  isValidSnapshot: (value): value is PackageAndRecordSnapshot =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as PackageAndRecordSnapshot).version === 1 &&
        typeof (value as PackageAndRecordSnapshot).packages === "object" &&
        typeof (value as PackageAndRecordSnapshot).responses === "object",
    ),
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeOfficialResponsePackages,
      idField: "packageId",
      select: (snapshot) => snapshot.packages as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        packages: records as unknown as Record<string, InitiativeOfficialResponsePackage>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.initiativeOfficialResponsePackageRecords,
      idField: "responseId",
      select: (snapshot) => snapshot.responses as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        responses: records as unknown as Record<string, InitiativeOfficialResponseRecord>,
      }),
    },
  ],
});

const initial = bridge.loadInitial();
const packages = new Map<string, InitiativeOfficialResponsePackage>(
  Object.entries(initial.packages).map(([id, pkg]) => [id, normalizePackage(structuredClone(pkg))]),
);
const responses = new Map<string, InitiativeOfficialResponseRecord>(
  Object.entries(initial.responses).map(([id, response]) => [id, structuredClone(response)]),
);

function replaceFromSnapshot(snapshot: PackageAndRecordSnapshot): void {
  packages.clear();
  responses.clear();
  for (const [id, pkg] of Object.entries(snapshot.packages)) {
    packages.set(id, normalizePackage(structuredClone(pkg)));
  }
  for (const [id, response] of Object.entries(snapshot.responses)) {
    responses.set(id, structuredClone(response));
  }
}

function persist(): void {
  const packageRecord: Record<string, InitiativeOfficialResponsePackage> = {};
  for (const [id, pkg] of packages) {
    packageRecord[id] = structuredClone(pkg);
  }
  const responseRecord: Record<string, InitiativeOfficialResponseRecord> = {};
  for (const [id, response] of responses) {
    responseRecord[id] = structuredClone(response);
  }
  bridge.save({ version: 1, packages: packageRecord, responses: responseRecord });
}

export async function hydrateInitiativeOfficialResponsePackageMongoPersistence(): Promise<void> {
  await bridge.hydrate();
  if (isMongoPersistenceMode("INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE")) {
    replaceFromSnapshot(bridge.loadMongoCache());
  }
}

export async function flushInitiativeOfficialResponsePackageMongoPersistence(): Promise<void> {
  await bridge.flush();
}

export function getPackageById(packageId: string): InitiativeOfficialResponsePackage | null {
  const pkg = packages.get(packageId);
  return pkg ? normalizePackage(structuredClone(pkg)) : null;
}

export function getPackageByInitiativeId(initiativeId: string): InitiativeOfficialResponsePackage | null {
  const matches = Array.from(packages.values())
    .filter((pkg) => pkg.initiativeId === initiativeId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  return matches[0] ? normalizePackage(structuredClone(matches[0])) : null;
}

export function upsertPackage(pkg: InitiativeOfficialResponsePackage): InitiativeOfficialResponsePackage {
  const normalized = normalizePackage(pkg);
  packages.set(normalized.packageId, structuredClone(normalized));
  persist();
  return structuredClone(normalized);
}

export function getResponseById(responseId: string): InitiativeOfficialResponseRecord | null {
  const response = responses.get(responseId);
  return response ? structuredClone(response) : null;
}

export function listResponsesByPackageId(packageId: string): InitiativeOfficialResponseRecord[] {
  return Array.from(responses.values())
    .filter((response) => response.packageId === packageId)
    .map((response) => structuredClone(response));
}

export function listResponsesByInitiativeId(initiativeId: string): InitiativeOfficialResponseRecord[] {
  return Array.from(responses.values())
    .filter((response) => response.initiativeId === initiativeId)
    .map((response) => structuredClone(response));
}

export function upsertResponse(
  response: InitiativeOfficialResponseRecord,
): InitiativeOfficialResponseRecord {
  responses.set(response.responseId, structuredClone(response));
  persist();
  return structuredClone(response);
}

export function deletePackagesByInitiativeIdForTests(initiativeId: string): number {
  let removed = 0;
  for (const [id, pkg] of packages.entries()) {
    if (pkg.initiativeId === initiativeId) {
      packages.delete(id);
      removed += 1;
    }
  }
  for (const [id, response] of responses.entries()) {
    if (response.initiativeId === initiativeId) {
      responses.delete(id);
      removed += 1;
    }
  }
  if (removed > 0) {
    persist();
  }
  return removed;
}
