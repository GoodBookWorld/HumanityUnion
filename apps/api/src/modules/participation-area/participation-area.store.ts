import type {
  ParticipationArea,
  ParticipationAreaSlugTriple,
  ParticipationAreaTransition,
  ParticipationAreaVerificationStatus,
} from "@hu/types";
import { participationAreaSlugTriple, participationAreaToSlugTriple } from "@hu/types";

import { resolveParticipationAreaPersistenceAdapter } from "./persistence/resolve-participation-area-persistence.js";
import { snapshotFromParticipationAreaStores } from "./persistence/participation-area-persistence.types.js";

export interface CreateParticipationAreaInput {
  participantId: string;
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
  regionLabel?: string;
  verificationStatus: ParticipationAreaVerificationStatus;
}

export interface RequestParticipationAreaTransitionInput {
  participantId: string;
  toArea: ParticipationAreaSlugTriple;
  effectiveAt: string;
}

const persistence = resolveParticipationAreaPersistenceAdapter();

function loadStores(): {
  areas: Map<string, ParticipationArea>;
  transitions: Map<string, ParticipationAreaTransition>;
} {
  const snapshot = persistence.load();

  return {
    areas: new Map<string, ParticipationArea>(
      Object.entries(snapshot.areas).map(([participationAreaId, area]) => [
        participationAreaId,
        structuredClone(area),
      ]),
    ),
    transitions: new Map<string, ParticipationAreaTransition>(
      Object.entries(snapshot.transitions).map(([transitionId, transition]) => [
        transitionId,
        structuredClone(transition),
      ]),
    ),
  };
}

const stores = loadStores();
const areas = stores.areas;
const transitions = stores.transitions;

function persistStores(): void {
  persistence.save(snapshotFromParticipationAreaStores(areas, transitions));
}

function findActiveAreaForParticipant(participantId: string): ParticipationArea | null {
  for (const area of areas.values()) {
    if (area.participantId === participantId && area.status === "active") {
      return structuredClone(area);
    }
  }

  return null;
}

function findPendingTransitionForParticipant(
  participantId: string,
): ParticipationAreaTransition | null {
  for (const transition of transitions.values()) {
    if (transition.participantId === participantId && transition.status === "pending") {
      return structuredClone(transition);
    }
  }

  return null;
}

function applyDueTransition(
  transition: ParticipationAreaTransition,
  currentTime: string,
): ParticipationArea | null {
  if (
    transition.status !== "pending" ||
    Date.parse(currentTime) < Date.parse(transition.effectiveAt)
  ) {
    return null;
  }

  const activeArea = findActiveAreaForParticipant(transition.participantId);

  if (!activeArea) {
    return null;
  }

  const now = new Date().toISOString();
  const archivedArea = areas.get(activeArea.participationAreaId);

  if (archivedArea) {
    archivedArea.status = "archived";
    archivedArea.updatedAt = now;
  }

  const newArea: ParticipationArea = {
    participationAreaId: `participation-area-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    participantId: transition.participantId,
    countrySlug: transition.toArea.countrySlug,
    regionSlug: transition.toArea.regionSlug,
    communitySlug: transition.toArea.communitySlug,
    regionLabel: transition.toArea.regionLabel,
    verificationStatus: activeArea.verificationStatus,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  areas.set(newArea.participationAreaId, newArea);

  const storedTransition = transitions.get(transition.transitionId);

  if (storedTransition) {
    storedTransition.status = "active";
  }

  persistStores();

  return structuredClone(newArea);
}

export function cancelParticipationAreaTransition(
  participantId: string,
): ParticipationAreaTransition {
  const pendingTransition = findPendingTransitionForParticipant(participantId);

  if (!pendingTransition) {
    throw new Error("Participant has no pending Participation Area transition.");
  }

  const storedTransition = transitions.get(pendingTransition.transitionId);

  if (!storedTransition) {
    throw new Error("Pending Participation Area transition not found.");
  }

  storedTransition.status = "cancelled";
  persistStores();

  return structuredClone(storedTransition);
}

export function getParticipationAreaById(participationAreaId: string): ParticipationArea | null {
  const area = areas.get(participationAreaId);

  return area ? structuredClone(area) : null;
}

export function getActiveParticipationAreaForParticipant(
  participantId: string,
): ParticipationArea | null {
  return findActiveAreaForParticipant(participantId);
}

export function getPendingParticipationAreaTransitionForParticipant(
  participantId: string,
): ParticipationAreaTransition | null {
  return findPendingTransitionForParticipant(participantId);
}

export function createParticipationArea(input: CreateParticipationAreaInput): ParticipationArea {
  const existingActive = findActiveAreaForParticipant(input.participantId);

  if (existingActive) {
    throw new Error("Participant already has an active Participation Area.");
  }

  const now = new Date().toISOString();
  const area: ParticipationArea = {
    participationAreaId: `participation-area-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    participantId: input.participantId,
    countrySlug: input.countrySlug,
    regionSlug: input.regionSlug,
    communitySlug: input.communitySlug,
    regionLabel: input.regionLabel,
    verificationStatus: input.verificationStatus,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  areas.set(area.participationAreaId, area);
  persistStores();

  return structuredClone(area);
}

export function requestParticipationAreaTransition(
  input: RequestParticipationAreaTransitionInput,
): ParticipationAreaTransition {
  const activeArea = findActiveAreaForParticipant(input.participantId);

  if (!activeArea) {
    throw new Error("Participant has no active Participation Area.");
  }

  const existingPending = findPendingTransitionForParticipant(input.participantId);

  if (existingPending) {
    throw new Error("Participant already has a pending Participation Area transition.");
  }

  const now = new Date().toISOString();
  const transition: ParticipationAreaTransition = {
    transitionId: `participation-area-transition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    participantId: input.participantId,
    fromArea: participationAreaToSlugTriple(activeArea),
    toArea: participationAreaSlugTriple(
      input.toArea.countrySlug,
      input.toArea.regionSlug,
      input.toArea.communitySlug,
      input.toArea.regionLabel,
    ),
    requestedAt: now,
    effectiveAt: input.effectiveAt,
    status: "pending",
  };

  transitions.set(transition.transitionId, transition);
  persistStores();

  return structuredClone(transition);
}

export function resolveActiveParticipationArea(
  participantId: string,
  currentTime: string,
): ParticipationArea | null {
  const pendingTransition = findPendingTransitionForParticipant(participantId);

  if (pendingTransition) {
    const applied = applyDueTransition(pendingTransition, currentTime);

    if (applied) {
      return applied;
    }
  }

  return findActiveAreaForParticipant(participantId);
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}

export function seedParticipationArea(area: ParticipationArea): ParticipationArea {
  areas.set(area.participationAreaId, structuredClone(area));
  persistStores();

  return structuredClone(area);
}

export function seedParticipationAreaTransition(
  transition: ParticipationAreaTransition,
): ParticipationAreaTransition {
  transitions.set(transition.transitionId, structuredClone(transition));
  persistStores();

  return structuredClone(transition);
}

export function listActiveParticipationAreas(): ParticipationArea[] {
  return Array.from(areas.values(), (area) => structuredClone(area)).filter(
    (area) => area.status === "active" && area.countrySlug.trim().length > 0,
  );
}

/**
 * Test-only cleanup helper (Recovery Task 13), mirroring the pattern
 * established in Tasks 06-10 for file-backed persistence modules that lack
 * a dedicated test-reset mechanism (e.g.
 * `deleteVotesByParticipantIdForTests`).
 *
 * Removes every Participation Area AND every pending/active Participation
 * Area Transition owned by the given participant, so a verification script
 * that re-seeds a fixed fixture participant ID on each run (e.g.
 * `verify-vote-casting-e2e.ts`) does not trip
 * `createParticipationArea`'s "already has an active Participation Area"
 * uniqueness check, or `requestParticipationAreaTransition`'s "already has
 * a pending Participation Area transition" check, against a record left
 * over from a previous run.
 *
 * Scoped narrowly to the supplied `participantId`: it never inspects or
 * deletes another participant's records, and it does not touch any other
 * store (Votes, Collective Decisions, Initiatives, etc.). Not exposed
 * through HTTP and not called from any production service — verification
 * scripts and tests only.
 */
export function deleteParticipationAreasByParticipantIdForTests(participantId: string): void {
  for (const [participationAreaId, area] of areas) {
    if (area.participantId === participantId) {
      areas.delete(participationAreaId);
    }
  }

  for (const [transitionId, transition] of transitions) {
    if (transition.participantId === participantId) {
      transitions.delete(transitionId);
    }
  }

  persistStores();
}
