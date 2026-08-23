/**
 * Pack 13B — Admin Author registry + Publication soft-block (Mongo, isolated hu_test_*).
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
  listAdminAuthors,
  listAdminPublications,
  unblockAdminAuthor,
  unblockAdminPublication,
} from "../../../src/modules/blog/admin-publishing.service.js";
import { BlogAccessDeniedError, BlogConflictError } from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  getBlogAuthoringAccessState,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  listPublicBlogPosts,
  publishBlogPost,
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
import { listMyNotifications } from "../../../src/modules/notifications/notification.service.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack13b");
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
      email: `${TEST_PREFIX}-${label}@pack13b.test`,
      password: "Password123!",
      displayName: `Pack13B ${label}`,
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

describe("Pack 13B — Admin Publishing Mongo", () => {
  let adminUserId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();
    const admin = await registerParticipant("admin", "admin");
    adminUserId = admin.userId;
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
    const focusedRun = process.env.PACK13B_FOCUSED_MONGO === "1";
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

  it("lists accepted Authors; refused applicants excluded; block/unblock Author", async () => {
    const author = await registerParticipant("author-a");
    const refused = await registerParticipant("refused-a");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: refused.participantId,
      capabilities: ["author_applicant"],
    });

    const listed = await listAdminAuthors({ actorUserId: adminUserId, status: "all" });
    assert.ok(listed.authors.some((row) => row.participantId === author.participantId));
    assert.equal(
      listed.authors.some((row) => row.participantId === refused.participantId),
      false,
    );

    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
      reason: "Policy review",
    });

    const blockedState = await getBlogAuthoringAccessState({
      actorParticipantId: author.participantId,
    });
    assert.equal(blockedState.presentation, "author_blocked");
    assert.equal(blockedState.publishingWorkspaceHref, null);

    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          body: {
            title: "Blocked author draft",
            excerpt: "Should not create while blocked.",
            content: "<p>Blocked author cannot create drafts.</p>",
            categoryId: "conscious_existence",
            tags: ["test"],
          },
        }),
      BlogAccessDeniedError,
    );

    const notes = await listMyNotifications({ userId: author.userId, limit: 20 });
    assert.ok(notes.notifications.some((n) => n.eventType === "blog_author_access_blocked"));

    await unblockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });
    const restored = await getBlogAuthoringAccessState({
      actorParticipantId: author.participantId,
    });
    assert.equal(restored.presentation, "author");
    assert.equal(restored.publishingWorkspaceHref, "/workspace/publishing");
  });

  it("publication block hides public item; Author block does not cascade-hide", async () => {
    const author = await registerParticipant("author-pub");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `Pack13B Public ${TEST_PREFIX}`,
        excerpt: "Visible until individually blocked.",
        content: "<p>Public body for Pack 13B visibility tests.</p>",
        categoryId: "human_security",
        tags: ["pack13b"],
      },
    });
    createdPostIds.push(draft.postId);

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    const slug = published.slug;

    const before = await listPublicBlogPosts({ limit: 50, offset: 0, q: "Pack13B Public" });
    assert.ok(before.items.some((item) => item.postId === draft.postId));

    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });

    const afterAuthorBlock = await listPublicBlogPosts({
      limit: 50,
      offset: 0,
      q: "Pack13B Public",
    });
    assert.ok(
      afterAuthorBlock.items.some((item) => item.postId === draft.postId),
      "Author block must not hide existing public publications",
    );

    await unblockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: draft.postId,
      reason: "Temporary removal",
    });

    const afterPubBlock = await listPublicBlogPosts({
      limit: 50,
      offset: 0,
      q: "Pack13B Public",
    });
    assert.equal(
      afterPubBlock.items.some((item) => item.postId === draft.postId),
      false,
    );
    await assert.rejects(() => getPublicBlogPostBySlug(slug), /Published Blog post not found/);
  });

  it("publication unblock restores published visibility; draft stays draft; Author remains active", async () => {
    const author = await registerParticipant("author-restore");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const publishedDraft = await createBlogDraft({
      actorParticipantId: author.participantId,
      body: {
        title: `Pack13B Restore ${TEST_PREFIX}`,
        excerpt: "Restore visibility after unblock.",
        content: "<p>Restore body for Pack 13B.</p>",
        categoryId: "our_life",
        tags: ["restore"],
      },
    });
    createdPostIds.push(publishedDraft.postId);
    const published = await publishBlogPost({
      postId: publishedDraft.postId,
      actorParticipantId: author.participantId,
    });

    const plainDraft = await createBlogDraft({
      actorParticipantId: author.participantId,
      body: {
        title: `Pack13B Draft ${TEST_PREFIX}`,
        excerpt: "Must remain draft after publication unblock elsewhere.",
        content: "<p>Draft stays draft.</p>",
        categoryId: "our_life",
        tags: ["draft"],
      },
    });
    createdPostIds.push(plainDraft.postId);

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: published.postId,
    });
    await unblockAdminPublication({
      actorUserId: adminUserId,
      postId: published.postId,
    });

    const publicAgain = await getPublicBlogPostBySlug(published.slug);
    assert.equal(publicAgain.postId, published.postId);

    const directory = await listAdminPublications({
      actorUserId: adminUserId,
      status: "draft",
      q: "Pack13B Draft",
    });
    assert.ok(directory.publications.some((row) => row.postId === plainDraft.postId));
    assert.ok(directory.publications.every((row) => row.status === "draft"));

    const authors = await listAdminAuthors({
      actorUserId: adminUserId,
      status: "active",
      q: author.displayName,
    });
    assert.ok(
      authors.authors.some(
        (row) => row.participantId === author.participantId && row.status === "active",
      ),
    );

    await assert.rejects(
      () =>
        blockAdminAuthor({
          actorUserId: author.userId,
          participantId: author.participantId,
        }),
      /Administrator access is required/,
    );
  });

  it("duplicate Author block is conflict; publication block notifies author", async () => {
    const author = await registerParticipant("author-notify");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      body: {
        title: `Pack13B Notify ${TEST_PREFIX}`,
        excerpt: "Notify on publication block.",
        content: "<p>Notify body.</p>",
        categoryId: "conscious_existence",
        tags: ["notify"],
      },
    });
    createdPostIds.push(draft.postId);
    await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });
    await assert.rejects(
      () =>
        blockAdminAuthor({
          actorUserId: adminUserId,
          participantId: author.participantId,
        }),
      BlogConflictError,
    );
    await unblockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: draft.postId,
    });
    const notes = await listMyNotifications({ userId: author.userId, limit: 30 });
    assert.ok(notes.notifications.some((n) => n.eventType === "blog_publication_blocked"));
  });
});
