import type { InitiativeLifecyclePhase } from "./initiative-lifecycle.js";
import type { MemberId } from "./member.js";

export type InitiativeId = string;

export type RevisionId = string;

export type ContributionId = string;

export type TimelineEventId = string;

export type InitiativeTitle = string;

export type InitiativeDescription = string;

export type InitiativeStatus =
  | "draft"
  | "proposal"
  | "discussion"
  | "revision"
  | "ready_for_poll"
  | "poll"
  | "petition"
  | "implementation"
  | "completed"
  | "archived"
  | "revived"
  | "superseded"
  | "merged";

export type InitiativeVisibilityPolicy = "steward_only" | "public";

export interface InitiativeVisibility {
  policy: InitiativeVisibilityPolicy;
}

export interface InitiativeMetadata {
  category: string;
  tags: string[];
  region: string;
  language: string;
  /** Bootstrap community slug associated with this initiative. */
  communitySlug: string;
  activityArea: string;
}

export interface InitiativeRevision {
  revisionId: RevisionId;
  authorId: MemberId;
  revisionNumber: number;
  summary: string;
  createdAt: string;
}

export type InitiativeContributionType = string;

export interface InitiativeContribution {
  contributionId: ContributionId;
  memberId: MemberId;
  contributionType: InitiativeContributionType;
  timestamp: string;
}

export interface TimelineEvent {
  eventId: TimelineEventId;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface Initiative {
  initiativeId: InitiativeId;
  stewardId: MemberId;
  createdAt: string;
  updatedAt: string;
  title: InitiativeTitle;
  description: InitiativeDescription;
  status: InitiativeStatus;
  lifecyclePhase: InitiativeLifecyclePhase;
  visibility: InitiativeVisibility;
  metadata: InitiativeMetadata;
  revisions: InitiativeRevision[];
  contributions: InitiativeContribution[];
  timeline: TimelineEvent[];
}
