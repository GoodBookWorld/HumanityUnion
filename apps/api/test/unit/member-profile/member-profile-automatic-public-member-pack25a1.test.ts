/**
 * Pack 25A.1 — automatic public Member indicator; Member Number privacy preserved.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile, MembershipRecord } from "@hu/types";

import {
  resolvePublicMembershipFields,
  toPublicMemberProfile,
} from "../../../src/modules/member-profile/member-profile.projection.js";

function buildProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-25a1",
    userId: "user-25a1",
    memberNumber: "HU-25A10001",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Pack Member",
    publicName: "pack-member-25a1",
    biography: "Civic work.",
    organization: "Civic Lab",
    skills: [],
    website: undefined,
    linkedinUrl: undefined,
    country: "Canada",
    region: undefined,
    community: undefined,
    participationAreaId: undefined,
    participationVisibility: "public",
    language: "en",
    profileVisibility: "public",
    showOrganization: true,
    showLocation: true,
    showParticipationArea: true,
    membershipPubliclyVisible: false,
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
  membershipId: "membership-25a1",
  userId: "user-25a1",
  status: "active_member",
  memberNumber: "HU-25A10001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as MembershipRecord;

describe("Pack 25A.1 — automatic public Member indicator projection", () => {
  it("1 — active_member + memberNumber + privacy false → Member indicator visible", () => {
    const fields = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: false }),
      activeMembership,
    );
    assert.equal(fields.membershipStatus, "member");
    assert.equal(fields.memberBadgeVisible, true);
  });

  it("2 — active_member + memberNumber + privacy false → Member Number hidden", () => {
    const fields = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: false }),
      activeMembership,
    );
    assert.equal("memberNumber" in fields && fields.memberNumber !== undefined, false);
    assert.equal(fields.memberNumber, undefined);
  });

  it("3 — active_member + memberNumber + privacy true → Member indicator visible", () => {
    const fields = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      activeMembership,
    );
    assert.equal(fields.membershipStatus, "member");
    assert.equal(fields.memberBadgeVisible, true);
  });

  it("4 — active_member + memberNumber + privacy true → Member Number visible", () => {
    const fields = resolvePublicMembershipFields(
      buildProfile({ membershipPubliclyVisible: true }),
      activeMembership,
    );
    assert.equal(fields.memberNumber, "HU-25A10001");
  });

  it("5 — non-member → no Member indicator", () => {
    const fields = resolvePublicMembershipFields(buildProfile(), null);
    assert.equal(fields.membershipStatus, "participant");
    assert.equal(fields.memberBadgeVisible, false);
  });

  it("6 — active_member without memberNumber → safe non-Member public fallback", () => {
    const fields = resolvePublicMembershipFields(buildProfile(), {
      ...activeMembership,
      memberNumber: null,
    });
    assert.equal(fields.membershipStatus, "participant");
    assert.equal(fields.memberBadgeVisible, false);
    assert.equal(fields.memberNumber, undefined);
  });

  it("7 — existing active Member needs no migration/resave for badge projection", () => {
    // Fresh projection from persisted membership + default privacy (false).
    const projection = toPublicMemberProfile(buildProfile({ membershipPubliclyVisible: false }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
      membership: activeMembership,
    });
    assert.ok(projection);
    assert.equal(projection!.membershipStatus, "member");
    assert.equal(projection!.memberBadgeVisible, true);
    assert.equal(projection!.memberNumber, undefined);
  });

  it("9 — public profile projection reflects Member immediately without privacy flip", () => {
    const projection = toPublicMemberProfile(buildProfile({ membershipPubliclyVisible: false }), {
      viewerIsAuthenticated: true,
      viewerIsOwner: false,
      membership: activeMembership,
    });
    assert.equal(projection!.membershipStatus, "member");
    assert.equal(projection!.memberBadgeVisible, true);
  });

  it("13 — does not expose payment or internal membership fields", () => {
    const projection = toPublicMemberProfile(buildProfile({ membershipPubliclyVisible: true }), {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
      membership: activeMembership,
    }) as Record<string, unknown>;

    for (const field of [
      "contributionId",
      "stripeCheckoutSessionId",
      "stripePaymentIntentId",
      "applicationNotes",
      "internalReview",
      "userId",
      "membershipId",
    ]) {
      assert.equal(field in projection, false, `must not expose ${field}`);
    }
  });
});
