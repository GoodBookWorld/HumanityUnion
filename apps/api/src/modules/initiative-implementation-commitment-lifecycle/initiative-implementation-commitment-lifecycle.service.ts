import { randomUUID } from "node:crypto";

import type {
  ImplementationCommitmentTraceability,
  Initiative,
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentDecisionReference,
  InitiativeImplementationCommitmentLifecycleDraft,
  InitiativeImplementationCommitmentLifecycleDraftContext,
  InitiativeImplementationCommitmentPackage,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import {
  createCommitment,
  getCommitmentById,
  listCommitmentsByParticipant,
  updateCommitment,
} from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generateImplementationCommitmentDraftContent } from "./initiative-implementation-commitment-draft-builder.js";
import {
  deleteInitiativeImplementationCommitmentLifecycleDraft,
  getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId,
  updateInitiativeImplementationCommitmentLifecycleDraft,
  upsertInitiativeImplementationCommitmentLifecycleDraft,
  type InitiativeImplementationCommitmentLifecycleDraftUpdate,
} from "./initiative-implementation-commitment-lifecycle-draft.store.js";
import { buildInitiativeImplementationCommitmentIntelligenceSnapshot } from "./initiative-implementation-commitment-intelligence.service.js";
import {
  getPackageByInitiativeId,
  upsertPackage,
} from "./initiative-implementation-commitment-package.store.js";
import { validateInitiativeImplementationCommitmentLifecycleDraftForPublication } from "./initiative-implementation-commitment-lifecycle.validators.js";

const COMMITMENT_TITLE_MAX_LENGTH = 160;

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function getOrCreateWorkingDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativeImplementationCommitmentLifecycleDraft {
  const existing = getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(
    initiative.initiativeId,
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativeImplementationCommitmentLifecycleDraft = {
    draftId: `initiative-implementation-commitment-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    summary: "",
    decisionId: null,
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeImplementationCommitmentLifecycleDraft(draft);
}

export async function getInitiativeImplementationCommitmentWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedPackage = getPackageByInitiativeId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(
    initiativeId,
  );

  if (publishedPackage) {
    return {
      draft: null,
      intelligenceSnapshot,
      publishedPackageId: publishedPackage.packageId,
    };
  }

  const draft = getOrCreateWorkingDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    publishedPackageId: null,
  };
}

export async function generateInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Commitments have already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(initiativeId);

  if (!snapshot.isCollectiveDecisionAvailable || !snapshot.decisionReference) {
    throw new Error(
      "A published (closed) Collective Decision is required before generating Implementation Commitments.",
    );
  }

  const content = await generateImplementationCommitmentDraftContent(snapshot);
  const existing = getOrCreateWorkingDraft(identity, initiative);
  const updated = updateInitiativeImplementationCommitmentLifecycleDraft(initiativeId, {
    title: content.title,
    summary: content.summary,
    decisionId: content.decisionId,
    candidates: content.candidates.map((candidate) => structuredClone(candidate)),
  });

  return updated ?? existing;
}

export function saveInitiativeImplementationCommitmentDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeImplementationCommitmentLifecycleDraftUpdate,
): InitiativeImplementationCommitmentLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Commitments have already been published for this Initiative.");
  }

  const existing = getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Implementation Commitment draft not found.");
  }

  const updated = updateInitiativeImplementationCommitmentLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Implementation Commitment draft not found.");
  }

  return updated;
}

function buildCandidateTraceability(
  decisionId: string,
  candidate: InitiativeImplementationCommitmentCandidate,
  actionIndex: number,
  decisionReference: InitiativeImplementationCommitmentDecisionReference,
): ImplementationCommitmentTraceability {
  return {
    analysisId: decisionReference.analysisId,
    analysisVersion: decisionReference.analysisVersion,
    proposalIds: [...decisionReference.proposalIds],
    revisionId: decisionReference.revisionId,
    revisionVersion: decisionReference.revisionVersion,
    petitionId: decisionReference.petitionId,
    petitionVersion: decisionReference.petitionVersion,
    decisionSessionId: decisionReference.decisionSessionId,
    decisionSessionVersion: decisionReference.decisionSessionVersion,
    decisionId,
    approvedAction: candidate.approvedAction,
    actionIndex,
    participantSignatures: decisionReference.participantSignatures,
    memberSignatures: decisionReference.memberSignatures,
    visitorSignals: decisionReference.visitorSignals,
  };
}

/** Best-effort ISO parse — an Author-authored free-text timeline rarely parses; only real dates survive. */
function parseTimelineToIso(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Date.parse(trimmed);

  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

async function createReminderCandidatesForPublishedPackage(input: {
  initiative: Initiative;
  pkg: InitiativeImplementationCommitmentPackage;
  commitments: readonly InitiativeImplementationCommitment[];
  actorParticipantId: string;
}): Promise<void> {
  const allies = await listActiveAlliesByInitiative(input.initiative.initiativeId);
  const allyRecipientIds = allies
    .map((ally) => ally.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);

  const proposedRecipients = input.commitments.filter(
    (commitment) =>
      commitment.proposalStatus === "proposed" && commitment.participantId !== input.actorParticipantId,
  );

  const recipientParticipantIds = [
    ...new Set([...allyRecipientIds, ...proposedRecipients.map((commitment) => commitment.participantId)]),
  ];

  if (recipientParticipantIds.length === 0) {
    return;
  }

  const usersByMemberId = await findAuthUsersByMemberIds(recipientParticipantIds);
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#implementation-commitments`;

  for (const participantId of allyRecipientIds) {
    const user = usersByMemberId.get(participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "implementation",
      title: "Implementation Commitments published",
      message: `Implementation Commitments for "${input.initiative.title}" have been published.`,
      relatedEntityType: "implementation_commitment_package",
      relatedEntityId: input.pkg.packageId,
      relatedUrl,
    });
  }

  for (const commitment of proposedRecipients) {
    const user = usersByMemberId.get(commitment.participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: commitment.participantId,
      category: "implementation",
      title: "You have a proposed responsibility",
      message: `You have been proposed as responsible for "${commitment.commitmentTitle}" in "${input.initiative.title}". Your commitment is waiting for your response.`,
      relatedEntityType: "implementation_commitment",
      relatedEntityId: commitment.commitmentId,
      relatedUrl,
    });
  }
}

/**
 * Initiative Lifecycle — Part I, Section 5/6/7/9/10. Publishes the working
 * draft as one Commitment Package: one canonical `InitiativeImplementationCommitment`
 * per Candidate (Approved Action), each created directly `published` via
 * the pre-existing commitment store, grouped by a new Package record,
 * followed by exactly one Lifecycle stage publication and Reminder
 * candidates for Active Allies and proposed Participants.
 */
export async function publishInitiativeImplementationCommitmentStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentPackage> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Implementation Commitment draft not found.");
  }

  validateInitiativeImplementationCommitmentLifecycleDraftForPublication(draft);

  const snapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(initiativeId);

  if (!snapshot.decisionReference || snapshot.decisionReference.decisionId !== draft.decisionId) {
    throw new Error(
      "The Collective Decision this draft was generated from is no longer current. Generate Implementation Commitments again before publishing.",
    );
  }

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Commitments have already been published for this Initiative.");
  }

  const decisionReference = snapshot.decisionReference;
  const now = new Date().toISOString();
  const packageId = `implementation-commitment-package-${randomUUID()}`;
  const commitmentIds: string[] = [];
  const createdCommitments: InitiativeImplementationCommitment[] = [];

  draft.candidates.forEach((candidate, index) => {
    const commitmentId = `implementation-commitment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`;
    const participantId = candidate.proposedParticipantId ?? initiative.stewardId;
    const proposalStatus = candidate.proposedParticipantId ? "proposed" : "unassigned";

    const commitment: InitiativeImplementationCommitment = {
      commitmentId,
      initiativeId,
      decisionId: decisionReference.decisionId,
      participantId,
      commitmentTitle: candidate.approvedAction.slice(0, COMMITMENT_TITLE_MAX_LENGTH),
      commitmentSummary: candidate.description,
      commitmentScope: "action",
      expectedCompletionDate: parseTimelineToIso(candidate.suggestedTimeline),
      status: "published",
      publishedAt: now,
      packageId,
      approvedAction: candidate.approvedAction,
      actionIndex: index,
      proposalStatus,
      suggestedResponsibleRole: candidate.suggestedResponsibleRole,
      priority: candidate.priority,
      requiredResources: [...candidate.requiredResources],
      relatedRisks: [...candidate.relatedRisks],
      references: [...candidate.references],
      proposedByParticipantId: initiative.stewardId,
      acceptedAt: null,
      declinedAt: null,
      traceability: buildCandidateTraceability(
        decisionReference.decisionId,
        candidate,
        index,
        decisionReference,
      ),
      createdAt: now,
      updatedAt: now,
    };

    createCommitment(commitment);
    commitmentIds.push(commitmentId);
    createdCommitments.push(commitment);
  });

  const pkg: InitiativeImplementationCommitmentPackage = {
    packageId,
    initiativeId,
    decisionId: decisionReference.decisionId,
    stewardId: initiative.stewardId,
    title: draft.title,
    summary: draft.summary,
    commitmentIds,
    status: "published",
    publishedAt: now,
    traceability: null,
    createdAt: now,
    updatedAt: now,
  };

  upsertPackage(pkg);
  deleteInitiativeImplementationCommitmentLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "commitment",
      stageLabel: "Implementation Commitment",
      stageArtifactId: packageId,
      stageVersion: commitmentIds.length,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#implementation-commitments`,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedPackage({
      initiative,
      pkg,
      commitments: createdCommitments,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Reminder candidates skipped: ${String(error)}`,
    );
  }

  return pkg;
}

function getOwnedProposedCommitment(
  commitmentId: string,
  identity: RequestIdentity,
): InitiativeImplementationCommitment {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  if (commitment.participantId !== identity.participantId) {
    throw new Error("You do not have access to this implementation commitment.");
  }

  return commitment;
}

async function notifyAuthorOfProposalResponse(
  commitment: InitiativeImplementationCommitment,
  outcome: "accepted" | "declined",
): Promise<void> {
  const authorParticipantId = commitment.proposedByParticipantId;

  if (!authorParticipantId) {
    return;
  }

  const initiative = getInitiativeById(commitment.initiativeId);
  const usersByMemberId = await findAuthUsersByMemberIds([authorParticipantId]);
  const user = usersByMemberId.get(authorParticipantId);

  if (!user) {
    return;
  }

  const relatedUrl = `/initiatives/public/${encodeURIComponent(commitment.initiativeId)}#implementation-commitments`;

  await createReminderIfNotExists({
    recipientUserId: user.userId,
    recipientProfileId: authorParticipantId,
    category: "implementation",
    title: outcome === "accepted" ? "Commitment accepted" : "Commitment declined",
    message:
      outcome === "accepted"
        ? `Your proposed commitment "${commitment.commitmentTitle}" for "${initiative?.title ?? commitment.initiativeId}" was accepted.`
        : `Your proposed commitment "${commitment.commitmentTitle}" for "${initiative?.title ?? commitment.initiativeId}" was declined.`,
    relatedEntityType: "implementation_commitment",
    relatedEntityId: commitment.commitmentId,
    relatedUrl,
  });
}

/**
 * Initiative Lifecycle — Part I, Section 6. Voluntary Accept — the
 * proposed Participant's own choice, never automatic and never performed
 * on their behalf by the Author.
 */
export async function acceptInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  const commitment = getOwnedProposedCommitment(commitmentId, identity);

  if (commitment.proposalStatus !== "proposed") {
    throw new Error("Only a proposed commitment can be accepted.");
  }

  const updated = updateCommitment(commitmentId, {
    proposalStatus: "accepted",
    acceptedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  try {
    await notifyAuthorOfProposalResponse(updated, "accepted");
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Accept notification skipped: ${String(error)}`,
    );
  }

  return updated;
}

/** Initiative Lifecycle — Part I, Section 6. Voluntary Decline. */
export async function declineInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  const commitment = getOwnedProposedCommitment(commitmentId, identity);

  if (commitment.proposalStatus !== "proposed") {
    throw new Error("Only a proposed commitment can be declined.");
  }

  const updated = updateCommitment(commitmentId, {
    proposalStatus: "declined",
    declinedAt: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error("Implementation commitment not found.");
  }

  try {
    await notifyAuthorOfProposalResponse(updated, "declined");
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Decline notification skipped: ${String(error)}`,
    );
  }

  return updated;
}

/** My proposed or already-accepted responsibilities across every Initiative (workspace inbox). */
export function listMyProposedInitiativeImplementationCommitments(
  identity: RequestIdentity,
): InitiativeImplementationCommitment[] {
  return listCommitmentsByParticipant(identity.participantId).filter(
    (commitment) => commitment.proposalStatus === "proposed" || commitment.proposalStatus === "accepted",
  );
}
