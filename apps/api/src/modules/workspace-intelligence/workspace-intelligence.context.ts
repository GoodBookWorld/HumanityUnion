import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getMemberById } from "../member/member-access.js";
import { isInitiativeOwnedBy } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { listSessionsByInitiative } from "../decision-session/decision-session.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listCapsByInitiative } from "../civic-action-package/civic-action-package.store.js";
import { listDeliveriesByCapId } from "../civic-delivery/civic-delivery.store.js";
import { listResponsesByInitiative } from "../official-response/official-response.store.js";
import { listAccountabilitiesByInitiative } from "../civic-accountability/civic-accountability.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listPublicTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listPublicImpactsByInitiative } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listArchiveRecordsByInitiative } from "../public-civic-archive/public-civic-archive.store.js";
import { buildPipelineStatus } from "../capability02-integration/capability02-integration.service.js";
import { getActiveVoteForParticipant } from "../initiative-decision-vote/initiative-decision-vote.store.js";
import { evaluateStoredDecisionParticipationEligibility } from "../participation-eligibility/participation-eligibility.service.js";
import {
  MemberProfileNotFoundError,
  MemberProfilePersistenceUnavailableError,
} from "../member-profile/member-profile.errors.js";
import {
  getOrCreateMemberProfileForUser,
  getWorkspaceMemberIdentityForUser,
} from "../member-profile/member-profile.service.js";
import { countUnreadNotifications } from "../notifications/notification.service.js";
import { resolveParticipationAreaDisplayLabels } from "../participation-area/participation-area-geography.js";
import {
  getPendingParticipationAreaTransitionForParticipant,
  resolveActiveParticipationArea,
} from "../participation-area/participation-area.store.js";
import type {
  WorkspaceIntelligenceContext,
  WorkspaceIntelligenceInitiativeState,
  WorkspaceIntelligenceParticipationArea,
} from "./workspace-intelligence.types.js";

export interface BuildWorkspaceIntelligenceContextInput {
  identity: RequestIdentity;
  userId: string;
  displayName: string;
  initiativeId?: string;
  currentSection?: string;
}

function buildParticipationAreaSummary(
  labels: { country?: string; region?: string; community?: string },
  verificationStatus: string,
  pendingEffectiveAt?: string,
): WorkspaceIntelligenceParticipationArea {
  return {
    country: labels.country,
    region: labels.region,
    community: labels.community,
    verificationStatus,
    hasPendingTransition: Boolean(pendingEffectiveAt),
    pendingEffectiveAt,
  };
}

async function buildInitiativeState(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<WorkspaceIntelligenceInitiativeState | null> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    return null;
  }

  const isSteward = isInitiativeOwnedBy(initiative, identity);
  const pipeline = buildPipelineStatus(initiativeId);
  const analyses = listPublishedAnalysesByInitiative(initiativeId);
  const proposals = listProposalsByInitiative(initiativeId);
  const revisions = listRevisionsByInitiative(initiativeId);
  const sessions = listSessionsByInitiative(initiativeId);
  const decisions = listDecisionsByInitiative(initiativeId);
  const caps = listCapsByInitiative(initiativeId);
  const responses = listResponsesByInitiative(initiativeId);
  const accountabilities = listAccountabilitiesByInitiative(initiativeId);
  const commitments = listCommitmentsByInitiative(initiativeId);
  const trackings = listPublicTrackingsByInitiative(initiativeId);
  const impacts = listPublicImpactsByInitiative(initiativeId);
  const archives = listArchiveRecordsByInitiative(initiativeId);

  const hasDelivery = caps.some((cap) =>
    listDeliveriesByCapId(cap.capId).some((delivery) => delivery.status !== "draft"),
  );

  const openDecision = decisions.find((decision) => decision.status === "opened");
  let participantEligibleToVote = false;
  let participantHasVote = false;

  if (openDecision) {
    const member = await getMemberById(identity.participantId);
    const eligibility = evaluateStoredDecisionParticipationEligibility({
      participantId: identity.participantId,
      isRegistered: member !== null,
      participantStatus: member?.status ?? "unregistered",
      decisionParticipationScope: openDecision.participationScope,
      initiativeCommunitySlug: initiative.metadata.communitySlug ?? "",
      decisionStatus: openDecision.status,
      openedAt: openDecision.openedAt,
      closesAt: openDecision.closesAt,
      currentTime: new Date().toISOString(),
      priorVoteExists: false,
    });

    participantEligibleToVote = eligibility.eligible;
    participantHasVote =
      getActiveVoteForParticipant(openDecision.decisionId, identity.participantId) !== null;
  }

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    lifecyclePhase: initiative.lifecyclePhase,
    isSteward,
    pipelineCurrentStageId: pipeline.currentStageId,
    pipelineNextStageId: pipeline.nextStageId,
    hasPublishedAnalysis: analyses.length > 0,
    hasSubmittedProposal: proposals.some((proposal) =>
      ["submitted", "accepted", "partially_accepted", "declined"].includes(proposal.status),
    ),
    hasAcceptedProposal: proposals.some((proposal) =>
      ["accepted", "partially_accepted"].includes(proposal.status),
    ),
    hasPublishedRevision: revisions.length > 0,
    hasOpenDecisionSession: sessions.some((session) => session.status === "published"),
    hasClosedDecisionSession: sessions.some((session) =>
      ["closed", "archived"].includes(session.status),
    ),
    hasOpenCollectiveDecision: decisions.some((decision) => decision.status === "opened"),
    hasClosedCollectiveDecision: decisions.some((decision) => decision.status === "closed"),
    hasCivicActionPackage: caps.length > 0,
    hasDelivery,
    hasOfficialResponse: responses.some((response) => response.publicationStatus === "published"),
    hasActiveAccountability: accountabilities.some(
      (accountability) => accountability.status === "active",
    ),
    hasPublishedCommitment: commitments.some((commitment) => commitment.status === "published"),
    hasActiveTracking: trackings.some((tracking) => tracking.status === "active"),
    hasCompletedTracking: trackings.some((tracking) =>
      ["completed", "archived"].includes(tracking.status),
    ),
    hasPublishedImpact: impacts.some((impact) => ["published", "verified"].includes(impact.status)),
    hasVerifiedImpact: impacts.some((impact) => impact.status === "verified"),
    hasArchiveDraft: archives.some((archive) => archive.status === "draft"),
    hasPublishedArchive: archives.some((archive) => archive.status === "published"),
    openDecisionId: openDecision?.decisionId,
    openDecisionQuestion: openDecision?.question,
    participantEligibleToVote,
    participantHasVote,
  };
}

function resolveOpenResponsibilities(input: {
  participationArea: WorkspaceIntelligenceParticipationArea;
  initiative: WorkspaceIntelligenceInitiativeState | null;
}): string[] {
  const responsibilities: string[] = [];

  if (!input.participationArea.country) {
    responsibilities.push("Declare Participation Area");
  }

  if (input.participationArea.hasPendingTransition) {
    responsibilities.push("Review pending Participation Area transition");
  }

  if (input.initiative?.isSteward && input.initiative.lifecyclePhase === "draft") {
    responsibilities.push(`Publish initiative "${input.initiative.title}"`);
  }

  if (
    input.initiative?.hasOpenCollectiveDecision &&
    input.initiative.participantEligibleToVote &&
    !input.initiative.participantHasVote
  ) {
    responsibilities.push("Cast vote on open collective decision");
  }

  if (input.initiative?.hasActiveAccountability) {
    responsibilities.push("Continue accountability timeline");
  }

  if (input.initiative?.hasActiveTracking) {
    responsibilities.push("Update implementation tracking");
  }

  return responsibilities;
}

function resolveCivicStage(initiative: WorkspaceIntelligenceInitiativeState | null): string | null {
  if (!initiative) {
    return "Select an initiative to view civic stage";
  }

  if (initiative.lifecyclePhase === "draft") {
    return "Initiative draft";
  }

  if (initiative.pipelineCurrentStageId) {
    return initiative.pipelineCurrentStageId.replace(/_/g, " ");
  }

  return initiative.lifecyclePhase;
}

function resolveNextMilestone(
  initiative: WorkspaceIntelligenceInitiativeState | null,
): string | null {
  if (!initiative?.pipelineNextStageId) {
    return null;
  }

  return initiative.pipelineNextStageId.replace(/_/g, " ");
}

async function resolveParticipantDisplayName(input: {
  userId: string;
  displayName: string;
}): Promise<string> {
  try {
    await getOrCreateMemberProfileForUser({
      userId: input.userId,
      displayName: input.displayName,
    });

    const identityView = await getWorkspaceMemberIdentityForUser(input.userId);
    return identityView.displayName;
  } catch (error) {
    if (
      error instanceof MemberProfilePersistenceUnavailableError ||
      error instanceof MemberProfileNotFoundError
    ) {
      return input.displayName;
    }

    throw error;
  }
}

function loadParticipationAreaReadOnly(participantId: string): {
  labels: { country?: string; region?: string; community?: string };
  verificationStatus: string;
  pendingEffectiveAt?: string;
} {
  const currentTime = new Date().toISOString();
  const activeArea = resolveActiveParticipationArea(participantId, currentTime);
  const pendingTransition = getPendingParticipationAreaTransitionForParticipant(participantId);
  const labels = activeArea ? resolveParticipationAreaDisplayLabels(activeArea) : {};

  return {
    labels,
    verificationStatus: activeArea?.verificationStatus ?? "unverified",
    pendingEffectiveAt: pendingTransition?.effectiveAt,
  };
}

export async function buildWorkspaceIntelligenceContext(
  input: BuildWorkspaceIntelligenceContextInput,
): Promise<WorkspaceIntelligenceContext> {
  const participantDisplayName = await resolveParticipantDisplayName({
    userId: input.userId,
    displayName: input.displayName,
  });

  const participation = loadParticipationAreaReadOnly(input.identity.participantId);

  const participationArea = buildParticipationAreaSummary(
    participation.labels,
    participation.verificationStatus,
    participation.pendingEffectiveAt,
  );

  const initiative = input.initiativeId
    ? await buildInitiativeState(input.identity, input.initiativeId)
    : null;

  const unreadNotificationCount = await countUnreadNotifications(input.userId);

  return {
    participantDisplayName,
    participationArea,
    currentSection: input.currentSection ?? "Workspace",
    currentCivicStage: resolveCivicStage(initiative),
    nextCivicMilestone: resolveNextMilestone(initiative),
    openResponsibilities: resolveOpenResponsibilities({ participationArea, initiative }),
    unreadNotificationCount,
    initiative,
    integrationViewLoaded: Boolean(initiative),
    evaluatedAt: new Date().toISOString(),
  };
}
