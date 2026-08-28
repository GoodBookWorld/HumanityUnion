import type {
  PublicMemberParticipationArea,
  PublicMemberProfile,
  PublicMemberProfileHiddenSections,
  PublicParticipantStatistics,
} from "@hu/types";

import {
  PERSONAL_STATISTICS_CARDS,
  type PersonalStatisticsCardConfig,
} from "../personal-statistics/personal-statistics-cards.config";
import { MEMBER_BADGE_IMAGE_PATH } from "../membership/membership.constants";

/**
 * Profile UX Pack 03.2 Part 7 / Profile UX Pack 03.3 — pure, framework-free
 * presentation logic shared by both profile surfaces:
 *
 * - `/member/{publicName}` (public visitor mode);
 * - `/profile` (signed-in owner-preview mode).
 *
 * Relocated from `app/member/[uniqueName]/public-member-page-presentation.ts`
 * during Profile UX Pack 03.3 so neither route forks this logic. Extracted
 * so this behavior can be exercised with Node's built-in test runner,
 * matching the existing convention in this repo
 * (`discussion-comment-presentation.ts`) since `apps/web` has no React
 * component test harness (no vitest/jest/RTL).
 *
 * Launch Readiness UX Fix Pack 01 — identity ordering helpers, Participation
 * Area labels, and Member badge visibility stay projection-driven (never
 * re-decide Privacy on the Web).
 */
export interface PublicMemberStatisticCard extends PersonalStatisticsCardConfig {
  value: number;
}

/**
 * Preserves the exact key order defined by `PERSONAL_STATISTICS_CARDS`
 * (Initiatives, Collective Decisions, Allies, Proposals, Petitions,
 * Implementation Commitments) and omits any statistic the profile owner's
 * Privacy settings hide. Never invents a zero for a field that is absent
 * from the projection.
 */
export function buildVisibleStatisticCards(
  statistics: PublicParticipantStatistics | undefined,
): PublicMemberStatisticCard[] {
  if (!statistics) {
    return [];
  }

  return PERSONAL_STATISTICS_CARDS.filter((card) => statistics[card.key] !== undefined).map(
    (card) => ({
      ...card,
      value: statistics[card.key] as number,
    }),
  );
}

export function hasAnyStatistic(statistics: PublicParticipantStatistics | undefined): boolean {
  return buildVisibleStatisticCards(statistics).length > 0;
}

/**
 * Launch Readiness UX Fix Pack 01 — identity-body metadata is country only.
 * Pack 17F — Organization renders as its own public block (Pack 18C: left info card).
 */
export function buildIdentityMetaLines(profile: Pick<PublicMemberProfile, "country">): string[] {
  return [profile.country].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

export function resolveDisplayName(profile: Pick<PublicMemberProfile, "displayName">): string {
  return profile.displayName ?? "Participant";
}

export function hasVisibleSkills(profile: Pick<PublicMemberProfile, "skills">): boolean {
  return Boolean(profile.skills && profile.skills.length > 0);
}

export function hasVisibleProfessionalLinks(
  profile: Pick<
    PublicMemberProfile,
    "website" | "linkedinUrl" | "facebookUrl" | "youtubeUrl" | "instagramUrl" | "xUrl"
  >,
): boolean {
  return Boolean(
    profile.website ||
      profile.linkedinUrl ||
      profile.facebookUrl ||
      profile.youtubeUrl ||
      profile.instagramUrl ||
      profile.xUrl,
  );
}

export function hasVisibleRecentInitiatives(
  profile: Pick<PublicMemberProfile, "recentPublicInitiatives">,
): boolean {
  return Boolean(profile.recentPublicInitiatives && profile.recentPublicInitiatives.length > 0);
}

export function hasVisibleBiography(profile: Pick<PublicMemberProfile, "biography">): boolean {
  return Boolean(profile.biography && profile.biography.trim().length > 0);
}

export function hasVisibleOrganization(
  profile: Pick<PublicMemberProfile, "organization">,
): boolean {
  return Boolean(profile.organization && profile.organization.trim().length > 0);
}

/**
 * Builds compact Participation Area labels from the public projection only.
 * Never uses internal IDs. Order: community → region → country.
 */
export function buildParticipationAreaLabels(
  participationArea: PublicMemberParticipationArea | undefined,
): string[] {
  if (!participationArea) {
    return [];
  }

  return [participationArea.community, participationArea.region, participationArea.country].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

export function hasVisibleParticipationArea(
  profile: Pick<PublicMemberProfile, "participationArea">,
): boolean {
  return buildParticipationAreaLabels(profile.participationArea).length > 0;
}

/**
 * Honorary Member indicator uses the public projection
 * (`memberBadgeVisible` / `membershipStatus === "member"`), never activity,
 * rank, points, role, preview state, or account age.
 *
 * Canonical domain status is `active_member`. Pack 25A.1 — Member badge/status
 * is automatic for active Members with a Member Number; `membershipPubliclyVisible`
 * gates only Member Number exposure via `resolvePublicMembershipFields`.
 */
export function shouldShowMemberBadge(
  profile: Pick<PublicMemberProfile, "memberBadgeVisible" | "membershipStatus">,
): boolean {
  return profile.memberBadgeVisible === true || profile.membershipStatus === "member";
}

/** Previous public hero avatar diameter (px) — kept for regression contracts. */
export const PUBLIC_MEMBER_AVATAR_SIZE_PREVIOUS_PX = 88;

/** Public hero / Membership preview avatar diameter (+50% vs previous). */
export const PUBLIC_MEMBER_AVATAR_SIZE_PX = Math.round(PUBLIC_MEMBER_AVATAR_SIZE_PREVIOUS_PX * 1.5);

/** Mobile (≤480px) previous / current avatar diameters. */
export const PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PREVIOUS_PX = 76;
export const PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PX = Math.round(
  PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PREVIOUS_PX * 1.5,
);

/** Member badge ≈ 35–40% of avatar (0.375 midpoint). */
export const PUBLIC_MEMBER_INDICATOR_BADGE_RATIO = 0.375;

export const PUBLIC_MEMBER_BADGE_SRC = MEMBER_BADGE_IMAGE_PATH;
/** @deprecated Prefer MemberStatusIndicator — size is CSS-token driven. */
export const PUBLIC_MEMBER_BADGE_SIZE_PX = Math.round(
  PUBLIC_MEMBER_AVATAR_SIZE_PX * PUBLIC_MEMBER_INDICATOR_BADGE_RATIO,
);
export const PUBLIC_MEMBER_BADGE_ALT = "Member badge";
/**
 * Profile UX Pack 03.3 Part 5/8-11 — an owner-preview-only section is only
 * ever shown when Privacy is the reason a public visitor would see nothing
 * there. A section that is merely empty (the owner never added Skills, for
 * example) renders no notice at all, matching what a public visitor sees.
 */
export function shouldShowOwnerHiddenSectionNotice(
  hasVisibleContent: boolean,
  isHiddenByPrivacy: boolean | undefined,
): boolean {
  return !hasVisibleContent && Boolean(isHiddenByPrivacy);
}

export const NO_HIDDEN_SECTIONS: PublicMemberProfileHiddenSections = {
  statistics: false,
  biography: false,
  skills: false,
  professionalLinks: false,
  recentPublicInitiatives: false,
};
