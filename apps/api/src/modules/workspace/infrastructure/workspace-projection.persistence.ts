import type { Document } from "mongodb";

import type { MemberRegisteredPayload } from "../../member/domain/member-registered.event.js";
import {
  buildWorkspaceId,
  createEmptyParticipationSummary,
  WORKSPACE_PROJECTION_SCHEMA_VERSION,
  type WorkspaceOverviewDto,
  type WorkspaceProjectionRecord,
  type WorkspaceRecentActivities,
  type WorkspaceRecentActivityCard,
  WORKSPACE_MAX_RECENT_ACTIVITIES,
} from "../domain/workspace-projection.types.js";

export interface WorkspaceProjectionMongoDocument extends Document {
  workspaceId: string;
  memberId: string;
  memberSummary: WorkspaceProjectionRecord["memberSummary"];
  participationSummary: WorkspaceProjectionRecord["participationSummary"];
  recentActivities: WorkspaceRecentActivities;
  nextActions: [];
  sourceEventId: string;
  sourceCorrelationId: string | null;
  projectionVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function buildWorkspaceProjectionFromMemberRegistered(input: {
  payload: MemberRegisteredPayload;
  eventId: string;
  correlationId: string | null;
  occurredAt: string;
}): WorkspaceProjectionRecord {
  const timestamp = input.occurredAt;

  return {
    workspaceId: buildWorkspaceId(input.payload.memberId),
    memberId: input.payload.memberId,
    memberSummary: {
      displayName: input.payload.displayName,
      uniqueName: input.payload.uniqueName,
      verificationLevel: input.payload.verificationLevel,
    },
    participationSummary: createEmptyParticipationSummary(),
    recentActivities: [],
    nextActions: [],
    sourceEventId: input.eventId,
    sourceCorrelationId: input.correlationId,
    projectionVersion: WORKSPACE_PROJECTION_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildWorkspaceRecentActivityCard(input: {
  activityId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEventId: string;
}): WorkspaceRecentActivityCard {
  return {
    activityId: input.activityId,
    title: input.title,
    status: input.status,
    createdAt: input.createdAt,
    sourceEventId: input.sourceEventId,
  };
}

export function prependRecentActivityCard(
  existing: WorkspaceRecentActivities,
  card: WorkspaceRecentActivityCard,
): WorkspaceRecentActivities {
  const withoutDuplicate = existing.filter((entry) => {
    if (card.proposalId && entry.proposalId) {
      return entry.proposalId !== card.proposalId;
    }

    if (card.decisionId && entry.decisionId) {
      return entry.decisionId !== card.decisionId;
    }

    if (card.discussionId && entry.discussionId) {
      return entry.discussionId !== card.discussionId;
    }

    return entry.activityId !== card.activityId || entry.referenceType !== card.referenceType;
  });
  return [card, ...withoutDuplicate].slice(0, WORKSPACE_MAX_RECENT_ACTIVITIES);
}

export function buildWorkspaceRecentDiscussionCard(input: {
  activityId: string;
  discussionId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEventId: string;
}): WorkspaceRecentActivityCard {
  return {
    activityId: input.activityId,
    discussionId: input.discussionId,
    referenceType: "discussion",
    title: input.title,
    status: input.status,
    createdAt: input.createdAt,
    sourceEventId: input.sourceEventId,
  };
}

export function buildWorkspaceRecentProposalCard(input: {
  activityId: string;
  proposalId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEventId: string;
}): WorkspaceRecentActivityCard {
  return {
    activityId: input.activityId,
    proposalId: input.proposalId,
    referenceType: "proposal",
    title: input.title,
    status: input.status,
    createdAt: input.createdAt,
    sourceEventId: input.sourceEventId,
  };
}

export function buildWorkspaceRecentDecisionCard(input: {
  activityId: string;
  proposalId: string;
  decisionId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEventId: string;
}): WorkspaceRecentActivityCard {
  return {
    activityId: input.activityId,
    proposalId: input.proposalId,
    decisionId: input.decisionId,
    referenceType: "decision",
    title: input.title,
    status: input.status,
    createdAt: input.createdAt,
    sourceEventId: input.sourceEventId,
  };
}

export function toWorkspaceProjectionMongoDocument(
  record: WorkspaceProjectionRecord,
): WorkspaceProjectionMongoDocument {
  return {
    workspaceId: record.workspaceId,
    memberId: record.memberId,
    memberSummary: { ...record.memberSummary },
    participationSummary: { ...record.participationSummary },
    recentActivities: [...record.recentActivities],
    nextActions: [],
    sourceEventId: record.sourceEventId,
    sourceCorrelationId: record.sourceCorrelationId,
    projectionVersion: record.projectionVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromWorkspaceProjectionMongoDocument(
  document: WorkspaceProjectionMongoDocument,
): WorkspaceProjectionRecord {
  return {
    workspaceId: document.workspaceId,
    memberId: document.memberId,
    memberSummary: { ...document.memberSummary },
    participationSummary: { ...document.participationSummary },
    recentActivities: [...document.recentActivities],
    nextActions: [],
    sourceEventId: document.sourceEventId,
    sourceCorrelationId: document.sourceCorrelationId,
    projectionVersion: document.projectionVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toWorkspaceOverviewDto(
  record: WorkspaceProjectionRecord,
): WorkspaceOverviewDto {
  return {
    workspaceId: record.workspaceId,
    memberId: record.memberId,
    projectionStatus: "materialized",
    memberSummary: { ...record.memberSummary },
    participationSummary: { ...record.participationSummary },
    recentActivities: [...record.recentActivities],
    nextActions: [],
    projectionVersion: record.projectionVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toPendingWorkspaceOverviewDto(input: {
  memberId: string;
  memberSummary: WorkspaceProjectionRecord["memberSummary"];
}): WorkspaceOverviewDto {
  const timestamp = new Date().toISOString();

  return {
    workspaceId: buildWorkspaceId(input.memberId),
    memberId: input.memberId,
    projectionStatus: "pending",
    memberSummary: { ...input.memberSummary },
    participationSummary: createEmptyParticipationSummary(),
    recentActivities: [],
    nextActions: [],
    projectionVersion: WORKSPACE_PROJECTION_SCHEMA_VERSION,
    createdAt: null,
    updatedAt: timestamp,
  };
}
