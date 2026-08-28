/**
 * Membership public-profile preview + honorary Member indicator contracts.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PREVIOUS_PX,
  PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PX,
  PUBLIC_MEMBER_AVATAR_SIZE_PREVIOUS_PX,
  PUBLIC_MEMBER_AVATAR_SIZE_PX,
  PUBLIC_MEMBER_BADGE_SRC,
  PUBLIC_MEMBER_INDICATOR_BADGE_RATIO,
  shouldShowMemberBadge,
} from "./participant-profile-surface-presentation.js";
import {
  MEMBER_STATUS_INDICATOR_BADGE_SRC,
  MEMBER_STATUS_INDICATOR_LABEL,
} from "./member-status-indicator.constants.js";
import { MEMBER_BADGE_IMAGE_PATH } from "../membership/membership.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Member public profile preview + honorary Member indicator", () => {
  it("1 — Membership preview uses public-profile identity styling/contract", () => {
    const preview = read("features/membership/components/MembershipPublicDisplayPreview.tsx");
    assert.match(preview, /public-member-page__hero/);
    assert.match(preview, /public-member-page__identity/);
    assert.match(preview, /public-member-page__identity-body/);
    assert.match(preview, /public-member-page__identity-text/);
    assert.match(preview, /membership-public-preview/);
  });

  it("2 — preview uses current avatar", () => {
    const preview = read("features/membership/components/MembershipPublicDisplayPreview.tsx");
    const section = read("features/membership/components/MembershipProfileSection.tsx");
    assert.match(preview, /avatarUrl/);
    assert.match(preview, /PUBLIC_MEMBER_AVATAR_SIZE_PX/);
    assert.match(section, /avatarUrl=\{profile\.avatarUrl\}/);
  });

  it("3 — avatar is approximately 50% larger than previous public-profile size", () => {
    assert.equal(PUBLIC_MEMBER_AVATAR_SIZE_PREVIOUS_PX, 88);
    assert.equal(PUBLIC_MEMBER_AVATAR_SIZE_PX, 132);
    assert.equal(PUBLIC_MEMBER_AVATAR_SIZE_PX / PUBLIC_MEMBER_AVATAR_SIZE_PREVIOUS_PX, 1.5);
    assert.equal(PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PREVIOUS_PX, 76);
    assert.equal(PUBLIC_MEMBER_AVATAR_SIZE_MOBILE_PX, 114);
    const css = read("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /--public-member-avatar-size:\s*132px/);
    assert.match(css, /--public-member-avatar-size:\s*114px/);
  });

  it("4 — preview and real profile share Member indicator component", () => {
    const preview = read("features/membership/components/MembershipPublicDisplayPreview.tsx");
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(preview, /MemberStatusIndicator/);
    assert.match(surface, /MemberStatusIndicator/);
  });

  it("5 — badge asset is membership/member-badge.webp (canonical public path)", () => {
    assert.equal(MEMBER_BADGE_IMAGE_PATH, "/illustrations/membership/member-badge.webp");
    assert.equal(MEMBER_STATUS_INDICATOR_BADGE_SRC, MEMBER_BADGE_IMAGE_PATH);
    assert.equal(PUBLIC_MEMBER_BADGE_SRC, MEMBER_BADGE_IMAGE_PATH);
    assert.match(MEMBER_BADGE_IMAGE_PATH, /\/membership\/member-badge\.webp$/);
    assert.ok(
      existsSync(path.join(webRoot, "public/illustrations/membership/member-badge.webp")),
    );
  });

  it("6 — Member indicator is one horizontal row", () => {
    const css = read("features/member-profile/components/member-status-indicator.css");
    assert.match(css, /\.member-status-indicator\s*\{[^}]*display:\s*inline-flex/s);
    assert.match(css, /flex-direction:\s*row/);
    const indicator = read("features/member-profile/components/MemberStatusIndicator.tsx");
    assert.match(indicator, /member-status-indicator__badge/);
    assert.match(indicator, /member-status-indicator__label/);
  });

  it("7 — Member indicator sits below public-member-page__identity-text", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    const identityTextIdx = surface.indexOf('public-member-page__identity-text');
    const indicatorIdx = surface.indexOf("<MemberStatusIndicator");
    assert.ok(identityTextIdx > 0);
    assert.ok(indicatorIdx > identityTextIdx);
    assert.match(surface, /identity-main[\s\S]*identity-text[\s\S]*MemberStatusIndicator/s);
  });

  it("8 — Member badge is approximately 35–40% of avatar size", () => {
    assert.ok(PUBLIC_MEMBER_INDICATOR_BADGE_RATIO >= 0.35);
    assert.ok(PUBLIC_MEMBER_INDICATOR_BADGE_RATIO <= 0.4);
    const css = read("features/member-profile/components/member-status-indicator.css");
    assert.match(css, /\*\s*0\.375/);
    const surfaceCss = read("features/member-profile/components/participant-profile-surface.css");
    assert.match(surfaceCss, /--public-member-indicator-badge-size:\s*calc\(var\(--public-member-avatar-size\)\s*\*\s*0\.375\)/);
  });

  it("9 — label exactly Member", () => {
    assert.equal(MEMBER_STATUS_INDICATOR_LABEL, "Member");
    const indicator = read("features/member-profile/components/MemberStatusIndicator.tsx");
    assert.match(indicator, />\{MEMBER_STATUS_INDICATOR_LABEL\}</);
  });

  it("10 — preview may show future Member state without mutating domain status", () => {
    const preview = read("features/membership/components/MembershipPublicDisplayPreview.tsx");
    const section = read("features/membership/components/MembershipProfileSection.tsx");
    assert.match(preview, /previewMemberStatus/);
    assert.match(preview, /Presentation-only/);
    assert.match(preview, /isActiveMember/);
    assert.match(section, /previewMemberStatus=\{!isActiveMember\}/);
    assert.match(section, /isActiveMember=\{isActiveMember\}/);
    assert.doesNotMatch(section, /status:\s*"active_member"/);
  });

  it("10b — Pack 25A.1 preview copy: badge automatic; number privacy separate", () => {
    const preview = read("features/membership/components/MembershipPublicDisplayPreview.tsx");
    assert.match(preview, /Member status appears automatically/);
    assert.match(preview, /Member Number stays private/);
    assert.match(preview, /future Member status/);
    const constants = read("features/membership/membership.constants.ts");
    assert.match(constants, /Show my Member Number publicly/);
    assert.doesNotMatch(constants, /Publicly display my Member status/);
  });

  it("11 — non-Member public profile does NOT render indicator", () => {
    assert.equal(
      shouldShowMemberBadge({ memberBadgeVisible: false, membershipStatus: "participant" }),
      false,
    );
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /showMemberBadge \? \(/);
    assert.match(surface, /shouldShowMemberBadge\(profile\)/);
  });

  it("12 — real Member public profile DOES render indicator", () => {
    assert.equal(
      shouldShowMemberBadge({ memberBadgeVisible: true, membershipStatus: "member" }),
      true,
    );
    assert.equal(
      shouldShowMemberBadge({ memberBadgeVisible: false, membershipStatus: "member" }),
      true,
    );
  });

  it("12b — Pack 25A.1 shared MemberStatusIndicator reused; no second flag", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /MemberStatusIndicator/);
    assert.doesNotMatch(surface, /enableBadge/);
    assert.doesNotMatch(surface, /forceMemberBadge/);
    assert.doesNotMatch(surface, /previewMemberStatus/);
  });

  it("12c — Pack 25A.1 success copy confirms automatic public Member badge", () => {
    const constants = read("features/membership/membership.constants.ts");
    const confirmation = read(
      "features/membership/components/MembershipSuccessConfirmationCard.tsx",
    );
    assert.match(constants, /publicMemberNote/);
    assert.match(constants, /Member badge appears automatically on your public profile/);
    assert.match(confirmation, /MEMBERSHIP_SUCCESS_COPY\.publicMemberNote/);
    assert.doesNotMatch(confirmation, /enable the Member badge/i);
  });

  it("13 — no blank layout gap for non-Member", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.doesNotMatch(surface, /member-status-indicator--placeholder/);
    assert.match(surface, /\{showMemberBadge \? \([\s\S]*MemberStatusIndicator[\s\S]*\) : null\}/);
  });

  it("14 — profile updates feed preview automatically", () => {
    const section = read("features/membership/components/MembershipProfileSection.tsx");
    assert.match(section, /getMyMemberProfile/);
    assert.match(section, /displayName=\{profile\.displayName\}/);
    assert.match(section, /publicName=\{profile\.publicName\}/);
    assert.match(section, /avatarUrl=\{profile\.avatarUrl\}/);
  });

  it("15 — Member status automatically affects real profile", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /shouldShowMemberBadge\(profile\)/);
    assert.doesNotMatch(surface, /enableBadge/);
    assert.doesNotMatch(surface, /previewMemberStatus/);
  });

  it("16 — no private membership fields exposed", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.doesNotMatch(surface, /applicationStatus/);
    assert.doesNotMatch(surface, /contributionId/);
    assert.doesNotMatch(surface, /adminDecision/);
    const projection = readFileSync(
      path.resolve(webRoot, "../api/src/modules/member-profile/member-profile.projection.ts"),
      "utf8",
    );
    assert.match(projection, /resolvePublicMembershipFields/);
    assert.match(projection, /membershipStatus:\s*"member"/);
    assert.doesNotMatch(
      projection.split("resolvePublicMembershipFields")[1]!.slice(0, 800),
      /applicationNotes|internalReview/,
    );
  });

  it("17 — responsive behavior", () => {
    const css = read("features/member-profile/components/participant-profile-surface.css");
    assert.match(css, /@media \(max-width:\s*480px\)/);
    assert.match(css, /--public-member-avatar-size:\s*114px/);
    const previewCss = read("features/membership/components/membership-page.css");
    assert.match(previewCss, /membership-public-preview__hero/);
  });

  it("18 — accessibility behavior", () => {
    const indicator = read("features/member-profile/components/MemberStatusIndicator.tsx");
    assert.match(indicator, /alt=""/);
    assert.match(indicator, /aria-hidden="true"/);
    assert.equal(MEMBER_STATUS_INDICATOR_LABEL, "Member");
  });

  it("19 — Direct Message / cover / hero regressions remain green", () => {
    const surface = read("features/member-profile/components/ParticipantProfileSurface.tsx");
    assert.match(surface, /DirectMessageAction/);
    assert.match(surface, /public-member-page__message-action/);
    assert.match(surface, /public-member-page__hero-backdrop/);
    assert.match(surface, /ProfileHeroNetwork/);
  });

  it("20 — existing Membership section regressions remain green", () => {
    const section = read("features/membership/components/MembershipProfileSection.tsx");
    assert.match(section, /MembershipPublicVisibilityControl/);
    assert.match(section, /MembershipTimeline/);
    assert.match(section, /Open Membership|View Membership Success/);
    assert.match(section, /MembershipPublicDisplayPreview/);
  });
});
