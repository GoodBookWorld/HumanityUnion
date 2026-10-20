import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile, MembershipRecord } from "@hu/types";

import {
  resolvePublicMembershipFields,
  toPublicMemberProfile,
} from "../../../src/modules/member-profile/member-profile.projection.js";
import { validateMemberProfilePrivacyPatch } from "../../../src/modules/member-profile/member-profile.validators.js";

function buildProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-1",
    userId: "user-1",
    memberNumber: "HU-00000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Jane Steward",
    publicName: "jane-steward-abc123",
    biography: "Working on civic tools.",
    organization: "Civic Lab",
    skills: ["Facilitation", "Mediation"],
    website: "https://example.com",
    linkedinUrl: "https://www.linkedin.com/in/jane",
    country: "Kenya",
    region: "Nairobi",
    community: "Westlands",
    participationAreaId: "participation-area-1",
    participationVisibility: "public",
    language: "en",
    profileVisibility: "public",
    showOrganization: true,
    showLocation: false,
    showParticipationArea: true,
    membershipPubliclyVisible: true,
    skillsVisibility: "public",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    showProposalsStatistics: true,
    showPetitionsStatistics: true,
    showCommitmentsStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
    ...overrides,
  };
}

const activeMembership: MembershipRecord = {
  membershipId: "membership-1",
  userId: "user-1",
  status: "active_member",
  memberNumber: "HU-00000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as MembershipRecord;

describe("Launch Readiness UX Fix Pack 01 — public profile visibility projection", () => {
  it("exposes Participation Area labels when visibility permits (even if showLocation is false)", () => {
    const projection = toPublicMemberProfile(buildProfile({ showLocation: false }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });

    assert.ok(projection);
    assert.equal(projection!.participationAreaId, "participation-area-1");
    assert.deepEqual(projection!.participationArea, {
      country: "Kenya",
      region: "Nairobi",
      community: "Westlands",
    });
    assert.equal(projection!.country, undefined);
  });

  it("omits Participation Area when showParticipationArea is false", () => {
    const projection = toPublicMemberProfile(
      buildProfile({ showParticipationArea: false }),
      { viewerIsAuthenticated: false, viewerIsOwner: false },
    );

    assert.ok(projection);
    assert.equal(projection!.participationAreaId, undefined);
    assert.equal(projection!.participationArea, undefined);
  });

  it("exposes skills when skillsVisibility is public", () => {
    const projection = toPublicMemberProfile(buildProfile({ skillsVisibility: "public" }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });

    assert.deepEqual(projection!.skills, ["Facilitation", "Mediation"]);
  });

  it("omits skills when skillsVisibility is private", () => {
    const projection = toPublicMemberProfile(buildProfile({ skillsVisibility: "private" }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });

    assert.equal(projection!.skills, undefined);
  });

  it("exposes professional links when visibility permits", () => {
    const projection = toPublicMemberProfile(
      buildProfile({
        professionalLinksVisibility: "public",
        facebookUrl: "https://www.facebook.com/jane",
        xUrl: "https://x.com/jane",
      }),
      { viewerIsAuthenticated: false, viewerIsOwner: false },
    );

    assert.equal(projection!.website, "https://example.com");
    assert.equal(projection!.linkedinUrl, "https://www.linkedin.com/in/jane");
    assert.equal(projection!.facebookUrl, "https://www.facebook.com/jane");
    assert.equal(projection!.xUrl, "https://x.com/jane");
  });

  it("omits professional links when visibility is private", () => {
    const projection = toPublicMemberProfile(
      buildProfile({
        professionalLinksVisibility: "private",
        facebookUrl: "https://www.facebook.com/jane",
        youtubeUrl: "https://www.youtube.com/@jane",
      }),
      { viewerIsAuthenticated: false, viewerIsOwner: false },
    );

    assert.equal(projection!.website, undefined);
    assert.equal(projection!.linkedinUrl, undefined);
    assert.equal(projection!.facebookUrl, undefined);
    assert.equal(projection!.youtubeUrl, undefined);
  });

  it("exposes biography and organization from the public projection when permitted", () => {
    const projection = toPublicMemberProfile(buildProfile(), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });

    assert.equal(projection!.biography, "Working on civic tools.");
    assert.equal(projection!.organization, "Civic Lab");
  });

  it("omits organization when showOrganization is false", () => {
    const projection = toPublicMemberProfile(buildProfile({ showOrganization: false }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });

    assert.equal(projection!.organization, undefined);
  });

  it("Pack 25A.1 — Member badge is automatic; Member Number stays privacy-gated", () => {
    const withNumber = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      activeMembership,
    );
    assert.equal(withNumber.membershipStatus, "member");
    assert.equal(withNumber.memberBadgeVisible, true);
    assert.equal(withNumber.memberNumber, "HU-00000001");

    const badgeOnly = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: false }),
      activeMembership,
    );
    assert.equal(badgeOnly.membershipStatus, "member");
    assert.equal(badgeOnly.memberBadgeVisible, true);
    assert.equal(badgeOnly.memberNumber, undefined);

    const nonMember = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      null,
    );
    assert.equal(nonMember.membershipStatus, "participant");
    assert.equal(nonMember.memberBadgeVisible, false);
    assert.equal(nonMember.memberNumber, undefined);

    const activeWithoutNumber = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      { ...activeMembership, memberNumber: null },
    );
    assert.equal(activeWithoutNumber.membershipStatus, "participant");
    assert.equal(activeWithoutNumber.memberBadgeVisible, false);
  });

  it("shows a public profile to an anonymous viewer and withholds restricted profiles", () => {
    const anonymous = { viewerIsAuthenticated: false, viewerIsOwner: false };
    const member = { viewerIsAuthenticated: true, viewerIsOwner: false };

    const publicProfile = toPublicMemberProfile(buildProfile({ profileVisibility: "public" }), anonymous);
    assert.ok(publicProfile);
    assert.equal(publicProfile.publicName, "jane-steward-abc123");

    assert.equal(
      toPublicMemberProfile(buildProfile({ profileVisibility: "members_only" }), anonymous),
      null,
    );
    assert.ok(toPublicMemberProfile(buildProfile({ profileVisibility: "members_only" }), member));
    assert.equal(
      toPublicMemberProfile(buildProfile({ profileVisibility: "private" }), member),
      null,
    );
    assert.ok(
      toPublicMemberProfile(buildProfile({ profileVisibility: "private" }), {
        viewerIsAuthenticated: true,
        viewerIsOwner: true,
      }),
    );
  });

  it("accepts Public, Members only, and Private through the profile privacy API", () => {
    for (const profileVisibility of ["public", "members_only", "private"] as const) {
      const patch = validateMemberProfilePrivacyPatch({ profileVisibility });
      assert.equal(patch.profileVisibility, profileVisibility);
    }
  });

  it("never leaks auth internals through the public projection", () => {
    const projection = toPublicMemberProfile(buildProfile(), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    }) as Record<string, unknown>;

    for (const field of ["userId", "passwordHash", "email", "refreshTokenHash", "sessionId"]) {
      assert.equal(field in projection, false, `must not expose ${field}`);
    }
  });
});
