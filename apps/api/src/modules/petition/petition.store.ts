import type { Petition, PetitionPolicy, PetitionSubject, ParticipationMode, Signature } from "@hu/types";

import { getDecision } from "../collective-decision/collective-decision.store.js";
import { bootstrapPetition } from "./bootstrap-petition.js";
import {
  assertMutablePetition,
  assertPreparatoryPetition,
  assertSignaturesImmutable,
  assertValidTransition,
  buildShareLink,
  clonePetition,
  createEmptySupportMetrics,
  hasParticipantSigned,
  isParticipantEligibleForPetition,
  mergePetitionPolicy,
  mergePetitionSubject,
  refreshDerivedState,
} from "./petition.helpers.js";

export interface PetitionUpdate {
  subject?: Partial<PetitionSubject>;
  policy?: Partial<PetitionPolicy>;
}

const petitions = new Map<string, Petition>([
  [bootstrapPetition.petitionId, structuredClone(bootstrapPetition)],
]);

refreshDerivedState(petitions.get(bootstrapPetition.petitionId)!);

function getMutablePetition(petitionId: string): Petition | null {
  return petitions.get(petitionId) ?? null;
}

function touchPetition(petition: Petition): Petition {
  petition.updatedAt = new Date().toISOString();
  refreshDerivedState(petition);
  return clonePetition(petition);
}

function assertApprovedCollectiveDecision(collectiveDecisionId: string): void {
  const decision = getDecision(collectiveDecisionId);

  if (!decision) {
    throw new Error(`Collective Decision "${collectiveDecisionId}" was not found.`);
  }

  if (decision.outcome?.outcomeType !== "Approved") {
    throw new Error("Petition may only be created from an approved Collective Decision.");
  }
}

function assertUniqueCollectiveDecisionPath(collectiveDecisionId: string, petitionId?: string): void {
  const duplicate = Array.from(petitions.values()).find(
    (entry) =>
      entry.collectiveDecisionId === collectiveDecisionId && entry.petitionId !== petitionId,
  );

  if (duplicate) {
    throw new Error(`Petition already exists for Collective Decision "${collectiveDecisionId}".`);
  }
}

export function listPetitions(): Petition[] {
  return Array.from(petitions.values(), (petition) => clonePetition(petition));
}

export function getPetition(petitionId: string): Petition | null {
  const petition = petitions.get(petitionId);

  return petition ? clonePetition(petition) : null;
}

export function getPetitionByCollectiveDecisionId(collectiveDecisionId: string): Petition | null {
  const petition = Array.from(petitions.values()).find(
    (entry) => entry.collectiveDecisionId === collectiveDecisionId,
  );

  return petition ? clonePetition(petition) : null;
}

export function getPetitionByInitiativeId(initiativeId: string): Petition | null {
  const petition = Array.from(petitions.values()).find(
    (entry) => entry.subject.initiativeId === initiativeId,
  );

  return petition ? clonePetition(petition) : null;
}

export function participantHasSigned(petitionId: string, participantId: string): boolean {
  const petition = petitions.get(petitionId);

  if (!petition) {
    return false;
  }

  return hasParticipantSigned(petition, participantId);
}

export function createPetition(petition: Petition): Petition {
  if (petitions.has(petition.petitionId)) {
    throw new Error(`Petition "${petition.petitionId}" already exists.`);
  }

  if (petition.status !== "Draft") {
    throw new Error("New Petitions must begin in Draft state.");
  }

  assertApprovedCollectiveDecision(petition.collectiveDecisionId);
  assertUniqueCollectiveDecisionPath(petition.collectiveDecisionId);

  const created = structuredClone(petition);
  created.shareLink = null;
  created.signatures = [];
  created.supportMetrics = createEmptySupportMetrics();
  created.outcome = null;
  refreshDerivedState(created);
  petitions.set(created.petitionId, created);

  return clonePetition(created);
}

export function updatePetition(petitionId: string, update: PetitionUpdate): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);
  assertPreparatoryPetition(petition.status);

  if (update.subject !== undefined) {
    petition.subject = mergePetitionSubject(petition.subject, update.subject);
  }

  if (update.policy !== undefined) {
    petition.policy = mergePetitionPolicy(petition.policy, update.policy);
  }

  return touchPetition(petition);
}

export function preparePetition(petitionId: string): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);

  if (!petition.subject.title.trim() || !petition.subject.summary.trim()) {
    throw new Error("PetitionSubject must be complete before preparation.");
  }

  assertValidTransition(petition.status, "Ready");
  petition.status = "Ready";

  return touchPetition(petition);
}

export function publishPetition(petitionId: string): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);
  assertValidTransition(petition.status, "Published");

  const publishedAt = new Date().toISOString();
  petition.status = "Published";
  petition.shareLink = buildShareLink(petition.petitionId, publishedAt);

  return touchPetition(petition);
}

export function openPetition(petitionId: string, opensAt?: string): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);
  assertValidTransition(petition.status, "Open");

  const effectiveOpensAt = opensAt ?? new Date().toISOString();
  petition.status = "Open";
  petition.policy = {
    ...petition.policy,
    endorsementPeriod: {
      ...petition.policy.endorsementPeriod,
      opensAt: effectiveOpensAt,
    },
  };

  return touchPetition(petition);
}

export function signPetition(
  petitionId: string,
  participantId: string,
  participationMode?: ParticipationMode,
): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);

  if (petition.status !== "Open") {
    throw new Error("Petition is not open for signing.");
  }

  if (hasParticipantSigned(petition, participantId)) {
    throw new Error(`Participant "${participantId}" already signed this Petition.`);
  }

  if (!isParticipantEligibleForPetition(participantId, petition.policy)) {
    throw new Error(`Participant "${participantId}" is not eligible to sign this Petition.`);
  }

  const signature: Signature = {
    signatureId: `signature-${petition.petitionId}-${participantId}`,
    petitionId: petition.petitionId,
    participantId,
    signedAt: new Date().toISOString(),
    visibility: "operational",
    status: "Active",
    participationMode,
  };

  const nextSignatures = [...petition.signatures, structuredClone(signature)];
  assertSignaturesImmutable(petition.signatures, nextSignatures);
  petition.signatures = nextSignatures;

  return touchPetition(petition);
}

export function closePetition(petitionId: string, closesAt?: string): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertMutablePetition(petition.status);
  assertValidTransition(petition.status, "Closed");

  const effectiveClosesAt = closesAt ?? new Date().toISOString();
  petition.status = "Closed";
  petition.policy = {
    ...petition.policy,
    endorsementPeriod: {
      ...petition.policy.endorsementPeriod,
      closesAt: effectiveClosesAt,
    },
  };

  return touchPetition(petition);
}

export function archivePetition(petitionId: string): Petition | null {
  const petition = getMutablePetition(petitionId);

  if (!petition) {
    return null;
  }

  assertValidTransition(petition.status, "Archived");
  petition.status = "Archived";

  return touchPetition(petition);
}
