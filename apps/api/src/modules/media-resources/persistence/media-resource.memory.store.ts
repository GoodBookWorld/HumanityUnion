import type { MediaResource } from "@hu/types";

const resourcesById = new Map<string, MediaResource>();

export function resetMediaResourcesMemoryForTests(): void {
  resourcesById.clear();
}

export function listMediaResourcesMemory(): MediaResource[] {
  return [...resourcesById.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

export function getMediaResourceByIdMemory(id: string): MediaResource | null {
  return resourcesById.get(id) ?? null;
}

export function upsertMediaResourceMemory(resource: MediaResource): MediaResource {
  resourcesById.set(resource.id, resource);
  return resource;
}

export function deleteMediaResourceMemory(id: string): boolean {
  return resourcesById.delete(id);
}
