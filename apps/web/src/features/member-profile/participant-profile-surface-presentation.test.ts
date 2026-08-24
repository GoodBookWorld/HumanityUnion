/**
 * Profile UX Pack 03.2 Part 18 / Profile UX Pack 03.3 Part 21 — focused
 * tests for the pure profile-surface layout presentation logic shared by
 * `/member/{publicName}` (public) and `/profile` (owner-preview).
 * Relocated from
 * `app/member/[uniqueName]/public-member-page-presentation.test.ts` when the
 * module it tests moved to this feature folder so neither route forks it.
 *
 * `apps/web` has no React component test harness (no vitest/jest/RTL
 * configured anywhere in this monorepo), so — matching the existing
 * convention (see discussion-comment-presentation.test.ts) — the
 * Privacy-filtering / ordering / fallback decisions behind the visual
 * refactor are exercised directly with Node's built-in test runner. Run
 * with:
 *
 *   npx tsx --test "src/features/member-profile/participant-profile-surface-presentation.test.ts"
 *
 * from apps/web.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIdentityMetaLines,
  buildParticipationAreaLabels,
  buildVisibleStatisticCards,
  hasAnyStatistic,
  hasVisibleBiography,
  hasVisibleOrganization,
  hasVisibleParticipationArea,
  hasVisibleProfessionalLinks,
  hasVisibleRecentInitiatives,
  hasVisibleSkills,
  PUBLIC_MEMBER_BADGE_ALT,
  PUBLIC_MEMBER_BADGE_SIZE_PX,
  PUBLIC_MEMBER_BADGE_SRC,
  resolveDisplayName,
  shouldShowMemberBadge,
  shouldShowOwnerHiddenSectionNotice,
} from "./participant-profile-surface-presentation.js";

describe("buildVisibleStatisticCards", () => {
  it("test 1 — renders all three statistics in the required order (Initiatives, Collective Decisions, Allies)", () => {
    const cards = buildVisibleStatisticCards({
      initiativesCount: 2,
      collectiveDecisionsCount: 0,
      alliesCount: 5,
    });

    assert.deepEqual(
      cards.map((card) => card.key),
      ["initiativesCount", "collectiveDecisionsCount", "alliesCount"],
    );
    assert.deepEqual(
      cards.map((card) => card.label),
      ["Initiatives", "Collective Decisions", "Allies"],
    );
  });

  it("test 2 — carries the real projected value for each visible statistic", () => {
    const cards = buildVisibleStatisticCards({
      initiativesCount: 7,
      collectiveDecisionsCount: 3,
      alliesCount: 11,
    });

    assert.equal(cards.find((card) => card.key === "initiativesCount")?.value, 7);
    assert.equal(cards.find((card) => card.key === "collectiveDecisionsCount")?.value, 3);
    assert.equal(cards.find((card) => card.key === "alliesCount")?.value, 11);
  });

  it("test 3 — omits a statistic Privacy hides entirely, rather than rendering a zero", () => {
    const cards = buildVisibleStatisticCards({
      initiativesCount: 4,
      alliesCount: 1,
      // collectiveDecisionsCount intentionally absent (Privacy-hidden).
    });

    assert.deepEqual(
      cards.map((card) => card.key),
      ["initiativesCount", "alliesCount"],
    );
    assert.equal(
      cards.some((card) => card.key === "collectiveDecisionsCount"),
      false,
    );
  });

  it("test 4 — returns no cards when every statistic is Privacy-hidden", () => {
    assert.deepEqual(buildVisibleStatisticCards({}), []);
  });

  it("test 5 — returns no cards when statistics are entirely absent from the projection", () => {
    assert.deepEqual(buildVisibleStatisticCards(undefined), []);
  });

  it("test 6 — each visible card retains its icon alongside the label and value (equal semantic structure)", () => {
    const cards = buildVisibleStatisticCards({ initiativesCount: 1 });

    assert.equal(cards.length, 1);
    assert.ok(cards[0]!.iconSrc.length > 0);
    assert.ok(cards[0]!.label.length > 0);
    assert.equal(cards[0]!.value, 1);
  });
});

describe("hasAnyStatistic", () => {
  it("test 7 — true when at least one statistic is visible", () => {
    assert.equal(hasAnyStatistic({ alliesCount: 0 }), true);
  });

  it("test 8 — false when statistics are undefined", () => {
    assert.equal(hasAnyStatistic(undefined), false);
  });

  it("test 9 — false when statistics is an empty (fully Privacy-hidden) object", () => {
    assert.equal(hasAnyStatistic({}), false);
  });
});

describe("buildIdentityMetaLines", () => {
  it("test 10 — includes country when present (organization is a separate identity block)", () => {
    assert.deepEqual(buildIdentityMetaLines({ country: "Kenya" }), ["Kenya"]);
  });

  it("test 11 — returns an empty list when country is absent", () => {
    assert.deepEqual(buildIdentityMetaLines({ country: undefined }), []);
  });

  it("test 12 — treats a blank/whitespace-only country as absent", () => {
    assert.deepEqual(buildIdentityMetaLines({ country: "   " }), []);
  });

  it("test 13 — hasVisibleOrganization follows the public projection only", () => {
    assert.equal(hasVisibleOrganization({ organization: "Civic Lab" }), true);
    assert.equal(hasVisibleOrganization({ organization: "   " }), false);
    assert.equal(hasVisibleOrganization({ organization: undefined }), false);
  });
});

describe("resolveDisplayName", () => {
  it("test 14 — returns the profile's display name when present", () => {
    assert.equal(resolveDisplayName({ displayName: "Amina K." }), "Amina K.");
  });

  it("test 15 — falls back to a safe generic label when display name is absent", () => {
    assert.equal(resolveDisplayName({ displayName: undefined }), "Participant");
  });
});

describe("hasVisibleSkills / hasVisibleProfessionalLinks / hasVisibleRecentInitiatives / hasVisibleBiography (Pack 03.3 — identity fields match between public and preview modes)", () => {
  it("test 16 — hasVisibleSkills is true only when the projection carries at least one skill", () => {
    assert.equal(hasVisibleSkills({ skills: ["Facilitation"] }), true);
    assert.equal(hasVisibleSkills({ skills: [] }), false);
    assert.equal(hasVisibleSkills({ skills: undefined }), false);
  });

  it("test 17 — hasVisibleProfessionalLinks is true when website, LinkedIn, or social URLs are present", () => {
    assert.equal(hasVisibleProfessionalLinks({ website: "https://example.com" }), true);
    assert.equal(hasVisibleProfessionalLinks({ linkedinUrl: "https://linkedin.com/in/x" }), true);
    assert.equal(hasVisibleProfessionalLinks({ facebookUrl: "https://facebook.com/x" }), true);
    assert.equal(hasVisibleProfessionalLinks({ youtubeUrl: "https://youtube.com/@x" }), true);
    assert.equal(hasVisibleProfessionalLinks({ instagramUrl: "https://instagram.com/x" }), true);
    assert.equal(hasVisibleProfessionalLinks({ xUrl: "https://x.com/x" }), true);
    assert.equal(hasVisibleProfessionalLinks({}), false);
  });

  it("test 18 — hasVisibleRecentInitiatives is true only when the list is non-empty", () => {
    assert.equal(
      hasVisibleRecentInitiatives({
        recentPublicInitiatives: [{ initiativeId: "i1", title: "Clean Water", href: "/x" }],
      }),
      true,
    );
    assert.equal(hasVisibleRecentInitiatives({ recentPublicInitiatives: [] }), false);
    assert.equal(hasVisibleRecentInitiatives({ recentPublicInitiatives: undefined }), false);
  });

  it("test 19 — hasVisibleBiography treats blank/whitespace-only text as absent", () => {
    assert.equal(hasVisibleBiography({ biography: "Working on civic tools." }), true);
    assert.equal(hasVisibleBiography({ biography: "   " }), false);
    assert.equal(hasVisibleBiography({ biography: undefined }), false);
  });
});

describe("shouldShowOwnerHiddenSectionNotice (Pack 03.3 Part 5 — never leak hidden values, never show for merely-empty sections)", () => {
  it("test 20 — shows the notice when content is absent and Privacy is the reason", () => {
    assert.equal(shouldShowOwnerHiddenSectionNotice(false, true), true);
  });

  it("test 21 — never shows the notice when the section is merely empty (not Privacy-hidden)", () => {
    assert.equal(shouldShowOwnerHiddenSectionNotice(false, false), false);
    assert.equal(shouldShowOwnerHiddenSectionNotice(false, undefined), false);
  });

  it("test 22 — never shows the notice when the content is already visible, even if flagged hidden", () => {
    assert.equal(shouldShowOwnerHiddenSectionNotice(true, true), false);
  });
});

describe("Launch Readiness UX Fix Pack 01 — Participation Area, Skills, Member badge", () => {
  it("renders Participation Area labels from the public projection only", () => {
    assert.deepEqual(
      buildParticipationAreaLabels({
        community: "Westlands",
        region: "Nairobi",
        country: "Kenya",
      }),
      ["Westlands", "Nairobi", "Kenya"],
    );
    assert.equal(
      hasVisibleParticipationArea({
        participationArea: { country: "Kenya" },
      }),
      true,
    );
    assert.equal(hasVisibleParticipationArea({ participationArea: undefined }), false);
  });

  it("shows Member badge only for projected Members and uses the canonical asset/size", () => {
    assert.equal(
      shouldShowMemberBadge({ memberBadgeVisible: true, membershipStatus: "member" }),
      true,
    );
    assert.equal(
      shouldShowMemberBadge({ memberBadgeVisible: false, membershipStatus: "participant" }),
      false,
    );
    assert.equal(PUBLIC_MEMBER_BADGE_SRC, "/illustrations/membership/member-badge.webp");
    assert.equal(PUBLIC_MEMBER_BADGE_SIZE_PX, 48);
    assert.equal(PUBLIC_MEMBER_BADGE_ALT, "Humanity Union Member");
  });

  it("keeps Skills / Professional Links / Biography projection helpers empty-safe", () => {
    assert.equal(hasVisibleSkills({ skills: ["Facilitation"] }), true);
    assert.equal(hasVisibleSkills({ skills: [] }), false);
    assert.equal(hasVisibleProfessionalLinks({ website: "https://example.com" }), true);
    assert.equal(hasVisibleProfessionalLinks({}), false);
    assert.equal(hasVisibleBiography({ biography: "Hello" }), true);
    assert.equal(hasVisibleBiography({ biography: "" }), false);
  });
});
