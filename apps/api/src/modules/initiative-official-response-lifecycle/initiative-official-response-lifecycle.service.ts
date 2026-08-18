import { randomUUID } from "node:crypto";

import type {
  Initiative,
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponseLifecycleDraftContext,
  InitiativeOfficialResponsePackage,
  InitiativeOfficialResponseRecord,
  OfficialResponseTraceability,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generateOfficialResponseDraftContent } from "./initiative-official-response-draft-builder.js";
import {
  deleteInitiativeOfficialResponseLifecycleDraft,
  getInitiativeOfficialResponseLifecycleDraftByInitiativeId,
  updateInitiativeOfficialResponseLifecycleDraft,
  upsertInitiativeOfficialResponseLifecycleDraft,
  type InitiativeOfficialResponseLifecycleDraftUpdate,
} from "./initiative-official-response-lifecycle-draft.store.js";
import { buildInitiativeOfficialResponseIntelligenceSnapshot } from "./initiative-official-response-intelligence.service.js";
import {
  getPackageByInitiativeId,
  listResponsesByInitiativeId,
  listResponsesByPackageId,
  upsertPackage,
  upsertResponse,
} from "./initiative-official-response-package.store.js";
import { validateInitiativeOfficialResponseLifecycleDraftForPublication } from "./initiative-official-response-lifecycle.validators.js";

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
): InitiativeOfficialResponseLifecycleDraft {
  const existing = getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativeOfficialResponseLifecycleDraft = {
    draftId: `initiative-official-response-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    summary: "",
    trackingPackageId: null,
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeOfficialResponseLifecycleDraft(draft);
}

export async function getInitiativeOfficialResponseWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeOfficialResponseLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedPackage = getPackageByInitiativeId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeOfficialResponseIntelligenceSnapshot(initiativeId);

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

export async function generateInitiativeOfficialResponseDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeOfficialResponseLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Official Responses have already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeOfficialResponseIntelligenceSnapshot(initiativeId);

  if (!snapshot.isTrackingPackageAvailable) {
    throw new Error(
      "A published Implementation Tracking Package is required before generating Official Responses.",
    );
  }

  const content = await generateOfficialResponseDraftContent(snapshot);
  const existing = getOrCreateWorkingDraft(identity, initiative);
  const updated = updateInitiativeOfficialResponseLifecycleDraft(initiativeId, {
    title: content.title,
    summary: content.summary,
    trackingPackageId: content.trackingPackageId,
    candidates: content.candidates.map((candidate) => structuredClone(candidate)),
  });

  return updated ?? existing;
}

export function saveInitiativeOfficialResponseDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeOfficialResponseLifecycleDraftUpdate,
): InitiativeOfficialResponseLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Official Responses have already been published for this Initiative.");
  }

  const existing = getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Official Responses draft not found.");
  }

  const updated = updateInitiativeOfficialResponseLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Official Responses draft not found.");
  }

  return updated;
}

/**
 * Permanent provenance for "which implementation action produced this
 * Official Response?" — mirrors `ImplementationTrackingTraceability`
 * (Part J), sourced from the first related Commitment's own traceability
 * chain (Analysis → Proposal → Revision → Petition → Decision Session →
 * Collective Decision), with the Tracking Package/Tracking ids/Approved
 * Actions the Candidate itself carries appended on top. Never invents a
 * chain link the source Commitment does not itself have.
 */
function buildOfficialResponseTraceability(
  candidate: InitiativeOfficialResponseCandidate,
  trackingPackageId: string | null,
): OfficialResponseTraceability {
  const primaryCommitmentId = candidate.relatedCommitmentIds[0] ?? null;
  const commitment = primaryCommitmentId ? getCommitmentById(primaryCommitmentId) : null;
  const source = commitment?.traceability ?? null;

  return {
    analysisId: source?.analysisId ?? null,
    analysisVersion: source?.analysisVersion ?? null,
    proposalIds: source ? [...source.proposalIds] : [],
    revisionId: source?.revisionId ?? null,
    revisionVersion: source?.revisionVersion ?? null,
    petitionId: source?.petitionId ?? null,
    petitionVersion: source?.petitionVersion ?? null,
    decisionSessionId: source?.decisionSessionId ?? null,
    decisionSessionVersion: source?.decisionSessionVersion ?? null,
    decisionId: source?.decisionId ?? commitment?.decisionId ?? null,
    trackingPackageId,
    relatedTrackingIds: [...candidate.relatedTrackingIds],
    relatedCommitmentIds: [...candidate.relatedCommitmentIds],
    relatedActions: [...candidate.relatedActions],
  };
}

async function createReminderCandidatesForPublishedOfficialResponsePackage(input: {
  initiative: Initiative;
  pkg: InitiativeOfficialResponsePackage;
  responses: readonly InitiativeOfficialResponseRecord[];
  actorParticipantId: string;
}): Promise<void> {
  const allies = await listActiveAlliesByInitiative(input.initiative.initiativeId);
  const trackings = listTrackingsByInitiative(input.initiative.initiativeId);
  const allyIds = allies
    .map((ally) => ally.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);
  const responsibleIds = trackings
    .map((tracking) => tracking.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);

  const recipientParticipantIds = [...new Set([...allyIds, ...responsibleIds])];

  if (recipientParticipantIds.length === 0) {
    return;
  }

  const usersByMemberId = await findAuthUsersByMemberIds(recipientParticipantIds);
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#official-responses`;

  for (const participantId of recipientParticipantIds) {
    const user = usersByMemberId.get(participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "implementation",
      title: "Official response published",
      message: `Official Responses for "${input.initiative.title}" have been published.`,
      relatedEntityType: "official_response_package",
      relatedEntityId: input.pkg.packageId,
      relatedUrl,
    });
  }

  const pendingVerification = input.responses.filter(
    (response) => response.verificationStatus === "pending",
  );

  for (const response of pendingVerification) {
    const user = usersByMemberId.get(input.actorParticipantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: input.actorParticipantId,
      category: "implementation",
      title: "Response requires verification",
      message: `"${response.subject}" in "${input.initiative.title}" is still pending verification.`,
      relatedEntityType: "official_response",
      relatedEntityId: response.responseId,
      relatedUrl,
    });
  }
}

/**
 * Initiative Lifecycle — Part K. Publishes the working draft as one
 * Official Response Package: one `InitiativeOfficialResponseRecord` per
 * Candidate, grouped by a new Package record, followed by exactly one
 * Lifecycle stage publication and Reminder candidates for Active Allies
 * and the responsible Tracking Participants. This is a Lifecycle Stage
 * Workspace artifact — it never creates, mutates, or reads the pre-existing
 * CAP/delivery TASK-041 `OfficialResponse` domain (`../official-response/`).
 */
export async function publishInitiativeOfficialResponseStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeOfficialResponsePackage> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Official Responses draft not found.");
  }

  validateInitiativeOfficialResponseLifecycleDraftForPublication(draft);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Official Responses have already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeOfficialResponseIntelligenceSnapshot(initiativeId);

  if (!snapshot.trackingPackageReference || snapshot.trackingPackageReference.packageId !== draft.trackingPackageId) {
    throw new Error(
      "The Implementation Tracking Package this draft was generated from is no longer current. Generate Official Responses again before publishing.",
    );
  }

  const now = new Date().toISOString();
  const packageId = `official-response-package-${randomUUID()}`;
  const responseIds: string[] = [];
  const createdResponses: InitiativeOfficialResponseRecord[] = [];

  draft.candidates.forEach((candidate: InitiativeOfficialResponseCandidate, index) => {
    const responseId = `official-response-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`;

    const response: InitiativeOfficialResponseRecord = {
      responseId,
      packageId,
      initiativeId,
      institution: candidate.institution,
      organization: candidate.organization,
      responseType: candidate.responseType,
      subject: candidate.subject,
      receivedAt: candidate.receivedAt,
      publishedAt: now,
      summary: candidate.summary,
      referenceNumber: candidate.referenceNumber,
      relatedActions: [...candidate.relatedActions],
      relatedCommitmentIds: [...candidate.relatedCommitmentIds],
      relatedTrackingIds: [...candidate.relatedTrackingIds],
      documentIds: [...candidate.documentIds],
      links: [...candidate.links],
      verificationStatus: candidate.verificationStatus,
      notes: candidate.notes,
      references: [...candidate.references],
      traceability: buildOfficialResponseTraceability(candidate, snapshot.trackingPackageReference!.packageId),
      createdAt: now,
      updatedAt: now,
    };

    upsertResponse(response);
    responseIds.push(responseId);
    createdResponses.push(response);
  });

  const pkg: InitiativeOfficialResponsePackage = {
    packageId,
    initiativeId,
    trackingPackageId: snapshot.trackingPackageReference.packageId,
    decisionId: snapshot.trackingPackageReference.decisionId,
    stewardId: initiative.stewardId,
    title: draft.title,
    summary: draft.summary,
    responseIds,
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  upsertPackage(pkg);
  deleteInitiativeOfficialResponseLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "official_response",
      stageLabel: "Official Responses",
      stageArtifactId: packageId,
      stageVersion: responseIds.length,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#official-responses`,
    });
  } catch (error) {
    console.warn(
      `[initiative-official-response-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedOfficialResponsePackage({
      initiative,
      pkg,
      responses: createdResponses,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(`[initiative-official-response-lifecycle] Reminder candidates skipped: ${String(error)}`);
  }

  return pkg;
}

/** Part K, Section 6 — the public list of published Official Responses grouped by their Package. */
export function listPublishedPackageResponses(packageId: string): InitiativeOfficialResponseRecord[] {
  return listResponsesByPackageId(packageId);
}

export function listPublishedInitiativeOfficialResponses(
  initiativeId: string,
): InitiativeOfficialResponseRecord[] {
  return listResponsesByInitiativeId(initiativeId);
}
