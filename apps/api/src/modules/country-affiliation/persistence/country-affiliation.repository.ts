import type {
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  fromCountryAffiliationMongoDocument,
  toCountryAffiliationMongoDocument,
  type CountryAffiliationMongoDocument,
} from "./country-affiliation.mongo-document.js";
import {
  deleteCountryAffiliationMemory,
  getCountryAffiliationByIdMemory,
  listCountryAffiliationsMemory,
  upsertCountryAffiliationMemory,
} from "./country-affiliation.memory.store.js";

export interface ListCountryAffiliationsFilter {
  countryCode?: string;
  entryType?: CountryAffiliationEntryType;
  active?: boolean;
}

async function ensureCountryAffiliationMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<CountryAffiliationMongoDocument>(
    MONGO_COLLECTIONS.countryAffiliations,
  );
}

let forceMemoryForTests = false;

export function setCountryAffiliationForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

function matchesFilter(
  entry: CountryAffiliationEntry,
  filter: ListCountryAffiliationsFilter,
): boolean {
  if (filter.countryCode !== undefined) {
    if (entry.countryCode.toUpperCase() !== filter.countryCode.toUpperCase()) {
      return false;
    }
  }
  if (filter.entryType && entry.entryType !== filter.entryType) {
    return false;
  }
  if (filter.active !== undefined && entry.active !== filter.active) {
    return false;
  }
  return true;
}

export async function listCountryAffiliations(
  filter: ListCountryAffiliationsFilter = {},
): Promise<CountryAffiliationEntry[]> {
  if (shouldUseMemoryAdapter()) {
    return listCountryAffiliationsMemory().filter((entry) => matchesFilter(entry, filter));
  }

  await ensureCountryAffiliationMongoReady();
  const query: Record<string, unknown> = {};
  if (filter.countryCode !== undefined) {
    query.countryCode = filter.countryCode.toUpperCase();
  }
  if (filter.entryType) {
    query.entryType = filter.entryType;
  }
  if (filter.active !== undefined) {
    query.active = filter.active;
  }

  const documents = await collection()
    .find(query)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return documents.map(fromCountryAffiliationMongoDocument);
}

export async function getCountryAffiliationById(
  entryId: string,
): Promise<CountryAffiliationEntry | null> {
  if (shouldUseMemoryAdapter()) {
    return getCountryAffiliationByIdMemory(entryId);
  }

  await ensureCountryAffiliationMongoReady();
  const document = await collection().findOne({ entryId });
  return document ? fromCountryAffiliationMongoDocument(document) : null;
}

export async function upsertCountryAffiliation(
  entry: CountryAffiliationEntry,
): Promise<CountryAffiliationEntry> {
  if (shouldUseMemoryAdapter()) {
    return upsertCountryAffiliationMemory(entry);
  }

  await ensureCountryAffiliationMongoReady();
  await collection().replaceOne(
    { entryId: entry.entryId },
    toCountryAffiliationMongoDocument(entry),
    { upsert: true },
  );
  return entry;
}

export async function deleteCountryAffiliation(entryId: string): Promise<boolean> {
  if (shouldUseMemoryAdapter()) {
    return deleteCountryAffiliationMemory(entryId);
  }

  await ensureCountryAffiliationMongoReady();
  const result = await collection().deleteOne({ entryId });
  return result.deletedCount === 1;
}
