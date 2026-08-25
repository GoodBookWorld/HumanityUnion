import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile, MembershipRecord } from "@hu/types";

import {
  resolvePublicMembershipFields,
  toPublicMemberProfile,
} from "../../../src/modules/member-profile/member-profile.projection.js";

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

  it("marks Member badge visible only for public active Members", () => {
    const visible = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      activeMembership,
    );
    assert.equal(visible.membershipStatus, "member");
    assert.equal(visible.memberBadgeVisible, true);

    const hidden = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: false }),
      activeMembership,
    );
    assert.equal(hidden.membershipStatus, "participant");
    assert.equal(hidden.memberBadgeVisible, false);
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
