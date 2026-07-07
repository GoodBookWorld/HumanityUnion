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
