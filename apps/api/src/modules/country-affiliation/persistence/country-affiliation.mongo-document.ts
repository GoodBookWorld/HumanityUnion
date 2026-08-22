import type { Document } from "mongodb";

import type { CountryAffiliationEntry } from "@hu/types";

export interface CountryAffiliationMongoDocument extends Document {
  entryId: string;
  countryCode: string;
  entryType: CountryAffiliationEntry["entryType"];
  name: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toCountryAffiliationMongoDocument(
  entry: CountryAffiliationEntry,
): CountryAffiliationMongoDocument {
  return {
    entryId: entry.entryId,
    countryCode: entry.countryCode,
    entryType: entry.entryType,
    name: entry.name,
    roleOrPosition: entry.roleOrPosition ?? null,
    imageUrl: entry.imageUrl ?? null,
    email: entry.email ?? null,
    websiteUrl: entry.websiteUrl ?? null,
    sortOrder: entry.sortOrder,
    active: entry.active,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function fromCountryAffiliationMongoDocument(
  document: CountryAffiliationMongoDocument,
): CountryAffiliationEntry {
  return {
    entryId: document.entryId,
    countryCode: document.countryCode,
    entryType: document.entryType,
    name: document.name,
    roleOrPosition: document.roleOrPosition ?? null,
    imageUrl: document.imageUrl ?? null,
    email: document.email ?? null,
    websiteUrl: document.websiteUrl ?? null,
    sortOrder: document.sortOrder,
    active: document.active,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
