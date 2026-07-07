import type { CivicActionPackage } from "@hu/types";

import { resolveCivicActionPackagePersistenceAdapter } from "./persistence/resolve-civic-action-package-persistence.js";
import { snapshotFromCivicActionPackages } from "./persistence/civic-action-package-persistence.types.js";

const persistence = resolveCivicActionPackagePersistenceAdapter();

function loadPackages(): Map<string, CivicActionPackage> {
  const snapshot = persistence.load();

  return new Map<string, CivicActionPackage>(
    Object.entries(snapshot.packages).map(([capId, capPackage]) => [
      capId,
      structuredClone(capPackage),
    ]),
  );
}

const packages = loadPackages();

function persistPackages(): void {
  persistence.save(snapshotFromCivicActionPackages(packages));
}

export function getPersistenceMode(): "file" | "memory" {
  return persistence.mode;
}

export function getCapById(capId: string): CivicActionPackage | null {
  const capPackage = packages.get(capId);

  return capPackage ? structuredClone(capPackage) : null;
}

export function getCapByDecisionId(decisionId: string): CivicActionPackage | null {
  const capPackage = listCaps().find((record) => record.decisionId === decisionId);

  return capPackage ? structuredClone(capPackage) : null;
}

export function listCaps(): CivicActionPackage[] {
  return Array.from(packages.values(), (capPackage) => structuredClone(capPackage));
}

export function listCapsByInitiative(initiativeId: string): CivicActionPackage[] {
  return listCaps()
    .filter((capPackage) => capPackage.initiativeId === initiativeId)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
}

export function listIssuedCapsByInitiative(initiativeId: string): CivicActionPackage[] {
  return listCapsByInitiative(initiativeId).filter((capPackage) => capPackage.status === "issued");
}

export function getNextCapNumber(): number {
  const numbers = listCaps().map((capPackage) => capPackage.capNumber);

  if (numbers.length === 0) {
    return 1;
  }

  return Math.max(...numbers) + 1;
}

export function createCapPackage(capPackage: CivicActionPackage): CivicActionPackage {
  if (packages.has(capPackage.capId)) {
    throw new Error("Civic Action Package already exists.");
  }

  if (getCapByDecisionId(capPackage.decisionId)) {
    throw new Error("A Civic Action Package already exists for this collective decision.");
  }

  packages.set(capPackage.capId, structuredClone(capPackage));
  persistPackages();

  return structuredClone(capPackage);
}

export function updateCapPackage(
  capId: string,
  update: Pick<CivicActionPackage, "status" | "updatedAt">,
): CivicActionPackage | null {
  const existing = packages.get(capId);

  if (!existing) {
    return null;
  }

  const updated: CivicActionPackage = {
    ...existing,
    ...update,
  };

  packages.set(capId, updated);
  persistPackages();

  return structuredClone(updated);
}
