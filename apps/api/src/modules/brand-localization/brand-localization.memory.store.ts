/**
 * In-memory Brand Localization store for tests and non-Mongo local runs.
 */

import type { BrandLocalizationRecord } from "@hu/types";

const byLocale = new Map<string, BrandLocalizationRecord>();

export function resetBrandLocalizationMemoryForTests(): void {
  byLocale.clear();
}

export function listBrandLocalizationMemory(): BrandLocalizationRecord[] {
  return Array.from(byLocale.values(), (record) => structuredClone(record)).sort((a, b) =>
    a.locale.localeCompare(b.locale),
  );
}

export function getBrandLocalizationByLocaleMemory(
  locale: string,
): BrandLocalizationRecord | null {
  const found = byLocale.get(locale.trim());
  return found ? structuredClone(found) : null;
}

export function upsertBrandLocalizationMemory(
  record: BrandLocalizationRecord,
): BrandLocalizationRecord {
  byLocale.set(record.locale, structuredClone(record));
  return structuredClone(record);
}

export function deleteBrandLocalizationMemory(locale: string): boolean {
  return byLocale.delete(locale.trim());
}
