import type { MediaResource, MediaResourceType } from "@hu/types";

import { resetMediaResourceTombstoneMemoryForTests } from "./media-resource-tombstone.memory.js";

const resourcesByIdentity = new Map<string, MediaResource>();

function identityKey(resourceType: MediaResourceType, id: string): string {
  return `${resourceType}\0${id}`;
}

export function resetMediaResourcesMemoryForTests(): void {
  resourcesByIdentity.clear();
  resetMediaResourceTombstoneMemoryForTests();
}

export function listMediaResourcesMemory(): MediaResource[] {
  return [...resourcesByIdentity.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

export function getMediaResourceByIdentityMemory(
  resourceType: MediaResourceType,
  id: string,
): MediaResource | null {
  return resourcesByIdentity.get(identityKey(resourceType, id)) ?? null;
}

export function listMediaResourcesByPublisherIdMemory(id: string): MediaResource[] {
  return listMediaResourcesMemory().filter((resource) => resource.id === id);
}

export function upsertMediaResourceMemory(resource: MediaResource): MediaResource {
  resourcesByIdentity.set(identityKey(resource.resourceType, resource.id), resource);
  return resource;
}

/** Synchronous check-and-set so concurrent seed calls cannot insert the same identity twice. */
export function insertMediaResourceIfAbsentMemory(
  resource: MediaResource,
): "inserted" | "exists" {
  const key = identityKey(resource.resourceType, resource.id);
  if (resourcesByIdentity.has(key)) return "exists";
  resourcesByIdentity.set(key, resource);
  return "inserted";
}

export function deleteMediaResourceMemory(
  resourceType: MediaResourceType,
  id: string,
): boolean {
  return resourcesByIdentity.delete(identityKey(resourceType, id));
}
