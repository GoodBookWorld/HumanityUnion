import type {
  AnalysisMetrics,
  AnalysisSummary,
  CollaborativeAnalysis,
  CollaborativeAnalysisStatus,
  Contribution,
  ProgressPolicy,
  Readiness,
  Signal,
} from "@hu/types";

import { sampleCollaborativeAnalysis } from "./collaborative-analysis.sample.js";

export interface CollaborativeAnalysisUpdate {
  status?: CollaborativeAnalysisStatus;
  progressPolicy?: Partial<ProgressPolicy>;
  addContributions?: Contribution[];
  addSignals?: Signal[];
  addSummaries?: AnalysisSummary[];
}

const analyses = new Map<string, CollaborativeAnalysis>([
  [sampleCollaborativeAnalysis.analysisId, structuredClone(sampleCollaborativeAnalysis)],
]);

refreshDerivedState(analyses.get(sampleCollaborativeAnalysis.analysisId)!);

function contributionsEqual(left: Contribution, right: Contribution): boolean {
  return (
    left.contributionId === right.contributionId &&
    left.authorId === right.authorId &&
    left.contributionType === right.contributionType &&
    left.title === right.title &&
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    left.relatedContributionId === right.relatedContributionId &&
    JSON.stringify(left.metadata) === JSON.stringify(right.metadata)
  );
}

function assertContributionsImmutable(
  existing: Contribution[],
  proposed: Contribution[],
): void {
  if (proposed.length < existing.length) {
    throw new Error("Published Contributions cannot be removed.");
  }

  for (let index = 0; index < existing.length; index += 1) {
    const existingContribution = existing[index];
    const proposedContribution = proposed[index];

    if (!existingContribution || !proposedContribution) {
      throw new Error("Published Contributions cannot be removed.");
    }

    if (!contributionsEqual(existingContribution, proposedContribution)) {
      throw new Error(`Contribution "${existingContribution.contributionId}" is immutable.`);
    }
  }
}

function validateSignalTarget(analysis: CollaborativeAnalysis, signal: Signal): void {
  if (signal.targetType === "Contribution") {
    const contributionExists = analysis.contributions.some(
      (contribution) => contribution.contributionId === signal.targetId,
    );

    if (!contributionExists) {
      throw new Error(`Signal target Contribution "${signal.targetId}" was not found.`);
    }

    return;
  }

  if (signal.targetType === "Initiative") {
    if (analysis.initiativeId !== signal.targetId) {
      throw new Error(`Signal target Initiative "${signal.targetId}" was not found.`);
    }

    return;
  }

  if (signal.targetType === "Analysis") {
    if (analysis.analysisId !== signal.targetId) {
      throw new Error(`Signal target Analysis "${signal.targetId}" was not found.`);
    }

    return;
  }

  throw new Error(`Signal target type "${signal.targetType}" is not supported.`);
}

function computeMetrics(analysis: CollaborativeAnalysis): AnalysisMetrics {
  const participantIds = new Set<string>();

  for (const contribution of analysis.contributions) {
    participantIds.add(contribution.authorId);
  }

  for (const signal of analysis.signals) {
    participantIds.add(signal.memberId);
  }

  return {
    contributionCount: analysis.contributions.length,
    signalCount: analysis.signals.length,
    participantCount: participantIds.size,
    evidenceCount: analysis.contributions.filter(
      (contribution) => contribution.contributionType === "Evidence",
    ).length,
    expertContributionCount: analysis.contributions.filter(
      (contribution) => contribution.contributionType === "ExpertOpinion",
    ).length,
    clarificationCount: analysis.contributions.filter(
      (contribution) => contribution.contributionType === "Clarification",
    ).length,
  };
}

function evaluateReadiness(analysis: CollaborativeAnalysis): Readiness {
  const policy = analysis.progressPolicy;
  const satisfiedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  const blockingIssues: string[] = [];

  if (analysis.metrics.contributionCount >= policy.minimumContributions) {
    satisfiedRequirements.push("minimumContributions");
  } else {
    missingRequirements.push("minimumContributions");
  }

  if (analysis.metrics.signalCount >= policy.minimumSignals) {
    satisfiedRequirements.push("minimumSignals");
  } else {
    missingRequirements.push("minimumSignals");
  }

  for (const signalType of policy.requiredSignalTypes) {
    const requirement = `requiredSignalType:${signalType}`;

    if (analysis.signals.some((signal) => signal.signalType === signalType)) {
      satisfiedRequirements.push(requirement);
    } else {
      missingRequirements.push(requirement);
    }
  }

  if (analysis.metrics.participantCount >= policy.minimumParticipantCount) {
    satisfiedRequirements.push("minimumParticipantCount");
  } else {
    missingRequirements.push("minimumParticipantCount");
  }

  if (analysis.metrics.signalCount >= policy.supportThreshold) {
    satisfiedRequirements.push("supportThreshold");
  } else {
    missingRequirements.push("supportThreshold");
  }

  if (policy.expertReviewRequired) {
    if (analysis.metrics.expertContributionCount > 0) {
      satisfiedRequirements.push("expertReviewRequired");
    } else {
      missingRequirements.push("expertReviewRequired");
      blockingIssues.push("Expert review is required.");
    }
  }

  if (policy.regionalReviewRequired) {
    if (analysis.signals.some((signal) => signal.signalType === "RegionalImpact")) {
      satisfiedRequirements.push("regionalReviewRequired");
    } else {
      missingRequirements.push("regionalReviewRequired");
      blockingIssues.push("Regional review is required.");
    }
  }

  const evaluatedCount = satisfiedRequirements.length + missingRequirements.length;
  const readinessScore =
    evaluatedCount === 0
      ? 0
      : Math.round((satisfiedRequirements.length / evaluatedCount) * 100);

  return {
    readinessScore,
    satisfiedRequirements,
    missingRequirements,
    blockingIssues,
  };
}

function refreshDerivedState(analysis: CollaborativeAnalysis): void {
  analysis.metrics = computeMetrics(analysis);
  analysis.readiness = evaluateReadiness(analysis);

  if (
    analysis.status === "active" &&
    analysis.readiness.missingRequirements.length === 0 &&
    analysis.readiness.blockingIssues.length === 0
  ) {
    analysis.status = "requirements_met";
  }
}

export function listAnalyses(): CollaborativeAnalysis[] {
  return Array.from(analyses.values(), (analysis) => structuredClone(analysis));
}

export function getAnalysisById(analysisId: string): CollaborativeAnalysis | null {
  const analysis = analyses.get(analysisId);

  return analysis ? structuredClone(analysis) : null;
}

export function getAnalysisByInitiativeId(initiativeId: string): CollaborativeAnalysis | null {
  const analysis = Array.from(analyses.values()).find(
    (entry) => entry.initiativeId === initiativeId,
  );

  return analysis ? structuredClone(analysis) : null;
}

export function createAnalysis(analysis: CollaborativeAnalysis): CollaborativeAnalysis {
  if (analyses.has(analysis.analysisId)) {
    throw new Error(`Analysis "${analysis.analysisId}" already exists.`);
  }

  const created = structuredClone(analysis);
  refreshDerivedState(created);
  analyses.set(created.analysisId, created);

  return structuredClone(created);
}

export function updateAnalysis(
  analysisId: string,
  update: CollaborativeAnalysisUpdate,
): CollaborativeAnalysis | null {
  const analysis = analyses.get(analysisId);

  if (!analysis) {
    return null;
  }

  if (analysis.status === "archived") {
    throw new Error("Archived analyses cannot be modified.");
  }

  if (update.status !== undefined) {
    analysis.status = update.status;
  }

  if (update.progressPolicy !== undefined) {
    Object.assign(analysis.progressPolicy, update.progressPolicy);
  }

  if (update.addContributions !== undefined) {
    const nextContributions = [...analysis.contributions, ...update.addContributions];
    assertContributionsImmutable(analysis.contributions, nextContributions);

    for (const contribution of update.addContributions) {
      if (analysis.contributions.some((entry) => entry.contributionId === contribution.contributionId)) {
        throw new Error(`Contribution "${contribution.contributionId}" already exists.`);
      }
    }

    analysis.contributions = structuredClone(nextContributions);
  }

  if (update.addSignals !== undefined) {
    for (const signal of update.addSignals) {
      if (analysis.signals.some((entry) => entry.signalId === signal.signalId)) {
        throw new Error(`Signal "${signal.signalId}" already exists.`);
      }

      validateSignalTarget(analysis, signal);
    }

    analysis.signals = [...analysis.signals, ...structuredClone(update.addSignals)];
  }

  if (update.addSummaries !== undefined) {
    for (const summary of update.addSummaries) {
      if (analysis.summaries.some((entry) => entry.summaryId === summary.summaryId)) {
        throw new Error(`Analysis Summary "${summary.summaryId}" already exists.`);
      }
    }

    analysis.summaries = [...analysis.summaries, ...structuredClone(update.addSummaries)];
  }

  analysis.updatedAt = new Date().toISOString();
  refreshDerivedState(analysis);

  return structuredClone(analysis);
}

export function archiveAnalysis(analysisId: string): CollaborativeAnalysis | null {
  const analysis = analyses.get(analysisId);

  if (!analysis) {
    return null;
  }

  analysis.status = "archived";
  analysis.updatedAt = new Date().toISOString();
  refreshDerivedState(analysis);

  return structuredClone(analysis);
}
