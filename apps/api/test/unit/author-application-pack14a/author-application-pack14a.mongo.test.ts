/**
 * Pack 14A — legacy pending Author application reconciliation (Mongo).
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
  listAdminPendingAuthorApplications,
  markInvalidLegacyAuthorApplicationForResubmit,
  reconcilePendingAuthorApplications,
} from "../../../src/modules/blog/blog-author-application-reconciliation.js";
import { getAdminAuthorApplicationReview } from "../../../src/modules/blog/blog.service.js";
import {
  insertBlogAuthorApplication,
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import {
  clearMemoryNotificationRecipientsForTests,
  registerMemoryNotificationRecipient,
} from "../../../src/modules/notifications/notification.recipients.js";
import { listMyNotifications } from "../../../src/modules/notifications/notification.service.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack14a");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdApplicationIds: string[] = [];

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
      email: `${TEST_PREFIX}-${label}@pack14a.test`,
      password: "Password123!",
      displayName: `Pack14A ${label}`,
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

async function insertLegacyPendingApplication(input: {
  participantId: string;
  applicationId: string;
  createdAt: string;
  motivation?: string;
  topics?: string;
  agreedToStandards?: boolean;
}): Promise<void> {
  await insertBlogAuthorApplication({
    applicationId: input.applicationId,
    participantId: input.participantId,
    status: "submitted",
    motivation: input.motivation ?? "I want to contribute thoughtful writing to the Blog.",
    topics: input.topics ?? "Human security and community life topics.",
    preferredCategoryIds: ["our_life"],
    agreedToStandards: input.agreedToStandards ?? true,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
  createdApplicationIds.push(input.applicationId);
}

describe("Pack 14A — Author application recovery (Mongo)", () => {
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
      if (createdApplicationIds.length > 0) {
        const collection = getMongoCollection(MONGO_COLLECTIONS.blogAuthorApplications);
        await collection.deleteMany({ applicationId: { $in: createdApplicationIds } });
      }
      await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
      for (const userId of createdAuthUserIds) {
        await deleteMemberProfilesByUserIdPrefix(userId);
      }
      await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
      clearMemoryNotificationRecipientsForTests();
    } catch {
      // best effort
    }

    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    const focusedRun = process.env.PACK14A_FOCUSED_MONGO === "1";
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

  it("legacy pending without notification gets one review notification; second reconcile is idempotent", async () => {
    const applicant = await registerParticipant("legacy");
    const submittedAt = "2026-01-10T10:00:00.000Z";
    const applicationId = `blog-app-legacy-${TEST_PREFIX}`;
    await insertLegacyPendingApplication({
      participantId: applicant.participantId,
      applicationId,
      createdAt: submittedAt,
    });

    const first = await reconcilePendingAuthorApplications({ actorUserId: adminUserId });
    assert.ok(first.notificationsCreated >= 1);
    assert.ok(first.recoveredApplicationIds.includes(applicationId));

    const adminNotes = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const reviewNotes = adminNotes.notifications.filter(
      (n) =>
        n.eventType === "blog_author_application_review_requested" &&
        n.relatedEntityId === applicationId,
    );
    assert.equal(reviewNotes.length, 1);

    const second = await reconcilePendingAuthorApplications({ actorUserId: adminUserId });
    assert.equal(second.notificationsCreated, 0);
    assert.ok(second.skippedAlreadyNotified >= 1);

    const after = await listMyNotifications({ userId: adminUserId, limit: 50 });
    const afterReview = after.notifications.filter(
      (n) =>
        n.eventType === "blog_author_application_review_requested" &&
        n.relatedEntityId === applicationId,
    );
    assert.equal(afterReview.length, 1);

    const queue = await listAdminPendingAuthorApplications({ actorUserId: adminUserId });
    const row = queue.applications.find((item) => item.applicationId === applicationId);
    assert.ok(row);
    assert.equal(row?.submittedAt, submittedAt);
    assert.equal(row?.hasAdminReviewNotification, true);

    const review = await getAdminAuthorApplicationReview({
      actorUserId: adminUserId,
      applicationId,
    });
    assert.equal(review.motivation.includes("thoughtful writing"), true);
    assert.equal(review.submittedAt, submittedAt);
  });

  it("pending queue exposes application even when notification creation is not required", async () => {
    const applicant = await registerParticipant("queue-only");
    const applicationId = `blog-app-queue-${TEST_PREFIX}`;
    await insertLegacyPendingApplication({
      participantId: applicant.participantId,
      applicationId,
      createdAt: "2026-02-01T08:00:00.000Z",
    });

    const queue = await listAdminPendingAuthorApplications({ actorUserId: adminUserId });
    assert.ok(queue.applications.some((item) => item.applicationId === applicationId));
  });

  it("approved and declined applications are not reconciled; invalid uses recovery reset", async () => {
    const approvedApplicant = await registerParticipant("approved");
    const declinedApplicant = await registerParticipant("declined");
    const invalidApplicant = await registerParticipant("invalid");

    const approvedId = `blog-app-approved-${TEST_PREFIX}`;
    const declinedId = `blog-app-declined-${TEST_PREFIX}`;
    const invalidId = `blog-app-invalid-${TEST_PREFIX}`;

    await insertBlogAuthorApplication({
      applicationId: approvedId,
      participantId: approvedApplicant.participantId,
      status: "approved",
      motivation: "Approved application body that is long enough.",
      topics: "Approved topics that are long enough.",
      preferredCategoryIds: ["our_life"],
      agreedToStandards: true,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      decidedAt: "2026-03-02T00:00:00.000Z",
    });
    createdApplicationIds.push(approvedId);

    await insertBlogAuthorApplication({
      applicationId: declinedId,
      participantId: declinedApplicant.participantId,
      status: "declined",
      motivation: "Declined application body that is long enough.",
      topics: "Declined topics that are long enough.",
      preferredCategoryIds: ["our_life"],
      agreedToStandards: true,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      decidedAt: "2026-03-02T00:00:00.000Z",
    });
    createdApplicationIds.push(declinedId);

    await insertBlogAuthorApplication({
      applicationId: invalidId,
      participantId: invalidApplicant.participantId,
      status: "submitted",
      motivation: "short",
      topics: "x",
      preferredCategoryIds: ["our_life"],
      agreedToStandards: false,
      createdAt: "2026-03-05T00:00:00.000Z",
      updatedAt: "2026-03-05T00:00:00.000Z",
    });
    createdApplicationIds.push(invalidId);

    const result = await reconcilePendingAuthorApplications({ actorUserId: adminUserId });
    assert.ok(!result.recoveredApplicationIds.includes(approvedId));
    assert.ok(!result.recoveredApplicationIds.includes(declinedId));
    assert.ok(result.skippedInvalid >= 1);

    const reset = await markInvalidLegacyAuthorApplicationForResubmit({
      actorUserId: adminUserId,
      applicationId: invalidId,
    });
    assert.equal(reset.status, "changes_requested");
    assert.ok(reset.reviewNote);
    assert.equal(reset.createdAt, "2026-03-05T00:00:00.000Z");
  });
});
