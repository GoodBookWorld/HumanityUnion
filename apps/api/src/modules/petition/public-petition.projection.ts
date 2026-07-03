import type {
  CollectiveDecision,
  CollaborativeAnalysis,
  Initiative,
  Petition,
  PetitionState,
  PublicApprovedDecisionContext,
  PublicParticipationEntryGuidance,
  PublicPetitionIdentity,
  PublicPetitionOutcomeProjection,
  PublicPetitionProjection,
  PublicPetitionSubject,
  PublicPetitionSummary,
  PublicShareReference,
  PublicSupportState,
  PublicSupportStatistics,
} from "@hu/types";

import { getAnalysisByInitiativeId } from "../collaborative-analysis/collaborative-analysis.store.js";
import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";

const VIEWING_NOTE = "Viewing this page does not record endorsement.";
const SHARING_NOTE = "Sharing increases visibility but does not record endorsement.";

function isPubliclyVisible(status: PetitionState): boolean {
  return status !== "Draft" && status !== "Ready";
}

function getSupportStatusSummary(status: PetitionState): string {
  switch (status) {
    case "Draft":
    case "Ready":
      return "Preparing for endorsement";
    case "Published":
      return "Published — endorsement not yet open";
    case "Open":
      return "Open for endorsement";
    case "Closed":
      return "Endorsement closed";
    case "Archived":
      return "Archived";
    default:
      return status;
  }
}

function getSupportState(status: PetitionState): PublicSupportState {
  if (status === "Published") {
    return "pending";
  }

  if (status === "Open") {
    return "active";
  }

  return "final";
}

function buildPetitionIdentity(petition: Petition): PublicPetitionIdentity {
  return {
    petitionId: petition.petitionId,
    title: petition.subject.title,
    supportStatus: getSupportStatusSummary(petition.status),
    lifecycleStatus: petition.status,
  };
}

function buildPetitionSummary(petition: Petition): PublicPetitionSummary {
  const publishedAt =
    petition.status === "Published" ||
    petition.status === "Open" ||
    petition.status === "Closed" ||
    petition.status === "Archived"
      ? petition.shareLink?.createdAt ?? petition.updatedAt
      : null;

  return {
    purpose: petition.subject.summary,
    followsApprovedDecisionStatement:
      "This Petition follows an approved Collective Decision. Public support expresses endorsement; it does not reopen the decision.",
    publishedAt,
    opensAt: petition.policy.endorsementPeriod.opensAt,
    closesAt: petition.policy.endorsementPeriod.closesAt,
  };
}

function buildPetitionSubject(petition: Petition): PublicPetitionSubject {
  return {
    subjectType: "Initiative",
    initiativeId: petition.subject.initiativeId,
    title: petition.subject.title,
    summary: petition.subject.summary,
  };
}

function buildApprovedResultSummary(decision: CollectiveDecision | null): string | null {
  if (!decision?.decisionResult?.winningOptionId) {
    return null;
  }

  const winningOption = decision.ballot.options.find(
    (option) => option.optionId === decision.decisionResult?.winningOptionId,
  );

  return winningOption?.label ?? null;
}

function buildAnalysisContextSummary(analysis: CollaborativeAnalysis | null): string | null {
  if (!analysis) {
    return null;
  }

  const publishedSummaries = analysis.summaries.filter(
    (summary) => summary.status.toLowerCase() !== "draft",
  );

  if (publishedSummaries.length === 0) {
    return null;
  }

  const currentSummary = [...publishedSummaries].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];

  return currentSummary?.summaryText ?? null;
}

function buildApprovedDecisionContext(
  petition: Petition,
  decision: CollectiveDecision | null,
  initiative: Initiative | null,
  analysis: CollaborativeAnalysis | null,
): PublicApprovedDecisionContext {
  const decisionSummary = decision?.ballot.question ?? null;
  const approvedOutcomeSummary = decision?.outcome?.explanation ?? null;
  const approvedResultSummary = buildApprovedResultSummary(decision);
  const initiativeContextSummary = initiative?.description ?? petition.subject.summary;
  const analysisContextSummary = buildAnalysisContextSummary(analysis);
  const contextAvailable = Boolean(decisionSummary || approvedOutcomeSummary || approvedResultSummary);

  return {
    collectiveDecisionId: petition.collectiveDecisionId,
    decisionSummary,
    approvedOutcomeSummary,
    approvedResultSummary,
    initiativeContextSummary,
    analysisContextSummary,
    contextAvailable,
  };
}

function buildPublicSupportStatistics(petition: Petition): PublicSupportStatistics {
  const { supportMetrics } = petition;
  const { supportThresholdStatus } = supportMetrics;

  const thresholdProgress = supportThresholdStatus.thresholdDefined
    ? `${supportThresholdStatus.currentCount} of ${supportThresholdStatus.thresholdCount ?? 0}`
    : null;

  const recentActivitySummary =
    supportMetrics.dailyActivity.length > 0
      ? supportMetrics.dailyActivity
          .slice(-3)
          .map((entry) => `${entry.date}: ${entry.signatureCount}`)
          .join("; ")
      : null;

  return {
    supportCount: supportMetrics.totalSignatures,
    supportState: getSupportState(petition.status),
    thresholdDefined: supportThresholdStatus.thresholdDefined,
    thresholdReached: supportThresholdStatus.thresholdReached,
    thresholdProgress,
    recentActivitySummary,
  };
}

function buildPublicPetitionOutcome(petition: Petition): PublicPetitionOutcomeProjection | null {
  if (!petition.outcome) {
    return null;
  }

  const finalSupportCount =
    petition.status === "Closed" || petition.status === "Archived"
      ? petition.supportMetrics.totalSignatures
      : null;

  return {
    outcomeType: petition.outcome.outcomeType,
    explanation: petition.outcome.explanation,
    finalSupportCount,
  };
}

function buildShareReference(petition: Petition): PublicShareReference {
  const available = isPubliclyVisible(petition.status);

  return {
    url: available ? (petition.shareLink?.url ?? `/petitions/public/${petition.petitionId}`) : null,
    available,
    sharingNote: SHARING_NOTE,
  };
}

function buildParticipationEntryGuidance(petition: Petition): PublicParticipationEntryGuidance {
  const observationAvailable = isPubliclyVisible(petition.status);
  const signingAvailable = petition.status === "Open";

  let entryIntent = "Observe this public record.";
  let registrationGatewayMessage =
    "You may read and share this Petition without registration. Registration is required before endorsement can be recorded.";

  if (signingAvailable) {
    entryIntent = "Register to continue toward signing in the Petition Workspace.";
    registrationGatewayMessage =
      "Registration is required before your endorsement can be recorded. After registration, continue in the Petition Workspace to sign when ready.";
  } else if (petition.status === "Published") {
    entryIntent = "Observe and share while endorsement prepares to open.";
    registrationGatewayMessage =
      "You may observe and share without registration. Registration will be required before signing when the endorsement period opens.";
  } else if (petition.status === "Closed" || petition.status === "Archived") {
    entryIntent = "Review the public endorsement record.";
    registrationGatewayMessage =
      "This Petition is no longer open for signing. The public record remains available for observation and sharing.";
  }

  return {
    registrationRequired: true,
    signingAvailable,
    observationAvailable,
    entryIntent,
    registrationGatewayMessage,
    viewingNote: VIEWING_NOTE,
    sharingNote: SHARING_NOTE,
    workspacePath: `/petitions/${petition.petitionId}`,
  };
}

export function toPublicPetitionProjection(petition: Petition): PublicPetitionProjection | null {
  if (!isPubliclyVisible(petition.status)) {
    return null;
  }

  const decision = getDecision(petition.collectiveDecisionId);
  const initiative = getInitiativeById(petition.subject.initiativeId);
  const analysis = getAnalysisByInitiativeId(petition.subject.initiativeId);

  return {
    petitionIdentity: buildPetitionIdentity(petition),
    petitionSummary: buildPetitionSummary(petition),
    petitionSubject: buildPetitionSubject(petition),
    approvedDecisionContext: buildApprovedDecisionContext(
      petition,
      decision,
      initiative,
      analysis,
    ),
    publicSupportStatistics: buildPublicSupportStatistics(petition),
    petitionOutcome: buildPublicPetitionOutcome(petition),
    shareReference: buildShareReference(petition),
    participationEntryGuidance: buildParticipationEntryGuidance(petition),
  };
}
