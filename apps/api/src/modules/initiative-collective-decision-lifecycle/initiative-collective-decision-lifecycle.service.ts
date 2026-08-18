import { randomUUID } from "node:crypto";

import type {
  CollectiveDecisionStructuredContent,
  CollectiveDecisionTraceability,
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeCollectiveDecisionLifecycleDraftContext,
  InitiativeCollectiveDecisionSessionReference,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import {
  closeInitiativeCollectiveDecision,
  openInitiativeCollectiveDecision,
} from "../initiative-collective-decision/initiative-collective-decision.service.js";
import {
  createDecision,
  getNextSequenceNumber,
  listDecisionsByInitiative,
  updateDecision,
} from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generateCollectiveDecisionDraftContent } from "./initiative-collective-decision-draft-builder.js";
import {
  deleteInitiativeCollectiveDecisionLifecycleDraft,
  getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId,
  updateInitiativeCollectiveDecisionLifecycleDraft,
  upsertInitiativeCollectiveDecisionLifecycleDraft,
  type InitiativeCollectiveDecisionLifecycleDraftUpdate,
} from "./initiative-collective-decision-lifecycle-draft.store.js";
import { buildInitiativeCollectiveDecisionIntelligenceSnapshot } from "./initiative-collective-decision-intelligence.service.js";
import { validateInitiativeCollectiveDecisionLifecycleDraftForPublication } from "./initiative-collective-decision-lifecycle.validators.js";

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function defaultClosesAt(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function getOrCreateWorkingCollectiveDecisionDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativeCollectiveDecisionLifecycleDraft {
  const existing = getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativeCollectiveDecisionLifecycleDraft = {
    draftId: `initiative-collective-decision-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    decisionSummary: "",
    approvedActions: [],
    rejectedAlternatives: [],
    responsibleRoles: [],
    implementationPriorities: [],
    implementationTimeline: "",
    decisionRationale: "",
    decisionRisks: [],
    successCriteria: [],
    requiredResources: [],
    supportingReferences: [],
    participationScope: "world",
    closesAt: defaultClosesAt(),
    decisionSessionId: null,
    decisionSessionVersion: null,
    petitionId: null,
    petitionVersion: null,
    revisionId: null,
    revisionVersion: null,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeCollectiveDecisionLifecycleDraft(draft);
}

function getPublishedDecisionId(initiativeId: string): string | null {
  const closed = listDecisionsByInitiative(initiativeId)
    .filter((decision) => decision.status === "closed")
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber);

  return closed[0]?.decisionId ?? null;
}

export async function getInitiativeCollectiveDecisionWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedDecisionId = getPublishedDecisionId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);

  if (publishedDecisionId) {
    return {
      draft: null,
      intelligenceSnapshot,
      publishedDecisionId,
    };
  }

  const draft = getOrCreateWorkingCollectiveDecisionDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    publishedDecisionId: null,
  };
}

export async function generateInitiativeCollectiveDecisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getPublishedDecisionId(initiativeId)) {
    throw new Error("A Collective Decision has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);

  // Decision Session is SOURCE_OPTIONAL — STANDARD and PUBLIC_CHOICE may generate
  // from Initiative context when no Decision Session exists.

  const session = snapshot.decisionSessionReference;
  const content = await generateCollectiveDecisionDraftContent(snapshot);
  const existing = getOrCreateWorkingCollectiveDecisionDraft(identity, initiative);
  const updated = updateInitiativeCollectiveDecisionLifecycleDraft(initiativeId, {
    title: content.title,
    decisionSummary: content.decisionSummary,
    approvedActions: [...content.approvedActions],
    rejectedAlternatives: [...content.rejectedAlternatives],
    responsibleRoles: [...content.responsibleRoles],
    implementationPriorities: [...content.implementationPriorities],
    implementationTimeline: content.implementationTimeline,
    decisionRationale: content.decisionRationale,
    decisionRisks: [...content.decisionRisks],
    successCriteria: [...content.successCriteria],
    requiredResources: [...content.requiredResources],
    supportingReferences: [...content.supportingReferences],
    decisionSessionId: session?.sessionId ?? null,
    decisionSessionVersion: session?.version ?? null,
    petitionId: session?.petitionId ?? null,
    petitionVersion: session?.petitionVersion ?? null,
    revisionId: session?.revisionId ?? null,
    revisionVersion: session?.revisionVersion ?? null,
    analysisId: session?.analysisId ?? null,
    analysisVersion: session?.analysisVersion ?? null,
    proposalIds: [...(session?.proposalIds ?? [])],
  });

  return updated ?? existing;
}

export function saveInitiativeCollectiveDecisionDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeCollectiveDecisionLifecycleDraftUpdate,
): InitiativeCollectiveDecisionLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getPublishedDecisionId(initiativeId)) {
    throw new Error("A Collective Decision has already been published for this Initiative.");
  }

  const existing = getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Collective Decision draft not found.");
  }

  const updated = updateInitiativeCollectiveDecisionLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Collective Decision draft not found.");
  }

  return updated;
}

function buildTraceability(
  draft: InitiativeCollectiveDecisionLifecycleDraft,
  session: InitiativeCollectiveDecisionSessionReference | null,
): CollectiveDecisionTraceability {
  return {
    analysisId: draft.analysisId,
    analysisVersion: draft.analysisVersion,
    proposalIds: [...draft.proposalIds],
    revisionId: draft.revisionId,
    revisionVersion: draft.revisionVersion,
    petitionId: draft.petitionId,
    petitionVersion: draft.petitionVersion,
    decisionSessionId: session?.sessionId ?? draft.decisionSessionId,
    decisionSessionVersion: session?.version ?? draft.decisionSessionVersion,
    participantSignatures: session?.participantSignatures ?? 0,
    memberSignatures: session?.memberSignatures ?? 0,
    visitorSignals: session?.visitorSignals ?? 0,
    votingStatistics: null,
    votingOutcome: null,
  };
}

async function createReminderCandidatesForPublishedDecision(input: {
  initiative: Initiative;
  decision: InitiativeCollectiveDecision;
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
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#collective-decision`;

  for (const participantId of recipientParticipantIds) {
    const user = usersByMemberId.get(participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "collective_decision",
      title: "Collective Decision published",
      message: `The Collective Decision for "${input.initiative.title}" has been published.`,
      relatedEntityType: "collective_decision",
      relatedEntityId: input.decision.decisionId,
      relatedUrl,
    });

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "implementation",
      title: "Implementation Commitments available",
      message: `Implementation Commitments can now be prepared for "${input.initiative.title}".`,
      relatedEntityType: "collective_decision",
      relatedEntityId: `${input.decision.decisionId}:implementation`,
      relatedUrl: `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#implementation-commitments`,
    });
  }
}

/**
 * Initiative Lifecycle — Part H, Section 5/9/10. Publishes the working
 * draft as the canonical `InitiativeCollectiveDecision` via the existing
 * Collective Decision state machine (draft → opened → closed), attaches
 * Traceability + structured content, fires exactly one Lifecycle stage
 * publication, and generates Reminder candidates.
 */
export async function publishInitiativeCollectiveDecisionStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeCollectiveDecision> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Collective Decision draft not found.");
  }

  validateInitiativeCollectiveDecisionLifecycleDraftForPublication(draft, {
    lifecycleProfile: initiative.lifecycleProfile,
  });

  const snapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);

  // When a Decision Session was linked on the draft, it must still be current.
  // Absence of Decision Session is allowed (SOURCE_OPTIONAL).
  if (
    draft.decisionSessionId &&
    (!snapshot.decisionSessionReference ||
      snapshot.decisionSessionReference.sessionId !== draft.decisionSessionId)
  ) {
    throw new Error(
      "The Decision Session this draft was generated from is no longer current. Generate the Collective Decision again before publishing.",
    );
  }

  const existingForInitiative = listDecisionsByInitiative(initiativeId);
  const alreadyClosed = existingForInitiative.find((decision) => decision.status === "closed");

  if (alreadyClosed) {
    throw new Error("A Collective Decision has already been published for this Initiative.");
  }

  let decision: InitiativeCollectiveDecision;

  // Author Lifecycle never uses legacy session-bound create eligibility.
  // Decision Session id is optional Source linkage only — createDecision directly.
  const existingMatching = existingForInitiative.find((candidate) =>
    draft.decisionSessionId
      ? candidate.decisionSessionId === draft.decisionSessionId
      : candidate.decisionSessionId === null,
  );

  if (existingMatching) {
    decision = existingMatching;
  } else {
    const now = new Date().toISOString();
    decision = createDecision({
      decisionId: `collective-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      initiativeId,
      decisionSessionId: draft.decisionSessionId,
      stewardId: identity.participantId,
      sequenceNumber: getNextSequenceNumber(initiativeId),
      participationScope: draft.participationScope,
      status: "draft",
      question: draft.title.trim() || draft.decisionSummary.trim() || initiative.title,
      closesAt: draft.closesAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  const structuredContent: CollectiveDecisionStructuredContent = {
    title: draft.title,
    decisionSummary: draft.decisionSummary,
    approvedActions: [...draft.approvedActions],
    rejectedAlternatives: [...draft.rejectedAlternatives],
    responsibleRoles: [...draft.responsibleRoles],
    implementationPriorities: [...draft.implementationPriorities],
    implementationTimeline: draft.implementationTimeline,
    decisionRationale: draft.decisionRationale,
    decisionRisks: [...draft.decisionRisks],
    successCriteria: [...draft.successCriteria],
    requiredResources: [...draft.requiredResources],
    supportingReferences: [...draft.supportingReferences],
    votingOutcomeSummary: null,
  };

  const traceability = buildTraceability(draft, snapshot.decisionSessionReference);

  const withContent = updateDecision(decision.decisionId, { structuredContent, traceability });

  if (!withContent) {
    throw new Error("Collective decision not found.");
  }

  decision = withContent;

  if (decision.status === "draft") {
    decision = openInitiativeCollectiveDecision(identity, decision.decisionId);
    decision = await closeInitiativeCollectiveDecision(identity, decision.decisionId);
  } else if (decision.status === "opened") {
    decision = await closeInitiativeCollectiveDecision(identity, decision.decisionId);
  } else {
    throw new Error("A Collective Decision has already been published for this Initiative.");
  }

  deleteInitiativeCollectiveDecisionLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "collective_decision",
      stageLabel: "Collective Decision",
      stageArtifactId: decision.decisionId,
      stageVersion: decision.sequenceNumber,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#collective-decision`,
    });
  } catch (error) {
    console.warn(
      `[initiative-collective-decision-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedDecision({
      initiative,
      decision,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-collective-decision-lifecycle] Reminder candidates skipped: ${String(error)}`,
    );
  }

  return decision;
}
