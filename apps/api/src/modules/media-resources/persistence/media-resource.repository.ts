import type { MediaResource, MediaResourceScopeType, MediaResourceType } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  fromMediaResourceMongoDocument,
  toMediaResourceMongoDocument,
  type MediaResourceMongoDocument,
} from "./media-resource.mongo-document.js";
import {
  deleteMediaResourceMemory,
  getMediaResourceByIdMemory,
  listMediaResourcesMemory,
  upsertMediaResourceMemory,
} from "./media-resource.memory.store.js";

export interface ListMediaResourcesFilter {
  resourceType?: MediaResourceType;
  scopeType?: MediaResourceScopeType;
  countryCode?: string | null;
  active?: boolean;
}

async function ensureMediaResourceMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<MediaResourceMongoDocument>(MONGO_COLLECTIONS.mediaResources);
}

let forceMemoryForTests = false;

export function setMediaResourceForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

function matchesFilter(resource: MediaResource, filter: ListMediaResourcesFilter): boolean {
  if (filter.resourceType && resource.resourceType !== filter.resourceType) {
    return false;
  }
  if (filter.scopeType && resource.scopeType !== filter.scopeType) {
    return false;
  }
  if (filter.active !== undefined && resource.active !== filter.active) {
    return false;
  }
  if (filter.countryCode !== undefined) {
    const expected = filter.countryCode === null ? null : filter.countryCode.toUpperCase();
    const actual = resource.countryCode === null ? null : resource.countryCode.toUpperCase();
    if (actual !== expected) {
      return false;
    }
  }
  return true;
}

export async function listMediaResources(
  filter: ListMediaResourcesFilter = {},
): Promise<MediaResource[]> {
  if (shouldUseMemoryAdapter()) {
    return listMediaResourcesMemory().filter((resource) => matchesFilter(resource, filter));
  }

  await ensureMediaResourceMongoReady();
  const query: Record<string, unknown> = {};
  if (filter.resourceType) {
    query.resourceType = filter.resourceType;
  }
  if (filter.scopeType) {
    query.scopeType = filter.scopeType;
  }
  if (filter.active !== undefined) {
    query.active = filter.active;
  }
  if (filter.countryCode !== undefined) {
    query.countryCode =
      filter.countryCode === null ? null : filter.countryCode.toUpperCase();
  }

  const documents = await collection()
    .find(query)
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return documents.map(fromMediaResourceMongoDocument);
}

export async function getMediaResourceById(id: string): Promise<MediaResource | null> {
  if (shouldUseMemoryAdapter()) {
    return getMediaResourceByIdMemory(id);
  }

  await ensureMediaResourceMongoReady();
  const document = await collection().findOne({ id });
  return document ? fromMediaResourceMongoDocument(document) : null;
}

export async function upsertMediaResource(resource: MediaResource): Promise<MediaResource> {
  if (shouldUseMemoryAdapter()) {
    return upsertMediaResourceMemory(resource);
  }

  await ensureMediaResourceMongoReady();
  await collection().replaceOne(
    { id: resource.id },
    toMediaResourceMongoDocument(resource),
    { upsert: true },
  );
  return resource;
}

export async function deleteMediaResource(id: string): Promise<boolean> {
  if (shouldUseMemoryAdapter()) {
    return deleteMediaResourceMemory(id);
  }

  await ensureMediaResourceMongoReady();
  const result = await collection().deleteOne({ id });
  return result.deletedCount === 1;
}
