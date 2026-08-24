/**
 * Pack 17C — Admin-managed platform social accounts (Mongo, isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { TEST_DATABASE_ENV_VAR } from "../../../scripts/test-mongo-isolation.js";
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/audit.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  listAdminPlatformSocialAccounts,
  listPublicPlatformSocialAccounts,
  resetPlatformSocialAccountsStoreForTests,
  setPlatformSocialAccountsForceMemoryForTests,
  upsertAdminPlatformSocialAccount,
} from "../../../src/modules/platform-social-accounts/index.js";
import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack17c");
const createdAuthUserIds: string[] = [];

async function registerUser(label: string, role: "member" | "admin") {
  const user = await insertAuthUser(
    {
      email: `${TEST_PREFIX}-${label}@pack17c.test`,
      password: "Password123!",
      displayName: `Pack17C ${label}`,
      role,
    },
    `member-${label}-${TEST_PREFIX}`,
  );
  createdAuthUserIds.push(user.userId);
  await markAuthUserEmailVerified(user.userId);
  await createMemberProfileForUser({
    userId: user.userId,
    displayName: user.displayName,
  });
  return user;
}

describe("Pack 17C — platform social accounts (mongo)", () => {
  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    setPlatformSocialAccountsForceMemoryForTests(false);
    resetPlatformSocialAccountsStoreForTests();
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId).catch(() => undefined);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`).catch(() => undefined);
    await disconnectMongoClient().catch(() => undefined);
  });

  beforeEach(async () => {
    resetPlatformSocialAccountsStoreForTests();
    await getMongoCollection(MONGO_COLLECTIONS.platformSocialAccounts).deleteMany({});
  });

  it("admin can save and clear a network; public list reflects availability; audit has no secrets", async () => {
    const admin = await registerUser("admin", "admin");
    const member = await registerUser("member", "member");

    const listed = await listAdminPlatformSocialAccounts({ actorUserId: admin.userId });
    assert.equal(listed.accounts.length, 4);
    assert.deepEqual(
      listed.accounts.map((row) => row.networkId),
      ["facebook", "youtube", "instagram", "x"],
    );

    const saved = await upsertAdminPlatformSocialAccount({
      actorUserId: admin.userId,
      networkId: "instagram",
      body: { url: "https://www.instagram.com/humanity_union/" },
    });
    assert.equal(saved.enabled, true);
    assert.equal(saved.url, "https://www.instagram.com/humanity_union/");

    const publicAfterSave = await listPublicPlatformSocialAccounts();
    assert.ok(
      publicAfterSave.accounts.some(
        (row) => row.networkId === "instagram" && row.url.includes("instagram.com"),
      ),
    );

    const cleared = await upsertAdminPlatformSocialAccount({
      actorUserId: admin.userId,
      networkId: "instagram",
      body: { clear: true },
    });
    assert.equal(cleared.url, null);
    assert.equal(cleared.enabled, false);

    const publicAfterClear = await listPublicPlatformSocialAccounts();
    assert.ok(!publicAfterClear.accounts.some((row) => row.networkId === "instagram"));

    await assert.rejects(
      () =>
        upsertAdminPlatformSocialAccount({
          actorUserId: member.userId,
          networkId: "x",
          body: { url: "https://x.com/HumanityUnionWS" },
        }),
      AdministrationForbiddenError,
    );

    const audits = await listAdministrationAuditsForTarget({
      targetType: "platform_social_account",
      targetId: "instagram",
    });
    assert.ok(audits.length >= 2);
    for (const audit of audits) {
      assert.match(audit.action, /^platform\.social_account\./);
      assert.doesNotMatch(audit.afterSummary ?? "", /password|token|secret|bearer/i);
      assert.doesNotMatch(audit.beforeSummary ?? "", /password|token|secret|bearer/i);
      assert.match(audit.afterSummary ?? "", /url=(configured|cleared)/);
    }
  });
});
