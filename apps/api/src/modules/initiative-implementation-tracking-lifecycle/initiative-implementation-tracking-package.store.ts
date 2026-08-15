import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeImplementationTrackingPackage } from "@hu/types";

import { isMongoPersistenceMode } from "../../config/production-persistence-contract.js";
import { createLegacyFileStoreMongoBridge } from "../../infrastructure/mongodb/legacy-file-store-mongo-bridge.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";

interface PackageSnapshot {
  version: 1;
  packages: Record<string, InitiativeImplementationTrackingPackage>;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE_PATH = path.resolve(
  MODULE_DIR,
  "../../../.runtime/initiative-implementation-tracking-packages.json",
);

function emptySnapshot(): PackageSnapshot {
  return { version: 1, packages: {} };
}

const bridge = createLegacyFileStoreMongoBridge<PackageSnapshot>({
  envKey: "INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE",
  defaultFilePath: DEFAULT_FILE_PATH,
  filePathEnvKey: "INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE_PATH",
  createEmpty: emptySnapshot,
  isValidSnapshot: (value): value is PackageSnapshot =>
    Boolean(
      value &&
        typeof value === "object" &&
        (value as PackageSnapshot).version === 1 &&
        typeof (value as PackageSnapshot).packages === "object",
    ),
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImplementationTrackingPackages,
      idField: "packageId",
      select: (snapshot) => snapshot.packages as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        packages: records as unknown as Record<string, InitiativeImplementationTrackingPackage>,
      }),
    },
  ],
});

const packages = new Map<string, InitiativeImplementationTrackingPackage>(
  Object.entries(bridge.loadInitial().packages).map(([id, pkg]) => [id, structuredClone(pkg)]),
);

function replaceFromSnapshot(snapshot: PackageSnapshot): void {
  packages.clear();
  for (const [id, pkg] of Object.entries(snapshot.packages)) {
    packages.set(id, structuredClone(pkg));
  }
}

function persist(): void {
  const record: Record<string, InitiativeImplementationTrackingPackage> = {};
  for (const [id, pkg] of packages) {
    record[id] = structuredClone(pkg);
  }
  bridge.save({ version: 1, packages: record });
}

export async function hydrateInitiativeImplementationTrackingPackageMongoPersistence(): Promise<void> {
  await bridge.hydrate();
  if (isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE")) {
    replaceFromSnapshot(bridge.loadMongoCache());
  }
}

export async function flushInitiativeImplementationTrackingPackageMongoPersistence(): Promise<void> {
  await bridge.flush();
}

export function getPackageById(packageId: string): InitiativeImplementationTrackingPackage | null {
  const pkg = packages.get(packageId);
  return pkg ? structuredClone(pkg) : null;
}

export function getPackageByInitiativeId(
  initiativeId: string,
): InitiativeImplementationTrackingPackage | null {
  const matches = Array.from(packages.values())
    .filter((pkg) => pkg.initiativeId === initiativeId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  return matches[0] ? structuredClone(matches[0]) : null;
}

export function upsertPackage(
  pkg: InitiativeImplementationTrackingPackage,
): InitiativeImplementationTrackingPackage {
  packages.set(pkg.packageId, structuredClone(pkg));
  persist();
  return structuredClone(pkg);
}

export function deletePackagesByInitiativeIdForTests(initiativeId: string): number {
  let removed = 0;
  for (const [id, pkg] of packages.entries()) {
    if (pkg.initiativeId === initiativeId) {
      packages.delete(id);
      removed += 1;
    }
  }
  if (removed > 0) {
    persist();
  }
  return removed;
}
