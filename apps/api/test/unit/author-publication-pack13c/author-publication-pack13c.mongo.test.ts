/**
 * Pack 13C — scheduling, backdating, ownership, blocked mutations (Mongo).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

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
  blockAdminAuthor,
  blockAdminPublication,
} from "../../../src/modules/blog/admin-publishing.service.js";
import { BlogAccessDeniedError, BlogValidationError } from "../../../src/modules/blog/blog.errors.js";
import {
  cancelScheduledBlogPublication,
  createBlogDraft,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  listOwnBlogWorkspacePosts,
  listPublicBlogPosts,
  publishBlogPost,
  releaseDueScheduledBlogPublications,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByIdsForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  resetSafetyProviderForTests,
  setSafetyProviderForTests,
  type SafetyProvider,
} from "../../../src/modules/lifecycle-safety/safety-provider.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  clearMemoryNotificationRecipientsForTests,
  registerMemoryNotificationRecipient,
} from "../../../src/modules/notifications/notification.recipients.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack13c");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdPostIds: string[] = [];

const permissiveSafety: SafetyProvider = {
  providerId: "test-permissive",
  async evaluate() {
    return {
      signal: "safe",
      categories: [],
      providerId: "test-permissive",
    };
  },
};

interface TestParticipant {
  userId: string;
  participantId: string;
  displayName: string;
}

async function registerParticipant(
  label: string,
  role: "member" | "admin" = "member",
): Promise<TestParticipant> {
  const user = await insertAuthUser(
    {
      email: `${TEST_PREFIX}-${label}@pack13c.test`,
      password: "Password123!",
      displayName: `Pack13C ${label}`,
      role,
    },
    `member-${label}-${TEST_PREFIX}`,
  );
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  await markAuthUserEmailVerified(user.userId);
  const profile = await createMemberProfileForUser({
    userId: user.userId,
    displayName: user.displayName,
  });
  registerMemoryNotificationRecipient({
    memberId: user.memberId,
    userId: user.userId,
    profileId: profile.profileId,
  });
  return {
    userId: user.userId,
    participantId: user.memberId,
    displayName: user.displayName,
  };
}

describe("Pack 13C — Author publication management (Mongo)", () => {
  let adminUserId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();
    const admin = await registerParticipant("admin", "admin");
    adminUserId = admin.userId;
    setSafetyProviderForTests(permissiveSafety);
  });

  after(async () => {
    try {
      await deleteBlogPostsByIdsForTests(createdPostIds);
      await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
      for (const userId of createdAuthUserIds) {
        await deleteMemberProfilesByUserIdPrefix(userId);
      }
      await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
      clearMemoryNotificationRecipientsForTests();
      resetSafetyProviderForTests();
    } catch {
      // best effort
    }

    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    const focusedRun = process.env.PACK13C_FOCUSED_MONGO === "1";
    if (focusedRun && isolatedName?.startsWith("hu_test_") && uri) {
      try {
        await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
        cleanupSucceeded = true;
      } catch {
        cleanupSucceeded = false;
      }
      try {
        await disconnectMongoClient();
      } catch {
        // ignore
      }
      assert.equal(cleanupSucceeded, true, "isolated hu_test_* database must be dropped");
    } else {
      cleanupSucceeded = true;
    }
  });

  beforeEach(() => {
    setSafetyProviderForTests(permissiveSafety);
  });

  it("lists only own publications; other Author items absent", async () => {
    const authorA = await registerParticipant("a");
    const authorB = await registerParticipant("b");
    await grantBlogCapabilitiesForTests({
      participantId: authorA.participantId,
      capabilities: ["author", "trusted_author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: authorB.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const draftA = await createBlogDraft({
      actorParticipantId: authorA.participantId,
      actorDisplayName: authorA.displayName,
      body: {
        title: "Author A only",
        categoryId: "our_life",
        excerpt: "A",
        content: "<p>A content long enough for publish</p>",
        tags: ["a"],
      },
    });
    createdPostIds.push(draftA.postId);

    const draftB = await createBlogDraft({
      actorParticipantId: authorB.participantId,
      actorDisplayName: authorB.displayName,
      body: {
        title: "Author B only",
        categoryId: "our_life",
        excerpt: "B",
        content: "<p>B content long enough for publish</p>",
        tags: ["b"],
      },
    });
    createdPostIds.push(draftB.postId);

    const list = await listOwnBlogWorkspacePosts({
      actorParticipantId: authorA.participantId,
    });
    assert.ok(list.items.some((item) => item.postId === draftA.postId));
    assert.ok(!list.items.some((item) => item.postId === draftB.postId));
  });

  it("backdates to 2022; rejects 2021; keeps createdAt distinct from publishedAt", async () => {
    const author = await registerParticipant("backdate");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const beforeCreate = Date.now();
    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Historical essay",
        categoryId: "conscious_existence",
        excerpt: "Earlier work",
        content: "<p>Imported historical content</p>",
        tags: ["history"],
        publicationDate: "2022-01-01",
      },
    });
    createdPostIds.push(draft.postId);

    assert.ok(new Date(draft.createdAt).getTime() >= beforeCreate - 1000);
    assert.equal(draft.publishedAt, "2022-01-01T12:00:00.000Z");

    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          actorDisplayName: author.displayName,
          body: {
            title: "Too early",
            categoryId: "our_life",
            excerpt: "x",
            content: "<p>content</p>",
            tags: ["x"],
            publicationDate: "2021-12-31",
          },
        }),
      BlogValidationError,
    );

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2023-04-15",
    });
    assert.equal(published.status, "published");
    assert.equal(published.publishedAt, "2023-04-15T12:00:00.000Z");
    assert.notEqual(published.createdAt, published.publishedAt);
  });

  it("future date schedules; not public early; release makes public; reschedule works", async () => {
    const author = await registerParticipant("sched");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Future piece",
        categoryId: "human_security",
        excerpt: "Later",
        content: "<p>Scheduled content body</p>",
        tags: ["future"],
        publicationDate: "2099-06-01",
      },
    });
    createdPostIds.push(draft.postId);

    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2099-06-01",
    });
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.publishedAt, "2099-06-01T12:00:00.000Z");

    await assert.rejects(() => getPublicBlogPostBySlug(scheduled.slug));
    const publicEarly = await listPublicBlogPosts({ limit: 50, q: "Future piece" });
    assert.ok(!publicEarly.items.some((item) => item.postId === scheduled.postId));

    const rescheduled = await updateBlogDraft({
      postId: scheduled.postId,
      actorParticipantId: author.participantId,
      body: { publicationDate: "2099-07-15" },
    });
    assert.equal(rescheduled.status, "scheduled");
    assert.equal(rescheduled.publishedAt, "2099-07-15T12:00:00.000Z");

    // Simulate wall-clock reaching the scheduled instant while status remains scheduled.
    const { findBlogPostById, replaceBlogPost } = await import(
      "../../../src/modules/blog/persistence/blog.repository.js"
    );
    const pending = await findBlogPostById(scheduled.postId);
    assert.ok(pending);
    await replaceBlogPost({
      ...pending,
      publishedAt: "2024-01-15T12:00:00.000Z",
    });

    const released = await releaseDueScheduledBlogPublications();
    assert.equal(released.releasedCount, 1);
    assert.ok(released.releasedPostIds.includes(scheduled.postId));

    const publicAfter = await getPublicBlogPostBySlug(scheduled.slug);
    assert.equal(publicAfter.postId, scheduled.postId);
    assert.equal(publicAfter.publishedAt, "2024-01-15T12:00:00.000Z");
  });

  it("cancel schedule; blocked publication immutable; blocked Author mutations denied", async () => {
    const author = await registerParticipant("block");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "To schedule then cancel",
        categoryId: "our_life",
        excerpt: "x",
        content: "<p>content for schedule cancel</p>",
        tags: ["cancel"],
      },
    });
    createdPostIds.push(draft.postId);

    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2099-01-01",
    });
    assert.equal(scheduled.status, "scheduled");

    const cancelled = await cancelScheduledBlogPublication({
      postId: scheduled.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(cancelled.status, "draft");

    const published = await publishBlogPost({
      postId: cancelled.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2024-01-10",
    });
    assert.equal(published.status, "published");

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: published.postId,
      reason: "test block",
    });

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: published.postId,
          actorParticipantId: author.participantId,
        }),
      BlogAccessDeniedError,
    );
    await assert.rejects(
      () =>
        updateBlogDraft({
          postId: published.postId,
          actorParticipantId: author.participantId,
          body: { title: "Should fail" },
        }),
      BlogAccessDeniedError,
    );

    const ownList = await listOwnBlogWorkspacePosts({
      actorParticipantId: author.participantId,
    });
    const blockedRow = ownList.items.find((item) => item.postId === published.postId);
    assert.equal(blockedRow?.administrativelyBlocked, true);

    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
      reason: "author block",
    });

    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          actorDisplayName: author.displayName,
          body: {
            title: "Blocked author draft",
            categoryId: "our_life",
            excerpt: "x",
            content: "<p>content</p>",
            tags: ["blocked"],
          },
        }),
      BlogAccessDeniedError,
    );

    const stillListed = await listOwnBlogWorkspacePosts({
      actorParticipantId: author.participantId,
    });
    assert.ok(stillListed.items.some((item) => item.postId === published.postId));
  });

  it("public latest order uses publication date (backdated not newest)", async () => {
    const author = await registerParticipant("sort");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const older = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `Older backdated ${TEST_PREFIX}`,
        categoryId: "our_life",
        excerpt: "old",
        content: "<p>older content</p>",
        tags: ["sort"],
      },
    });
    createdPostIds.push(older.postId);
    await publishBlogPost({
      postId: older.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2022-06-01",
    });

    const newer = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `Newer dated ${TEST_PREFIX}`,
        categoryId: "our_life",
        excerpt: "new",
        content: "<p>newer content</p>",
        tags: ["sort"],
      },
    });
    createdPostIds.push(newer.postId);
    await publishBlogPost({
      postId: newer.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2024-06-01",
    });

    const publicList = await listPublicBlogPosts({
      limit: 50,
      q: TEST_PREFIX,
    });
    const ids = publicList.items.map((item) => item.postId);
    const olderIndex = ids.indexOf(older.postId);
    const newerIndex = ids.indexOf(newer.postId);
    assert.ok(olderIndex >= 0 && newerIndex >= 0);
    assert.ok(newerIndex < olderIndex);
  });

  it("blocked publication never auto-reappears when due", async () => {
    const author = await registerParticipant("noblockrelease");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Blocked schedule",
        categoryId: "our_life",
        excerpt: "x",
        content: "<p>content for blocked schedule</p>",
        tags: ["block-sched"],
      },
    });
    createdPostIds.push(draft.postId);

    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2099-03-01",
    });

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: scheduled.postId,
      reason: "keep blocked",
    });

    const released = await releaseDueScheduledBlogPublications({
      nowIso: "2099-03-02T12:00:00.000Z",
    });
    assert.equal(released.releasedCount, 0);
    await assert.rejects(() => getPublicBlogPostBySlug(scheduled.slug));
  });

  it("blocked Author prevents scheduled auto-release until unblocked (Pack 13E policy)", async () => {
    const author = await registerParticipant("author-block-sched");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author", "trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Author blocked before due",
        categoryId: "our_life",
        excerpt: "x",
        content: "<p>scheduled while author later blocked</p>",
        tags: ["author-block-sched"],
      },
    });
    createdPostIds.push(draft.postId);

    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      publicationDate: "2099-04-01",
    });
    assert.equal(scheduled.status, "scheduled");

    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
      reason: "block before due",
    });

    const { findBlogPostById, replaceBlogPost } = await import(
      "../../../src/modules/blog/persistence/blog.repository.js"
    );
    const pending = await findBlogPostById(scheduled.postId);
    assert.ok(pending);
    await replaceBlogPost({
      ...pending,
      publishedAt: "2024-02-01T12:00:00.000Z",
    });

    const blockedRelease = await releaseDueScheduledBlogPublications();
    assert.equal(blockedRelease.releasedCount, 0);
    await assert.rejects(() => getPublicBlogPostBySlug(scheduled.slug));

    const { unblockAdminAuthor } = await import(
      "../../../src/modules/blog/admin-publishing.service.js"
    );
    await unblockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });

    const afterUnblock = await releaseDueScheduledBlogPublications();
    assert.equal(afterUnblock.releasedCount, 1);
    const publicAfter = await getPublicBlogPostBySlug(scheduled.slug);
    assert.equal(publicAfter.postId, scheduled.postId);
  });
});
