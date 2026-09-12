/**
 * In-memory Language Activation Job store (tests / non-Mongo).
 */

import type { LanguageActivationJobRecord } from "@hu/types";

const byJobId = new Map<string, LanguageActivationJobRecord>();

export function resetLanguageActivationJobMemoryForTests(): void {
  byJobId.clear();
}

export function listLanguageActivationJobMemory(): readonly LanguageActivationJobRecord[] {
  return [...byJobId.values()];
}

export function getLanguageActivationJobByIdMemory(
  jobId: string,
): LanguageActivationJobRecord | null {
  return byJobId.get(jobId) ?? null;
}

export function getLatestLanguageActivationJobByLocaleMemory(
  locale: string,
): LanguageActivationJobRecord | null {
  const rows = [...byJobId.values()].filter((row) => row.locale === locale);
  if (rows.length === 0) {
    return null;
  }
  rows.sort((a, b) => {
    if (a.generation !== b.generation) {
      return b.generation - a.generation;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return rows[0] ?? null;
}

export function getActiveLanguageActivationJobByLocaleMemory(
  locale: string,
): LanguageActivationJobRecord | null {
  const active = [...byJobId.values()].filter(
    (row) =>
      row.locale === locale &&
      (row.status === "queued" ||
        row.status === "running" ||
        row.status === "waiting_for_data"),
  );
  if (active.length === 0) {
    return null;
  }
  active.sort((a, b) => b.generation - a.generation);
  return active[0] ?? null;
}

export function upsertLanguageActivationJobMemory(
  record: LanguageActivationJobRecord,
): LanguageActivationJobRecord {
  byJobId.set(record.jobId, record);
  return record;
}
