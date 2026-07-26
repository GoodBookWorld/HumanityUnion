import type {
  CivicArchiveLifecycleRecord,
  PublicCivicArchiveListItem,
  PublicCivicArchiveMetrics,
  PublicCivicArchiveProjection,
  PublicCivicArchiveRecord,
  PublicCivicArchiveTimelineEntry,
} from "@hu/types";

import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listUpdatesByTracking } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getImpactById } from "../initiative-public-impact/initiative-public-impact.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getMemberById } from "../member/member-access.js";
import {
  getArchiveRecordById,
  listArchiveRecordsByImpact,
  listArchiveRecordsByInitiative,
} from "./public-civic-archive.store.js";
import {
  computeCivicArchiveLifecycleMetrics,
  listCivicArchiveLifecycleRecords,
  resolveCivicArchiveLifecycleRecord,
} from "./public-civic-archive-lifecycle.projection.js";

export interface PublicCivicArchiveIndexQuery {
  search?: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  implementationYear?: number;
}

async function resolveDisplayName(participantId: string): Promise<string> {
  const member = await getMemberById(participantId);

  return member?.profile.displayName ?? "Unknown Participant";
}

function toPublicListItem(record: PublicCivicArchiveRecord): PublicCivicArchiveListItem {
  const archivedAt = record.archivedAt ?? record.updatedAt;

  return {
    archiveRecordId: record.archiveRecordId,
    initiativeId: record.initiativeId,
    impactId: record.impactId,
    title: record.title,
    summary: record.summary,
    country: record.country,
    region: record.region,
    community: record.community,
    activityArea: record.activityArea,
    participationScope: record.participationScope,
    implementationPeriod: record.implementationPeriod,
    archivedVersion: record.archivedVersion,
    archivedAt,
    implementationYear: new Date(archivedAt).getFullYear(),
  };
}

function buildHistoricalTimeline(
  record: PublicCivicArchiveRecord,
): PublicCivicArchiveTimelineEntry[] {
  const initiative = getInitiativeById(record.initiativeId);
  const decision = getDecisionById(record.references.decisionId);
  const commitment = getCommitmentById(record.references.commitmentId);
  const tracking = getTrackingById(record.references.trackingId);
  const impact = getImpactById(record.references.impactId);
  const updates = listUpdatesByTracking(record.references.trackingId);

  const entries: PublicCivicArchiveTimelineEntry[] = [];

  if (initiative) {
    entries.push({
      eventId: `initiative-created-${initiative.initiativeId}`,
      label: "Initiative created",
      occurredAt: initiative.createdAt,
    });
  }

  if (decision?.closedAt) {
    entries.push({
      eventId: `decision-closed-${decision.decisionId}`,
      label: "Collective decision closed",
      occurredAt: decision.closedAt,
    });
  }

  if (commitment?.publishedAt) {
    entries.push({
      eventId: `commitment-published-${commitment.commitmentId}`,
      label: "Implementation commitment published",
      occurredAt: commitment.publishedAt,
    });
  }

  if (tracking?.activatedAt) {
    entries.push({
      eventId: `tracking-activated-${tracking.trackingId}`,
      label: "Implementation tracking activated",
      occurredAt: tracking.activatedAt,
    });
  }

  for (const update of updates) {
    entries.push({
      eventId: `tracking-update-${update.updateId}`,
      label: "Implementation update added",
      occurredAt: update.createdAt,
    });
  }

  if (tracking?.completedAt) {
    entries.push({
      eventId: `tracking-completed-${tracking.trackingId}`,
      label: "Implementation tracking completed",
      occurredAt: tracking.completedAt,
    });
  }

  if (impact?.verifiedAt) {
    entries.push({
      eventId: `impact-verified-${impact.impactId}`,
      label: "Public impact verified",
      occurredAt: impact.verifiedAt,
    });
  }

  if (record.archivedAt) {
    entries.push({
      eventId: `archive-published-${record.archiveRecordId}`,
      label: "Archived in Humanity Union Civic Archive",
      occurredAt: record.archivedAt,
    });
  }

  return entries.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export async function toPublicCivicArchiveProjection(
  record: PublicCivicArchiveRecord,
): Promise<PublicCivicArchiveProjection> {
  const initiative = getInitiativeById(record.initiativeId);
  const commitment = getCommitmentById(record.references.commitmentId);
  const tracking = getTrackingById(record.references.trackingId);
  const impact = getImpactById(record.references.impactId);
  const updates = listUpdatesByTracking(record.references.trackingId);

  return {
    archiveRecordId: record.archiveRecordId,
    initiativeId: record.initiativeId,
    impactId: record.impactId,
    title: record.title,
    summary: record.summary,
    country: record.country,
    region: record.region,
    community: record.community,
    activityArea: record.activityArea,
    participationScope: record.participationScope,
    implementationPeriod: record.implementationPeriod,
    archivedStatus: "published",
    archivedVersion: record.archivedVersion,
    archivedAt: record.archivedAt ?? record.updatedAt,
    initiativeSummary: initiative?.description ?? record.summary,
    civicChallenge: initiative?.description ?? record.summary,
    implementationStory: [
      commitment?.commitmentSummary,
      tracking?.summary,
      updates.length > 0 ? updates.map((update) => update.summary).join(" ") : null,
    ]
      .filter(Boolean)
      .join(" "),
    verifiedPublicImpact: impact?.observedImpact ?? record.summary,
    lessonsLearned: structuredClone(record.lessonsLearned),
    knowledgeContribution: structuredClone(record.knowledgeContribution),
    historicalTimeline: buildHistoricalTimeline(record),
    references: structuredClone(record.references),
    authorDisplayName: await resolveDisplayName(record.authorId),
    stewardDisplayName: await resolveDisplayName(record.stewardId),
  };
}

export function computePublicCivicArchiveMetrics(): PublicCivicArchiveMetrics {
  const lifecycleMetrics = computeCivicArchiveLifecycleMetrics();

  return {
    archivedInitiativeCount: lifecycleMetrics.archivedInitiativeCount,
    archiveRecordCount: lifecycleMetrics.archiveRecordCount,
    countriesRepresented: lifecycleMetrics.countriesRepresented,
    regionsRepresented: lifecycleMetrics.regionsRepresented,
    communitiesRepresented: lifecycleMetrics.communitiesRepresented,
    activityAreasRepresented: lifecycleMetrics.activityAreasRepresented,
    verifiedImpactCount: lifecycleMetrics.verifiedImpactCount,
  };
}

export function listPublicCivicArchiveIndex(
  query: PublicCivicArchiveIndexQuery = {},
): CivicArchiveLifecycleRecord[] {
  return listCivicArchiveLifecycleRecords(query);
}

export async function getPublicCivicArchive(
  archiveRecordId: string,
): Promise<PublicCivicArchiveProjection | null> {
  const lifecycle = resolveCivicArchiveLifecycleRecord(archiveRecordId);

  if (!lifecycle) {
    return null;
  }

  const record = getArchiveRecordById(lifecycle.archiveRecordId);

  if (!record || record.status !== "published") {
    return null;
  }

  return await toPublicCivicArchiveProjection(record);
}

export async function getPublishedPublicCivicArchiveForImpact(
  impactId: string,
): Promise<PublicCivicArchiveProjection | null> {
  const record = listArchiveRecordsByImpact(impactId)
    .filter((item) => item.status === "published")
    .sort((left, right) => right.archivedVersion - left.archivedVersion)[0];

  return record ? await toPublicCivicArchiveProjection(record) : null;
}

export function listPublicCivicArchiveForInitiative(
  initiativeId: string,
): PublicCivicArchiveListItem[] {
  return listArchiveRecordsByInitiative(initiativeId)
    .filter((record) => record.status === "published")
    .sort((left, right) => (right.archivedAt ?? "").localeCompare(left.archivedAt ?? ""))
    .map((record) => toPublicListItem(record));
}

export async function getLatestPublishedPublicCivicArchiveForInitiative(
  initiativeId: string,
): Promise<PublicCivicArchiveProjection | null> {
  const record = listArchiveRecordsByInitiative(initiativeId)
    .filter((item) => item.status === "published")
    .sort((left, right) => right.archivedVersion - left.archivedVersion)[0];

  return record ? await toPublicCivicArchiveProjection(record) : null;
}
