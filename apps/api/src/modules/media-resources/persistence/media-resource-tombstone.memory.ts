import type { MediaResourceType } from "@hu/types";

export interface MediaResourceTombstone {
  readonly resourceType: MediaResourceType;
  readonly id: string;
  readonly deletedAt: string;
  readonly deletedByParticipantId: string | null;
}

const tombstonesByIdentity = new Map<string, MediaResourceTombstone>();

function identityKey(resourceType: MediaResourceType, id: string): string {
  return `${resourceType}\0${id}`;
}

export function resetMediaResourceTombstoneMemoryForTests(): void {
  tombstonesByIdentity.clear();
}

export function getMediaResourceTombstoneMemory(input: {
  readonly resourceType: MediaResourceType;
  readonly id: string;
}): MediaResourceTombstone | null {
  return tombstonesByIdentity.get(identityKey(input.resourceType, input.id)) ?? null;
}

export function recordMediaResourceTombstoneMemory(
  tombstone: MediaResourceTombstone,
): "recorded" | "exists" {
  const key = identityKey(tombstone.resourceType, tombstone.id);
  if (tombstonesByIdentity.has(key)) return "exists";
  tombstonesByIdentity.set(key, tombstone);
  return "recorded";
}
