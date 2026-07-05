import type {
  DecisionSession,
  DecisionSessionMetrics,
  PublicDecisionSessionListItem,
  PublicDecisionSessionPackage,
  PublicDecisionSessionProjection,
} from "@hu/types";

import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { toPublicInitiativeCollaborativeAnalysisListItem } from "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js";
import { getProposalById } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { toPublicInitiativeImprovementProposalListItem } from "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getRevisionById } from "../initiative-version-revision/initiative-version-revision.store.js";
import { toPublicInitiativeVersionRevisionListItem } from "../initiative-version-revision/public-initiative-version-revision.projection.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getMemberById } from "../member/member.store.js";
import { getDecisionSessionPackageCounts } from "./decision-session-package.js";
import {
  getSessionById,
  listPublicSessionsByInitiative,
  listSessionsByInitiative,
} from "./decision-session.store.js";

const PUBLIC_STATUSES = new Set<DecisionSession["status"]>(["published", "closed"]);

function resolveStewardDisplayName(stewardId: string): string {
  const member = getMemberById(stewardId);

  return member?.profile.displayName ?? "Unknown Steward";
}

function toPublicStatus(
  status: DecisionSession["status"],
): PublicDecisionSessionProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Decision session status is not publicly visible.");
  }

  return status as PublicDecisionSessionProjection["status"];
}

function buildPublicDecisionSessionPackage(session: DecisionSession): PublicDecisionSessionPackage {
  const packageReferences = session.packageReferences ?? {
    revisionIds: [],
    analysisIds: [],
    proposalIds: [],
  };
  const currentVersion = getCurrentPublishedVersion(session.initiativeId);

  const revisions = packageReferences.revisionIds
    .map((revisionId) => getRevisionById(revisionId))
    .filter((revision): revision is NonNullable<typeof revision> => revision !== null)
    .map((revision) => toPublicInitiativeVersionRevisionListItem(revision, currentVersion));

  const analyses = packageReferences.analysisIds
    .map((analysisId) => getAnalysisById(analysisId))
    .filter(
      (analysis): analysis is NonNullable<typeof analysis> =>
        analysis !== null && analysis.status === "published",
    )
    .map((analysis) => toPublicInitiativeCollaborativeAnalysisListItem(analysis));

  const proposals = packageReferences.proposalIds
    .map((proposalId) => getProposalById(proposalId))
    .filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null)
    .map((proposal) => toPublicInitiativeImprovementProposalListItem(proposal));

  return {
    initiativeVersion: session.initiativeVersion,
    revisions,
    analyses,
    proposals,
  };
}

export function toPublicDecisionSessionListItem(
  session: DecisionSession,
): PublicDecisionSessionListItem {
  return {
    sessionId: session.sessionId,
    title: session.title,
    status: toPublicStatus(session.status),
    opensAt: session.opensAt,
    closesAt: session.closesAt,
    publishedAt: session.publishedAt ?? session.updatedAt,
  };
}

export function toPublicDecisionSessionProjection(
  session: DecisionSession,
): PublicDecisionSessionProjection {
  return {
    sessionId: session.sessionId,
    initiativeId: session.initiativeId,
    initiativeVersion: session.initiativeVersion,
    title: session.title,
    purpose: session.purpose,
    decisionQuestion: session.decisionQuestion,
    status: toPublicStatus(session.status),
    opensAt: session.opensAt,
    closesAt: session.closesAt,
    stewardDisplayName: resolveStewardDisplayName(session.stewardId),
    publishedAt: session.publishedAt ?? session.updatedAt,
    closedAt: session.closedAt,
    decisionPackage: buildPublicDecisionSessionPackage(session),
  };
}

export function computeDecisionSessionMetrics(initiativeId: string): DecisionSessionMetrics {
  const sessions = listSessionsByInitiative(initiativeId).filter((session) =>
    PUBLIC_STATUSES.has(session.status),
  );
  const initiative = getInitiativeById(initiativeId);

  if (sessions.length === 0) {
    return {
      decisionSessionCount: 0,
      averagePreparationTimeDays: null,
      averageRevisionCountBeforeDecision: 0,
      averageAnalysisCountBeforeDecision: 0,
      averageProposalCountBeforeDecision: 0,
    };
  }

  const preparationTimes: number[] = [];
  let totalRevisionCount = 0;
  let totalAnalysisCount = 0;
  let totalProposalCount = 0;

  for (const session of sessions) {
    if (session.packageReferences) {
      const counts = getDecisionSessionPackageCounts(session.packageReferences);
      totalRevisionCount += counts.revisionCount;
      totalAnalysisCount += counts.analysisCount;
      totalProposalCount += counts.proposalCount;
    }

    if (initiative && session.publishedAt) {
      const start = new Date(initiative.createdAt).getTime();
      const end = new Date(session.publishedAt).getTime();
      preparationTimes.push((end - start) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    decisionSessionCount: sessions.length,
    averagePreparationTimeDays:
      preparationTimes.length > 0
        ? preparationTimes.reduce((sum, value) => sum + value, 0) / preparationTimes.length
        : null,
    averageRevisionCountBeforeDecision: totalRevisionCount / sessions.length,
    averageAnalysisCountBeforeDecision: totalAnalysisCount / sessions.length,
    averageProposalCountBeforeDecision: totalProposalCount / sessions.length,
  };
}

export function listPublicDecisionSessionsForInitiative(
  initiativeId: string,
): PublicDecisionSessionListItem[] {
  return listPublicSessionsByInitiative(initiativeId).map((session) =>
    toPublicDecisionSessionListItem(session),
  );
}

export function getPublicDecisionSession(
  sessionId: string,
): PublicDecisionSessionProjection | null {
  const session = getSessionById(sessionId);

  if (!session || !PUBLIC_STATUSES.has(session.status)) {
    return null;
  }

  return toPublicDecisionSessionProjection(session);
}
