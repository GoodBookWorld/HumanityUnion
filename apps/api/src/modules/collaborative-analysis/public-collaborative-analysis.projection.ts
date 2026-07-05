import type {
  CollaborativeAnalysis,
  ContributionType,
  PublicCollaborativeAnalysisProjection,
  PublicAnalysisSummaryProjection,
  PublicContributionStatistics,
  PublicProgressPolicySummary,
  PublicSignalStatistics,
  SignalType,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";

const CONTRIBUTION_TYPES: ContributionType[] = [
  "Evidence",
  "Question",
  "Alternative",
  "Clarification",
  "Reference",
  "ExpertOpinion",
  "SummaryProposal",
  "Correction",
];

const SIGNAL_TYPES: SignalType[] = [
  "NeedsClarification",
  "StrongEvidence",
  "WeakEvidence",
  "Duplicate",
  "NeedsExpertReview",
  "RegionalImpact",
  "HighPriority",
  "ReadyForPoll",
];

function buildProgressPolicySummary(analysis: CollaborativeAnalysis): PublicProgressPolicySummary {
  return {
    minimumContributions: analysis.progressPolicy.minimumContributions,
    minimumSignals: analysis.progressPolicy.minimumSignals,
    minimumParticipantCount: analysis.progressPolicy.minimumParticipantCount,
    expertReviewRequired: analysis.progressPolicy.expertReviewRequired,
    regionalReviewRequired: analysis.progressPolicy.regionalReviewRequired,
  };
}

function buildPublicAnalysisSummary(
  analysis: CollaborativeAnalysis,
): PublicAnalysisSummaryProjection | null {
  const publishedSummaries = analysis.summaries.filter(
    (summary) => summary.status.toLowerCase() !== "draft",
  );

  if (publishedSummaries.length === 0) {
    return null;
  }

  const currentSummary = [...publishedSummaries].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];

  if (!currentSummary) {
    return null;
  }

  return {
    summaryText: currentSummary.summaryText,
    createdAt: currentSummary.createdAt,
  };
}

function buildContributionStatistics(
  analysis: CollaborativeAnalysis,
): PublicContributionStatistics {
  const counts = new Map<ContributionType, number>();

  for (const contributionType of CONTRIBUTION_TYPES) {
    counts.set(contributionType, 0);
  }

  for (const contribution of analysis.contributions) {
    counts.set(contribution.contributionType, (counts.get(contribution.contributionType) ?? 0) + 1);
  }

  return {
    totalCount: analysis.contributions.length,
    byType: CONTRIBUTION_TYPES.map((contributionType) => ({
      contributionType,
      count: counts.get(contributionType) ?? 0,
    })).filter((entry) => entry.count > 0),
  };
}

function buildSignalStatistics(analysis: CollaborativeAnalysis): PublicSignalStatistics {
  const counts = new Map<SignalType, number>();

  for (const signalType of SIGNAL_TYPES) {
    counts.set(signalType, 0);
  }

  for (const signal of analysis.signals) {
    counts.set(signal.signalType, (counts.get(signal.signalType) ?? 0) + 1);
  }

  return {
    totalCount: analysis.signals.length,
    byType: SIGNAL_TYPES.map((signalType) => ({
      signalType,
      count: counts.get(signalType) ?? 0,
    })).filter((entry) => entry.count > 0),
  };
}

export function toPublicCollaborativeAnalysisProjection(
  analysis: CollaborativeAnalysis,
): PublicCollaborativeAnalysisProjection {
  const initiative = getInitiativeById(analysis.initiativeId);

  return {
    analysisId: analysis.analysisId,
    initiativeId: analysis.initiativeId,
    initiativeTitle: initiative?.title ?? "Unknown Initiative",
    status: analysis.status,
    readiness: {
      readinessScore: analysis.readiness.readinessScore,
      satisfiedRequirements: [...analysis.readiness.satisfiedRequirements],
      missingRequirements: [...analysis.readiness.missingRequirements],
      blockingIssues: [...analysis.readiness.blockingIssues],
    },
    progressPolicySummary: buildProgressPolicySummary(analysis),
    analysisSummary: buildPublicAnalysisSummary(analysis),
    contributionStatistics: buildContributionStatistics(analysis),
    signalStatistics: buildSignalStatistics(analysis),
    createdAt: analysis.createdAt,
  };
}
