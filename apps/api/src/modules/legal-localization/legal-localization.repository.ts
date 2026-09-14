/**
 * Pack 08I.5 — Legal Localization repository (Mongo + memory).
 * No English seed body — empty store is intentional; counsel-approved copies only.
 */

import type { LegalDocumentType, LegalLocalizationRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  LegalLocalizationError,
  LegalLocalizationNotFoundError,
  LegalLocalizationPersistenceError,
  LegalLocalizationValidationError,
} from "./legal-localization.errors.js";
import {
  getLegalLocalizationMemory,
  listLegalLocalizationMemory,
  resetLegalLocalizationMemoryForTests,
  upsertLegalLocalizationMemory,
} from "./legal-localization.memory.store.js";
import {
  fromLegalLocalizationMongoDocument,
  toLegalLocalizationMongoDocument,
  type LegalLocalizationMongoDocument,
} from "./legal-localization.mongo-document.js";

let forceMemoryForTests = false;

export function setLegalLocalizationForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetLegalLocalizationStoreForTests(): void {
  resetLegalLocalizationMemoryForTests();
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new LegalLocalizationPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<LegalLocalizationMongoDocument>(
    MONGO_COLLECTIONS.legalLocalization,
  );
}

function sortRecords(records: LegalLocalizationRecord[]): LegalLocalizationRecord[] {
  return [...records].sort((a, b) => {
    const byType = a.documentType.localeCompare(b.documentType);
    return byType !== 0 ? byType : a.locale.localeCompare(b.locale);
  });
}

/**
 * Optional readiness — no seed required. Memory is always ready; Mongo connects when configured.
 */
export async function ensureLegalLocalizationReady(): Promise<void> {
  if (shouldUseMemoryAdapter()) {
    return;
  }
  await ensureMongoReady();
}

async function listAllRecordsInternal(): Promise<LegalLocalizationRecord[]> {
  if (shouldUseMemoryAdapter()) {
    return listLegalLocalizationMemory();
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs.map((doc) => fromLegalLocalizationMongoDocument(doc));
}

export async function listLegalLocalizations(): Promise<LegalLocalizationRecord[]> {
  try {
    await ensureLegalLocalizationReady();
    return sortRecords(await listAllRecordsInternal());
  } catch (error) {
    if (error instanceof LegalLocalizationError) {
      throw error;
    }
    throw new LegalLocalizationPersistenceError("Failed to list legal localizations.", error);
  }
}

export async function getLegalLocalization(
  documentType: LegalDocumentType,
  locale: string,
): Promise<LegalLocalizationRecord | null> {
  const key = locale.trim();
  if (!key) {
    return null;
  }

  await ensureLegalLocalizationReady();

  if (shouldUseMemoryAdapter()) {
    return getLegalLocalizationMemory(documentType, key);
  }

  try {
    await ensureMongoReady();
    const doc = await collection().findOne({ documentType, locale: key });
    return doc ? fromLegalLocalizationMongoDocument(doc) : null;
  } catch (error) {
    throw new LegalLocalizationPersistenceError("Failed to load legal localization.", error);
  }
}

export async function upsertLegalLocalization(
  record: LegalLocalizationRecord,
): Promise<LegalLocalizationRecord> {
  if (!record.locale.trim()) {
    throw new LegalLocalizationValidationError("locale is required.");
  }

  await ensureLegalLocalizationReady();

  if (shouldUseMemoryAdapter()) {
    return upsertLegalLocalizationMemory(record);
  }

  try {
    await ensureMongoReady();
    await collection().replaceOne(
      { documentType: record.documentType, locale: record.locale },
      toLegalLocalizationMongoDocument(record),
      { upsert: true },
    );
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new LegalLocalizationPersistenceError(
        "Legal localization unique constraint violated.",
        error,
      );
    }
    throw new LegalLocalizationPersistenceError("Failed to save legal localization.", error);
  }
}

export async function updateLegalLocalizationRecord(
  documentType: LegalDocumentType,
  locale: string,
  next: LegalLocalizationRecord,
): Promise<LegalLocalizationRecord> {
  const key = locale.trim();
  if (!key) {
    throw new LegalLocalizationValidationError("locale is required.");
  }
  if (next.locale !== key) {
    throw new LegalLocalizationValidationError("locale is immutable after create.");
  }
  if (next.documentType !== documentType) {
    throw new LegalLocalizationValidationError("documentType is immutable after create.");
  }

  await ensureLegalLocalizationReady();

  const current = await getLegalLocalization(documentType, key);
  if (!current) {
    throw new LegalLocalizationNotFoundError(
      `Legal localization not found: ${documentType}/${key}`,
    );
  }

  if (shouldUseMemoryAdapter()) {
    return upsertLegalLocalizationMemory(next);
  }

  try {
    await ensureMongoReady();
    const result = await collection().replaceOne(
      { documentType, locale: key },
      toLegalLocalizationMongoDocument(next),
      { upsert: false },
    );
    if (result.matchedCount === 0) {
      throw new LegalLocalizationNotFoundError(
        `Legal localization not found: ${documentType}/${key}`,
      );
    }
    return next;
  } catch (error) {
    if (error instanceof LegalLocalizationError) {
      throw error;
    }
    throw new LegalLocalizationPersistenceError(
      "Failed to update legal localization.",
      error,
    );
  }
}
