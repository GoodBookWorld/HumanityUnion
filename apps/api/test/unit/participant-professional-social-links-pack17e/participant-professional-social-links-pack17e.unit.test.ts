/**
 * Pack 17E — Participant personal professional social links (validation + projection).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile } from "@hu/types";

import {
  resolvePublicMemberProfileHiddenSections,
  toPublicMemberProfile,
} from "../../../src/modules/member-profile/member-profile.projection.js";
import {
  validateMemberProfilePatch,
  validateParticipantSocialProfileUrl,
} from "../../../src/modules/member-profile/member-profile.validators.js";
import { MemberProfileValidationError } from "../../../src/modules/member-profile/member-profile.errors.js";

function buildProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-17e",
    userId: "user-17e",
    memberNumber: "HU-17E00001",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayName: "Pat Participant",
    publicName: "pat-participant-17e",
    skills: [],
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
    messagingPolicy: "active_allies",
    status: "active",
    ...overrides,
  };
}

describe("Pack 17E — participant professional social links", () => {
  it("validates HTTPS host-matched personal social URLs and clears empty values", () => {
    assert.equal(
      validateParticipantSocialProfileUrl(
        "facebook",
        "https://www.facebook.com/humanity.friend",
        "Facebook",
      ),
      "https://www.facebook.com/humanity.friend",
    );
    assert.equal(validateParticipantSocialProfileUrl("x", "   ", "X"), undefined);
    assert.equal(validateParticipantSocialProfileUrl("instagram", "", "Instagram"), undefined);

    assert.throws(
      () => validateParticipantSocialProfileUrl("youtube", "http://youtube.com/@x", "YouTube"),
      MemberProfileValidationError,
    );
    assert.throws(
      () =>
        validateParticipantSocialProfileUrl(
          "facebook",
          "https://user:secret@facebook.com/x",
          "Facebook",
        ),
      MemberProfileValidationError,
    );
    assert.throws(
      () => validateParticipantSocialProfileUrl("x", "https://evil.example/x", "X"),
      MemberProfileValidationError,
    );
  });

  it("patch accepts social fields and rejects wrong hosts via profile patch", () => {
    const patch = validateMemberProfilePatch({
      facebookUrl: "https://facebook.com/pat",
      youtubeUrl: "https://www.youtube.com/@pat",
      instagramUrl: "https://www.instagram.com/pat/",
      xUrl: "https://x.com/pat",
      website: "",
      linkedinUrl: "",
    });
    assert.equal(patch.facebookUrl?.includes("facebook.com"), true);
    assert.equal(patch.youtubeUrl?.includes("youtube.com"), true);
    assert.equal(patch.instagramUrl?.includes("instagram.com"), true);
    assert.equal(patch.xUrl?.includes("x.com"), true);
    assert.equal(patch.website, undefined);
    assert.equal(patch.linkedinUrl, undefined);

    assert.throws(
      () => validateMemberProfilePatch({ facebookUrl: "https://linkedin.com/in/pat" }),
      MemberProfileValidationError,
    );
  });

  it("public projection includes personal social links under professionalLinksVisibility", () => {
    const profile = buildProfile({
      website: "https://example.com",
      linkedinUrl: "https://www.linkedin.com/in/pat",
      facebookUrl: "https://www.facebook.com/pat",
      youtubeUrl: "https://www.youtube.com/@pat",
      instagramUrl: "https://www.instagram.com/pat",
      xUrl: "https://x.com/pat",
      professionalLinksVisibility: "public",
    });

    const publicVisible = toPublicMemberProfile(profile, {
      viewerIsAuthenticated: false,
      viewerIsOwner: false,
    });
    assert.ok(publicVisible);
    assert.equal(publicVisible!.facebookUrl, "https://www.facebook.com/pat");
    assert.equal(publicVisible!.youtubeUrl, "https://www.youtube.com/@pat");
    assert.equal(publicVisible!.instagramUrl, "https://www.instagram.com/pat");
    assert.equal(publicVisible!.xUrl, "https://x.com/pat");
    assert.equal(publicVisible!.linkedinUrl, "https://www.linkedin.com/in/pat");

    const privateLinks = toPublicMemberProfile(
      { ...profile, professionalLinksVisibility: "private" },
      { viewerIsAuthenticated: false, viewerIsOwner: false },
    );
    assert.equal(privateLinks!.facebookUrl, undefined);
    assert.equal(privateLinks!.xUrl, undefined);
    assert.equal(privateLinks!.website, undefined);

    const hidden = resolvePublicMemberProfileHiddenSections(
      profile,
      privateLinks!,
    );
    assert.equal(hidden.professionalLinks, true);
  });

  it("does not conflate personal links with HU platform distribution destinations", () => {
    const patch = validateMemberProfilePatch({
      facebookUrl: "https://www.facebook.com/personal.pat",
    });
    assert.ok(patch.facebookUrl);
    assert.doesNotMatch(JSON.stringify(patch), /huPlatformChannels|platform_social|distribution/i);
  });
});
