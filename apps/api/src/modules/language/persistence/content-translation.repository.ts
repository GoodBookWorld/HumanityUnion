import type { ContentTranslationSourceKind, LanguageCode, TranslatedContentRecord } from "@hu/types";

import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import {
  findContentTranslationMemory,
  listContentTranslationsForSourceMemory,
  markStaleTranslationsForSourceMemory,
  upsertContentTranslationMemory,
} from "./content-translation.memory.store.js";
import {
  findContentTranslationMongo,
  listContentTranslationsForSourceMongo,
  markStaleTranslationsForSourceMongo,
  upsertContentTranslationMongo,
} from "./content-translation.mongo.repository.js";

function shouldUseMongoContentTranslations(): boolean {
  if (process.env.CONTENT_TRANSLATION_PERSISTENCE?.trim().toLowerCase() === "memory") {
    return false;
  }
  return isMongoConfigured();
}

export async function upsertContentTranslation(
  record: TranslatedContentRecord,
): Promise<TranslatedContentRecord> {
  if (shouldUseMongoContentTranslations()) {
    return upsertContentTranslationMongo(record);
  }
  return upsertContentTranslationMemory(record);
}

export async function findContentTranslation(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: LanguageCode;
}): Promise<TranslatedContentRecord | null> {
  if (shouldUseMongoContentTranslations()) {
    return findContentTranslationMongo(input);
  }
  return findContentTranslationMemory(input);
}

export async function listContentTranslationsForSource(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
}): Promise<TranslatedContentRecord[]> {
  if (shouldUseMongoContentTranslations()) {
    return listContentTranslationsForSourceMongo(input);
  }
  return listContentTranslationsForSourceMemory(input);
}

export async function markStaleTranslationsForSource(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  liveSourceVersion: string;
}): Promise<void> {
  if (shouldUseMongoContentTranslations()) {
    await markStaleTranslationsForSourceMongo(input);
    return;
  }
  markStaleTranslationsForSourceMemory(input);
}
