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
  getMediaResourceByIdentityMemory,
  insertMediaResourceIfAbsentMemory,
  listMediaResourcesByPublisherIdMemory,
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

export function mediaResourcePersistenceUsesMemory(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

function shouldUseMemoryAdapter(): boolean {
  return mediaResourcePersistenceUsesMemory();
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

export async function getMediaResourceByIdentity(input: {
  readonly resourceType: MediaResourceType;
  readonly id: string;
}): Promise<MediaResource | null> {
  if (shouldUseMemoryAdapter()) {
    return getMediaResourceByIdentityMemory(input.resourceType, input.id);
  }

  await ensureMediaResourceMongoReady();
  const document = await collection().findOne({
    resourceType: input.resourceType,
    id: input.id,
  });
  return document ? fromMediaResourceMongoDocument(document) : null;
}

export async function listMediaResourcesByPublisherId(id: string): Promise<MediaResource[]> {
  if (shouldUseMemoryAdapter()) {
    return listMediaResourcesByPublisherIdMemory(id);
  }

  await ensureMediaResourceMongoReady();
  const documents = await collection().find({ id }).sort({ resourceType: 1 }).toArray();
  return documents.map(fromMediaResourceMongoDocument);
}

export async function upsertMediaResource(resource: MediaResource): Promise<MediaResource> {
  if (shouldUseMemoryAdapter()) {
    return upsertMediaResourceMemory(resource);
  }

  await ensureMediaResourceMongoReady();
  await collection().replaceOne(
    { resourceType: resource.resourceType, id: resource.id },
    toMediaResourceMongoDocument(resource),
    { upsert: true },
  );
  return resource;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Insert a catalog default only when (resourceType, id) is absent.
 * Existing rows, including inactive and administrator-edited rows, stay unchanged.
 */
export async function insertMediaResourceIfAbsent(
  resource: MediaResource,
): Promise<"inserted" | "exists"> {
  if (shouldUseMemoryAdapter()) {
    return insertMediaResourceIfAbsentMemory(resource);
  }

  await ensureMediaResourceMongoReady();
  try {
    await collection().insertOne(toMediaResourceMongoDocument(resource));
    return "inserted";
  } catch (error) {
    if (isDuplicateKeyError(error)) return "exists";
    throw error;
  }
}

export async function deleteMediaResource(input: {
  readonly resourceType: MediaResourceType;
  readonly id: string;
}): Promise<boolean> {
  if (shouldUseMemoryAdapter()) {
    return deleteMediaResourceMemory(input.resourceType, input.id);
  }

  await ensureMediaResourceMongoReady();
  const result = await collection().deleteOne({
    resourceType: input.resourceType,
    id: input.id,
  });
  return result.deletedCount === 1;
}
