import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

export interface InitiativeImplementationCommitmentEligibility {
  eligible: boolean;
  reasons: string[];
}

export function assessInitiativeImplementationCommitmentEligibility(
  initiativeId: string,
  decisionId: string,
): InitiativeImplementationCommitmentEligibility {
  const reasons: string[] = [];
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    reasons.push("Initiative not found.");
  }

  const decision = getDecisionById(decisionId);

  if (!decision) {
    reasons.push("Collective decision not found.");
  } else if (decision.initiativeId !== initiativeId) {
    reasons.push("Collective decision does not belong to this initiative.");
  } else if (decision.status !== "closed") {
    reasons.push("Collective decision must be closed before implementation commitments can begin.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function assertInitiativeImplementationCommitmentEligible(
  initiativeId: string,
  decisionId: string,
): void {
  const eligibility = assessInitiativeImplementationCommitmentEligibility(initiativeId, decisionId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }
}
