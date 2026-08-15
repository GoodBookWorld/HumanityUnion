import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { MemberProfile, PublicMemberProfile } from "@hu/types";

import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  getMyPublicMemberProfilePreview,
  getOrCreateMemberProfileForUser,
  updateMemberProfileForUser,
  updateMemberProfilePrivacyForUser,
} from "../../../src/modules/member-profile/member-profile.service.js";
import { resolvePublicMemberProfileHiddenSections } from "../../../src/modules/member-profile/member-profile.projection.js";
import { MemberProfileAccessDeniedError } from "../../../src/modules/member-profile/member-profile.errors.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("member-profile-public-preview");

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
    skills: ["Facilitation"],
    website: "https://example.com",
    participationVisibility: "public",
    language: "en",
    profileVisibility: "public",
    showOrganization: false,
    showLocation: false,
    showParticipationArea: false,
    membershipPubliclyVisible: false,
    skillsVisibility: "members_only",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
    ...overrides,
  };
}

/**
 * Profile UX Pack 03.3 — `resolvePublicMemberProfileHiddenSections` is a
 * pure diff between the raw profile and its already-computed public
 * projection; no Mongo required.
 */
describe("resolvePublicMemberProfileHiddenSections (Pack 03.3)", () => {
  it("flags skills as hidden only when real skills exist but Privacy kept them off the projection", () => {
    const profile = buildProfile({ skills: ["Facilitation", "Mediation"] });
    const projection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      messagingAvailability: "hidden",
    };

    const hidden = resolvePublicMemberProfileHiddenSections(profile, projection);
    assert.equal(hidden.skills, true);
  });

  it("never flags skills as hidden when the owner simply has none", () => {
    const profile = buildProfile({ skills: [] });
    const projection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      messagingAvailability: "hidden",
    };

    assert.equal(resolvePublicMemberProfileHiddenSections(profile, projection).skills, false);
  });

  it("never flags skills as hidden when they are already visible in the projection", () => {
    const profile = buildProfile({ skills: ["Facilitation"] });
    const projection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      skills: ["Facilitation"],
      messagingAvailability: "hidden",
    };

    assert.equal(resolvePublicMemberProfileHiddenSections(profile, projection).skills, false);
  });

  it("flags professionalLinks as hidden only when a real link exists but neither made it into the projection", () => {
    const profile = buildProfile({ website: "https://example.com", linkedinUrl: undefined });
    const projection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      messagingAvailability: "hidden",
    };

    assert.equal(
      resolvePublicMemberProfileHiddenSections(profile, projection).professionalLinks,
      true,
    );
  });

  it("flags statistics as hidden exactly when the projection carries no statistics block at all", () => {
    const profile = buildProfile();
    const hiddenProjection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      messagingAvailability: "hidden",
    };
    const visibleProjection: PublicMemberProfile = {
      ...hiddenProjection,
      statistics: { initiativesCount: 1 },
    };

    assert.equal(
      resolvePublicMemberProfileHiddenSections(profile, hiddenProjection).statistics,
      true,
    );
    assert.equal(
      resolvePublicMemberProfileHiddenSections(profile, visibleProjection).statistics,
      false,
    );
  });

  it("never invents a hidden biography or recentPublicInitiatives flag (no dedicated Privacy switch exists for either today)", () => {
    const profile = buildProfile({ biography: "Hello" });
    const projection: PublicMemberProfile = {
      profileId: profile.profileId,
      publicName: profile.publicName,
      biography: "Hello",
      messagingAvailability: "hidden",
    };

    const hidden = resolvePublicMemberProfileHiddenSections(profile, projection);
    assert.equal(hidden.biography, false);
    assert.equal(hidden.recentPublicInitiatives, false);
  });
});

/**
 * Profile UX Pack 03.3 — `getMyPublicMemberProfilePreview` end-to-end: the
 * "what will other Participants see" preview for the signed-in owner's own
 * `/profile`. Reuses the same Mongo-backed fixtures/pattern as
 * `public-member-profile-by-name.test.ts`.
 */
describe("getMyPublicMemberProfilePreview (Pack 03.3 — Privacy invariant with /member/{publicName})", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("never elevates the owner viewing their own preview — hides exactly what a real other Participant would not see", async () => {
    const email = `${TEST_PREFIX}-hidden@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Hidden Fields Owner" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    await getOrCreateMemberProfileForUser({ userId: user.userId, displayName: "Hidden Fields Owner" });
    await updateMemberProfileForUser(user.userId, {
      organization: "Humanity Union",
      skills: ["Facilitation"],
      website: "https://example.com",
    });
    await updateMemberProfilePrivacyForUser(user.userId, {
      profileVisibility: "public",
      showOrganization: false,
      skillsVisibility: "private",
      professionalLinksVisibility: "private",
      showInitiativesStatistics: false,
      showCollectiveDecisionsStatistics: false,
      showAlliesStatistics: false,
    });

    const preview = await getMyPublicMemberProfilePreview(user.userId);

    // Never the owner-bypass values a real self-authenticated visit to
    // `/member/{publicName}` would show — this preview must match a
    // *stranger's* view, never the owner's.
    assert.equal(preview.profile.organization, undefined);
    assert.equal(preview.profile.skills, undefined);
    assert.equal(preview.profile.website, undefined);
    assert.equal(preview.profile.statistics, undefined);

    // Real content exists, but Privacy hid it — hiddenSections says so.
    assert.equal(preview.hiddenSections.skills, true);
    assert.equal(preview.hiddenSections.professionalLinks, true);
    assert.equal(preview.hiddenSections.statistics, true);

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });

  it("never leaks a self-message action — messagingAvailability always resolves to hidden", async () => {
    const email = `${TEST_PREFIX}-messaging@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Messaging Owner" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    await getOrCreateMemberProfileForUser({ userId: user.userId, displayName: "Messaging Owner" });
    await updateMemberProfilePrivacyForUser(user.userId, {
      profileVisibility: "public",
      messagingPolicy: "registered_participants",
    });

    const preview = await getMyPublicMemberProfilePreview(user.userId);
    assert.equal(preview.profile.messagingAvailability, "hidden");

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });

  it("resolves visible fields for the default members_only profile — matches what another authenticated Participant sees", async () => {
    const email = `${TEST_PREFIX}-default@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Default Visibility Owner" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    const profile = await getOrCreateMemberProfileForUser({
      userId: user.userId,
      displayName: "Default Visibility Owner",
    });
    assert.equal(profile.profileVisibility, "members_only");

    const preview = await getMyPublicMemberProfilePreview(user.userId);
    assert.equal(preview.profile.displayName, "Default Visibility Owner");
    assert.equal(preview.profile.publicName, profile.publicName);

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });

  it("throws access-denied when the owner's own Profile Visibility is Private — nobody but the owner can see it", async () => {
    const email = `${TEST_PREFIX}-private@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Private Owner" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    await getOrCreateMemberProfileForUser({ userId: user.userId, displayName: "Private Owner" });
    await updateMemberProfilePrivacyForUser(user.userId, { profileVisibility: "private" });

    await assert.rejects(
      () => getMyPublicMemberProfilePreview(user.userId),
      MemberProfileAccessDeniedError,
    );

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });
});
