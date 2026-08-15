import type { DirectMessagingPolicy } from "./direct-messaging.js";
import type { PublicParticipantStatistics } from "./participant-statistics.js";

/** Profile visibility for civic participant identity. */
export type MemberProfileVisibility = "public" | "members_only" | "private";

/** Participant profile lifecycle status. */
export type MemberProfileStatus = "active" | "suspended";

/** Mongo-backed civic participant profile (TASK-053). */
export interface MemberProfile {
  profileId: string;
  userId: string;
  memberNumber: string;
  createdAt: string;
  updatedAt: string;

  displayName: string;
  publicName: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  skills: string[];

  country?: string;
  region?: string;
  community?: string;

  participationAreaId?: string;
  participationVisibility: MemberProfileVisibility;

  language: string;
  timezone?: string;

  profileVisibility: MemberProfileVisibility;
  showOrganization: boolean;
  showLocation: boolean;
  showParticipationArea: boolean;
  membershipPubliclyVisible: boolean;
  skillsVisibility: MemberProfileVisibility;
  professionalLinksVisibility: MemberProfileVisibility;
  /**
   * Profile UX Pack 02 Part 5 — statistics visibility switches. Each
   * defaults to `true` (shown); disabling one only hides that number from
   * the Public Profile, it never changes the underlying calculation.
   */
  showInitiativesStatistics: boolean;
  showCollectiveDecisionsStatistics: boolean;
  showAlliesStatistics: boolean;
  /**
   * Profile UX Pack 03 Part 6 — "Who can message me?" Direct Collaboration
   * control. Defaults to `"active_allies"` for every profile, including
   * ones persisted before this pack existed (see `stripDocument`).
   */
  messagingPolicy: DirectMessagingPolicy;

  status: MemberProfileStatus;
}

export interface MemberProfilePrivacySettings {
  profileVisibility: MemberProfileVisibility;
  showOrganization: boolean;
  showLocation: boolean;
  showParticipationArea: boolean;
  participationVisibility: MemberProfileVisibility;
  membershipPubliclyVisible: boolean;
  skillsVisibility: MemberProfileVisibility;
  professionalLinksVisibility: MemberProfileVisibility;
  showInitiativesStatistics: boolean;
  showCollectiveDecisionsStatistics: boolean;
  showAlliesStatistics: boolean;
  messagingPolicy: DirectMessagingPolicy;
}

/**
 * Profile UX Pack 02 Part 9 — one row of the "Recent Public Initiatives"
 * compact list: title-only, clickable, no preview text, no pagination.
 */
export interface MemberProfilePublicRecentInitiative {
  initiativeId: string;
  title: string;
  href: string;
}

/**
 * Launch Readiness UX Fix Pack 01 — human-readable Participation Area labels
 * for public display. Present only when Privacy permits Participation Area
 * visibility and at least one label exists. Never exposes internal IDs.
 */
export interface PublicMemberParticipationArea {
  country?: string;
  region?: string;
  community?: string;
}

/** Safe public civic identity projection — never includes auth internals. */
export interface PublicMemberProfile {
  profileId: string;
  publicName: string;
  displayName?: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  skills?: string[];
  country?: string;
  region?: string;
  community?: string;
  participationAreaId?: string;
  /** Public Participation Area labels when visibility permits; omit when private/empty. */
  participationArea?: PublicMemberParticipationArea;
  membershipStatus?: "member" | "participant";
  memberNumber?: string;
  memberBadgeVisible?: boolean;
  /**
   * Profile UX Pack 02 Part 6/11 — present only when the profile owner's
   * Privacy statistics switches allow it (or the viewer is the owner).
   * Absent entirely (not zeros) when nothing is permitted to show.
   */
  statistics?: PublicParticipantStatistics;
  /** Profile UX Pack 02 Part 9 — omitted entirely when there are none. */
  recentPublicInitiatives?: MemberProfilePublicRecentInitiative[];
  /**
   * Profile UX Pack 03 Part 7 — server-computed Message-button state.
   * `"available"` shows an active Message action; `"unavailable"` shows
   * neutral static text (authenticated viewer, but blocked by Privacy);
   * `"hidden"` renders nothing at all (guest viewer, or the profile owner
   * viewing their own profile). Never reveals the exact blocking reason.
   */
  messagingAvailability: PublicMemberProfileMessagingAvailability;
}

export type PublicMemberProfileMessagingAvailability = "available" | "unavailable" | "hidden";

/**
 * Profile UX Pack 03.3 — per-section flags for the signed-in owner's
 * "Public Profile Preview" (`/profile`). `true` means the owner has real
 * content for that section, but their current Privacy settings keep it out
 * of `MemberProfilePublicPreview.profile` (the same public-facing
 * projection `/member/{publicName}` renders). Never `true` merely because
 * the section is empty — an owner who never added Skills sees no notice at
 * all, exactly like a public visitor sees no Skills section. Only the
 * owner-preview surface reads this; public visitors never receive it.
 */
export interface PublicMemberProfileHiddenSections {
  statistics: boolean;
  biography: boolean;
  skills: boolean;
  professionalLinks: boolean;
  recentPublicInitiatives: boolean;
}

/**
 * Profile UX Pack 03.3 — response of the owner-only "what will other
 * Participants see" preview endpoint. `profile` is the exact same
 * `PublicMemberProfile` shape (and built from the exact same projection
 * pipeline) the real `/member/{publicName}` route returns for an
 * authenticated, non-owner viewer — no separate Privacy logic exists for
 * this preview.
 */
export interface MemberProfilePublicPreview {
  profile: PublicMemberProfile;
  hiddenSections: PublicMemberProfileHiddenSections;
}
