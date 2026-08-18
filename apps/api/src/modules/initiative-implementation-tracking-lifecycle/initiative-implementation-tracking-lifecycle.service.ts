import { randomUUID } from "node:crypto";

import type {
  ImplementationTrackingTraceability,
  Initiative,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeImplementationTrackingLifecycleDraftContext,
  InitiativeImplementationTrackingPackage,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import {
  appendTrackingUpdate,
  createTracking,
  getTrackingById,
  listTrackingsByParticipant,
  updateTracking,
  type InitiativeImplementationTrackingUpdate as TrackingRecordUpdate,
} from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { generateImplementationTrackingDraftContent } from "./initiative-implementation-tracking-draft-builder.js";
import {
  deleteInitiativeImplementationTrackingLifecycleDraft,
  getInitiativeImplementationTrackingLifecycleDraftByInitiativeId,
  updateInitiativeImplementationTrackingLifecycleDraft,
  upsertInitiativeImplementationTrackingLifecycleDraft,
  type InitiativeImplementationTrackingLifecycleDraftUpdate,
} from "./initiative-implementation-tracking-lifecycle-draft.store.js";
import { buildInitiativeImplementationTrackingIntelligenceSnapshot } from "./initiative-implementation-tracking-intelligence.service.js";
import {
  getPackageByInitiativeId,
  upsertPackage,
} from "./initiative-implementation-tracking-package.store.js";
import { validateInitiativeImplementationTrackingLifecycleDraftForPublication } from "./initiative-implementation-tracking-lifecycle.validators.js";

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
): InitiativeImplementationTrackingLifecycleDraft {
  const existing = getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(
    initiative.initiativeId,
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativeImplementationTrackingLifecycleDraft = {
    draftId: `initiative-implementation-tracking-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    summary: "",
    packageId: null,
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativeImplementationTrackingLifecycleDraft(draft);
}

export async function getInitiativeImplementationTrackingWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationTrackingLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedPackage = getPackageByInitiativeId(initiativeId);
  const intelligenceSnapshot = await buildInitiativeImplementationTrackingIntelligenceSnapshot(
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

export async function generateInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationTrackingLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Tracking has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeImplementationTrackingIntelligenceSnapshot(initiativeId);

  if (!snapshot.isCommitmentPackageAvailable) {
    throw new Error(
      "At least one Accepted Implementation Commitment is required before generating Implementation Tracking.",
    );
  }

  const content = await generateImplementationTrackingDraftContent(snapshot);
  const existing = getOrCreateWorkingDraft(identity, initiative);
  const updated = updateInitiativeImplementationTrackingLifecycleDraft(initiativeId, {
    title: content.title,
    summary: content.summary,
    packageId: content.packageId,
    candidates: content.candidates.map((candidate) => structuredClone(candidate)),
  });

  return updated ?? existing;
}

export function saveInitiativeImplementationTrackingDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativeImplementationTrackingLifecycleDraftUpdate,
): InitiativeImplementationTrackingLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Tracking has already been published for this Initiative.");
  }

  const existing = getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Implementation Tracking draft not found.");
  }

  const updated = updateInitiativeImplementationTrackingLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Implementation Tracking draft not found.");
  }

  return updated;
}

/**
 * Permanent provenance for "which Commitment (and, transitively, which
 * Collective Decision Action) produced this Tracking Record?" — mirrors
 * `ImplementationCommitmentTraceability` (Part I) with `commitmentId`/
 * `commitmentPackageId` added and the signature counters dropped (Tracking
 * has no voting concept of its own). `decisionId`, `commitmentId`, and
 * `approvedAction` always come from the Commitment record itself (never
 * optional there), so this always returns a fully-populated object even
 * for a legacy Commitment published before Part I's own `traceability`
 * field existed.
 */
function buildTrackingTraceability(
  commitment: InitiativeImplementationCommitment,
  commitmentPackageId: string | null,
): ImplementationTrackingTraceability {
  const source = commitment.traceability ?? null;

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
    decisionId: commitment.decisionId,
    commitmentId: commitment.commitmentId,
    commitmentPackageId,
    approvedAction: commitment.approvedAction ?? commitment.commitmentTitle,
    actionIndex: commitment.actionIndex ?? null,
  };
}

async function createReminderCandidatesForPublishedTrackingPackage(input: {
  initiative: Initiative;
  pkg: InitiativeImplementationTrackingPackage;
  trackings: readonly InitiativeImplementationTracking[];
  actorParticipantId: string;
}): Promise<void> {
  const allies = await listActiveAlliesByInitiative(input.initiative.initiativeId);
  const allyIds = allies
    .map((ally) => ally.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);
  const responsibleIds = input.trackings
    .map((tracking) => tracking.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);

  const recipientParticipantIds = [...new Set([...allyIds, ...responsibleIds])];

  if (recipientParticipantIds.length === 0) {
    return;
  }

  const usersByMemberId = await findAuthUsersByMemberIds(recipientParticipantIds);
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#implementation-tracking`;

  for (const participantId of recipientParticipantIds) {
    const user = usersByMemberId.get(participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "implementation",
      title: "Tracking published",
      message: `Implementation Tracking for "${input.initiative.title}" has been published.`,
      relatedEntityType: "implementation_tracking_package",
      relatedEntityId: input.pkg.packageId,
      relatedUrl,
    });

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: participantId,
      category: "implementation",
      title: "Progress update requested",
      message: `Please share a progress update for your Implementation Tracking in "${input.initiative.title}".`,
      relatedEntityType: "implementation_tracking_package",
      relatedEntityId: `${input.pkg.packageId}:progress-request`,
      relatedUrl,
    });
  }

  for (const tracking of input.trackings) {
    if (!tracking.targetDate) {
      continue;
    }

    const user = usersByMemberId.get(tracking.participantId);

    if (!user) {
      continue;
    }

    await createReminderIfNotExists({
      recipientUserId: user.userId,
      recipientProfileId: tracking.participantId,
      category: "implementation",
      title: "Deadline approaching",
      message: `Your Implementation Tracking "${tracking.approvedAction ?? tracking.summary}" in "${input.initiative.title}" has a target date of ${tracking.targetDate}.`,
      relatedEntityType: "implementation_tracking",
      relatedEntityId: tracking.trackingId,
      relatedUrl,
      dueAt: tracking.targetDate,
    });
  }
}

/**
 * Initiative Lifecycle — Part J. Publishes the working draft as one
 * Tracking Package: one canonical `InitiativeImplementationTracking`
 * per Candidate — each created directly `active` (no separate `draft`
 * intermediate, unlike the pre-existing per-Participant creation flow in
 * `initiative-implementation-tracking.service.ts`, which this Part does
 * not alter) — grouped by a new Package record, followed by exactly one
 * Lifecycle stage publication and Reminder candidates for Active Allies
 * and the newly-responsible Participants.
 */
export async function publishInitiativeImplementationTrackingStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativeImplementationTrackingPackage> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Implementation Tracking draft not found.");
  }

  validateInitiativeImplementationTrackingLifecycleDraftForPublication(draft);

  if (getPackageByInitiativeId(initiativeId)) {
    throw new Error("Implementation Tracking has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativeImplementationTrackingIntelligenceSnapshot(initiativeId);

  if (!snapshot.packageReference || snapshot.packageReference.packageId !== draft.packageId) {
    throw new Error(
      "The Commitment Package this draft was generated from is no longer current. Generate Implementation Tracking again before publishing.",
    );
  }

  const commitmentPackageId = snapshot.packageReference.packageId;
  const acceptedByCommitmentId = new Map(
    snapshot.acceptedCommitments.map((commitment) => [commitment.commitmentId, commitment]),
  );

  for (const candidate of draft.candidates) {
    if (!acceptedByCommitmentId.has(candidate.commitmentId)) {
      throw new Error(
        "One or more Accepted Commitments referenced by this draft are no longer accepted. Generate Implementation Tracking again before publishing.",
      );
    }
  }

  const now = new Date().toISOString();
  const packageId = `implementation-tracking-package-${randomUUID()}`;
  const trackingIds: string[] = [];
  const createdTrackings: InitiativeImplementationTracking[] = [];

  draft.candidates.forEach((candidate: InitiativeImplementationTrackingCandidate, index) => {
    const commitment = getCommitmentById(candidate.commitmentId);

    if (!commitment) {
      throw new Error("Implementation commitment not found.");
    }

    const trackingId = `implementation-tracking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`;

    const tracking: InitiativeImplementationTracking = {
      trackingId,
      commitmentId: commitment.commitmentId,
      initiativeId,
      participantId: candidate.responsibleParticipantId || commitment.participantId,
      status: "active",
      currentStage: candidate.currentStatus,
      summary: candidate.notes || candidate.approvedAction,
      activatedAt: now,
      packageId,
      progress: candidate.progress,
      targetDate: candidate.targetDate,
      startedDate: candidate.startedDate,
      actualCompletedDate: candidate.completedDate,
      dependencies: [...candidate.dependencies],
      obstacles: [...candidate.obstacles],
      evidenceReferences: [...candidate.evidenceReferences],
      notes: candidate.notes,
      approvedAction: candidate.approvedAction,
      traceability: buildTrackingTraceability(commitment, commitmentPackageId),
      createdAt: now,
      updatedAt: now,
    };

    createTracking(tracking);
    trackingIds.push(trackingId);
    createdTrackings.push(tracking);
  });

  const pkg: InitiativeImplementationTrackingPackage = {
    packageId,
    initiativeId,
    commitmentPackageId: snapshot.packageReference.packageId,
    decisionId: snapshot.packageReference.decisionId,
    stewardId: initiative.stewardId,
    title: draft.title,
    summary: draft.summary,
    trackingIds,
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  upsertPackage(pkg);
  deleteInitiativeImplementationTrackingLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "tracking",
      stageLabel: "Implementation Tracking",
      stageArtifactId: packageId,
      stageVersion: trackingIds.length,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#implementation-tracking`,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-tracking-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedTrackingPackage({
      initiative,
      pkg,
      trackings: createdTrackings,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(
      `[initiative-implementation-tracking-lifecycle] Reminder candidates skipped: ${String(error)}`,
    );
  }

  return pkg;
}

export interface UpdateInitiativeImplementationTrackingProgressInput {
  progress?: number;
  currentStatus?: string;
  notes?: string;
  evidenceReferences?: string[];
  obstacles?: string[];
  dependencies?: string[];
  startedDate?: string | null;
  actualCompletedDate?: string | null;
  summary?: string;
}

async function notifyStewardOfProgressUpdate(
  tracking: InitiativeImplementationTracking,
  status: { wantsCompletion: boolean; hasNewObstacles: boolean },
): Promise<void> {
  const initiative = getInitiativeById(tracking.initiativeId);

  if (!initiative || initiative.stewardId === tracking.participantId) {
    return;
  }

  const usersByMemberId = await findAuthUsersByMemberIds([initiative.stewardId]);
  const user = usersByMemberId.get(initiative.stewardId);

  if (!user) {
    return;
  }

  const label = tracking.approvedAction ?? tracking.summary;
  const relatedUrl = `/initiatives/public/${encodeURIComponent(tracking.initiativeId)}#implementation-tracking`;

  const title = status.wantsCompletion
    ? "Commitment completed"
    : status.hasNewObstacles
      ? "Implementation delayed"
      : "Progress updated";

  const message = status.wantsCompletion
    ? `"${label}" has been marked completed in "${initiative.title}".`
    : status.hasNewObstacles
      ? `An obstacle was reported for "${label}" in "${initiative.title}".`
      : `Progress was updated for "${label}" in "${initiative.title}".`;

  await createReminderIfNotExists({
    recipientUserId: user.userId,
    recipientProfileId: initiative.stewardId,
    category: "implementation",
    title,
    message,
    relatedEntityType: "implementation_tracking",
    relatedEntityId: tracking.trackingId,
    relatedUrl,
  });
}

/**
 * Initiative Lifecycle — Part J, Section 6/15 (continuous Participant
 * updates). The one place a responsible Participant's own progress
 * update happens — never on behalf of them by the Initiative's Author,
 * who only ever reviews the aggregate result (Section 5's read-only
 * workspace + public result).
 */
export async function updateInitiativeImplementationTrackingProgress(
  identity: RequestIdentity,
  trackingId: string,
  input: UpdateInitiativeImplementationTrackingProgressInput,
): Promise<InitiativeImplementationTracking> {
  const tracking = getTrackingById(trackingId);

  if (!tracking) {
    throw new Error("Implementation tracking not found.");
  }

  if (tracking.participantId !== identity.participantId) {
    throw new Error("You do not have access to update this implementation tracking.");
  }

  if (tracking.status !== "active") {
    throw new Error(`Implementation tracking in status "${tracking.status}" cannot be updated.`);
  }

  if (
    input.progress !== undefined &&
    (typeof input.progress !== "number" ||
      Number.isNaN(input.progress) ||
      input.progress < 0 ||
      input.progress > 100)
  ) {
    throw new Error("progress must be a number between 0 and 100.");
  }

  const nextProgress = input.progress !== undefined ? input.progress : tracking.progress ?? 0;
  const nextEvidence =
    input.evidenceReferences !== undefined ? input.evidenceReferences : tracking.evidenceReferences ?? [];
  const wantsCompletion = nextProgress >= 100 || input.currentStatus === "Completed";

  if (wantsCompletion && nextEvidence.length === 0) {
    throw new Error(
      "At least one Evidence Reference is required to mark Implementation Tracking as completed.",
    );
  }

  const now = new Date().toISOString();
  const update: TrackingRecordUpdate = { progress: nextProgress };

  if (input.currentStatus !== undefined) {
    update.currentStage = input.currentStatus;
  }
  if (input.notes !== undefined) {
    update.notes = input.notes;
  }
  if (input.evidenceReferences !== undefined) {
    update.evidenceReferences = input.evidenceReferences;
  }
  if (input.obstacles !== undefined) {
    update.obstacles = input.obstacles;
  }
  if (input.dependencies !== undefined) {
    update.dependencies = input.dependencies;
  }
  if (input.startedDate !== undefined) {
    update.startedDate = input.startedDate;
  }
  if (input.actualCompletedDate !== undefined) {
    update.actualCompletedDate = input.actualCompletedDate;
  }
  if (input.summary !== undefined) {
    update.summary = input.summary;
  }

  if (wantsCompletion) {
    update.status = "completed";
    update.completedAt = now;
    update.currentStage = input.currentStatus ?? "Completed";
    if (input.actualCompletedDate === undefined) {
      update.actualCompletedDate = now;
    }
  }

  const updated = updateTracking(trackingId, update);

  if (!updated) {
    throw new Error("Implementation tracking not found.");
  }

  const hasNewObstacles = (input.obstacles?.length ?? 0) > 0;
  const journalTitle = wantsCompletion ? "Marked as Completed" : "Progress updated";
  const journalSummary =
    input.notes ?? (wantsCompletion ? "Implementation Tracking marked as completed." : `Progress updated to ${nextProgress}%.`);

  appendTrackingUpdate({
    updateId: `implementation-tracking-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trackingId,
    title: journalTitle,
    summary: journalSummary,
    evidence: nextEvidence.join("; "),
    references: [],
    authorId: identity.participantId,
    createdAt: now,
  });

  try {
    await notifyStewardOfProgressUpdate(updated, { wantsCompletion, hasNewObstacles });
  } catch (error) {
    console.warn(
      `[initiative-implementation-tracking-lifecycle] Steward progress notification skipped: ${String(error)}`,
    );
  }

  return updated;
}

/** My currently-active Tracking responsibilities across every Initiative (workspace inbox). */
export function listMyActiveInitiativeImplementationTrackings(
  identity: RequestIdentity,
): InitiativeImplementationTracking[] {
  return listTrackingsByParticipant(identity.participantId).filter(
    (tracking) => tracking.status === "active",
  );
}
