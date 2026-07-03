import type {
  Member,
  Petition,
  PetitionOutcome,
  PetitionPolicy,
  PetitionState,
  PetitionSubject,
  Signature,
  SupportMetrics,
  VerificationLevel,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";

const ALLOWED_TRANSITIONS: Record<PetitionState, PetitionState[]> = {
  Draft: ["Ready"],
  Ready: ["Published"],
  Published: ["Open"],
  Open: ["Closed"],
  Closed: ["Archived"],
  Archived: [],
};

const VERIFICATION_LEVEL_RANK: Record<VerificationLevel, number> = {
  none: 0,
  email: 1,
  identity: 2,
  institution: 3,
  trusted: 4,
};

export function clonePetition(petition: Petition): Petition {
  return structuredClone(petition);
}

export function assertValidTransition(currentStatus: PetitionState, nextStatus: PetitionState): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(nextStatus)) {
    throw new Error(`Transition from "${currentStatus}" to "${nextStatus}" is not allowed.`);
  }
}

export function assertMutablePetition(status: PetitionState): void {
  if (status === "Archived") {
    throw new Error("Archived Petitions are read-only.");
  }
}

export function assertPreparatoryPetition(status: PetitionState): void {
  if (status !== "Draft" && status !== "Ready") {
    throw new Error("Only Draft or Ready Petitions can be updated.");
  }
}

export function verificationLevelMeets(
  required: VerificationLevel,
  actual: VerificationLevel,
): boolean {
  return VERIFICATION_LEVEL_RANK[actual] >= VERIFICATION_LEVEL_RANK[required];
}

export function isMemberEligibleForPetition(member: Member, policy: PetitionPolicy): boolean {
  const rules = policy.eligibility;

  if (rules.membershipRequired && member.status !== "active") {
    return false;
  }

  if (
    rules.verificationLevelRequired !== null &&
    !verificationLevelMeets(
      rules.verificationLevelRequired as VerificationLevel,
      member.verificationLevel,
    )
  ) {
    return false;
  }

  if (rules.regionRequired !== null && member.profile.region !== rules.regionRequired) {
    return false;
  }

  if (rules.organizationRequired !== null) {
    return false;
  }

  return true;
}

export function isParticipantEligibleForPetition(
  participantId: string,
  policy: PetitionPolicy,
): boolean {
  const member = getMemberById(participantId);

  if (!member) {
    return false;
  }

  return isMemberEligibleForPetition(member, policy);
}

export function getActiveSignatures(signatures: Signature[]): Signature[] {
  return signatures.filter((signature) => signature.status === "Active");
}

export function hasParticipantSigned(petition: Petition, participantId: string): boolean {
  return getActiveSignatures(petition.signatures).some(
    (signature) => signature.participantId === participantId,
  );
}

export function createEmptySupportMetrics(): SupportMetrics {
  return {
    totalSignatures: 0,
    participantSignatures: 0,
    dailyActivity: [],
    supportThresholdStatus: {
      thresholdDefined: false,
      thresholdReached: false,
      currentCount: 0,
      thresholdCount: null,
    },
  };
}

export function calculateSupportMetrics(petition: Petition): SupportMetrics {
  const activeSignatures = getActiveSignatures(petition.signatures);
  const dailyCounts = new Map<string, number>();

  for (const signature of activeSignatures) {
    const date = signature.signedAt.slice(0, 10);
    dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1);
  }

  const dailyActivity = Array.from(dailyCounts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, signatureCount]) => ({ date, signatureCount }));

  const totalSignatures = activeSignatures.length;

  return {
    totalSignatures,
    participantSignatures: totalSignatures,
    dailyActivity,
    supportThresholdStatus: {
      thresholdDefined: false,
      thresholdReached: false,
      currentCount: totalSignatures,
      thresholdCount: null,
    },
  };
}

export function buildPetitionOutcome(petition: Petition): PetitionOutcome | null {
  if (petition.status === "Draft" || petition.status === "Ready" || petition.status === "Published") {
    return null;
  }

  if (petition.status === "Open") {
    return {
      outcomeId: `outcome-${petition.petitionId}`,
      outcomeType: "Active",
      derivedAt: new Date().toISOString(),
      explanation: "Public endorsement is active.",
    };
  }

  if (petition.status === "Closed") {
    return {
      outcomeId: `outcome-${petition.petitionId}`,
      outcomeType: "Closed",
      derivedAt: new Date().toISOString(),
      explanation: "Public endorsement has closed.",
    };
  }

  return {
    outcomeId: `outcome-${petition.petitionId}`,
    outcomeType: "Archived",
    derivedAt: new Date().toISOString(),
    explanation: "Public endorsement is preserved as historical record.",
  };
}

export function refreshDerivedState(petition: Petition): void {
  petition.supportMetrics = calculateSupportMetrics(petition);
  petition.outcome = buildPetitionOutcome(petition);
}

export function assertSignaturesImmutable(existing: Signature[], proposed: Signature[]): void {
  if (proposed.length < existing.length) {
    throw new Error("Recorded Signatures cannot be removed.");
  }

  for (let index = 0; index < existing.length; index += 1) {
    const existingSignature = existing[index];
    const proposedSignature = proposed[index];

    if (!existingSignature || !proposedSignature) {
      throw new Error("Recorded Signatures cannot be removed.");
    }

    if (
      existingSignature.signatureId !== proposedSignature.signatureId ||
      existingSignature.petitionId !== proposedSignature.petitionId ||
      existingSignature.participantId !== proposedSignature.participantId ||
      existingSignature.signedAt !== proposedSignature.signedAt ||
      existingSignature.visibility !== proposedSignature.visibility ||
      existingSignature.status !== proposedSignature.status ||
      existingSignature.participationMode !== proposedSignature.participationMode
    ) {
      throw new Error(`Signature "${existingSignature.signatureId}" is immutable.`);
    }
  }
}

export function mergePetitionSubject(
  current: PetitionSubject,
  update: Partial<PetitionSubject>,
): PetitionSubject {
  return {
    decisionId: update.decisionId ?? current.decisionId,
    initiativeId: update.initiativeId ?? current.initiativeId,
    title: update.title ?? current.title,
    summary: update.summary ?? current.summary,
  };
}

export function mergePetitionPolicy(
  current: PetitionPolicy,
  update: Partial<PetitionPolicy>,
): PetitionPolicy {
  return {
    eligibility: { ...current.eligibility, ...update.eligibility },
    visibility: { ...current.visibility, ...update.visibility },
    signaturePolicy: { ...current.signaturePolicy, ...update.signaturePolicy },
    withdrawalPolicy: { ...current.withdrawalPolicy, ...update.withdrawalPolicy },
    publicationRules: { ...current.publicationRules, ...update.publicationRules },
    endorsementPeriod: { ...current.endorsementPeriod, ...update.endorsementPeriod },
  };
}

export function buildShareLink(petitionId: string, createdAt: string) {
  return {
    url: `/petitions/public/${petitionId}`,
    createdAt,
  };
}
