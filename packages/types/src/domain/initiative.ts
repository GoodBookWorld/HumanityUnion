import type { InitiativeLifecyclePhase } from "./initiative-lifecycle.js";
import type { ParticipationScope } from "./initiative-collective-decision.js";
import type { MemberId } from "./member.js";
import type { InitiativeNewsSourceReference } from "./public-news-article.js";

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
  /** Canonical ISO-style country slug for search and geographic discovery. */
  countrySlug?: string;
  /** Canonical first-level region slug for search and geographic discovery. */
  regionSlug?: string;
  /** Bootstrap community slug associated with this initiative. */
  communitySlug: string;
  /** Optional descriptive community or organization association entered by the steward. */
  communityAssociation?: string;
  /** Canonical participation scope for public discovery and eligibility. */
  participationScope?: ParticipationScope;
  activityArea: string;
  /** Supplemental activity area label when activityArea is Other. */
  activityAreaOther?: string;
  /** Optional initiative image URL from authenticated media upload. */
  imageUrl?: string;
  /** Optional image alt text for accessibility. */
  imageAltText?: string;
  /** Optional initiative start date (ISO 8601 date). */
  startDate?: string;
  /** Optional initiative completion date (ISO 8601 date). */
  completionDate?: string;
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
  sourceReferences?: InitiativeNewsSourceReference[];
}
