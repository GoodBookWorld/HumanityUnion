import type { CivicActionPackage } from "@hu/types";

export interface CivicActionPackagePersistenceSnapshot {
  version: 1;
  packages: Record<string, CivicActionPackage>;
}

export interface CivicActionPackagePersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): CivicActionPackagePersistenceSnapshot;
  save(snapshot: CivicActionPackagePersistenceSnapshot): void;
}

export function createEmptyCivicActionPackagePersistenceSnapshot(): CivicActionPackagePersistenceSnapshot {
  return {
    version: 1,
    packages: {},
  };
}

export function snapshotFromCivicActionPackages(
  packages: Map<string, CivicActionPackage>,
): CivicActionPackagePersistenceSnapshot {
  const serialized: Record<string, CivicActionPackage> = {};

  for (const [capId, capPackage] of packages) {
    serialized[capId] = structuredClone(capPackage);
  }

  return {
    version: 1,
    packages: serialized,
  };
}
