import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";

export interface InitiativeImplementationTrackingEligibility {
  eligible: boolean;
  reasons: string[];
}

export function assessInitiativeImplementationTrackingEligibility(
  commitmentId: string,
  participantId: string,
): InitiativeImplementationTrackingEligibility {
  const reasons: string[] = [];
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    reasons.push("Implementation commitment not found.");
  } else if (commitment.status !== "published") {
    reasons.push("Implementation tracking requires a published implementation commitment.");
  } else if (commitment.participantId !== participantId) {
    reasons.push("Only the commitment author may begin implementation tracking.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function assertInitiativeImplementationTrackingEligible(
  commitmentId: string,
  participantId: string,
): void {
  const eligibility = assessInitiativeImplementationTrackingEligibility(
    commitmentId,
    participantId,
  );

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }
}
