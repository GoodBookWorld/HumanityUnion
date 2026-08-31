/**
 * Production Completion Pack 02B — Language Registry repository.
 *
 * Mongo-backed with memory adapter for tests.
 * Task 02: bootstrap seed + locale/alias integrity; HTTP read APIs live in routes/service.
 */

import { randomUUID } from "node:crypto";

import type {
  LanguageRegistryCreateInput,
  LanguageRegistryRecord,
  LanguageRegistryUpdateInput,
} from "@hu/types";
import {
  LANGUAGE_REGISTRY_DEFAULT_FALLBACK_LOCALE,
  deriveLanguageCodeFromLocale,
  isLanguageTextDirection,
  isLanguageUiTranslationStatus,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  LanguageRegistryConflictError,
  LanguageRegistryError,
  LanguageRegistryNotFoundError,
  LanguageRegistryPersistenceError,
  LanguageRegistryValidationError,
} from "./language-registry.errors.js";
import {
  assertLanguageRegistryLocaleIntegrity,
  sortLanguageRegistryRecords,
} from "./language-registry.integrity.js";
import {
  applyDisabledFeatureFlagClearance,
  assertLanguageRegistryAdminPolicy,
} from "./language-registry.policy.js";
import {
  getLanguageRegistryByIdMemory,
  getLanguageRegistryByLocaleMemory,
  listLanguageRegistryMemory,
  resetLanguageRegistryMemoryForTests,
  resolveLanguageRegistryLocaleMemory,
  upsertLanguageRegistryMemory,
} from "./language-registry.memory.store.js";
import {
  fromLanguageRegistryMongoDocument,
  normalizeAliasList,
  toLanguageRegistryMongoDocument,
  type LanguageRegistryMongoDocument,
} from "./language-registry.mongo-document.js";
import {
  LANGUAGE_REGISTRY_SEED_DEFINITIONS,
  buildLanguageRegistrySeedRecord,
} from "./language-registry.seed.js";

let forceMemoryForTests = false;
let mongoSeedPromise: Promise<LanguageRegistrySeedResult> | null = null;

export interface LanguageRegistrySeedResult {
  readonly inserted: number;
  readonly skippedExisting: number;
  readonly locales: readonly string[];
}

export function setLanguageRegistryForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetLanguageRegistryStoreForTests(): void {
  resetLanguageRegistryMemoryForTests();
  mongoSeedPromise = null;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new LanguageRegistryPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<LanguageRegistryMongoDocument>(MONGO_COLLECTIONS.languageRegistry);
}

function assertValidLocaleTag(locale: string, fieldName: string): string {
  const trimmed = locale.trim();
  if (!trimmed) {
    throw new LanguageRegistryValidationError(`${fieldName} is required.`);
  }
  if (/\s/.test(trimmed)) {
    throw new LanguageRegistryValidationError(`${fieldName} must not contain whitespace.`);
  }
  return trimmed;
}

function assertCreateInput(input: LanguageRegistryCreateInput): void {
  assertValidLocaleTag(input.locale, "locale");
  if (!input.englishName?.trim() || !input.nativeName?.trim()) {
    throw new LanguageRegistryValidationError("englishName and nativeName are required.");
  }
  if (!isLanguageTextDirection(input.textDirection)) {
    throw new LanguageRegistryValidationError("textDirection must be ltr or rtl.");
  }
  if (
    input.uiTranslationStatus !== undefined &&
    !isLanguageUiTranslationStatus(input.uiTranslationStatus)
  ) {
    throw new LanguageRegistryValidationError("Invalid uiTranslationStatus.");
  }
}

/**
 * Fail closed when an alias/locale key is already claimed by another registry row.
 */
function assertNoAmbiguousLocaleKeys(
  records: readonly LanguageRegistryRecord[],
  candidate: {
    languageId: string;
    locale: string;
    aliases: readonly string[];
  },
): void {
  assertLanguageRegistryLocaleIntegrity(records, candidate);
}

function buildRecordFromCreateInput(input: LanguageRegistryCreateInput): LanguageRegistryRecord {
  assertCreateInput(input);
  const now = new Date().toISOString();
  const locale = assertValidLocaleTag(input.locale, "locale");
  const aliases = normalizeAliasList(input.aliases);
  const languageId = input.languageId?.trim() || randomUUID();

  return {
    languageId,
    locale,
    languageCode:
      input.languageCode?.trim().toLowerCase() || deriveLanguageCodeFromLocale(locale),
    englishName: input.englishName.trim(),
    nativeName: input.nativeName.trim(),
    textDirection: input.textDirection,
    fallbackLocale: assertValidLocaleTag(
      input.fallbackLocale ?? LANGUAGE_REGISTRY_DEFAULT_FALLBACK_LOCALE,
      "fallbackLocale",
    ),
    enabled: input.enabled === true,
    uiTranslationStatus: input.uiTranslationStatus ?? "none",
    contentTranslationEnabled: input.contentTranslationEnabled === true,
    searchEnabled: input.searchEnabled === true,
    seoIndexingEnabled: input.seoIndexingEnabled === true,
    aliases,
    providerMappings: { ...(input.providerMappings ?? {}) },
    createdAt: now,
    updatedAt: now,
  };
}

async function listAllRecordsInternal(): Promise<LanguageRegistryRecord[]> {
  if (shouldUseMemoryAdapter()) {
    return listLanguageRegistryMemory();
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs.map((doc) => fromLanguageRegistryMongoDocument(doc));
}

export async function listLanguageRegistry(): Promise<LanguageRegistryRecord[]> {
  try {
    await ensureLanguageRegistrySeeded();
    return sortLanguageRegistryRecords(await listAllRecordsInternal());
  } catch (error) {
    if (error instanceof LanguageRegistryError) {
      throw error;
    }
    throw new LanguageRegistryPersistenceError("Failed to list language registry.", error);
  }
}

export async function getLanguageRegistryByLocale(
  locale: string,
): Promise<LanguageRegistryRecord | null> {
  const key = normalizeLanguageRegistryLocaleKey(locale);
  if (!key) {
    return null;
  }

  await ensureLanguageRegistrySeeded();

  if (shouldUseMemoryAdapter()) {
    return getLanguageRegistryByLocaleMemory(locale);
  }

  try {
    await ensureMongoReady();
    const doc = await collection().findOne({ localeKey: key });
    return doc ? fromLanguageRegistryMongoDocument(doc) : null;
  } catch (error) {
    throw new LanguageRegistryPersistenceError("Failed to load language registry by locale.", error);
  }
}

/**
 * Resolve a BCP-47 tag or alias to the canonical registry record.
 */
export async function resolveLanguageRegistryLocale(
  localeOrAlias: string,
): Promise<LanguageRegistryRecord | null> {
  const key = normalizeLanguageRegistryLocaleKey(localeOrAlias);
  if (!key) {
    return null;
  }

  await ensureLanguageRegistrySeeded();

  if (shouldUseMemoryAdapter()) {
    return resolveLanguageRegistryLocaleMemory(localeOrAlias);
  }

  try {
    await ensureMongoReady();
    const doc = await collection().findOne({
      $or: [{ localeKey: key }, { aliasKeys: key }],
    });
    return doc ? fromLanguageRegistryMongoDocument(doc) : null;
  } catch (error) {
    throw new LanguageRegistryPersistenceError(
      "Failed to resolve language registry locale.",
      error,
    );
  }
}

export async function createLanguageRegistryRecord(
  input: LanguageRegistryCreateInput,
): Promise<LanguageRegistryRecord> {
  let record = buildRecordFromCreateInput(input);
  if (
    !record.enabled &&
    (input.searchEnabled === true ||
      input.seoIndexingEnabled === true ||
      input.contentTranslationEnabled === true)
  ) {
    throw new LanguageRegistryValidationError(
      "Feature enablement flags require enabled=true.",
    );
  }
  record = applyDisabledFeatureFlagClearance(record);

  const existing = await listAllRecordsInternal();
  assertNoAmbiguousLocaleKeys(existing, record);
  assertLanguageRegistryAdminPolicy([...existing, record], record, null);

  if (existing.some((row) => row.languageId === record.languageId)) {
    throw new LanguageRegistryConflictError(
      `languageId "${record.languageId}" already exists.`,
    );
  }

  if (shouldUseMemoryAdapter()) {
    return upsertLanguageRegistryMemory(record);
  }

  try {
    await ensureMongoReady();
    await collection().insertOne(toLanguageRegistryMongoDocument(record));
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new LanguageRegistryConflictError(
        "Language registry unique constraint violated (locale, languageId, or alias).",
      );
    }
    throw new LanguageRegistryPersistenceError("Failed to create language registry record.", error);
  }
}

export async function updateLanguageRegistryRecord(
  languageId: string,
  input: LanguageRegistryUpdateInput,
): Promise<LanguageRegistryRecord> {
  const id = languageId.trim();
  if (!id) {
    throw new LanguageRegistryValidationError("languageId is required.");
  }

  await ensureLanguageRegistrySeeded();

  let current: LanguageRegistryRecord | null;
  if (shouldUseMemoryAdapter()) {
    current = getLanguageRegistryByIdMemory(id);
  } else {
    await ensureMongoReady();
    const doc = await collection().findOne({ languageId: id });
    current = doc ? fromLanguageRegistryMongoDocument(doc) : null;
  }

  if (!current) {
    throw new LanguageRegistryNotFoundError(`Language registry record not found: ${id}`);
  }

  if (input.textDirection !== undefined && !isLanguageTextDirection(input.textDirection)) {
    throw new LanguageRegistryValidationError("textDirection must be ltr or rtl.");
  }
  if (
    input.uiTranslationStatus !== undefined &&
    !isLanguageUiTranslationStatus(input.uiTranslationStatus)
  ) {
    throw new LanguageRegistryValidationError("Invalid uiTranslationStatus.");
  }

  const nextLocale =
    input.locale !== undefined
      ? assertValidLocaleTag(input.locale, "locale")
      : current.locale;
  if (
    input.locale !== undefined &&
    normalizeLanguageRegistryLocaleKey(nextLocale) !==
      normalizeLanguageRegistryLocaleKey(current.locale)
  ) {
    throw new LanguageRegistryValidationError(
      "Canonical locale cannot be changed after creation.",
    );
  }
  const nextAliases =
    input.aliases !== undefined ? normalizeAliasList(input.aliases) : [...current.aliases];

  let next: LanguageRegistryRecord = {
    ...current,
    locale: current.locale,
    languageCode:
      input.languageCode?.trim().toLowerCase() || current.languageCode,
    englishName: input.englishName?.trim() ?? current.englishName,
    nativeName: input.nativeName?.trim() ?? current.nativeName,
    textDirection: input.textDirection ?? current.textDirection,
    fallbackLocale:
      input.fallbackLocale !== undefined
        ? assertValidLocaleTag(input.fallbackLocale, "fallbackLocale")
        : current.fallbackLocale,
    enabled: input.enabled ?? current.enabled,
    uiTranslationStatus: input.uiTranslationStatus ?? current.uiTranslationStatus,
    contentTranslationEnabled:
      input.contentTranslationEnabled ?? current.contentTranslationEnabled,
    searchEnabled: input.searchEnabled ?? current.searchEnabled,
    seoIndexingEnabled: input.seoIndexingEnabled ?? current.seoIndexingEnabled,
    aliases: nextAliases,
    providerMappings:
      input.providerMappings !== undefined
        ? { ...input.providerMappings }
        : { ...current.providerMappings },
    updatedAt: new Date().toISOString(),
  };

  if (
    !next.enabled &&
    (input.searchEnabled === true ||
      input.seoIndexingEnabled === true ||
      input.contentTranslationEnabled === true)
  ) {
    throw new LanguageRegistryValidationError(
      "Feature enablement flags require enabled=true.",
    );
  }
  next = applyDisabledFeatureFlagClearance(next);

  const others = (await listAllRecordsInternal()).filter((row) => row.languageId !== id);
  assertNoAmbiguousLocaleKeys(others, next);
  assertLanguageRegistryAdminPolicy([...others, next], next, current);

  if (shouldUseMemoryAdapter()) {
    return upsertLanguageRegistryMemory(next);
  }

  try {
    await ensureMongoReady();
    await collection().replaceOne(
      { languageId: id },
      toLanguageRegistryMongoDocument(next),
      { upsert: false },
    );
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new LanguageRegistryConflictError(
        "Language registry unique constraint violated (locale or alias).",
      );
    }
    throw new LanguageRegistryPersistenceError("Failed to update language registry record.", error);
  }
}

/**
 * Idempotent bootstrap for Task 01 verification locales.
 * Existing rows (including Admin-modified) are never overwritten.
 */
export async function ensureLanguageRegistrySeeded(): Promise<LanguageRegistrySeedResult> {
  if (shouldUseMemoryAdapter()) {
    let inserted = 0;
    let skippedExisting = 0;
    for (const definition of LANGUAGE_REGISTRY_SEED_DEFINITIONS) {
      const existing = getLanguageRegistryByLocaleMemory(definition.locale);
      if (existing) {
        skippedExisting += 1;
        continue;
      }
      upsertLanguageRegistryMemory(buildLanguageRegistrySeedRecord(definition));
      inserted += 1;
    }
    return {
      inserted,
      skippedExisting,
      locales: LANGUAGE_REGISTRY_SEED_DEFINITIONS.map((d) => d.locale),
    };
  }

  if (!mongoSeedPromise) {
    mongoSeedPromise = (async () => {
      try {
        await ensureMongoReady();
        let inserted = 0;
        let skippedExisting = 0;
        for (const definition of LANGUAGE_REGISTRY_SEED_DEFINITIONS) {
          const localeKey = normalizeLanguageRegistryLocaleKey(definition.locale);
          const existing = await collection().findOne({ localeKey });
          if (existing) {
            skippedExisting += 1;
            continue;
          }
          const seed = buildLanguageRegistrySeedRecord(definition);
          // Re-check alias conflicts against live rows before insert.
          const live = (await collection().find({}).toArray()).map((doc) =>
            fromLanguageRegistryMongoDocument(doc),
          );
          assertNoAmbiguousLocaleKeys(live, seed);
          await collection().insertOne(toLanguageRegistryMongoDocument(seed));
          inserted += 1;
        }
        return {
          inserted,
          skippedExisting,
          locales: LANGUAGE_REGISTRY_SEED_DEFINITIONS.map((d) => d.locale),
        };
      } catch (error) {
        mongoSeedPromise = null;
        if (
          error instanceof LanguageRegistryConflictError ||
          error instanceof LanguageRegistryValidationError
        ) {
          throw error;
        }
        throw new LanguageRegistryPersistenceError("Failed to seed language registry.", error);
      }
    })();
  }

  return mongoSeedPromise;
}
