import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

export interface InitiativeImplementationCommitmentEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * LEGACY / KEEP_DATA_COMPATIBILITY — participant & e2e create path only.
 *
 * NOT Author Lifecycle progression authority. Canonical Author Implementation
 * Commitment publish creates commitments from the Author pack without this gate.
 *
 * Assesses Collective Decision eligibility for an Initiative that the
 * caller has already resolved (Recovery Task 15), mirroring the
 * single-resolution pattern established for Collective Decision itself in
 * Recovery Task 09. This is the module-specific business-eligibility rule
 * consumed by `assertEligibleDecision` in
 * `initiative-implementation-commitment.service.ts` — it performs no
 * Initiative lookup of its own, so a caller that has already resolved the
 * Initiative via the shared ancestry validator does not incur a second
 * Initiative lookup.
 *
 * Reason precedence and message text (unchanged from the pre-existing
 * `assessInitiativeImplementationCommitmentEligibility` below for the
 * Decision-related reasons): "not found" takes priority over "belongs to a
 * different initiative", which takes priority over "must be closed". The
 * pre-existing "Initiative not found." reason is intentionally NOT
 * reproduced here: once ancestry validation has resolved a real
 * `Initiative`, "Initiative not found" can no longer occur, so this
 * resolved-input variant only ever needs to reason about the Decision.
 */
export function assessInitiativeImplementationCommitmentEligibilityForResolved(
  initiative: Initiative,
  decision: InitiativeCollectiveDecision | null,
): InitiativeImplementationCommitmentEligibility {
  const reasons: string[] = [];

  if (!decision) {
    reasons.push("Collective decision not found.");
  } else if (decision.initiativeId !== initiative.initiativeId) {
    reasons.push("Collective decision does not belong to this initiative.");
  } else if (decision.status !== "closed") {
    reasons.push(
      "Collective decision must be published before implementation commitments can begin.",
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
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
    reasons.push(
      "Collective decision must be published before implementation commitments can begin.",
    );
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
