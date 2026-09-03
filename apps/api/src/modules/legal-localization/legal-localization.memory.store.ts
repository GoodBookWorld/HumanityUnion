/**
 * In-memory Legal Localization store for tests and non-Mongo local runs.
 * Unique key = documentType + locale. No English seed bodies.
 */

import type { LegalDocumentType, LegalLocalizationRecord } from "@hu/types";

function memoryKey(documentType: LegalDocumentType, locale: string): string {
  return `${documentType}::${locale.trim()}`;
}

const byKey = new Map<string, LegalLocalizationRecord>();

export function resetLegalLocalizationMemoryForTests(): void {
  byKey.clear();
}

export function listLegalLocalizationMemory(): LegalLocalizationRecord[] {
  return Array.from(byKey.values(), (record) => structuredClone(record)).sort((a, b) => {
    const byType = a.documentType.localeCompare(b.documentType);
    return byType !== 0 ? byType : a.locale.localeCompare(b.locale);
  });
}

export function getLegalLocalizationMemory(
  documentType: LegalDocumentType,
  locale: string,
): LegalLocalizationRecord | null {
  const found = byKey.get(memoryKey(documentType, locale));
  return found ? structuredClone(found) : null;
}

export function upsertLegalLocalizationMemory(
  record: LegalLocalizationRecord,
): LegalLocalizationRecord {
  byKey.set(memoryKey(record.documentType, record.locale), structuredClone(record));
  return structuredClone(record);
}

export function deleteLegalLocalizationMemory(
  documentType: LegalDocumentType,
  locale: string,
): boolean {
  return byKey.delete(memoryKey(documentType, locale));
}
