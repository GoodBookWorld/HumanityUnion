/**
 * In-memory Language Registry store for tests and non-Mongo local runs.
 */

import type { LanguageRegistryRecord } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

const byLanguageId = new Map<string, LanguageRegistryRecord>();

export function resetLanguageRegistryMemoryForTests(): void {
  byLanguageId.clear();
}

export function listLanguageRegistryMemory(): LanguageRegistryRecord[] {
  return Array.from(byLanguageId.values(), (record) => structuredClone(record)).sort((a, b) =>
    a.locale.localeCompare(b.locale),
  );
}

export function getLanguageRegistryByIdMemory(
  languageId: string,
): LanguageRegistryRecord | null {
  const found = byLanguageId.get(languageId.trim());
  return found ? structuredClone(found) : null;
}

export function getLanguageRegistryByLocaleMemory(
  locale: string,
): LanguageRegistryRecord | null {
  const key = normalizeLanguageRegistryLocaleKey(locale);
  for (const record of byLanguageId.values()) {
    if (normalizeLanguageRegistryLocaleKey(record.locale) === key) {
      return structuredClone(record);
    }
  }
  return null;
}

export function resolveLanguageRegistryLocaleMemory(
  localeOrAlias: string,
): LanguageRegistryRecord | null {
  const key = normalizeLanguageRegistryLocaleKey(localeOrAlias);
  for (const record of byLanguageId.values()) {
    if (normalizeLanguageRegistryLocaleKey(record.locale) === key) {
      return structuredClone(record);
    }
    for (const alias of record.aliases) {
      if (normalizeLanguageRegistryLocaleKey(alias) === key) {
        return structuredClone(record);
      }
    }
  }
  return null;
}

export function upsertLanguageRegistryMemory(record: LanguageRegistryRecord): LanguageRegistryRecord {
  byLanguageId.set(record.languageId, structuredClone(record));
  return structuredClone(record);
}

export function listLanguageRegistryMemorySnapshot(): LanguageRegistryRecord[] {
  return listLanguageRegistryMemory();
}
