import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile, ParticipantStatistics } from "@hu/types";

import {
  toMemberProfilePrivacySettings,
  toPublicParticipantStatistics,
} from "../../../src/modules/member-profile/member-profile.projection.js";

/**
 * Profile UX Pack 02 Part 5/6/11 — pure privacy-filtering logic applied to
 * the one shared `ParticipantStatistics` aggregation before it is placed on
 * a Public Profile projection, plus the corresponding privacy-settings
 * defaults. No Mongo required (pure functions).
 */
function buildProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-1",
    userId: "user-1",
    memberNumber: "HU-00000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Jane Steward",
    publicName: "jane-steward-abc123",
    skills: [],
    participationVisibility: "public",
    language: "en",
    profileVisibility: "public",
    showOrganization: false,
    showLocation: false,
    showParticipationArea: false,
    membershipPubliclyVisible: false,
    skillsVisibility: "members_only",
    professionalLinksVisibility: "public",
    status: "active",
    ...overrides,
  };
}

const STATISTICS: ParticipantStatistics = {
  initiativesCount: 3,
  collectiveDecisionsCount: 2,
  alliesCount: 5,
};

describe("toMemberProfilePrivacySettings — new statistics switches default to enabled", () => {
  it("defaults all three statistics switches to true when absent from the stored profile", () => {
    const settings = toMemberProfilePrivacySettings(buildProfile());

    assert.equal(settings.showInitiativesStatistics, true);
    assert.equal(settings.showCollectiveDecisionsStatistics, true);
    assert.equal(settings.showAlliesStatistics, true);
  });

  it("honors an explicit false for any individual switch without affecting the others", () => {
    const settings = toMemberProfilePrivacySettings(
      buildProfile({ showCollectiveDecisionsStatistics: false }),
    );

    assert.equal(settings.showInitiativesStatistics, true);
    assert.equal(settings.showCollectiveDecisionsStatistics, false);
    assert.equal(settings.showAlliesStatistics, true);
  });
});

describe("toPublicParticipantStatistics (Profile UX Pack 02 Part 5/6)", () => {
  it("includes all three numbers for a non-owner viewer when every switch is enabled (default)", () => {
    const result = toPublicParticipantStatistics(STATISTICS, buildProfile(), false);

    assert.deepEqual(result, STATISTICS);
  });

  it("hides only the disabled statistic, leaving the other two visible", () => {
    const result = toPublicParticipantStatistics(
      STATISTICS,
      buildProfile({ showAlliesStatistics: false }),
      false,
    );

    assert.deepEqual(result, {
      initiativesCount: 3,
      collectiveDecisionsCount: 2,
    });
  });

  it("never affects the underlying calculation — disabling a switch only hides it, values are unchanged when shown", () => {
    const result = toPublicParticipantStatistics(
      STATISTICS,
      buildProfile({ showInitiativesStatistics: false }),
      false,
    );

    assert.equal(result?.collectiveDecisionsCount, STATISTICS.collectiveDecisionsCount);
    assert.equal(result?.alliesCount, STATISTICS.alliesCount);
  });

  it("returns undefined (not an object of zeros) when every switch is disabled for a non-owner viewer", () => {
    const result = toPublicParticipantStatistics(
      STATISTICS,
      buildProfile({
        showInitiativesStatistics: false,
        showCollectiveDecisionsStatistics: false,
        showAlliesStatistics: false,
      }),
      false,
    );

    assert.equal(result, undefined);
  });

  it("the profile owner always sees every number on their own Public Profile, even with every switch disabled", () => {
    const result = toPublicParticipantStatistics(
      STATISTICS,
      buildProfile({
        showInitiativesStatistics: false,
        showCollectiveDecisionsStatistics: false,
        showAlliesStatistics: false,
      }),
      true,
    );

    assert.deepEqual(result, STATISTICS);
  });
});
