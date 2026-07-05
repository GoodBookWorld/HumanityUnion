import type { DecisionSessionEligibility, Initiative } from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import {
  getCurrentPublishedVersion,
  getLatestRevisionForInitiative,
} from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

const STEWARD_REVIEWED_STATUSES = new Set(["accepted", "partially_accepted", "declined"]);

export function assessDecisionSessionEligibility(initiativeId: string): DecisionSessionEligibility {
  const reasons: string[] = [];
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return {
      eligible: false,
      reasons: ["Initiative not found."],
      initiativeVersion: 0,
      publishedAnalysisCount: 0,
      stewardReviewedProposalCount: 0,
    };
  }

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

  return {
    eligible: reasons.length === 0,
    reasons,
    initiativeVersion,
    publishedAnalysisCount: publishedAnalyses.length,
    stewardReviewedProposalCount: stewardReviewedProposals.length,
  };
}

export function assertDecisionSessionEligible(initiativeId: string): {
  initiative: Initiative;
  initiativeVersion: number;
} {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const eligibility = assessDecisionSessionEligibility(initiativeId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons[0] ?? "Initiative is not eligible for a decision session.");
  }

  return {
    initiative,
    initiativeVersion: eligibility.initiativeVersion,
  };
}
