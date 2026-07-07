import type {
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
import { getMemberById } from "../member/member.store.js";
import {
  getArchiveRecordById,
  listArchiveRecordsByImpact,
  listArchiveRecordsByInitiative,
  listPublishedArchiveRecords,
} from "./public-civic-archive.store.js";

export interface PublicCivicArchiveIndexQuery {
  search?: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  implementationYear?: number;
}

function resolveDisplayName(participantId: string): string {
  const member = getMemberById(participantId);

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

export function toPublicCivicArchiveProjection(
  record: PublicCivicArchiveRecord,
): PublicCivicArchiveProjection {
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
    authorDisplayName: resolveDisplayName(record.authorId),
    stewardDisplayName: resolveDisplayName(record.stewardId),
  };
}

export function computePublicCivicArchiveMetrics(): PublicCivicArchiveMetrics {
  const records = listPublishedArchiveRecords();
  const unique = <T>(values: T[]): number => new Set(values).size;

  return {
    archiveRecordCount: records.length,
    countriesRepresented: unique(records.map((record) => record.country)),
    regionsRepresented: unique(records.map((record) => record.region)),
    communitiesRepresented: unique(records.map((record) => record.community)),
    activityAreasRepresented: unique(records.map((record) => record.activityArea)),
    verifiedImpactCount: unique(records.map((record) => record.impactId)),
  };
}

function matchesQuery(
  record: PublicCivicArchiveRecord,
  query: PublicCivicArchiveIndexQuery,
): boolean {
  const search = query.search?.trim().toLowerCase();

  if (search) {
    const haystack =
      `${record.title} ${record.summary} ${record.community} ${record.activityArea}`.toLowerCase();

    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (query.country && record.country !== query.country) {
    return false;
  }

  if (query.region && record.region !== query.region) {
    return false;
  }

  if (query.community && record.community !== query.community) {
    return false;
  }

  if (query.activityArea && record.activityArea !== query.activityArea) {
    return false;
  }

  if (query.implementationYear) {
    const year = new Date(record.archivedAt ?? record.updatedAt).getFullYear();

    if (year !== query.implementationYear) {
      return false;
    }
  }

  return true;
}

export function listPublicCivicArchiveIndex(
  query: PublicCivicArchiveIndexQuery = {},
): PublicCivicArchiveListItem[] {
  return listPublishedArchiveRecords()
    .filter((record) => matchesQuery(record, query))
    .map((record) => toPublicListItem(record));
}

export function getPublicCivicArchive(
  archiveRecordId: string,
): PublicCivicArchiveProjection | null {
  const record = getArchiveRecordById(archiveRecordId);

  if (!record || record.status !== "published") {
    return null;
  }

  return toPublicCivicArchiveProjection(record);
}

export function getPublishedPublicCivicArchiveForImpact(
  impactId: string,
): PublicCivicArchiveProjection | null {
  const record = listArchiveRecordsByImpact(impactId)
    .filter((item) => item.status === "published")
    .sort((left, right) => right.archivedVersion - left.archivedVersion)[0];

  return record ? toPublicCivicArchiveProjection(record) : null;
}

export function listPublicCivicArchiveForInitiative(
  initiativeId: string,
): PublicCivicArchiveListItem[] {
  return listArchiveRecordsByInitiative(initiativeId)
    .filter((record) => record.status === "published")
    .sort((left, right) => (right.archivedAt ?? "").localeCompare(left.archivedAt ?? ""))
    .map((record) => toPublicListItem(record));
}

export function getLatestPublishedPublicCivicArchiveForInitiative(
  initiativeId: string,
): PublicCivicArchiveProjection | null {
  const record = listArchiveRecordsByInitiative(initiativeId)
    .filter((item) => item.status === "published")
    .sort((left, right) => right.archivedVersion - left.archivedVersion)[0];

  return record ? toPublicCivicArchiveProjection(record) : null;
}
