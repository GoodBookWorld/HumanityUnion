import type { DecisionSessionPackageReferences } from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";

const STEWARD_REVIEWED_STATUSES = new Set(["accepted", "partially_accepted", "declined"]);

export function buildDecisionSessionPackageReferences(
  initiativeId: string,
): DecisionSessionPackageReferences {
  return {
    revisionIds: listRevisionsByInitiative(initiativeId).map((revision) => revision.revisionId),
    analysisIds: listPublishedAnalysesByInitiative(initiativeId).map(
      (analysis) => analysis.analysisId,
    ),
    proposalIds: listProposalsByInitiative(initiativeId)
      .filter((proposal) => STEWARD_REVIEWED_STATUSES.has(proposal.status))
      .map((proposal) => proposal.proposalId),
  };
}

export function getDecisionSessionPackageCounts(
  packageReferences: DecisionSessionPackageReferences,
): {
  revisionCount: number;
  analysisCount: number;
  proposalCount: number;
} {
  return {
    revisionCount: packageReferences.revisionIds.length,
    analysisCount: packageReferences.analysisIds.length,
    proposalCount: packageReferences.proposalIds.length,
  };
}
