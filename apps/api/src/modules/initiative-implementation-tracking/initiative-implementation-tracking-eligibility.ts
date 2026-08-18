import type { InitiativeImplementationCommitment } from "@hu/types";

import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";

export interface InitiativeImplementationTrackingEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * LEGACY / KEEP_DATA_COMPATIBILITY — participant & e2e create path only.
 * NOT Author Lifecycle progression authority (Author Tracking pack bypasses).
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
  } else if (commitment.participantId !== participantId) {
    reasons.push("Only the commitment author may begin implementation tracking.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Recovery Task 16 — eligibility variant for a Commitment already resolved
 * by `resolveTrackingInitiativeAncestry`, avoiding a second
 * `getCommitmentById` lookup (pre-Task-16 looked it up here, then again in
 * the service body). `commitment` is guaranteed non-null and to exist by the
 * time ancestry resolution succeeds, so the "not found" reason from
 * {@link assessInitiativeImplementationTrackingEligibility} is intentionally
 * omitted here — ancestry resolution (not eligibility) now owns that check.
 * The remaining business rules (published status, author-only) are preserved
 * verbatim, including their exact messages and else-if precedence.
 */
export function assessInitiativeImplementationTrackingEligibilityForResolved(
  commitment: InitiativeImplementationCommitment,
  participantId: string,
): InitiativeImplementationTrackingEligibility {
  const reasons: string[] = [];

  if (commitment.status !== "published") {
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
