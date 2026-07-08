import type { ImplementationTrackingUpdate, InitiativeImplementationTracking } from "@hu/types";

export interface InitiativeImplementationTrackingPersistenceSnapshot {
  version: 1;
  trackings: Record<string, InitiativeImplementationTracking>;
  updates: Record<string, ImplementationTrackingUpdate>;
}

export interface InitiativeImplementationTrackingPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeImplementationTrackingPersistenceSnapshot;
  save(snapshot: InitiativeImplementationTrackingPersistenceSnapshot): void;
}

export function createEmptyInitiativeImplementationTrackingPersistenceSnapshot(): InitiativeImplementationTrackingPersistenceSnapshot {
  return {
    version: 1,
    trackings: {},
    updates: {},
  };
}

export function snapshotFromTrackingData(input: {
  trackings: Map<string, InitiativeImplementationTracking>;
  updates: Map<string, ImplementationTrackingUpdate>;
}): InitiativeImplementationTrackingPersistenceSnapshot {
  const trackings: Record<string, InitiativeImplementationTracking> = {};
  const updates: Record<string, ImplementationTrackingUpdate> = {};

  for (const [trackingId, tracking] of input.trackings) {
    trackings[trackingId] = structuredClone(tracking);
  }

  for (const [updateId, update] of input.updates) {
    updates[updateId] = structuredClone(update);
  }

  return {
    version: 1,
    trackings,
    updates,
  };
}
