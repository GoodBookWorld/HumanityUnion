import type { CountryAffiliationEntry } from "@hu/types";

const entriesById = new Map<string, CountryAffiliationEntry>();

export function resetCountryAffiliationsMemoryForTests(): void {
  entriesById.clear();
}

export function listCountryAffiliationsMemory(): CountryAffiliationEntry[] {
  return [...entriesById.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

export function getCountryAffiliationByIdMemory(
  entryId: string,
): CountryAffiliationEntry | null {
  return entriesById.get(entryId) ?? null;
}

export function upsertCountryAffiliationMemory(
  entry: CountryAffiliationEntry,
): CountryAffiliationEntry {
  entriesById.set(entry.entryId, entry);
  return entry;
}

export function deleteCountryAffiliationMemory(entryId: string): boolean {
  return entriesById.delete(entryId);
}
