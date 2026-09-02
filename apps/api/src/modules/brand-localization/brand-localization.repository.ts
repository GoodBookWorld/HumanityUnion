/**
 * Pack 08I.2 — Brand Localization repository (Mongo + memory).
 * Seeds English published record; never overwrites Admin-managed rows on re-seed.
 */

import type { BrandLocalizationRecord } from "@hu/types";
import { CANONICAL_ENGLISH_BRAND_FALLBACK } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  BrandLocalizationError,
  BrandLocalizationNotFoundError,
  BrandLocalizationPersistenceError,
  BrandLocalizationValidationError,
} from "./brand-localization.errors.js";
import {
  getBrandLocalizationByLocaleMemory,
  listBrandLocalizationMemory,
  resetBrandLocalizationMemoryForTests,
  upsertBrandLocalizationMemory,
} from "./brand-localization.memory.store.js";
import {
  fromBrandLocalizationMongoDocument,
  toBrandLocalizationMongoDocument,
  type BrandLocalizationMongoDocument,
} from "./brand-localization.mongo-document.js";
import {
  ENGLISH_BRAND_LOCALIZATION_LOCALE,
  buildEnglishPublishedBrandLocalization,
} from "./brand-localization.seed.js";

let forceMemoryForTests = false;
let mongoSeedPromise: Promise<BrandLocalizationSeedResult> | null = null;

export interface BrandLocalizationSeedResult {
  readonly inserted: number;
  readonly skippedExisting: number;
  readonly locales: readonly string[];
}

export function setBrandLocalizationForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetBrandLocalizationStoreForTests(): void {
  resetBrandLocalizationMemoryForTests();
  mongoSeedPromise = null;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new BrandLocalizationPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<BrandLocalizationMongoDocument>(
    MONGO_COLLECTIONS.brandLocalization,
  );
}

function sortByLocale(records: BrandLocalizationRecord[]): BrandLocalizationRecord[] {
  return [...records].sort((a, b) => a.locale.localeCompare(b.locale));
}

async function listAllRecordsInternal(): Promise<BrandLocalizationRecord[]> {
  if (shouldUseMemoryAdapter()) {
    return listBrandLocalizationMemory();
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs.map((doc) => fromBrandLocalizationMongoDocument(doc));
}

export async function ensureBrandLocalizationSeeded(): Promise<BrandLocalizationSeedResult> {
  if (shouldUseMemoryAdapter()) {
    const existing = getBrandLocalizationByLocaleMemory(ENGLISH_BRAND_LOCALIZATION_LOCALE);
    if (existing) {
      if (!existing.heroUnityQuote?.trim()) {
        upsertBrandLocalizationMemory({
          ...existing,
          heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
        });
      }
      return {
        inserted: 0,
        skippedExisting: 1,
        locales: [ENGLISH_BRAND_LOCALIZATION_LOCALE],
      };
    }
    upsertBrandLocalizationMemory(buildEnglishPublishedBrandLocalization());
    return {
      inserted: 1,
      skippedExisting: 0,
      locales: [ENGLISH_BRAND_LOCALIZATION_LOCALE],
    };
  }

  await ensureMongoReady();
  if (!mongoSeedPromise) {
    mongoSeedPromise = (async () => {
      try {
        const existing = await collection().findOne({
          locale: ENGLISH_BRAND_LOCALIZATION_LOCALE,
        });
        if (existing) {
          if (!existing.heroUnityQuote?.trim()) {
            await collection().updateOne(
              { locale: ENGLISH_BRAND_LOCALIZATION_LOCALE },
              {
                $set: {
                  heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
                },
              },
            );
          }
          return {
            inserted: 0,
            skippedExisting: 1,
            locales: [ENGLISH_BRAND_LOCALIZATION_LOCALE],
          };
        }
        const seed = buildEnglishPublishedBrandLocalization();
        await collection().insertOne(toBrandLocalizationMongoDocument(seed));
        return {
          inserted: 1,
          skippedExisting: 0,
          locales: [ENGLISH_BRAND_LOCALIZATION_LOCALE],
        };
      } catch (error) {
        mongoSeedPromise = null;
        throw new BrandLocalizationPersistenceError(
          "Failed to seed brand localization.",
          error,
        );
      }
    })();
  }
  return mongoSeedPromise;
}

export async function listBrandLocalizations(): Promise<BrandLocalizationRecord[]> {
  try {
    await ensureBrandLocalizationSeeded();
    return sortByLocale(await listAllRecordsInternal());
  } catch (error) {
    if (error instanceof BrandLocalizationError) {
      throw error;
    }
    throw new BrandLocalizationPersistenceError("Failed to list brand localizations.", error);
  }
}

export async function getBrandLocalizationByLocale(
  locale: string,
): Promise<BrandLocalizationRecord | null> {
  const key = locale.trim();
  if (!key) {
    return null;
  }

  await ensureBrandLocalizationSeeded();

  if (shouldUseMemoryAdapter()) {
    return getBrandLocalizationByLocaleMemory(key);
  }

  try {
    await ensureMongoReady();
    const doc = await collection().findOne({ locale: key });
    return doc ? fromBrandLocalizationMongoDocument(doc) : null;
  } catch (error) {
    throw new BrandLocalizationPersistenceError(
      "Failed to load brand localization.",
      error,
    );
  }
}

export async function upsertBrandLocalization(
  record: BrandLocalizationRecord,
): Promise<BrandLocalizationRecord> {
  if (!record.locale.trim()) {
    throw new BrandLocalizationValidationError("locale is required.");
  }

  await ensureBrandLocalizationSeeded();

  if (shouldUseMemoryAdapter()) {
    return upsertBrandLocalizationMemory(record);
  }

  try {
    await ensureMongoReady();
    await collection().replaceOne(
      { locale: record.locale },
      toBrandLocalizationMongoDocument(record),
      { upsert: true },
    );
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new BrandLocalizationPersistenceError(
        "Brand localization unique constraint violated.",
        error,
      );
    }
    throw new BrandLocalizationPersistenceError("Failed to save brand localization.", error);
  }
}

export async function updateBrandLocalizationRecord(
  locale: string,
  next: BrandLocalizationRecord,
): Promise<BrandLocalizationRecord> {
  const key = locale.trim();
  if (!key) {
    throw new BrandLocalizationValidationError("locale is required.");
  }
  if (next.locale !== key) {
    throw new BrandLocalizationValidationError("locale is immutable after create.");
  }

  await ensureBrandLocalizationSeeded();

  const current = await getBrandLocalizationByLocale(key);
  if (!current) {
    throw new BrandLocalizationNotFoundError(`Brand localization not found: ${key}`);
  }

  if (shouldUseMemoryAdapter()) {
    return upsertBrandLocalizationMemory(next);
  }

  try {
    await ensureMongoReady();
    const result = await collection().replaceOne(
      { locale: key },
      toBrandLocalizationMongoDocument(next),
      { upsert: false },
    );
    if (result.matchedCount === 0) {
      throw new BrandLocalizationNotFoundError(`Brand localization not found: ${key}`);
    }
    return next;
  } catch (error) {
    if (error instanceof BrandLocalizationError) {
      throw error;
    }
    throw new BrandLocalizationPersistenceError(
      "Failed to update brand localization.",
      error,
    );
  }
}
