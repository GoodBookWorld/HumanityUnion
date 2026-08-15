import type { ContentTranslationSourceKind, LanguageCode, TranslatedContentRecord } from "@hu/types";

const records = new Map<string, TranslatedContentRecord>();

function identityKey(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: LanguageCode;
}): string {
  return [
    input.sourceKind,
    input.sourceRecordId,
    input.sourceVersion,
    input.targetLanguage.toLowerCase(),
  ].join("::");
}

export function resetContentTranslationMemoryStoreForTests(): void {
  records.clear();
}

export function upsertContentTranslationMemory(
  record: TranslatedContentRecord,
): TranslatedContentRecord {
  const key = identityKey(record);
  records.set(key, record);
  return record;
}

export function findContentTranslationMemory(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: LanguageCode;
}): TranslatedContentRecord | null {
  return records.get(identityKey(input)) ?? null;
}

export function listContentTranslationsForSourceMemory(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
}): TranslatedContentRecord[] {
  return [...records.values()].filter(
    (record) =>
      record.sourceKind === input.sourceKind && record.sourceRecordId === input.sourceRecordId,
  );
}

export function markStaleTranslationsForSourceMemory(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  liveSourceVersion: string;
}): void {
  for (const [key, record] of records.entries()) {
    if (
      record.sourceKind === input.sourceKind &&
      record.sourceRecordId === input.sourceRecordId &&
      record.sourceVersion !== input.liveSourceVersion &&
      !record.stale
    ) {
      records.set(key, {
        ...record,
        stale: true,
        freshness: "stale",
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
