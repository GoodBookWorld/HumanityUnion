/**
 * Pack 14B — publication review Admin notification + pending queue (Mongo).
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
import { blockAdminPublication } from "../../../src/modules/blog/admin-publishing.service.js";
import {
  listAdminPendingPublicationReviews,
  reconcilePendingPublicationReviews,
} from "../../../src/modules/blog/blog-publication-review-reconciliation.js";
import { BlogAccessDeniedError } from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
  requestBlogPostChanges,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByIdsForTests,
  findBlogPostById,
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
import { blogPublicationReviewNotificationEntityId } from "../../../src/modules/blog/blog-publication-notifications.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack14b");
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
      email: `${TEST_PREFIX}-${label}@pack14b.test`,
      password: "Password123!",
      displayName: `Pack14B ${label}`,
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

describe("Pack 14B — Publication review notifications (Mongo)", () => {
  let adminUserId = "";
  let adminParticipantId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();
    setSafetyProviderForTests(permissiveSafety);
    const admin = await registerParticipant("admin", "admin");
    adminUserId = admin.userId;
    adminParticipantId = admin.participantId;
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
    const focusedRun = process.env.PACK14B_FOCUSED_MONGO === "1";
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
      assert.equal(cleanupSucceeded, true);
    } else {
      cleanupSucceeded = true;
    }
  });

  it("draft → submit creates one Admin review notification; save draft does not; queue lists item", async () => {
    const author = await registerParticipant("author-submit");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Pack 14B Review Article",
        categoryId: "our_life",
        content: "<p>Constructive civic article awaiting Admin review notification.</p>",
        excerpt: "Constructive excerpt for review",
      },
    });
    createdPostIds.push(draft.postId);

    const beforeSubmit = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const beforeCount = beforeSubmit.notifications.filter(
      (n) => n.eventType === "blog_publication_review_requested",
    ).length;

    await updateBlogDraft({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      body: { excerpt: "Updated draft excerpt without submit" },
    });

    const afterDraft = await listMyNotifications({ userId: adminUserId, limit: 50 });
    assert.equal(
      afterDraft.notifications.filter((n) => n.eventType === "blog_publication_review_requested")
        .length,
      beforeCount,
    );

    const submitted = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(submitted.status, "submitted_for_review");
    assert.equal(submitted.review.reviewStatus, "pending");

    const afterSubmit = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const reviewNotes = afterSubmit.notifications.filter(
      (n) =>
        n.eventType === "blog_publication_review_requested" &&
        n.relatedUrl?.includes(draft.postId),
    );
    assert.equal(reviewNotes.length, 1);
    assert.match(reviewNotes[0]!.title, /Publication submitted for review/);
    assert.match(reviewNotes[0]!.message, /Pack 14B Review Article/);
    assert.match(reviewNotes[0]!.relatedUrl ?? "", /\/workspace\/editorial\//);

    const queue = await listAdminPendingPublicationReviews({ actorUserId: adminUserId });
    const row = queue.publications.find((item) => item.postId === draft.postId);
    assert.ok(row);
    assert.equal(row?.hasAdminReviewNotification, true);
    assert.equal(row?.status, "submitted_for_review");

    // Idempotent reconcile for same submission cycle
    const persisted = await findBlogPostById(draft.postId);
    assert.ok(persisted?.submittedAt);
    const cycleId = blogPublicationReviewNotificationEntityId(
      draft.postId,
      persisted!.submittedAt!,
    );
    assert.equal(reviewNotes[0]!.relatedEntityId, cycleId);

    const second = await reconcilePendingPublicationReviews({ actorUserId: adminUserId });
    assert.equal(second.notificationsCreated, 0);
  });

  it("resubmit after return creates a new review cycle notification; approval preserves dates", async () => {
    const author = await registerParticipant("author-resubmit");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Resubmit Cycle Article",
        categoryId: "our_life",
        content: "<p>Article for return and resubmit notification cycle.</p>",
        excerpt: "Resubmit excerpt",
        publicationDate: "2030-06-15",
      },
    });
    createdPostIds.push(draft.postId);

    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await requestBlogPostChanges({
      postId: draft.postId,
      actorParticipantId: adminParticipantId,
      role: "admin",
      reviewNote: "Please clarify the opening paragraph.",
    });

    const authorNotes = await listMyNotifications({ userId: author.userId, limit: 20 });
    assert.ok(authorNotes.notifications.some((n) => n.eventType === "blog_post_changes_requested"));

    const afterReturn = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const firstCycleCount = afterReturn.notifications.filter(
      (n) =>
        n.eventType === "blog_publication_review_requested" &&
        n.relatedUrl?.includes(draft.postId),
    ).length;

    const resubmitted = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(resubmitted.status, "submitted_for_review");

    const afterResubmit = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const cycles = afterResubmit.notifications.filter(
      (n) =>
        n.eventType === "blog_publication_review_requested" &&
        n.relatedUrl?.includes(draft.postId),
    );
    assert.equal(cycles.length, firstCycleCount + 1);

    const approved = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: adminParticipantId,
      role: "admin",
    });
    assert.equal(approved.status, "scheduled");
    assert.ok(approved.publishedAt?.startsWith("2030-06-15"));

    const authorAfter = await listMyNotifications({ userId: author.userId, limit: 30 });
    assert.ok(authorAfter.notifications.some((n) => n.eventType === "blog_post_published"));
  });

  it("historical date preserved on approval; blocked publication cannot resubmit", async () => {
    const author = await registerParticipant("author-history");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Historical Date Article",
        categoryId: "our_life",
        content: "<p>Historical publication date must survive review approval.</p>",
        excerpt: "Historical excerpt",
        publicationDate: "2023-03-20",
      },
    });
    createdPostIds.push(draft.postId);

    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: adminParticipantId,
      role: "admin",
    });
    assert.equal(published.status, "published");
    assert.ok(published.publishedAt?.startsWith("2023-03-20"));

    const blockedAuthor = await registerParticipant("author-blocked-pub");
    await grantBlogCapabilitiesForTests({
      participantId: blockedAuthor.participantId,
      capabilities: ["author"],
    });
    const blockedDraft = await createBlogDraft({
      actorParticipantId: blockedAuthor.participantId,
      actorDisplayName: blockedAuthor.displayName,
      body: {
        title: "Blocked Submit Article",
        categoryId: "our_life",
        content: "<p>Blocked publications must not enter review via resubmit.</p>",
        excerpt: "Blocked excerpt",
      },
    });
    createdPostIds.push(blockedDraft.postId);

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: blockedDraft.postId,
    });

    await assert.rejects(
      () =>
        submitBlogPostForReview({
          postId: blockedDraft.postId,
          actorParticipantId: blockedAuthor.participantId,
        }),
      BlogAccessDeniedError,
    );
  });

  it("pending queue exposes submitted publication even when reconcile is the recovery path", async () => {
    const author = await registerParticipant("author-queue");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Queue Authority Article",
        categoryId: "our_life",
        content: "<p>Queue remains authority when notifications are reconciled later.</p>",
        excerpt: "Queue excerpt",
      },
    });
    createdPostIds.push(draft.postId);
    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const queue = await listAdminPendingPublicationReviews({ actorUserId: adminUserId });
    assert.ok(queue.publications.some((item) => item.postId === draft.postId));
  });
});
