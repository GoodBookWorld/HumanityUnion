import { randomUUID } from "node:crypto";

import type {
  DecisionSession,
  DecisionSessionTraceability,
  Initiative,
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionDraftContext,
  InitiativeDecisionSessionRecommendation,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import {
  createDecisionSessionDraft,
  publishDecisionSession,
  saveDecisionSessionDraft,
} from "../decision-session/decision-session.service.js";
import {
  listPublicSessionsByInitiative,
  listSessionsByInitiative,
  updateSession,
} from "../decision-session/decision-session.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generateDecisionSessionDraftContent } from "./initiative-decision-session-draft-builder.js";
import {
  deleteInitiativeDecisionSessionDraft,
  getInitiativeDecisionSessionDraftByInitiativeId,
  updateInitiativeDecisionSessionDraft,
  upsertInitiativeDecisionSessionDraft,
  type InitiativeDecisionSessionDraftUpdate,
} from "./initiative-decision-session-draft.store.js";
import { buildInitiativeDecisionSessionIntelligenceSnapshot } from "./initiative-decision-session-intelligence.service.js";
import {
  createRecommendation,
  listRecommendationsByInitiative,
} from "./initiative-decision-session-recommendation.store.js";
import {
  validateInitiativeDecisionSessionDraftForPublication,
  type validateSubmitDecisionSessionRecommendationInput,
} from "./initiative-decision-session-lifecycle.validators.js";

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function defaultWindow(): { opensAt: string; closesAt: string } {
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
  };
}

function getOrCreateWorkingDecisionSessionDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativeDecisionSessionDraft {
  const existing = getInitiativeDecisionSessionDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const window = defaultWindow();
  const draft: InitiativeDecisionSessionDraft = {
    draftId: `initiative-decision-session-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    decisionQuestion: "",
    decisionContext: "",
    objectives: [],
    options: [],
    supportingArguments: [],
    risks: [],
    dependencies: [],
    requiredResources: [],
    suggestedTimeline: "",
    suggestedParticipants: [],
    suggestedResponsibleRoles: [],
    unresolvedQuestions: [],
    purpose: "",
    opensAt: window.opensAt,
    closesAt: window.closesAt,
    petitionId: null,
    revisionId: null,
    revisionVersion: null,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeDecisionSessionDraft(draft);
}

function getPublishedSessionId(initiativeId: string): string | null {
  const published = listPublicSessionsByInitiative(initiativeId)[0] ?? null;
  return published?.sessionId ?? null;
}

export async function getInitiativeDecisionSessionWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeDecisionSessionDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedSessionId = getPublishedSessionId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);
  const recommendations = listRecommendationsByInitiative(initiativeId);

  if (publishedSessionId) {
    return {
      draft: null,
      intelligenceSnapshot,
      recommendations,
      publishedSessionId,
    };
  }

  const draft = getOrCreateWorkingDecisionSessionDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    recommendations,
    publishedSessionId: null,
  };
}

export async function generateInitiativeDecisionSessionDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeDecisionSessionDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getPublishedSessionId(initiativeId)) {
    throw new Error("A Decision Session has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);

  if (!snapshot.isPetitionAvailable || !snapshot.petitionReference) {
    throw new Error("A Published Petition is required before generating a Decision Session draft.");
  }

  const content = await generateDecisionSessionDraftContent(snapshot);
  const existing = getOrCreateWorkingDecisionSessionDraft(identity, initiative);
  const updated = updateInitiativeDecisionSessionDraft(initiativeId, {
    title: content.title,
    decisionQuestion: content.decisionQuestion,
    decisionContext: content.decisionContext,
    objectives: [...content.objectives],
    options: [...content.options],
    supportingArguments: [...content.supportingArguments],
    risks: [...content.risks],
    dependencies: [...content.dependencies],
    requiredResources: [...content.requiredResources],
    suggestedTimeline: content.suggestedTimeline,
    suggestedParticipants: [...content.suggestedParticipants],
    suggestedResponsibleRoles: [...content.suggestedResponsibleRoles],
    unresolvedQuestions: [...content.unresolvedQuestions],
    purpose: content.purpose,
    petitionId: snapshot.petitionReference.petitionId,
    revisionId: snapshot.revisionReference?.revisionId ?? snapshot.petitionReference.revisionId,
    revisionVersion:
      snapshot.revisionReference?.version ?? snapshot.petitionReference.revisionVersion,
    analysisId: snapshot.analysisReference?.analysisId ?? snapshot.petitionReference.analysisId,
    analysisVersion:
      snapshot.analysisReference?.initiativeVersion ?? snapshot.petitionReference.analysisVersion,
    proposalIds: [
      ...(snapshot.petitionReference.proposalIds.length > 0
        ? snapshot.petitionReference.proposalIds
        : snapshot.proposalReferences.map((proposal) => proposal.proposalId)),
    ],
  });

  return updated ?? existing;
}

export function saveInitiativeDecisionSessionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeDecisionSessionDraftUpdate,
): InitiativeDecisionSessionDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getPublishedSessionId(initiativeId)) {
    throw new Error("A Decision Session has already been published for this Initiative.");
  }

  const existing = getInitiativeDecisionSessionDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Decision Session draft not found.");
  }

  const updated = updateInitiativeDecisionSessionDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Decision Session draft not found.");
  }

  return updated;
}

function buildTraceability(
  draft: InitiativeDecisionSessionDraft,
  snapshotPetition: NonNullable<
    Awaited<ReturnType<typeof buildInitiativeDecisionSessionIntelligenceSnapshot>>["petitionReference"]
  >,
): DecisionSessionTraceability {
  return {
    analysisId: draft.analysisId,
    analysisVersion: draft.analysisVersion,
    proposalIds: [...draft.proposalIds],
    revisionId: draft.revisionId ?? "",
    revisionVersion: draft.revisionVersion ?? 0,
    petitionId: draft.petitionId ?? snapshotPetition.petitionId,
    petitionVersion: 1,
    participantSignatures: snapshotPetition.participantSignatures,
    memberSignatures: snapshotPetition.memberSignatures,
    visitorSignals: snapshotPetition.visitorSignals,
  };
}

async function createReminderCandidatesForPublishedSession(input: {
  initiative: Initiative;
  session: DecisionSession;
  actorParticipantId: string;
}): Promise<void> {
  const allies = await listActiveAlliesByInitiative(input.initiative.initiativeId);
  const recipientParticipantIds = allies
    .map((ally) => ally.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);

  if (recipientParticipantIds.length === 0) {
    return;
  }

  const usersByMemberId = await findAuthUsersByMemberIds(recipientParticipantIds);
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#decision-session`;

  for (const participantId of recipientParticipantIds) {
    const user = usersByMemberId.get(participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "decision",
      title: "Decision Session published",
      message: `A Decision Session for "${input.initiative.title}" is published. Collective Decision is now available to prepare.`,
      relatedEntityType: "decision_session",
      relatedEntityId: input.session.sessionId,
      relatedUrl,
    });

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "collective_decision",
      title: "Collective Decision is available",
      message: `Collective Decision can now be opened for "${input.initiative.title}".`,
      relatedEntityType: "decision_session",
      relatedEntityId: `${input.session.sessionId}:collective-decision`,
      relatedUrl: `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#collective-decision`,
    });
  }
}

/**
 * Initiative Lifecycle — Part G, Section 5/9/10. Publishes the working
 * draft as the canonical Public Decision Session via the existing Decision
 * Session state machine, attaches Traceability + structured content, fires
 * exactly one Lifecycle stage publication, and generates Reminder candidates.
 */
export async function publishInitiativeDecisionSessionStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<DecisionSession> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeDecisionSessionDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Decision Session draft not found.");
  }

  validateInitiativeDecisionSessionDraftForPublication(draft);

  const snapshot = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);

  if (!snapshot.petitionReference || snapshot.petitionReference.petitionId !== draft.petitionId) {
    throw new Error(
      "The Petition this draft was generated from is no longer current. Generate the Decision Session again before publishing.",
    );
  }

  const existingPublished = getPublishedSessionId(initiativeId);

  if (existingPublished) {
    throw new Error("A Decision Session has already been published for this Initiative.");
  }

  const existingDraftSessions = listSessionsByInitiative(initiativeId).filter(
    (session) => session.status === "draft" && session.stewardId === identity.participantId,
  );
  let session =
    existingDraftSessions[0] ??
    (await createDecisionSessionDraft(identity, {
      initiativeId,
      title: draft.title,
      purpose: draft.purpose || draft.decisionContext.slice(0, 280),
      decisionQuestion: draft.decisionQuestion,
      opensAt: draft.opensAt,
      closesAt: draft.closesAt,
    }));

  session = saveDecisionSessionDraft(identity, session.sessionId, {
    title: draft.title,
    purpose: draft.purpose || draft.decisionContext.slice(0, 280),
    decisionQuestion: draft.decisionQuestion,
    opensAt: draft.opensAt,
    closesAt: draft.closesAt,
  });

  updateSession(session.sessionId, {
    structuredContent: {
      decisionContext: draft.decisionContext,
      objectives: [...draft.objectives],
      options: [...draft.options],
      supportingArguments: [...draft.supportingArguments],
      risks: [...draft.risks],
      dependencies: [...draft.dependencies],
      requiredResources: [...draft.requiredResources],
      suggestedTimeline: draft.suggestedTimeline,
      suggestedParticipants: [...draft.suggestedParticipants],
      suggestedResponsibleRoles: [...draft.suggestedResponsibleRoles],
      unresolvedQuestions: [...draft.unresolvedQuestions],
    },
    traceability: buildTraceability(draft, snapshot.petitionReference),
  });

  session = await publishDecisionSession(identity, session.sessionId);

  deleteInitiativeDecisionSessionDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "decision_session",
      stageLabel: "Decision Session",
      stageArtifactId: session.sessionId,
      stageVersion: 1,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#decision-session`,
    });
  } catch (error) {
    console.warn(
      `[initiative-decision-session-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedSession({
      initiative,
      session,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-decision-session-lifecycle] Reminder candidates skipped: ${String(error)}`,
    );
  }

  return session;
}

export async function submitInitiativeDecisionSessionRecommendation(
  identity: RequestIdentity,
  initiativeId: string,
  input: ReturnType<typeof validateSubmitDecisionSessionRecommendationInput>,
): Promise<InitiativeDecisionSessionRecommendation> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const allies = await listActiveAlliesByInitiative(initiativeId);
  const isAlly = allies.some((ally) => ally.participantId === identity.participantId);

  if (!isAlly && initiative.stewardId !== identity.participantId) {
    throw new Error("Only Active Allies may submit Decision Session recommendations.");
  }

  if (getPublishedSessionId(initiativeId)) {
    throw new Error("Recommendations cannot be submitted after the Decision Session is published.");
  }

  return createRecommendation({
    initiativeId,
    authorParticipantId: identity.participantId,
    kind: input.kind,
    title: input.title,
    body: input.body,
  });
}

export function listInitiativeDecisionSessionRecommendations(
  initiativeId: string,
): InitiativeDecisionSessionRecommendation[] {
  return listRecommendationsByInitiative(initiativeId);
}
