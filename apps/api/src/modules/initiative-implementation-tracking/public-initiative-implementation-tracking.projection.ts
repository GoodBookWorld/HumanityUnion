import type {
  ImplementationTrackingUpdate,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingMetrics,
  PublicImplementationTrackingUpdate,
  PublicInitiativeImplementationTrackingListItem,
  PublicInitiativeImplementationTrackingProjection,
} from "@hu/types";

import { getMemberById } from "../member/member-access.js";
import {
  countUpdatesForTracking,
  getTrackingById,
  listPublicTrackingsByCommitment,
  listPublicTrackingsByInitiative,
  listTrackingsByInitiative,
  listUpdatesByTracking,
} from "./initiative-implementation-tracking.store.js";

const PUBLIC_STATUSES = new Set<InitiativeImplementationTracking["status"]>([
  "active",
  "completed",
  "archived",
]);

async function resolveAuthorDisplayName(participantId: string): Promise<string> {
  const member = await getMemberById(participantId);

  return member?.profile.displayName ?? "Unknown Participant";
}

function toPublicStatus(
  status: InitiativeImplementationTracking["status"],
): PublicInitiativeImplementationTrackingProjection["status"] {
  if (!PUBLIC_STATUSES.has(status)) {
    throw new Error("Implementation tracking status is not publicly visible.");
  }

  return status as PublicInitiativeImplementationTrackingProjection["status"];
}

async function toPublicUpdate(
  update: ImplementationTrackingUpdate,
): Promise<PublicImplementationTrackingUpdate> {
  return {
    updateId: update.updateId,
    title: update.title,
    summary: update.summary,
    evidence: update.evidence,
    references: update.references,
    createdAt: update.createdAt,
    authorDisplayName: await resolveAuthorDisplayName(update.authorId),
  };
}

async function toPublicListItem(
  tracking: InitiativeImplementationTracking,
): Promise<PublicInitiativeImplementationTrackingListItem> {
  return {
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    status: toPublicStatus(tracking.status),
    currentStage: tracking.currentStage,
    summary: tracking.summary,
    authorDisplayName: await resolveAuthorDisplayName(tracking.participantId),
    updateCount: countUpdatesForTracking(tracking.trackingId),
    activatedAt: tracking.activatedAt,
    completedAt: tracking.completedAt,
    archivedAt: tracking.archivedAt,
    packageId: tracking.packageId ?? null,
    progress: tracking.progress ?? null,
    approvedAction: tracking.approvedAction ?? null,
  };
}

export async function toPublicInitiativeImplementationTrackingProjection(
  tracking: InitiativeImplementationTracking,
): Promise<PublicInitiativeImplementationTrackingProjection> {
  const updates = listUpdatesByTracking(tracking.trackingId);

  return {
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    initiativeId: tracking.initiativeId,
    status: toPublicStatus(tracking.status),
    currentStage: tracking.currentStage,
    summary: tracking.summary,
    authorDisplayName: await resolveAuthorDisplayName(tracking.participantId),
    executionHistory: await Promise.all(updates.map((update) => toPublicUpdate(update))),
    activatedAt: tracking.activatedAt,
    completedAt: tracking.completedAt,
    archivedAt: tracking.archivedAt,
    createdAt: tracking.createdAt,
    updatedAt: tracking.updatedAt,
    packageId: tracking.packageId ?? null,
    progress: tracking.progress ?? null,
    targetDate: tracking.targetDate ?? null,
    startedDate: tracking.startedDate ?? null,
    actualCompletedDate: tracking.actualCompletedDate ?? null,
    dependencies: tracking.dependencies ?? [],
    obstacles: tracking.obstacles ?? [],
    evidenceReferences: tracking.evidenceReferences ?? [],
    notes: tracking.notes ?? null,
    approvedAction: tracking.approvedAction ?? null,
    traceability: tracking.traceability ?? null,
  };
}

export function computeInitiativeImplementationTrackingMetrics(
  initiativeId: string,
): InitiativeImplementationTrackingMetrics {
  const trackings = listTrackingsByInitiative(initiativeId);
  const totalUpdates = trackings.reduce(
    (sum, tracking) => sum + countUpdatesForTracking(tracking.trackingId),
    0,
  );

  const completedTrackings = trackings.filter((tracking) => tracking.status === "completed");
  const completionDurations = completedTrackings
    .filter((tracking) => tracking.activatedAt && tracking.completedAt)
    .map(
      (tracking) => Date.parse(tracking.completedAt ?? "") - Date.parse(tracking.activatedAt ?? ""),
    )
    .filter((duration) => Number.isFinite(duration) && duration >= 0);

  return {
    trackingCount: trackings.length,
    activeTrackingCount: trackings.filter((tracking) => tracking.status === "active").length,
    completedTrackingCount: completedTrackings.length,
    averageUpdatesPerTracking:
      trackings.length === 0 ? 0 : Number((totalUpdates / trackings.length).toFixed(2)),
    averageCompletionTimeMs:
      completionDurations.length === 0
        ? null
        : Math.round(
            completionDurations.reduce((sum, duration) => sum + duration, 0) /
              completionDurations.length,
          ),
  };
}

export async function listPublicInitiativeImplementationTrackingsForInitiative(
  initiativeId: string,
): Promise<PublicInitiativeImplementationTrackingListItem[]> {
  const trackings = listPublicTrackingsByInitiative(initiativeId);

  return Promise.all(trackings.map((tracking) => toPublicListItem(tracking)));
}

export async function listPublicInitiativeImplementationTrackingsForCommitment(
  commitmentId: string,
): Promise<PublicInitiativeImplementationTrackingListItem[]> {
  const trackings = listPublicTrackingsByCommitment(commitmentId);

  return Promise.all(trackings.map((tracking) => toPublicListItem(tracking)));
}

export async function getPublicInitiativeImplementationTracking(
  trackingId: string,
): Promise<PublicInitiativeImplementationTrackingProjection | null> {
  const tracking = getTrackingById(trackingId);

  if (!tracking || !PUBLIC_STATUSES.has(tracking.status)) {
    return null;
  }

  return toPublicInitiativeImplementationTrackingProjection(tracking);
}
