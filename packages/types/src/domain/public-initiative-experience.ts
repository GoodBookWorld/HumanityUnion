import type { InitiativeStatus } from "./initiative.js";
import type { PublicCommentAuthor } from "./initiative-comment.js";
import type { PublicInitiativeProjection } from "./public-initiative.js";
import type { PublicInitiativeWithVersionHistory } from "./public-initiative-version-revision.js";
import type { WorldInitiativeCardProjection } from "./public-world-initiatives.js";

/** Shared transparency note for initiative support signals. */
export const INITIATIVE_SUPPORT_TRANSPARENCY_NOTE =
  "Support signals are statistical indicators and do not change vote weight or create authority.";

export type InitiativeExperienceLifecycleStageState =
  "completed" | "current" | "upcoming" | "not_applicable" | "unavailable";

export type InitiativeSupportSignalKind = "like" | "dislike" | "none";

export type InitiativeSupportAudienceKind = "participants" | "members" | "visitors";

export interface PublicInitiativeExperienceStageDefinition {
  stageId: string;
  label: string;
  hash: string;
}

/** Ordered lifecycle stages for the single-initiative public experience. */
export const PUBLIC_INITIATIVE_EXPERIENCE_STAGES: readonly PublicInitiativeExperienceStageDefinition[] =
  [
    { stageId: "initiative", label: "Initiative", hash: "initiative" },
    {
      stageId: "analysis",
      label: "Collaborative Analysis",
      hash: "collaborative-analysis",
    },
    {
      stageId: "proposal",
      label: "Improvement Proposals",
      hash: "improvement-proposals",
    },
    { stageId: "revision", label: "Revision", hash: "revision" },
    { stageId: "petition", label: "Petition", hash: "petition" },
    {
      stageId: "decision_session",
      label: "Decision Session",
      hash: "decision-session",
    },
    {
      stageId: "collective_decision",
      label: "Collective Decision",
      hash: "collective-decision",
    },
    {
      stageId: "commitment",
      label: "Implementation Commitments",
      hash: "implementation-commitments",
    },
    {
      stageId: "tracking",
      label: "Implementation Tracking",
      hash: "implementation-tracking",
    },
    {
      stageId: "official_response",
      label: "Official Responses",
      hash: "official-responses",
    },
    { stageId: "public_impact", label: "Public Impact", hash: "public-impact" },
    { stageId: "archive", label: "Civic Archive", hash: "civic-archive" },
  ] as const;

export interface PublicInitiativeLifecycleStageNavItem {
  stageId: string;
  label: string;
  hash: string;
  state: InitiativeExperienceLifecycleStageState;
  stateLabel: string;
  recordCount: number;
}

export interface PublicInitiativeLifecycleRecordItem {
  recordId: string;
  title: string;
  summary?: string;
  status?: string;
  updatedAt: string;
  publicHref?: string;
  authorDisplayName?: string;
  detail?: string;
}

export interface PublicInitiativeLifecycleStageContent {
  stageId: string;
  records: PublicInitiativeLifecycleRecordItem[];
  emptyStateMessage: string;
}

export interface InitiativeSupportAudienceBreakdown {
  total: number;
  participants: number;
  members: number;
  visitors: number;
}

export interface PublicInitiativeSupportStatistics {
  likes: InitiativeSupportAudienceBreakdown;
  dislikes: InitiativeSupportAudienceBreakdown;
  bookmarks: {
    total: number;
    available: boolean;
  };
  views: {
    total: number;
    available: boolean;
  };
  transparencyNote: string;
  currentUserSignal: InitiativeSupportSignalKind;
  currentUserBookmarked: boolean;
  visitorSignalsAvailable: boolean;
}

export interface PublicInitiativeRelatedCivicRecord {
  recordType: string;
  recordId: string;
  title: string;
  status: string;
  updatedAt: string;
  publicHref: string;
}

export interface PublicInitiativeDiscussionComment {
  commentId: string;
  author: PublicCommentAuthor;
  /** Mirrors author.displayName for backward-compatible consumers. */
  authorDisplayName: string;
  body: string;
  createdAt: string;
  replyCount: number;
  likes: number;
  dislikes: number;
  currentUserReaction?: "like" | "dislike" | "none";
}

export interface PublicInitiativeDiscussionSummary {
  commentCount: number;
  initialComments: PublicInitiativeDiscussionComment[];
  hasMoreComments: boolean;
  canComment: boolean;
  requiresLogin: boolean;
  commentsAvailable: boolean;
  /** When shown on analysis pages, clarifies comment scope. */
  discussionScopeLabel?: string;
}

export interface PublicInitiativeExperienceGeography {
  country?: string;
  region?: string;
  city?: string;
  activityArea: string;
  /** Canonical formatted label: City · Region · Country, etc. */
  label: string;
}

export interface PublicInitiativeExperienceHero {
  title: string;
  summary: string;
  activityArea: string;
  geography: PublicInitiativeExperienceGeography;
  status: InitiativeStatus;
  currentStageLabel: string;
  firstPublishedAt: string;
  lastUpdatedAt: string;
  imageUrl?: string;
  imageAltText?: string;
  stewardDisplayName: string;
}

export interface PublicInitiativeExperienceProjection {
  initiativeId: string;
  hero: PublicInitiativeExperienceHero;
  initiative: PublicInitiativeProjection;
  currentStageId: string;
  lifecycleStages: PublicInitiativeLifecycleStageNavItem[];
  stageContent: PublicInitiativeLifecycleStageContent[];
  supportStatistics: PublicInitiativeSupportStatistics;
  revisionHistory: PublicInitiativeWithVersionHistory;
  relatedCivicRecords: PublicInitiativeRelatedCivicRecord[];
  latestInitiatives: WorldInitiativeCardProjection[];
  discussion: PublicInitiativeDiscussionSummary;
  generatedAt: string;
}

export interface InitiativeSupportSignalInput {
  signal: Exclude<InitiativeSupportSignalKind, "none">;
}
