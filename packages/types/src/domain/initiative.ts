import type { InitiativeLifecyclePhase } from "./initiative-lifecycle.js";
import type { InitiativeLifecycleProfile } from "./initiative-lifecycle-profile.js";
import type { ParticipationScope } from "./initiative-collective-decision.js";
import type { MemberId } from "./member.js";
import type { InitiativeNewsSourceReference } from "./public-news-article.js";
import type { InitiativeCoverMedia } from "./initiative-cover-media.js";

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
  /**
   * Optional initiative image URL from authenticated media upload.
   * Legacy field, retained for backward compatibility with existing
   * initiatives and API clients. UX Evolution Pack 03 — kept in sync with
   * `coverMedia` when `coverMedia.type === "image"`; see
   * `resolveInitiativeCoverMedia` and `initiative.service.ts`.
   */
  imageUrl?: string;
  /** Optional image alt text for accessibility. */
  imageAltText?: string;
  /**
   * UX Evolution Pack 03 — Initiative Cover Media. Additive: existing
   * initiatives simply omit this field and continue to work off `imageUrl`
   * alone via `resolveInitiativeCoverMedia`.
   */
  coverMedia?: InitiativeCoverMedia;
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
  /**
   * Lifecycle Finalization Phase 02 — selects the allowed Stage Registry route.
   * Missing on historical Initiatives → treated as STANDARD.
   */
  lifecycleProfile?: InitiativeLifecycleProfile;
  visibility: InitiativeVisibility;
  metadata: InitiativeMetadata;
  revisions: InitiativeRevision[];
  contributions: InitiativeContribution[];
  timeline: TimelineEvent[];
  sourceReferences?: InitiativeNewsSourceReference[];
}

/**
 * Communication UX Pack 03.9 — one row in the signed-in Participant's
 * "Initiative Group Chat" picker: an Initiative they either steward
 * ("author") or currently collaborate on as an `active` Ally
 * ("active_ally"). This is a thin composition over two already-existing
 * reads (`listInitiativesBySteward` + active `InitiativeAlly` rows) — never
 * a new persisted projection, so it can never drift from the source of
 * truth for either role.
 */
export type MyInitiativeGroupRole = "author" | "active_ally";

export interface MyInitiativeGroupSummary {
  initiativeId: InitiativeId;
  title: InitiativeTitle;
  lifecyclePhase: InitiativeLifecyclePhase;
  role: MyInitiativeGroupRole;
}
