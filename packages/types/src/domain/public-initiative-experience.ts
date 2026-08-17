import type { InitiativeStatus } from "./initiative.js";
import type { InitiativeCoverMedia } from "./initiative-cover-media.js";
import type { PublicCommentAuthor } from "./initiative-comment.js";
import type { PublicCommentCollaborationState } from "./initiative-discussion-collaboration.js";
import type { InitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";
import type { PublicInitiativeProjection } from "./public-initiative.js";
import type { PublicInitiativeWithVersionHistory } from "./public-initiative-version-revision.js";
import type { CommunityInitiativeRelationshipProjection } from "./community-intelligence.js";
import type { WorldInitiativeCardProjection } from "./public-world-initiatives.js";

/** Shared transparency note for initiative support signals. */
export const INITIATIVE_SUPPORT_TRANSPARENCY_NOTE =
  "Support signals are statistical indicators and do not change vote weight or create authority.";

/**
 * Lifecycle UX Completion Pack 02 — visual progress vocabulary for the
 * Lifecycle menu. Derived from publication metadata + registry order;
 * never a hardcoded per-stage UI enum.
 */
export type InitiativeExperienceLifecycleStageState =
  | "not_started"
  | "in_progress"
  | "draft_saved"
  | "preview"
  | "published"
  | "completed"
  | "archived"
  | "not_applicable"
  | "unavailable";

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
    { stageId: "discussion", label: "Discussion", hash: "discussion" },
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
  /**
   * UX Evolution Pack 02 — present once the collaboration module is wired in;
   * absent means the caller did not compute it (never a broken/partial state).
   */
  collaboration?: PublicCommentCollaborationState;
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
  /** UX Evolution Pack 03 — public-safe (verificationReasonCode always stripped); approved media only. */
  coverMedia?: InitiativeCoverMedia;
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
  /** Community Intelligence Pack 01 — explainable related Initiatives (public, non-personalized). */
  relatedInitiatives: readonly CommunityInitiativeRelationshipProjection[];
  discussion: PublicInitiativeDiscussionSummary;
  /**
   * Phase 02 addendum — public-safe optional-section health.
   * Never includes raw infrastructure error messages.
   */
  optionalStageDiagnostics?: PublicInitiativeOptionalStageDiagnostics;
  /**
   * Phase 03 — LifecycleProfile on the Experience shell (configuration, not progress).
   * Missing → STANDARD at resolve time.
   */
  lifecycleProfile?: InitiativeLifecycleProfile;
  /**
   * Phase 03 — true when the authenticated viewer is the Initiative steward.
   * Author Mode eligibility must use this (or owner route), never Allies success.
   */
  viewerIsSteward?: boolean;
  generatedAt: string;
}

/**
 * Distinguishes normal absence from optional-section degradation.
 * `unavailable` means the section failed to load (infrastructure), not that
 * the artifact was never created.
 */
export type PublicInitiativeOptionalStageHealth = "ok" | "absent" | "unavailable";

export type PublicInitiativeOptionalStageReasonCode =
  | "not_created_yet"
  | "infrastructure_failure";

export interface PublicInitiativeOptionalStageDiagnostic {
  readonly health: PublicInitiativeOptionalStageHealth;
  readonly reasonCode?: PublicInitiativeOptionalStageReasonCode;
}

export interface PublicInitiativeOptionalStageDiagnostics {
  readonly petition?: PublicInitiativeOptionalStageDiagnostic;
  readonly civicArchive?: PublicInitiativeOptionalStageDiagnostic;
}

export interface InitiativeSupportSignalInput {
  signal: Exclude<InitiativeSupportSignalKind, "none">;
}
