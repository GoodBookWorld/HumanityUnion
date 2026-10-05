import type { MediaResource, MediaResourceType } from "@hu/types";

const resourcesByIdentity = new Map<string, MediaResource>();

function identityKey(resourceType: MediaResourceType, id: string): string {
  return `${resourceType}\0${id}`;
}

export function resetMediaResourcesMemoryForTests(): void {
  resourcesByIdentity.clear();
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

export function deleteMediaResourceMemory(
  resourceType: MediaResourceType,
  id: string,
): boolean {
  return resourcesByIdentity.delete(identityKey(resourceType, id));
}
