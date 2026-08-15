import type {
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativePublicImpact,
} from "@hu/types";

import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getDraftArchiveRecordForImpact } from "./public-civic-archive.store.js";

export interface PublicCivicArchiveEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Public Impact, Initiative, and (where resolvable) Tracking/Commitment/
 * Decision already resolved by the caller — see
 * `resolvePublicCivicArchiveSource` in `public-civic-archive.service.ts`.
 *
 * Tracking/Commitment/Decision remain nullable here because they mirror the
 * pre-existing defensive checks in {@link assessPublicCivicArchiveEligibility}
 * (a corrupted or partially-seeded fixture could still reference a Tracking,
 * Commitment, or Decision that no longer exists) — this type does not widen
 * what was previously checked, it only avoids re-resolving what the caller
 * already resolved once.
 */
export interface ResolvedPublicCivicArchiveEligibilitySource {
  readonly impact: InitiativePublicImpact;
  readonly initiative: Initiative;
  readonly tracking: InitiativeImplementationTracking | null;
  readonly commitment: InitiativeImplementationCommitment | null;
  readonly decision: InitiativeCollectiveDecision | null;
}

export function assessPublicCivicArchiveEligibility(
  impactId: string,
  authorId: string,
): PublicCivicArchiveEligibility {
  const reasons: string[] = [];
  const impact = getImpactById(impactId);

  if (!impact) {
    reasons.push("Public impact record not found.");
    return { eligible: false, reasons };
  }

  if (impact.status !== "verified") {
    reasons.push("Only verified public impact may enter the civic archive.");
  }

  if (impact.participantId !== authorId) {
    reasons.push("Only the implementation author may prepare an archive draft.");
  }

  const tracking = getTrackingById(impact.trackingId);

  if (!tracking) {
    reasons.push("Implementation tracking not found.");
  } else if (tracking.status !== "completed") {
    reasons.push("Archive creation requires completed implementation tracking.");
  }

  const commitment = tracking ? getCommitmentById(tracking.commitmentId) : null;

  if (!commitment) {
    reasons.push("Implementation commitment not found.");
  }

  const decision = commitment ? getDecisionById(commitment.decisionId) : null;

  if (!decision) {
    reasons.push("Collective decision not found.");
  } else if (decision.status !== "closed") {
    reasons.push("Archive creation requires a closed collective decision.");
  }

  const initiative = getInitiativeById(impact.initiativeId);

  if (!initiative) {
    reasons.push("Initiative not found.");
  } else if (initiative.lifecyclePhase !== "projected") {
    reasons.push("Archive creation requires a projected initiative.");
  }

  if (getDraftArchiveRecordForImpact(impactId)) {
    reasons.push("An archive draft already exists for this public impact record.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function assertPublicCivicArchiveEligible(impactId: string, authorId: string): void {
  const eligibility = assessPublicCivicArchiveEligibility(impactId, authorId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }
}

/**
 * Same eligibility rules as {@link assessPublicCivicArchiveEligibility},
 * unchanged in order, wording, and precedence — but operating on an
 * already-resolved source bundle so Public Impact and Initiative are not
 * looked up a second time (Recovery Task 18, Part 6/7 single-resolution
 * targets). Impact-not-found and Initiative-not-found are intentionally
 * absent here: by construction, the caller only reaches this function after
 * `resolvePublicCivicArchiveSource` has already resolved both.
 */
export function assessPublicCivicArchiveEligibilityForResolved(
  resolved: ResolvedPublicCivicArchiveEligibilitySource,
  authorId: string,
): PublicCivicArchiveEligibility {
  const { impact, initiative, tracking, commitment, decision } = resolved;
  const reasons: string[] = [];

  if (impact.status !== "verified") {
    reasons.push("Only verified public impact may enter the civic archive.");
  }

  if (impact.participantId !== authorId) {
    reasons.push("Only the implementation author may prepare an archive draft.");
  }

  if (!tracking) {
    reasons.push("Implementation tracking not found.");
  } else if (tracking.status !== "completed") {
    reasons.push("Archive creation requires completed implementation tracking.");
  }

  if (!commitment) {
    reasons.push("Implementation commitment not found.");
  }

  if (!decision) {
    reasons.push("Collective decision not found.");
  } else if (decision.status !== "closed") {
    reasons.push("Archive creation requires a closed collective decision.");
  }

  if (initiative.lifecyclePhase !== "projected") {
    reasons.push("Archive creation requires a projected initiative.");
  }

  if (getDraftArchiveRecordForImpact(impact.impactId)) {
    reasons.push("An archive draft already exists for this public impact record.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function assertPublicCivicArchiveEligibleForResolved(
  resolved: ResolvedPublicCivicArchiveEligibilitySource,
  authorId: string,
): void {
  const eligibility = assessPublicCivicArchiveEligibilityForResolved(resolved, authorId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }
}
