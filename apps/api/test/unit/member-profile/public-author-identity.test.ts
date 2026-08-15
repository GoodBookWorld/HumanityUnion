import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberProfile } from "@hu/types";

import { resolvePublicAuthorIdentity } from "../../../src/modules/member-profile/public-author-identity.projection.js";

/**
 * UX Evolution Pack 02.4 — the shared "public author identity" rule now
 * used by both comment authors (unchanged behavior) and the Initiative
 * steward (Part 3/4 "Unknown Steward" root-cause fix). Pure function, no
 * Mongo required.
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

describe("resolvePublicAuthorIdentity", () => {
  it("returns display name, avatar, and a /member/{publicName} link for an active, public profile", () => {
    const identity = resolvePublicAuthorIdentity(buildProfile(), "Snapshot Name");

    assert.equal(identity.displayName, "Jane Steward");
    assert.equal(identity.profileUrl, "/member/jane-steward-abc123");
    assert.ok(identity.avatarUrl);
    assert.equal(identity.publicUserId, "profile-1");
  });

  it("URL-encodes publicName in the generated link", () => {
    const identity = resolvePublicAuthorIdentity(
      buildProfile({ publicName: "jane steward/x" }),
      "",
    );

    assert.equal(identity.profileUrl, `/member/${encodeURIComponent("jane steward/x")}`);
  });

  it("never returns a profile link for a members_only profile (privacy preserved)", () => {
    const identity = resolvePublicAuthorIdentity(
      buildProfile({ profileVisibility: "members_only" }),
      "Snapshot Name",
    );

    assert.equal(identity.profileUrl, undefined);
    // Name is still shown — visibility only gates the link, not the name itself.
    assert.equal(identity.displayName, "Jane Steward");
  });

  it("never returns a profile link for a private profile", () => {
    const identity = resolvePublicAuthorIdentity(
      buildProfile({ profileVisibility: "private" }),
      "Snapshot Name",
    );

    assert.equal(identity.profileUrl, undefined);
  });

  it("never returns a profile link for a suspended profile, even if visibility is public", () => {
    const identity = resolvePublicAuthorIdentity(
      buildProfile({ status: "suspended", profileVisibility: "public" }),
      "Snapshot Name",
    );

    assert.equal(identity.profileUrl, undefined);
  });

  it("falls back to the name snapshot when no profile exists", () => {
    const identity = resolvePublicAuthorIdentity(undefined, "Registration-Time Name");

    assert.equal(identity.displayName, "Registration-Time Name");
    assert.equal(identity.profileUrl, undefined);
    assert.equal(identity.avatarUrl, undefined);
  });

  it("falls back to the generic 'Participant' label — never 'Unknown Steward' — when no profile and no snapshot exist", () => {
    const identity = resolvePublicAuthorIdentity(undefined, "");

    assert.equal(identity.displayName, "Participant");
  });

  it("falls back to the name snapshot (not the stale profile name) for a suspended profile", () => {
    const identity = resolvePublicAuthorIdentity(
      buildProfile({ status: "suspended", displayName: "Stale Name" }),
      "Fresher Snapshot",
    );

    assert.equal(identity.displayName, "Fresher Snapshot");
  });

  it("never exposes email or other private fields", () => {
    const identity = resolvePublicAuthorIdentity(buildProfile(), "Snapshot Name");
    const serialized = JSON.stringify(identity);

    assert.ok(!("email" in identity));
    assert.ok(!serialized.toLowerCase().includes("@"));
  });
});
