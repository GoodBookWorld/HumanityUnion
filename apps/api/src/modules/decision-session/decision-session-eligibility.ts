import type { DecisionSessionEligibility, Initiative } from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import {
  getCurrentPublishedVersion,
  getLatestRevisionForInitiative,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetitionByInitiativeId } from "../petition/petition.store.js";

const STEWARD_REVIEWED_STATUSES = new Set(["accepted", "partially_accepted", "declined"]);
const PUBLICLY_VISIBLE_PETITION_STATUSES = new Set(["Published", "Open", "Closed", "Archived"]);

/**
 * Initiative Lifecycle — Part F, Section 11 (Decision Session
 * Integration). "Decision Session becomes the collaborative decision
 * process built on the published Petition" — a Decision Session may only
 * be created/published once the Initiative's Petition has itself been
 * published, so it always has real Petition/signature context to surface.
 */
async function hasPublishedPetitionForInitiative(initiativeId: string): Promise<boolean> {
  const petition = await getPetitionByInitiativeId(initiativeId);

  return Boolean(petition && PUBLICLY_VISIBLE_PETITION_STATUSES.has(petition.status));
}

/**
 * Assesses Decision Session eligibility for an Initiative that the caller has
 * already resolved (Recovery Task 08). This is the module-specific
 * eligibility rule referenced by `assertEligibleInitiativeAncestry` in
 * `decision-session.service.ts` — it is intentionally kept separate from
 * generic Initiative ancestry/existence validation (see
 * `apps/api/src/shared/initiative-ancestry/`) and does not re-fetch the
 * Initiative, so a caller that has already resolved it via the shared
 * ancestry validator does not incur a second lookup.
 *
 * Note: `publishedAnalyses` and `stewardReviewedProposals` are both looked up
 * by this same `initiative.initiativeId`, so cross-artifact Initiative
 * consistency is guaranteed structurally — there is no independently
 * supplied Analysis/Proposal identifier here that could disagree.
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
  const latestRevision = getLatestRevisionForInitiative(initiativeId);

  if (initiativeVersion === 0 || !latestRevision) {
    reasons.push("Latest initiative revision must be published.");
  }

  const publishedAnalyses = listPublishedAnalysesByInitiative(initiativeId);
  const stewardReviewedProposals = listProposalsByInitiative(initiativeId).filter((proposal) =>
    STEWARD_REVIEWED_STATUSES.has(proposal.status),
  );

  if (publishedAnalyses.length === 0) {
    reasons.push("At least one published collaborative analysis is required.");
  }

  if (stewardReviewedProposals.length === 0) {
    reasons.push("At least one steward-reviewed improvement proposal is required.");
  }

  const hasPublishedPetition = await hasPublishedPetitionForInitiative(initiativeId);

  if (!hasPublishedPetition) {
    reasons.push("A published Petition is required before a Decision Session can be prepared.");
  }

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
