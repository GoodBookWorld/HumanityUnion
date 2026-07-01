import type { AnalysisId, CollaborativeAnalysisStatus } from "./collaborative-analysis.js";
import type { ContributionType } from "./contribution.js";
import type { InitiativeId } from "./initiative.js";
import type { Readiness } from "./readiness.js";
import type { SignalType } from "./signal.js";

export interface PublicProgressPolicySummary {
  minimumContributions: number;
  minimumSignals: number;
  minimumParticipantCount: number;
  expertReviewRequired: boolean;
  regionalReviewRequired: boolean;
}

export interface PublicAnalysisSummaryProjection {
  summaryText: string;
  createdAt: string;
}

export interface PublicContributionTypeCount {
  contributionType: ContributionType;
  count: number;
}

export interface PublicContributionStatistics {
  totalCount: number;
  byType: PublicContributionTypeCount[];
}

export interface PublicSignalTypeCount {
  signalType: SignalType;
  count: number;
}

export interface PublicSignalStatistics {
  totalCount: number;
  byType: PublicSignalTypeCount[];
}

export interface PublicCollaborativeAnalysisProjection {
  analysisId: AnalysisId;
  initiativeId: InitiativeId;
  initiativeTitle: string;
  status: CollaborativeAnalysisStatus;
  readiness: Readiness;
  progressPolicySummary: PublicProgressPolicySummary;
  analysisSummary: PublicAnalysisSummaryProjection | null;
  contributionStatistics: PublicContributionStatistics;
  signalStatistics: PublicSignalStatistics;
  createdAt: string;
}
