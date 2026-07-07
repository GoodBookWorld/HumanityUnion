import type { ParticipationScope } from "./initiative-collective-decision.js";
import type { KnowledgeContribution, LessonsLearned } from "./public-civic-archive.js";

export interface PublicCivicArchiveReferenceLinks {
  initiativeId: string;
  initiativeVersion: number;
  decisionId: string;
  commitmentId: string;
  trackingId: string;
  impactId: string;
}

export interface PublicCivicArchiveTimelineEntry {
  eventId: string;
  label: string;
  occurredAt: string;
}

export interface PublicCivicArchiveProjection {
  archiveRecordId: string;
  initiativeId: string;
  impactId: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  participationScope: ParticipationScope;
  implementationPeriod: string;
  archivedStatus: "published";
  archivedVersion: number;
  archivedAt: string;
  initiativeSummary: string;
  civicChallenge: string;
  implementationStory: string;
  verifiedPublicImpact: string;
  lessonsLearned: LessonsLearned;
  knowledgeContribution: KnowledgeContribution;
  historicalTimeline: PublicCivicArchiveTimelineEntry[];
  references: PublicCivicArchiveReferenceLinks;
  authorDisplayName: string;
  stewardDisplayName: string;
}

export interface PublicCivicArchiveListItem {
  archiveRecordId: string;
  initiativeId: string;
  impactId: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  participationScope: ParticipationScope;
  implementationPeriod: string;
  archivedVersion: number;
  archivedAt: string;
  implementationYear: number;
}

export interface PublicCivicArchiveMetrics {
  archiveRecordCount: number;
  countriesRepresented: number;
  regionsRepresented: number;
  communitiesRepresented: number;
  activityAreasRepresented: number;
  verifiedImpactCount: number;
}
