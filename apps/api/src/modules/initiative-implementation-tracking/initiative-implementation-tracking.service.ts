import type {
  ImplementationTrackingUpdate,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingStatus,
} from "@hu/types";
import {
  canTransitionInitiativeImplementationTracking,
  isInitiativeImplementationTrackingTerminal,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { assertInitiativeImplementationTrackingEligible } from "./initiative-implementation-tracking-eligibility.js";
import {
  appendTrackingUpdate,
  countUpdatesForTracking,
  createTracking,
  getTrackingById,
  listTrackingsByCommitment,
  listTrackingsByParticipant,
  listUpdatesByParticipant,
  listUpdatesByTracking,
  updateTracking,
} from "./initiative-implementation-tracking.store.js";

export interface CreateInitiativeImplementationTrackingDraftInput {
  commitmentId: string;
  currentStage: string;
  summary: string;
}

export interface UpdateInitiativeImplementationTrackingDraftInput {
  currentStage?: string;
  summary?: string;
}

export interface AddImplementationTrackingUpdateInput {
  title: string;
  summary: string;
  evidence: string;
  references?: string[];
  currentStage?: string;
}

function getOwnedTracking(
  trackingId: string,
  identity: RequestIdentity,
): InitiativeImplementationTracking {
  const tracking = getTrackingById(trackingId);

  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  const commitment = getCommitmentById(tracking.commitmentId);

  if (!commitment || commitment.participantId !== identity.participantId) {
    throw new Error("You do not have access to this implementation tracking.");
  }

  return tracking;
}

function assertTransitionAllowed(
  tracking: InitiativeImplementationTracking,
  nextStatus: InitiativeImplementationTrackingStatus,
): void {
  if (isInitiativeImplementationTrackingTerminal(tracking.status)) {
    throw new Error(`Implementation tracking in status "${tracking.status}" cannot be changed.`);
  }

  if (!canTransitionInitiativeImplementationTracking(tracking.status, nextStatus)) {
    throw new Error(
      `Implementation tracking cannot transition from "${tracking.status}" to "${nextStatus}".`,
    );
  }
}

function assertDraftEditable(tracking: InitiativeImplementationTracking): void {
  if (tracking.status !== "draft") {
    throw new Error("Only draft implementation tracking can be edited.");
  }
}

export function listMyInitiativeImplementationTrackings(
  identity: RequestIdentity,
): InitiativeImplementationTracking[] {
  return listTrackingsByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationTrackingUpdates(
  identity: RequestIdentity,
): ImplementationTrackingUpdate[] {
  return listUpdatesByParticipant(identity.participantId);
}

export function listMyInitiativeImplementationTrackingsForCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): InitiativeImplementationTracking[] {
  return listTrackingsByCommitment(commitmentId).filter(
    (tracking) => tracking.participantId === identity.participantId,
  );
}

export function getMyInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  return getOwnedTracking(trackingId, identity);
}

export function listImplementationTrackingUpdates(
  identity: RequestIdentity,
  trackingId: string,
): ImplementationTrackingUpdate[] {
  getOwnedTracking(trackingId, identity);

  return listUpdatesByTracking(trackingId);
}

export function createInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  input: CreateInitiativeImplementationTrackingDraftInput,
): InitiativeImplementationTracking {
  assertInitiativeImplementationTrackingEligible(input.commitmentId, identity.participantId);

  const commitment = getCommitmentById(input.commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const now = new Date().toISOString();

  const tracking: InitiativeImplementationTracking = {
    trackingId: `implementation-tracking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    commitmentId: commitment.commitmentId,
    initiativeId: commitment.initiativeId,
    participantId: identity.participantId,
    status: "draft",
    currentStage: input.currentStage,
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
  };

  return createTracking(tracking);
}

export function updateInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  trackingId: string,
  input: UpdateInitiativeImplementationTrackingDraftInput,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertDraftEditable(tracking);

  const updated = updateTracking(trackingId, input);

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}

export function activateInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "active");

  const updated = updateTracking(trackingId, {
    status: "active",
    activatedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}

export function addImplementationTrackingUpdate(
  identity: RequestIdentity,
  trackingId: string,
  input: AddImplementationTrackingUpdateInput,
): ImplementationTrackingUpdate {
  const tracking = getOwnedTracking(trackingId, identity);

  if (tracking.status !== "active") {
    throw new Error("Execution updates may only be added while tracking is active.");
  }

  const now = new Date().toISOString();

  const update: ImplementationTrackingUpdate = {
    updateId: `implementation-tracking-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trackingId,
    title: input.title,
    summary: input.summary,
    evidence: input.evidence,
    references: input.references ?? [],
    authorId: identity.participantId,
    createdAt: now,
  };

  appendTrackingUpdate(update);

  if (input.currentStage) {
    updateTracking(trackingId, {
      currentStage: input.currentStage,
    });
  }

  return update;
}

export function completeInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "completed");

  if (tracking.status !== "active") {
    throw new Error("Only active implementation tracking can be completed.");
  }

  if (countUpdatesForTracking(trackingId) < 1) {
    throw new Error("Implementation tracking requires at least one execution update to complete.");
  }

  const updated = updateTracking(trackingId, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}

export function archiveInitiativeImplementationTracking(
  identity: RequestIdentity,
  trackingId: string,
): InitiativeImplementationTracking {
  const tracking = getOwnedTracking(trackingId, identity);

  assertTransitionAllowed(tracking, "archived");

  const updated = updateTracking(trackingId, {
    status: "archived",
    archivedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  return updated;
}
