import type { InitiativeImplementationTracking } from "@hu/types";

import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";

export interface InitiativePublicImpactEligibility {
  eligible: boolean;
  reasons: string[];
}

export function assessInitiativePublicImpactEligibility(
  trackingId: string,
  participantId: string,
): InitiativePublicImpactEligibility {
  const reasons: string[] = [];
  const tracking = getTrackingById(trackingId);

  if (!tracking) {
    reasons.push("Implementation tracking not found.");
  } else if (tracking.status !== "completed") {
    reasons.push("Public impact requires completed implementation tracking.");
  } else if (tracking.participantId !== participantId) {
    reasons.push("Only the tracking author may document public impact.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Initiative Ancestry — Recovery Task 17.
 *
 * Same eligibility rules as {@link assessInitiativePublicImpactEligibility},
 * but accepts an already-resolved `InitiativeImplementationTracking` so the
 * creation flow (which now resolves Tracking once via
 * `resolvePublicImpactInitiativeAncestry`) does not look it up a second
 * time. "Not found" can no longer occur here since ancestry resolution
 * already guarantees a non-null Tracking before this is called.
 */
export function assessInitiativePublicImpactEligibilityForResolved(
  tracking: InitiativeImplementationTracking,
  participantId: string,
): InitiativePublicImpactEligibility {
  const reasons: string[] = [];

  if (tracking.status !== "completed") {
    reasons.push("Public impact requires completed implementation tracking.");
  } else if (tracking.participantId !== participantId) {
    reasons.push("Only the tracking author may document public impact.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function assertInitiativePublicImpactEligible(
  trackingId: string,
  participantId: string,
): void {
  const eligibility = assessInitiativePublicImpactEligibility(trackingId, participantId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }
}
