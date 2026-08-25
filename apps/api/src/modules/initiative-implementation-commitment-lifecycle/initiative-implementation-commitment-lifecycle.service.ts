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
  tryAcceptResponsibilityTransfer,
  tryDeclineResponsibilityTransfer,
  tryInitiateResponsibilityTransfer,
  tryReproposeDeclinedCommitment,
  tryTakeUnassignedCommitment,
  updateCommitment,
  listCommitments,
} from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  buildTakeImplementationCommitmentAcceptanceUpdate,
} from "../initiative-implementation-commitment/initiative-implementation-commitment-responsibility.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { findAuthUserByMemberId, findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { createNotification } from "../notifications/notification.service.js";
import { getMemberById } from "../member/member-access.js";
import { validateDirectInitiativeAncestry } from "../../shared/initiative-ancestry/index.js";
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

export type ResolveProposedParticipantExists = (participantId: string) => Promise<boolean>;

/**
 * Resolves a Proposed Participant ID to a real Participant identity
 * (auth user memberId). Ally membership is NOT required.
 */
export async function defaultResolveProposedParticipantExists(
  participantId: string,
): Promise<boolean> {
  const trimmed = participantId.trim();

  if (!trimmed) {
    return false;
  }

  const authUser = await findAuthUserByMemberId(trimmed);
  return authUser !== null;
}

export async function assertProposedParticipantsExist(
  candidates: readonly InitiativeImplementationCommitmentCandidate[],
  resolveExists: ResolveProposedParticipantExists,
): Promise<void> {
  for (const [index, candidate] of candidates.entries()) {
    const proposedId = candidate.proposedParticipantId?.trim() ?? "";

    if (!proposedId) {
      continue;
    }

    if (!(await resolveExists(proposedId))) {
      throw new Error(
        `Proposed Participant ID is unknown at candidates[${index}]: ${proposedId}`,
      );
    }
  }
}

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

  // Collective Decision is SOURCE_OPTIONAL — Author may define commitments manually.

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
  decisionReference: InitiativeImplementationCommitmentDecisionReference | null | undefined,
): ImplementationCommitmentTraceability {
  return {
    analysisId: decisionReference?.analysisId ?? null,
    analysisVersion: decisionReference?.analysisVersion ?? null,
    proposalIds: [...(decisionReference?.proposalIds ?? [])],
    revisionId: decisionReference?.revisionId ?? null,
    revisionVersion: decisionReference?.revisionVersion ?? null,
    petitionId: decisionReference?.petitionId ?? null,
    petitionVersion: decisionReference?.petitionVersion ?? null,
    decisionSessionId: decisionReference?.decisionSessionId ?? null,
    decisionSessionVersion: decisionReference?.decisionSessionVersion ?? null,
    decisionId,
    approvedAction: candidate.approvedAction,
    actionIndex,
    participantSignatures: decisionReference?.participantSignatures ?? 0,
    memberSignatures: decisionReference?.memberSignatures ?? 0,
    visitorSignals: decisionReference?.visitorSignals ?? 0,
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
      commitment.proposalStatus === "proposed" &&
      commitment.participantId != null &&
      commitment.participantId !== input.actorParticipantId,
  );

  const recipientParticipantIds = [
    ...new Set([
      ...allyRecipientIds,
      ...proposedRecipients.map((commitment) => commitment.participantId as string),
    ]),
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
    const proposedParticipantId = commitment.participantId;

    if (!proposedParticipantId) {
      continue;
    }

    try {
      await notifyProposedParticipant({
        commitment,
        proposedParticipantId,
        initiativeTitle: input.initiative.title,
      });
    } catch (error) {
      console.warn(
        `[initiative-implementation-commitment-lifecycle] Proposal notification skipped: ${String(error)}`,
      );
    }
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
  options: {
    resolveProposedParticipantExists?: ResolveProposedParticipantExists;
  } = {},
): Promise<InitiativeImplementationCommitmentPackage> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Implementation Commitment draft not found.");
  }

  validateInitiativeImplementationCommitmentLifecycleDraftForPublication(draft);
  await assertProposedParticipantsExist(
    draft.candidates,
    options.resolveProposedParticipantExists ?? defaultResolveProposedParticipantExists,
  );

  const snapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(initiativeId);

  // When a Collective Decision was linked, it must still be current.
  if (
    draft.decisionId &&
    (!snapshot.decisionReference || snapshot.decisionReference.decisionId !== draft.decisionId)
  ) {
    throw new Error(
      "The Collective Decision this draft was generated from is no longer current. Generate Implementation Commitments again before publishing.",
    );
  }

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Commitments have already been published for this Initiative.");
  }

  const decisionReference = snapshot.decisionReference;
  const resolvedDecisionId = draft.decisionId ?? decisionReference?.decisionId ?? "";
  const now = new Date().toISOString();
  const packageId = `implementation-commitment-package-${randomUUID()}`;
  const commitmentIds: string[] = [];
  const createdCommitments: InitiativeImplementationCommitment[] = [];

  draft.candidates.forEach((candidate, index) => {
    const commitmentId = `implementation-commitment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`;
    const proposedParticipantId = candidate.proposedParticipantId?.trim() || null;
    const participantId = proposedParticipantId;
    const proposalStatus = proposedParticipantId ? "proposed" : "unassigned";

    const commitment: InitiativeImplementationCommitment = {
      commitmentId,
      initiativeId,
      decisionId: resolvedDecisionId,
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
      proposedAt: proposalStatus === "proposed" ? now : null,
      acceptedAt: null,
      declinedAt: null,
      pendingProposedParticipantId: null,
      proposalHistory: [],
      traceability: buildCandidateTraceability(
        resolvedDecisionId,
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
    decisionId: resolvedDecisionId,
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

function resolveProposalActionMode(
  commitment: InitiativeImplementationCommitment,
  identity: RequestIdentity,
): "proposal" | "transfer" {
  if (
    commitment.proposalStatus === "accepted" &&
    commitment.pendingProposedParticipantId === identity.participantId
  ) {
    return "transfer";
  }

  if (commitment.participantId == null || commitment.participantId !== identity.participantId) {
    throw new Error("You do not have access to this implementation commitment.");
  }

  return "proposal";
}

async function notifyProposedParticipant(input: {
  commitment: InitiativeImplementationCommitment;
  proposedParticipantId: string;
  initiativeTitle: string;
}): Promise<void> {
  const user = await findAuthUserByMemberId(input.proposedParticipantId);

  if (!user) {
    return;
  }

  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.commitment.initiativeId)}#implementation-commitments`;
  const actionTitle = input.commitment.commitmentTitle;

  await createReminderIfNotExists({
    recipientUserId: user.userId,
    recipientProfileId: input.proposedParticipantId,
    category: "implementation",
    title: "You have a proposed responsibility",
    message: `You have been proposed as responsible for "${actionTitle}" in "${input.initiativeTitle}". Your commitment is waiting for your response.`,
    relatedEntityType: "implementation_commitment",
    relatedEntityId: input.commitment.commitmentId,
    relatedUrl,
  });

  try {
    await createNotification({
      recipientUserId: user.userId,
      recipientProfileId: input.proposedParticipantId,
      eventType: "implementation_commitment_proposed",
      title: "You have a proposed responsibility",
      message: `You have been proposed as responsible for "${actionTitle}" in "${input.initiativeTitle}". Accept or decline to respond.`,
      relatedEntityType: "implementation_commitment",
      relatedEntityId: input.commitment.commitmentId,
      relatedUrl,
      priority: "important",
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Proposal notification skipped: ${String(error)}`,
    );
  }
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
 * Initiative Lifecycle — Part I, Section 6 / Pack 19A.5.
 * Accepts a normal proposal or a pending responsibility transfer.
 */
export async function acceptInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const mode = resolveProposalActionMode(commitment, identity);
  const now = new Date().toISOString();

  if (mode === "transfer") {
    const previousOwnerId = commitment.participantId;

    if (!previousOwnerId) {
      throw new Error("Implementation commitment has no current responsible Participant.");
    }

    const updated = tryAcceptResponsibilityTransfer(commitmentId, identity.participantId, now, {
      participantId: previousOwnerId,
      outcome: "transferred_away",
      resolvedAt: now,
      proposedByParticipantId: commitment.proposedByParticipantId ?? null,
      proposedAt: commitment.proposedAt ?? null,
      acceptedAt: commitment.acceptedAt ?? null,
    });

    if (!updated) {
      throw new Error("This commitment transfer is no longer available.");
    }

    try {
      await notifyAuthorOfProposalResponse(updated, "accepted");
    } catch (error) {
      console.warn(
        `[initiative-implementation-commitment-lifecycle] Accept notification skipped: ${String(error)}`,
      );
    }

    try {
      await notifyPreviousOwnerOfTransfer({
        commitment: updated,
        previousOwnerId,
        replacementParticipantId: identity.participantId,
      });
    } catch (error) {
      console.warn(
        `[initiative-implementation-commitment-lifecycle] Transfer owner notification skipped: ${String(error)}`,
      );
    }

    return updated;
  }

  if (commitment.proposalStatus === "accepted") {
    throw new Error("This implementation commitment has already been accepted.");
  }

  if (commitment.proposalStatus === "declined") {
    throw new Error("A declined implementation commitment cannot be accepted without a new proposal.");
  }

  if (commitment.proposalStatus !== "proposed") {
    throw new Error("Only a proposed commitment can be accepted.");
  }

  const updated = updateCommitment(commitmentId, {
    proposalStatus: "accepted",
    acceptedAt: now,
    pendingProposedParticipantId: null,
    proposedAt: null,
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

/** Initiative Lifecycle — Part I, Section 6 / Pack 19A.5. Decline proposal or pending transfer. */
export async function declineInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
): Promise<InitiativeImplementationCommitment> {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const mode = resolveProposalActionMode(commitment, identity);
  const now = new Date().toISOString();

  if (mode === "transfer") {
    const updated = tryDeclineResponsibilityTransfer(commitmentId, identity.participantId, {
      participantId: identity.participantId,
      outcome: "transfer_declined",
      resolvedAt: now,
      proposedByParticipantId: commitment.proposedByParticipantId ?? null,
      proposedAt: commitment.proposedAt ?? null,
    });

    if (!updated) {
      throw new Error("This commitment transfer is no longer available.");
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

  if (commitment.proposalStatus === "accepted") {
    throw new Error("An accepted implementation commitment cannot be declined.");
  }

  if (commitment.proposalStatus === "declined") {
    throw new Error("This implementation commitment has already been declined.");
  }

  if (commitment.proposalStatus !== "proposed") {
    throw new Error("Only a proposed commitment can be declined.");
  }

  const history = [
    ...(commitment.proposalHistory ?? []),
    {
      participantId: identity.participantId,
      outcome: "declined" as const,
      resolvedAt: now,
      proposedByParticipantId: commitment.proposedByParticipantId ?? null,
      proposedAt: commitment.proposedAt ?? null,
    },
  ];

  const updated = updateCommitment(commitmentId, {
    proposalStatus: "declined",
    declinedAt: now,
    proposalHistory: history,
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

/** My proposed, transfer-pending, or already-accepted responsibilities. */
export function listMyProposedInitiativeImplementationCommitments(
  identity: RequestIdentity,
): InitiativeImplementationCommitment[] {
  const byParticipant = listCommitmentsByParticipant(identity.participantId).filter(
    (commitment) =>
      commitment.proposalStatus === "proposed" || commitment.proposalStatus === "accepted",
  );

  const transferPending = listCommitments().filter(
    (commitment) =>
      commitment.pendingProposedParticipantId === identity.participantId &&
      !byParticipant.some((row) => row.commitmentId === commitment.commitmentId),
  );

  return [...byParticipant, ...transferPending];
}

/**
 * Pack 19A.5 — Author re-proposes after Decline.
 * Declined history is preserved; new invitee uses canonical proposed state + notification.
 */
export async function reproposeInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
  nextParticipantId: string,
  options: {
    resolveProposedParticipantExists?: ResolveProposedParticipantExists;
  } = {},
): Promise<InitiativeImplementationCommitment> {
  const trimmedNext = nextParticipantId.trim();

  if (!trimmedNext) {
    throw new Error("Proposed Participant ID is required.");
  }

  const resolveExists =
    options.resolveProposedParticipantExists ?? defaultResolveProposedParticipantExists;

  if (!(await resolveExists(trimmedNext))) {
    throw new Error(`Proposed Participant ID is unknown: ${trimmedNext}`);
  }

  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const initiative = getOwnedInitiative(commitment.initiativeId, identity);

  if (commitment.status !== "published") {
    throw new Error("Only a published Implementation Commitment can be re-proposed.");
  }

  if (commitment.proposalStatus !== "declined") {
    throw new Error("Only a declined Implementation Commitment can be re-proposed.");
  }

  const now = new Date().toISOString();
  const previousParticipantId = commitment.participantId;

  const updated = tryReproposeDeclinedCommitment(
    commitmentId,
    trimmedNext,
    now,
    identity.participantId,
    {
      participantId: previousParticipantId ?? trimmedNext,
      outcome: "superseded_by_reproposal",
      resolvedAt: now,
      proposedByParticipantId: commitment.proposedByParticipantId ?? null,
      proposedAt: commitment.proposedAt ?? null,
    },
  );

  if (!updated) {
    throw new Error("This commitment can no longer be re-proposed.");
  }

  try {
    await notifyProposedParticipant({
      commitment: updated,
      proposedParticipantId: trimmedNext,
      initiativeTitle: initiative.title,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Re-proposal notification skipped: ${String(error)}`,
    );
  }

  return updated;
}

/**
 * Pack 19A.5 — Author initiates transfer while current accepted owner remains canonical
 * until the replacement Participant Accepts.
 */
export async function initiateImplementationCommitmentTransfer(
  identity: RequestIdentity,
  commitmentId: string,
  nextParticipantId: string,
  options: {
    resolveProposedParticipantExists?: ResolveProposedParticipantExists;
  } = {},
): Promise<InitiativeImplementationCommitment> {
  const trimmedNext = nextParticipantId.trim();

  if (!trimmedNext) {
    throw new Error("Proposed Participant ID is required.");
  }

  const resolveExists =
    options.resolveProposedParticipantExists ?? defaultResolveProposedParticipantExists;

  if (!(await resolveExists(trimmedNext))) {
    throw new Error(`Proposed Participant ID is unknown: ${trimmedNext}`);
  }

  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  const initiative = getOwnedInitiative(commitment.initiativeId, identity);

  if (commitment.status !== "published") {
    throw new Error("Only a published Implementation Commitment can be transferred.");
  }

  if (commitment.proposalStatus !== "accepted") {
    throw new Error("Only an accepted Implementation Commitment can be transferred.");
  }

  if (commitment.pendingProposedParticipantId) {
    throw new Error("A responsibility transfer is already pending for this commitment.");
  }

  if (commitment.participantId === trimmedNext) {
    throw new Error("Cannot transfer responsibility to the current responsible Participant.");
  }

  const now = new Date().toISOString();
  const updated = tryInitiateResponsibilityTransfer(commitmentId, trimmedNext, now);

  if (!updated) {
    throw new Error("This commitment can no longer be transferred.");
  }

  try {
    await notifyProposedParticipant({
      commitment: updated,
      proposedParticipantId: trimmedNext,
      initiativeTitle: initiative.title,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Transfer proposal notification skipped: ${String(error)}`,
    );
  }

  return updated;
}

async function notifyPreviousOwnerOfTransfer(input: {
  commitment: InitiativeImplementationCommitment;
  previousOwnerId: string;
  replacementParticipantId: string;
}): Promise<void> {
  if (input.previousOwnerId === input.replacementParticipantId) {
    return;
  }

  const authUser = await findAuthUserByMemberId(input.previousOwnerId);

  if (!authUser) {
    return;
  }

  const initiative = getInitiativeById(input.commitment.initiativeId);
  const replacementName = await resolveActorDisplayName(input.replacementParticipantId);
  const actionText =
    input.commitment.approvedAction?.trim() ||
    input.commitment.commitmentTitle.trim() ||
    "an Implementation Action";
  const initiativeTitle = initiative?.title ?? input.commitment.initiativeId;
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.commitment.initiativeId)}#implementation-commitments`;

  await createNotification({
    recipientUserId: authUser.userId,
    recipientProfileId: input.previousOwnerId,
    eventType: "implementation_commitment_taken",
    title: "Implementation Commitment transferred",
    message: `Responsibility for "${actionText}" on "${initiativeTitle}" was transferred to ${replacementName}.`,
    relatedEntityType: "implementation_commitment",
    relatedEntityId: input.commitment.commitmentId,
    relatedUrl,
    priority: "normal",
  });
}

async function resolveActorDisplayName(participantId: string): Promise<string> {
  try {
    const member = await getMemberById(participantId);
    const displayName = member?.profile.displayName?.trim();

    if (displayName) {
      return displayName;
    }
  } catch {
    // Best-effort display only.
  }

  return "A Participant";
}

async function notifyStewardOfTakenCommitment(input: {
  commitment: InitiativeImplementationCommitment;
  actorParticipantId: string;
}): Promise<void> {
  const initiative = getInitiativeById(input.commitment.initiativeId);
  const stewardId = initiative?.stewardId ?? input.commitment.proposedByParticipantId;

  if (!stewardId || stewardId === input.actorParticipantId) {
    return;
  }

  const authUser = await findAuthUserByMemberId(stewardId);

  if (!authUser) {
    return;
  }

  const actorName = await resolveActorDisplayName(input.actorParticipantId);
  const actionText =
    input.commitment.approvedAction?.trim() ||
    input.commitment.commitmentTitle.trim() ||
    "an Implementation Action";
  const initiativeTitle = initiative?.title ?? input.commitment.initiativeId;
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.commitment.initiativeId)}#implementation-commitments`;

  await createNotification({
    recipientUserId: authUser.userId,
    recipientProfileId: stewardId,
    eventType: "implementation_commitment_taken",
    title: "Implementation Commitment taken",
    message: `${actorName} took responsibility for "${actionText}" on "${initiativeTitle}".`,
    relatedEntityType: "implementation_commitment",
    relatedEntityId: input.commitment.commitmentId,
    relatedUrl,
    priority: "normal",
  });
}

/**
 * Pack 19A.3 — voluntary Take Commitment.
 * published + unassigned → same accepted-responsibility fact as proposal Accept.
 * Ally status is not required. Admin/Editor gain no implicit responsibility.
 */
export async function takeInitiativeImplementationCommitment(
  identity: RequestIdentity,
  commitmentId: string,
  options: {
    notifySteward?: (input: {
      commitment: InitiativeImplementationCommitment;
      actorParticipantId: string;
    }) => Promise<void>;
  } = {},
): Promise<InitiativeImplementationCommitment> {
  const commitment = getCommitmentById(commitmentId);

  if (!commitment) {
    throw new Error("Implementation commitment not found.");
  }

  await validateDirectInitiativeAncestry(
    { initiativeId: commitment.initiativeId },
    {
      initiativeExists(id) {
        return getInitiativeById(id) !== null;
      },
    },
  );

  if (commitment.status !== "published") {
    throw new Error("Only a published Implementation Commitment can be taken.");
  }

  if (commitment.proposalStatus == null) {
    throw new Error("Only an unassigned Implementation Commitment can be taken.");
  }

  if (commitment.proposalStatus === "accepted") {
    throw new Error("This commitment has already been taken.");
  }

  if (commitment.proposalStatus !== "unassigned") {
    throw new Error("Only an unassigned Implementation Commitment can be taken.");
  }

  const acceptedAt = new Date().toISOString();
  // Validates transition rules; acceptedAt is always server-stamped here.
  buildTakeImplementationCommitmentAcceptanceUpdate(
    commitment,
    identity.participantId,
    acceptedAt,
  );

  const taken = tryTakeUnassignedCommitment(
    commitmentId,
    identity.participantId,
    acceptedAt,
  );

  if (!taken) {
    const current = getCommitmentById(commitmentId);

    if (current?.proposalStatus === "accepted") {
      throw new Error("This commitment has already been taken.");
    }

    throw new Error("Only an unassigned Implementation Commitment can be taken.");
  }

  try {
    await (options.notifySteward ?? notifyStewardOfTakenCommitment)({
      commitment: taken,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-commitment-lifecycle] Take notification skipped: ${String(error)}`,
    );
  }

  return taken;
}
