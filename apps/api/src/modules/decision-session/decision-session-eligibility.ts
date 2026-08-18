import type { DecisionSessionEligibility, Initiative } from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";

const STEWARD_REVIEWED_STATUSES = new Set(["accepted", "partially_accepted", "declined"]);
const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

/**
 * Informational Petition presence for Decision Session context.
 * Petition is SOURCE_OPTIONAL — never a hard eligibility gate (Step 03).
 */
async function hasPublishedPetitionForInitiative(initiativeId: string): Promise<boolean> {
  if (process.env.NODE_TEST_ENV === "true") {
    return false;
  }

  try {
    const petition = await getPetitionByInitiativeId(initiativeId);
    return Boolean(petition && PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status));
  } catch {
    // Petition store may be unavailable offline (Mongo down).
    return false;
  }
}

/**
 * Assesses Decision Session eligibility for an Initiative.
 *
 * Step 03 — Petition / Analysis / Revision / Proposals are SOURCE_OPTIONAL.
 * Missing upstream artifacts produce empty/insufficient Sources, not a hard
 * block. Initiative must still be projected.
 */
export async function assessDecisionSessionEligibilityForInitiative(
  initiative: Initiative,
): Promise<DecisionSessionEligibility> {
  const reasons: string[] = [];
  const initiativeId = initiative.initiativeId;

  if (initiative.lifecyclePhase !== "projected") {
    reasons.push("Initiative must be projected.");
  }

  const initiativeVersion = getCurrentPublishedVersion(initiativeId);
  const publishedAnalyses = listPublishedAnalysesByInitiative(initiativeId);
  const stewardReviewedProposals = listProposalsByInitiative(initiativeId).filter((proposal) =>
    STEWARD_REVIEWED_STATUSES.has(proposal.status),
  );
  const hasPublishedPetition = await hasPublishedPetitionForInitiative(initiativeId);

  return {
    eligible: reasons.length === 0,
    reasons,
    initiativeVersion,
    publishedAnalysisCount: publishedAnalyses.length,
    stewardReviewedProposalCount: stewardReviewedProposals.length,
    hasPublishedPetition,
  };
}

export async function assessDecisionSessionEligibility(
  initiativeId: string,
): Promise<DecisionSessionEligibility> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return {
      eligible: false,
      reasons: ["Initiative not found."],
      initiativeVersion: 0,
      publishedAnalysisCount: 0,
      stewardReviewedProposalCount: 0,
      hasPublishedPetition: false,
    };
  }

  return assessDecisionSessionEligibilityForInitiative(initiative);
}

export async function assertDecisionSessionEligible(initiativeId: string): Promise<{
  initiative: Initiative;
  initiativeVersion: number;
}> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const eligibility = await assessDecisionSessionEligibility(initiativeId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Initiative is not eligible for a decision session.");
  }

  return {
    initiative,
    initiativeVersion: eligibility.initiativeVersion,
  };
}
