/**
 * Production Completion Pack 01 — Support links mongo auth (isolated hu_test_*).
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
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  listAdminPlatformSupportLinks,
  listPublicPlatformSupportLinks,
  resetPlatformSupportLinksStoreForTests,
  setPlatformSupportLinksForceMemoryForTests,
  upsertAdminPlatformSupportLink,
} from "../../../src/modules/platform-support-links/index.js";
import { getAdminDiagnosticsHealth } from "../../../src/modules/administration/admin-diagnostics-health.service.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack01-support");
const createdAuthUserIds: string[] = [];

async function registerUser(label: string, role: "member" | "admin") {
  const user = await insertAuthUser(
    {
      email: `${TEST_PREFIX}-${label}@pack01.test`,
      password: "Password123!",
      displayName: `Pack01 ${label}`,
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

describe("Production Completion Pack 01 — support links + diagnostics auth (mongo)", () => {
  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    setPlatformSupportLinksForceMemoryForTests(false);
    resetPlatformSupportLinksStoreForTests();
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
    resetPlatformSupportLinksStoreForTests();
    await getMongoCollection(MONGO_COLLECTIONS.platformSupportLinks).deleteMany({});
  });

  it("admin can save support links; member forbidden; public list reflects enabled URLs", async () => {
    const admin = await registerUser("admin", "admin");
    const member = await registerUser("member", "member");

    const listed = await listAdminPlatformSupportLinks({ actorUserId: admin.userId });
    assert.equal(listed.links.length, 3);

    const saved = await upsertAdminPlatformSupportLink({
      actorUserId: admin.userId,
      linkId: "volunteer",
      body: { url: "https://example.com/volunteer" },
    });
    assert.equal(saved.enabled, true);

    const publicAfter = await listPublicPlatformSupportLinks();
    assert.ok(publicAfter.links.some((row) => row.linkId === "volunteer"));

    await assert.rejects(
      () =>
        upsertAdminPlatformSupportLink({
          actorUserId: member.userId,
          linkId: "donation",
          body: { url: "https://example.com/donate" },
        }),
      AdministrationForbiddenError,
    );
  });

  it("Admin diagnostics health allows admin; forbids member and unauthenticated", async () => {
    const admin = await registerUser("diag-admin", "admin");
    const member = await registerUser("diag-member", "member");

    const health = await getAdminDiagnosticsHealth({ actorUserId: admin.userId });
    assert.ok(health.mongodb);
    assert.ok(health.email);
    assert.ok(health.outbox);
    assert.equal("database" in health.mongodb, false);
    assert.doesNotMatch(JSON.stringify(health), /mongodb(\+srv)?:\/\//i);

    await assert.rejects(
      () => getAdminDiagnosticsHealth({ actorUserId: member.userId }),
      AdministrationForbiddenError,
    );
    await assert.rejects(
      () => getAdminDiagnosticsHealth({ actorUserId: "" }),
      AdministrationUnauthorizedError,
    );
  });
});
