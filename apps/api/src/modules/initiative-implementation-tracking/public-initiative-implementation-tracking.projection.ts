import type {
  ImplementationTrackingUpdate,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingMetrics,
  PublicImplementationTrackingUpdate,
  PublicInitiativeImplementationTrackingListItem,
  PublicInitiativeImplementationTrackingProjection,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
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

function resolveAuthorDisplayName(participantId: string): string {
  const member = getMemberById(participantId);

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

function toPublicUpdate(update: ImplementationTrackingUpdate): PublicImplementationTrackingUpdate {
  return {
    updateId: update.updateId,
    title: update.title,
    summary: update.summary,
    evidence: update.evidence,
    references: update.references,
    createdAt: update.createdAt,
    authorDisplayName: resolveAuthorDisplayName(update.authorId),
  };
}

function toPublicListItem(
  tracking: InitiativeImplementationTracking,
): PublicInitiativeImplementationTrackingListItem {
  return {
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    status: toPublicStatus(tracking.status),
    currentStage: tracking.currentStage,
    summary: tracking.summary,
    authorDisplayName: resolveAuthorDisplayName(tracking.participantId),
    updateCount: countUpdatesForTracking(tracking.trackingId),
    activatedAt: tracking.activatedAt,
    completedAt: tracking.completedAt,
    archivedAt: tracking.archivedAt,
  };
}

export function toPublicInitiativeImplementationTrackingProjection(
  tracking: InitiativeImplementationTracking,
): PublicInitiativeImplementationTrackingProjection {
  return {
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    initiativeId: tracking.initiativeId,
    status: toPublicStatus(tracking.status),
    currentStage: tracking.currentStage,
    summary: tracking.summary,
    authorDisplayName: resolveAuthorDisplayName(tracking.participantId),
    executionHistory: listUpdatesByTracking(tracking.trackingId).map((update) =>
      toPublicUpdate(update),
    ),
    activatedAt: tracking.activatedAt,
    completedAt: tracking.completedAt,
    archivedAt: tracking.archivedAt,
    createdAt: tracking.createdAt,
    updatedAt: tracking.updatedAt,
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

export function listPublicInitiativeImplementationTrackingsForInitiative(
  initiativeId: string,
): PublicInitiativeImplementationTrackingListItem[] {
  return listPublicTrackingsByInitiative(initiativeId).map((tracking) =>
    toPublicListItem(tracking),
  );
}

export function listPublicInitiativeImplementationTrackingsForCommitment(
  commitmentId: string,
): PublicInitiativeImplementationTrackingListItem[] {
  return listPublicTrackingsByCommitment(commitmentId).map((tracking) =>
    toPublicListItem(tracking),
  );
}

export function getPublicInitiativeImplementationTracking(
  trackingId: string,
): PublicInitiativeImplementationTrackingProjection | null {
  const tracking = getTrackingById(trackingId);

  if (!tracking || !PUBLIC_STATUSES.has(tracking.status)) {
    return null;
  }

  return toPublicInitiativeImplementationTrackingProjection(tracking);
}
