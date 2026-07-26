import type { CivicNomination } from "@hu/types";

import { resolveCivicNominationPersistenceAdapter } from "./persistence/resolve-civic-nomination-persistence.js";
import { snapshotFromCivicNominations } from "./persistence/civic-nomination-persistence.types.js";

const persistence = resolveCivicNominationPersistenceAdapter();

function loadNominations(): Map<string, CivicNomination> {
  const snapshot = persistence.load();

  return new Map<string, CivicNomination>(
    Object.entries(snapshot.nominations).map(([nominationId, nomination]) => [
      nominationId,
      structuredClone(nomination),
    ]),
  );
}

const nominations = loadNominations();

function persistNominations(): void {
  persistence.save(snapshotFromCivicNominations(nominations));
}

export function getPersistenceMode(): "memory" | "mongodb" {
  return persistence.mode;
}

export function getCivicNominationById(nominationId: string): CivicNomination | null {
  const nomination = nominations.get(nominationId);
  return nomination ? structuredClone(nomination) : null;
}

export function listCivicNominations(): CivicNomination[] {
  return Array.from(nominations.values(), (nomination) => structuredClone(nomination));
}

export function listCivicNominationsByNominator(profileId: string): CivicNomination[] {
  return listCivicNominations()
    .filter((nomination) => nomination.nominatedByProfileId === profileId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listPublishedCivicNominations(filters?: {
  institutionRole?: string;
  countrySlug?: string;
}): CivicNomination[] {
  return listCivicNominations()
    .filter((nomination) => nomination.status === "published")
    .filter((nomination) =>
      filters?.institutionRole ? nomination.institutionRole === filters.institutionRole : true,
    )
    .filter((nomination) =>
      filters?.countrySlug ? nomination.countrySlug === filters.countrySlug : true,
    )
    .sort((left, right) => right.publishedAt?.localeCompare(left.publishedAt ?? "") ?? 0);
}

export function createCivicNominationRecord(nomination: CivicNomination): CivicNomination {
  if (nominations.has(nomination.nominationId)) {
    throw new Error("Civic nomination already exists.");
  }

  nominations.set(nomination.nominationId, structuredClone(nomination));
  persistNominations();

  return structuredClone(nomination);
}

export function updateCivicNominationRecord(
  nominationId: string,
  updater: (current: CivicNomination) => CivicNomination,
): CivicNomination {
  const current = nominations.get(nominationId);

  if (!current) {
    throw new Error("Civic nomination not found.");
  }

  const updated = updater(structuredClone(current));
  nominations.set(nominationId, structuredClone(updated));
  persistNominations();

  return structuredClone(updated);
}

export function resetCivicNominationStoreForTests(): void {
  nominations.clear();
  persistNominations();
}
