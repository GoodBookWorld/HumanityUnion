import type { InitiativeImplementationCommitment } from "@hu/types";

import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { hasAcceptedImplementationResponsibility } from "../initiative-implementation-commitment/initiative-implementation-commitment-responsibility.js";

export interface InitiativeImplementationTrackingEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Tracking requires a published Commitment whose actor has canonical
 * accepted responsibility (package Accept / future Take Commitment, or
 * legacy TASK-031 self-authored ownership).
 */
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
  } else if (!hasAcceptedImplementationResponsibility(commitment, participantId)) {
    reasons.push(
      "Implementation tracking requires accepted responsibility for this implementation commitment.",
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Recovery Task 16 — eligibility variant for a Commitment already resolved
 * by `resolveTrackingInitiativeAncestry`, avoiding a second
 * `getCommitmentById` lookup.
 */
export function assessInitiativeImplementationTrackingEligibilityForResolved(
  commitment: InitiativeImplementationCommitment,
  participantId: string,
): InitiativeImplementationTrackingEligibility {
  const reasons: string[] = [];

  if (commitment.status !== "published") {
    reasons.push("Implementation tracking requires a published implementation commitment.");
  } else if (!hasAcceptedImplementationResponsibility(commitment, participantId)) {
    reasons.push(
      "Implementation tracking requires accepted responsibility for this implementation commitment.",
    );
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
