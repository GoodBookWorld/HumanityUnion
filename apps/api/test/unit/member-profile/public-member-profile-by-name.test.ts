import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  getOrCreateMemberProfileForUser,
  getPublicMemberProfileByPublicName,
  updateMemberProfilePrivacyForUser,
} from "../../../src/modules/member-profile/member-profile.service.js";
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

const TEST_PREFIX = createTestId("public-member-profile-by-name");

/**
 * UX Evolution Pack 02.4 Part 6 root-cause fix — the `/member/{publicName}`
 * page (and every generated comment-author / Initiative-author link) needs
 * a way to resolve a `MemberProfile` by `publicName`. This did not exist
 * before this pack; the page instead queried the unrelated legacy `member`
 * module, which is why the link "looked right" but almost always landed on
 * "Member profile is not available."
 */
describe("getPublicMemberProfileByPublicName (Pack 02.4 Part 6)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(TEST_PREFIX);
    await disconnectMongoClient();
  });

  it("resolves a public profile by publicName for any viewer (guest included)", async () => {
    const email = `${TEST_PREFIX}-public@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Public Author" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    const profile = await getOrCreateMemberProfileForUser({
      userId: user.userId,
      displayName: "Public Author",
    });
    await updateMemberProfilePrivacyForUser(user.userId, { profileVisibility: "public" });

    const publicProfile = await getPublicMemberProfileByPublicName(profile.publicName, {
      viewerIsAuthenticated: false,
    });

    assert.equal(publicProfile.displayName, "Public Author");
    assert.equal(publicProfile.publicName, profile.publicName);
    assert.ok(!("email" in publicProfile));

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });

  it("denies a guest viewer for a members_only profile (privacy preserved) — this is the default for every new profile", async () => {
    const email = `${TEST_PREFIX}-members-only@example.com`;
    await registerAuthUser({ email, password: "Password123!", displayName: "Members Only Author" });
    const user = await findAuthUserByEmail(email);
    assert.ok(user);

    const profile = await getOrCreateMemberProfileForUser({
      userId: user.userId,
      displayName: "Members Only Author",
    });
    assert.equal(profile.profileVisibility, "members_only");

    await assert.rejects(
      () => getPublicMemberProfileByPublicName(profile.publicName, { viewerIsAuthenticated: false }),
      MemberProfileAccessDeniedError,
    );

    const asMember = await getPublicMemberProfileByPublicName(profile.publicName, {
      viewerIsAuthenticated: true,
    });
    assert.equal(asMember.displayName, "Members Only Author");

    await deleteMemberProfilesByUserIdPrefix(user.userId);
  });

  it("throws not-found for an unknown publicName rather than a broken/empty result", async () => {
    await assert.rejects(() =>
      getPublicMemberProfileByPublicName(`${TEST_PREFIX}-does-not-exist`, {
        viewerIsAuthenticated: false,
      }),
    );
  });
});
