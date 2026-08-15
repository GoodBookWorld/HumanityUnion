import type {
  ImplementationTrackingTraceability,
  ImplementationTrackingUpdate,
  InitiativeImplementationTracking,
} from "@hu/types";

import { resolveInitiativeImplementationTrackingPersistenceAdapter } from "./persistence/resolve-initiative-implementation-tracking-persistence.js";
import { snapshotFromTrackingData } from "./persistence/initiative-implementation-tracking-persistence.types.js";

export interface InitiativeImplementationTrackingUpdate {
  currentStage?: string;
  summary?: string;
  status?: InitiativeImplementationTracking["status"];
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  /** Initiative Lifecycle — Part J fields. */
  packageId?: string | null;
  progress?: number | null;
  targetDate?: string | null;
  startedDate?: string | null;
  actualCompletedDate?: string | null;
  dependencies?: string[] | null;
  obstacles?: string[] | null;
  evidenceReferences?: string[] | null;
  notes?: string | null;
  approvedAction?: string | null;
  traceability?: ImplementationTrackingTraceability | null;
}

const PUBLIC_STATUSES = new Set<InitiativeImplementationTracking["status"]>([
  "active",
  "completed",
  "archived",
]);

const persistence = resolveInitiativeImplementationTrackingPersistenceAdapter();

function loadState(): {
  trackings: Map<string, InitiativeImplementationTracking>;
  updates: Map<string, ImplementationTrackingUpdate>;
} {
  const snapshot = persistence.load();

  return {
    trackings: new Map<string, InitiativeImplementationTracking>(
      Object.entries(snapshot.trackings).map(([trackingId, tracking]) => [
        trackingId,
        structuredClone(tracking),
      ]),
    ),
    updates: new Map<string, ImplementationTrackingUpdate>(
      Object.entries(snapshot.updates).map(([updateId, update]) => [
        updateId,
        structuredClone(update),
      ]),
    ),
  };
}

function persistState(input: {
  trackings: Map<string, InitiativeImplementationTracking>;
  updates: Map<string, ImplementationTrackingUpdate>;
}): void {
  persistence.save(snapshotFromTrackingData(input));
}

const initialState = loadState();
const trackings = initialState.trackings;
const updates = initialState.updates;

export function getTrackingById(trackingId: string): InitiativeImplementationTracking | null {
  const tracking = trackings.get(trackingId);

  return tracking ? structuredClone(tracking) : null;
}

export function listTrackings(): InitiativeImplementationTracking[] {
  return Array.from(trackings.values(), (tracking) => structuredClone(tracking));
}

export function listTrackingsByInitiative(
  initiativeId: string,
): InitiativeImplementationTracking[] {
  return listTrackings().filter((tracking) => tracking.initiativeId === initiativeId);
}

export function listTrackingsByCommitment(
  commitmentId: string,
): InitiativeImplementationTracking[] {
  return listTrackings().filter((tracking) => tracking.commitmentId === commitmentId);
}

export function listTrackingsByParticipant(
  participantId: string,
): InitiativeImplementationTracking[] {
  return listTrackings().filter((tracking) => tracking.participantId === participantId);
}

export function listPublicTrackingsByInitiative(
  initiativeId: string,
): InitiativeImplementationTracking[] {
  return listTrackingsByInitiative(initiativeId)
    .filter((tracking) => PUBLIC_STATUSES.has(tracking.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listPublicTrackingsByCommitment(
  commitmentId: string,
): InitiativeImplementationTracking[] {
  return listTrackingsByCommitment(commitmentId)
    .filter((tracking) => PUBLIC_STATUSES.has(tracking.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createTracking(
  tracking: InitiativeImplementationTracking,
): InitiativeImplementationTracking {
  trackings.set(tracking.trackingId, structuredClone(tracking));
  persistState({ trackings, updates });

  return structuredClone(tracking);
}

export function updateTracking(
  trackingId: string,
  update: InitiativeImplementationTrackingUpdate,
): InitiativeImplementationTracking | null {
  const tracking = trackings.get(trackingId);

  if (!tracking) {
    return null;
  }

  if (update.currentStage !== undefined) {
    tracking.currentStage = update.currentStage;
  }

  if (update.summary !== undefined) {
    tracking.summary = update.summary;
  }

  if (update.status !== undefined) {
    tracking.status = update.status;
  }

  if (update.activatedAt !== undefined) {
    tracking.activatedAt = update.activatedAt;
  }

  if (update.completedAt !== undefined) {
    tracking.completedAt = update.completedAt;
  }

  if (update.archivedAt !== undefined) {
    tracking.archivedAt = update.archivedAt;
  }

  if (update.packageId !== undefined) {
    tracking.packageId = update.packageId;
  }

  if (update.progress !== undefined) {
    tracking.progress = update.progress;
  }

  if (update.targetDate !== undefined) {
    tracking.targetDate = update.targetDate;
  }

  if (update.startedDate !== undefined) {
    tracking.startedDate = update.startedDate;
  }

  if (update.actualCompletedDate !== undefined) {
    tracking.actualCompletedDate = update.actualCompletedDate;
  }

  if (update.dependencies !== undefined) {
    tracking.dependencies = update.dependencies;
  }

  if (update.obstacles !== undefined) {
    tracking.obstacles = update.obstacles;
  }

  if (update.evidenceReferences !== undefined) {
    tracking.evidenceReferences = update.evidenceReferences;
  }

  if (update.notes !== undefined) {
    tracking.notes = update.notes;
  }

  if (update.approvedAction !== undefined) {
    tracking.approvedAction = update.approvedAction;
  }

  if (update.traceability !== undefined) {
    tracking.traceability = update.traceability;
  }

  tracking.updatedAt = new Date().toISOString();

  persistState({ trackings, updates });

  return structuredClone(tracking);
}

export function appendTrackingUpdate(
  update: ImplementationTrackingUpdate,
): ImplementationTrackingUpdate {
  updates.set(update.updateId, structuredClone(update));
  persistState({ trackings, updates });

  return structuredClone(update);
}

export function listUpdatesByTracking(trackingId: string): ImplementationTrackingUpdate[] {
  return Array.from(updates.values())
    .filter((update) => update.trackingId === trackingId)
    .sort((left, right) => {
      const timeComparison = right.createdAt.localeCompare(left.createdAt);

      if (timeComparison !== 0) {
        return timeComparison;
      }

      return right.updateId.localeCompare(left.updateId);
    });
}

export function listUpdatesByParticipant(participantId: string): ImplementationTrackingUpdate[] {
  const ownedTrackingIds = new Set(
    listTrackingsByParticipant(participantId).map((tracking) => tracking.trackingId),
  );

  return Array.from(updates.values())
    .filter((update) => ownedTrackingIds.has(update.trackingId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listAllTrackingUpdates(): ImplementationTrackingUpdate[] {
  return Array.from(updates.values(), (update) => structuredClone(update));
}

export function countUpdatesForTracking(trackingId: string): number {
  return listUpdatesByTracking(trackingId).length;
}

export function getUpdateById(updateId: string): ImplementationTrackingUpdate | null {
  const update = updates.get(updateId);

  return update ? structuredClone(update) : null;
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}

/**
 * Recovery Task 16 — narrow, test-only cleanup helper aligned with the
 * actual aggregate boundary: Tracking is its own aggregate root (not
 * embedded within Commitment), and each `ImplementationTrackingUpdate` is
 * owned exclusively by exactly one Tracking record. Deletes only the
 * Tracking records authored by `participantId` and their owned execution
 * history entries, leaving unrelated records (including other
 * participants' Tracking and Commitment data) untouched. No delete-all
 * option and no HTTP exposure, matching sibling cleanup helpers
 * (`deleteVotesByParticipantIdForTests`,
 * `deleteCommitmentsByParticipantIdForTests`).
 */
export function deleteTrackingsByParticipantIdForTests(participantId: string): void {
  const removedTrackingIds = new Set<string>();

  for (const [trackingId, tracking] of trackings) {
    if (tracking.participantId === participantId) {
      trackings.delete(trackingId);
      removedTrackingIds.add(trackingId);
    }
  }

  for (const [updateId, update] of updates) {
    if (removedTrackingIds.has(update.trackingId)) {
      updates.delete(updateId);
    }
  }

  persistState({ trackings, updates });
}
