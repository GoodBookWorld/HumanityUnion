/**
 * Pack 16F — Admin category CRUD (Mongo, isolated hu_test_*).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  activateAdminBlogCategory,
  createAdminBlogCategory,
  deactivateAdminBlogCategory,
  deleteAdminBlogCategory,
  listAdminBlogCategories,
  updateAdminBlogCategory,
} from "../../../src/modules/blog/blog-category-admin.service.js";
import {
  ensureBlogCategoriesSeeded,
  invalidateBlogCategoryCache,
  isActiveBlogCategoryId,
  listBlogCategories,
} from "../../../src/modules/blog/blog-categories.js";
import { BlogConflictError } from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  grantBlogCapabilitiesForTests,
} from "../../../src/modules/blog/blog.service.js";
import { deleteBlogCategoryRecordsByIdPrefixForTests } from "../../../src/modules/blog/persistence/blog-category.repository.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByIdsForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  resetSafetyProviderForTests,
  setSafetyProviderForTests,
  type SafetyProvider,
} from "../../../src/modules/lifecycle-safety/safety-provider.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack16f");
const CATEGORY_ID_PREFIX = TEST_PREFIX.replace(/-/g, "_");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdPostIds: string[] = [];
const createdCategoryIds: string[] = [];

const permissiveSafety: SafetyProvider = {
  providerId: "test-permissive",
  async evaluate() {
    return { signal: "safe", categories: [], providerId: "test-permissive" };
  },
};

async function registerAdmin(): Promise<{ userId: string; participantId: string }> {
  const suffix = createTestId("a");
  const memberId = `member-admin-${suffix}`;
  const user = await insertAuthUser(
    {
      email: `${suffix}-admin@example.com`,
      password: "Password123!",
      displayName: "Pack16F Admin",
      role: "admin",
    },
    memberId,
  );
  await markAuthUserEmailVerified(user.userId);
  await createMemberProfileForUser({ userId: user.userId, displayName: "Pack16F Admin" });
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  return { userId: user.userId, participantId: user.memberId };
}

async function registerAuthor(): Promise<{ userId: string; participantId: string }> {
  const suffix = createTestId("u");
  const memberId = `member-author-${suffix}`;
  const user = await insertAuthUser(
    {
      email: `${suffix}-author@example.com`,
      password: "Password123!",
      displayName: "Pack16F Author",
      role: "member",
    },
    memberId,
  );
  await markAuthUserEmailVerified(user.userId);
  await createMemberProfileForUser({ userId: user.userId, displayName: "Pack16F Author" });
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  await grantBlogCapabilitiesForTests({
    participantId: user.memberId,
    capabilities: ["author"],
  });
  return { userId: user.userId, participantId: user.memberId };
}

describe("Pack 16F — publication categories (Mongo)", () => {
  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();
    setSafetyProviderForTests(permissiveSafety);
    invalidateBlogCategoryCache();
    await ensureBlogCategoriesSeeded();
  });

  after(async () => {
    resetSafetyProviderForTests();
    if (createdPostIds.length > 0) {
      await deleteBlogPostsByIdsForTests(createdPostIds);
    }
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteBlogCategoryRecordsByIdPrefixForTests(`${CATEGORY_ID_PREFIX}_`);
    await deleteBlogCategoryRecordsByIdPrefixForTests(CATEGORY_ID_PREFIX);
    // Auth/profile rows use per-call createTestId suffixes; isolated DB drop covers leftovers.
    await deleteMemberProfilesByUserIdPrefix("a-");
    await deleteMemberProfilesByUserIdPrefix("u-");
    await deleteAuthUsersByEmailPrefix("a-");
    await deleteAuthUsersByEmailPrefix("u-");
    invalidateBlogCategoryCache();
    if (process.env.PACK16F_FOCUSED_MONGO === "1") {
      await dropIsolatedTestDatabase({
        databaseName: process.env[TEST_DATABASE_ENV_VAR]!,
      });
    }
    await disconnectMongoClient();
  });

  it("seeds canonical categories and allows admin create/rename/deactivate", async () => {
    const admin = await registerAdmin();
    const listed = await listAdminBlogCategories({ actorUserId: admin.userId });
    assert.ok(listed.categories.some((row) => row.categoryId === "our_life"));

    const created = await createAdminBlogCategory({
      actorUserId: admin.userId,
      body: {
        name: `${TEST_PREFIX} Civic Notes`,
        slug: `${TEST_PREFIX}-civic-notes`,
        categoryId: `${CATEGORY_ID_PREFIX}_civic_notes`,
        description: "Pack 16F test category",
      },
    });
    createdCategoryIds.push(created.categoryId);
    assert.equal(created.categoryId, `${CATEGORY_ID_PREFIX}_civic_notes`);

    const renamed = await updateAdminBlogCategory({
      actorUserId: admin.userId,
      categoryId: created.categoryId,
      body: { name: `${TEST_PREFIX} Civic Notes Renamed` },
    });
    assert.match(renamed.name, /Renamed/);
    assert.equal(renamed.categoryId, created.categoryId);

    const deactivated = await deactivateAdminBlogCategory({
      actorUserId: admin.userId,
      categoryId: created.categoryId,
    });
    assert.equal(deactivated.status, "inactive");
    assert.equal(isActiveBlogCategoryId(created.categoryId), false);
    assert.ok(!listBlogCategories().some((row) => row.categoryId === created.categoryId));

    const reactivated = await activateAdminBlogCategory({
      actorUserId: admin.userId,
      categoryId: created.categoryId,
    });
    assert.equal(reactivated.status, "active");
  });

  it("blocks delete when publications reference the category unless reassigned", async () => {
    const admin = await registerAdmin();
    const author = await registerAuthor();
    const created = await createAdminBlogCategory({
      actorUserId: admin.userId,
      body: {
        name: `${TEST_PREFIX} Delete Guard`,
        slug: `${TEST_PREFIX}-delete-guard`,
        categoryId: `${CATEGORY_ID_PREFIX}_delete_guard`,
      },
    });
    createdCategoryIds.push(created.categoryId);

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: "Pack16F Author",
      body: {
        title: `${TEST_PREFIX} Categorized Post`,
        categoryId: created.categoryId,
        content: "<p>Body</p>",
        excerpt: "Body",
      },
    });
    createdPostIds.push(draft.postId);

    await assert.rejects(
      () =>
        deleteAdminBlogCategory({
          actorUserId: admin.userId,
          categoryId: created.categoryId,
        }),
      BlogConflictError,
    );

    const deleted = await deleteAdminBlogCategory({
      actorUserId: admin.userId,
      categoryId: created.categoryId,
      reassignToCategoryId: "our_life",
    });
    assert.equal(deleted.deleted, true);
    assert.ok(deleted.reassignedCount >= 1);
  });
});
