import type { VerificationLevel } from "@hu/types";

export const WORKSPACE_PROJECTION_SCHEMA_VERSION = 1 as const;

export type WorkspaceProjectionStatus = "materialized" | "pending";

/** Denormalized Member summary embedded in the Workspace read model. */
export interface WorkspaceMemberSummary {
  displayName: string;
  uniqueName: string;
  verificationLevel: VerificationLevel;
}

/** Lightweight card shown on Workspace overview — not the Activity or Discussion aggregate. */
export interface WorkspaceRecentActivityCard {
  activityId: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEventId: string;
  discussionId?: string;
  proposalId?: string;
  decisionId?: string;
  referenceType?: "activity" | "discussion" | "proposal" | "decision";
}

export type WorkspaceRecentActivities = WorkspaceRecentActivityCard[];

export const WORKSPACE_MAX_RECENT_ACTIVITIES = 10 as const;

/** Participation Summary — derived civic orientation counts (Blueprint 09 §4). */
export interface WorkspaceParticipationSummary {
  activeActivityCount: number;
  awaitingMemberActionCount: number;
  completedActivityCount: number;
}

/** Persisted Workspace projection document — read model only. */
export interface WorkspaceProjectionRecord {
  workspaceId: string;
  memberId: string;
  memberSummary: WorkspaceMemberSummary;
  participationSummary: WorkspaceParticipationSummary;
  recentActivities: WorkspaceRecentActivities;
  nextActions: [];
  sourceEventId: string;
  sourceCorrelationId: string | null;
  projectionVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** API/query DTO returned by the canonical Workspace endpoint. */
export interface WorkspaceOverviewDto {
  workspaceId: string;
  memberId: string;
  projectionStatus: WorkspaceProjectionStatus;
  memberSummary: WorkspaceMemberSummary;
  participationSummary: WorkspaceParticipationSummary;
  recentActivities: WorkspaceRecentActivities;
  nextActions: [];
  projectionVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export function buildWorkspaceId(memberId: string): string {
  return `workspace:${memberId}`;
}

export function createEmptyParticipationSummary(): WorkspaceParticipationSummary {
  return {
    activeActivityCount: 0,
    awaitingMemberActionCount: 0,
    completedActivityCount: 0,
  };
}
