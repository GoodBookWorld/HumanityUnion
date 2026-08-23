/**
 * Pack 13A — Author application Admin delivery + Invite/Refuse (Mongo, isolated hu_test_*).
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
  BlogAccessDeniedError,
  BlogConflictError,
} from "../../../src/modules/blog/blog.errors.js";
import {
  applyForBlogAuthorCapability,
  decideBlogAuthorApplicationAsAdmin,
  getAdminAuthorApplicationReview,
  getBlogAuthoringAccessState,
} from "../../../src/modules/blog/blog.service.js";
import { resolveBlogCapabilities } from "../../../src/modules/blog/blog-permissions.js";
import { deleteBlogCapabilityGrantsByParticipantIdsForTests } from "../../../src/modules/blog/persistence/blog.repository.js";
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

const TEST_PREFIX = createTestId("pack13a");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

const validApplicationBody = {
  motivation: "I want to share constructive civic reflections with the community.",
  topics: "Human security, education, and community resilience.",
  previousWritingUrl: "https://example.com/writing",
  preferredCategoryIds: ["conscious_existence", "human_security"] as const,
  agreedToStandards: true as const,
};

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

/** Auth + Profile only — avoids member aggregate (blocked under NODE_TEST_ENV). */
async function registerParticipant(
  label: string,
  role: "member" | "admin" = "member",
): Promise<TestParticipant> {
  const user = await insertAuthUser(
    {
      email: `${TEST_PREFIX}-${label}@pack13a.test`,
      password: "Password123!",
      displayName: `Pack13A ${label}`,
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

describe("Pack 13A — Author application Mongo delivery", () => {
  let adminUserId = "";
  let adminMemberId = "";
  let cleanupSucceeded = false;

  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    await ensureMongoIndexes();

    const admin = await registerParticipant("admin", "admin");
    adminUserId = admin.userId;
    adminMemberId = admin.participantId;
  });

  after(async () => {
    try {
      await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
      for (const userId of createdAuthUserIds) {
        await deleteMemberProfilesByUserIdPrefix(userId);
      }
      await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
      clearMemoryNotificationRecipientsForTests();
      resetSafetyProviderForTests();
    } catch {
      // best effort before DB drop
    }

    // Prefer prefix cleanup when co-running the full suite (shared hu_test_* DB).
    // Drop only on focused Pack 13A runs; the recursive runner also drops after the suite.
    const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
    const uri = process.env.MONGODB_URI?.trim();
    const focusedRun = process.env.PACK13A_FOCUSED_MONGO === "1";
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

  it("submit persists PENDING, notifies Admin once, blocks duplicate", async () => {
    const applicant = await registerParticipant("submit");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    assert.equal(application.status, "submitted");

    const applicantNotes = await listMyNotifications({ userId: applicant.userId, limit: 20 });
    assert.ok(
      applicantNotes.notifications.some((n) => n.eventType === "blog_author_application_submitted"),
    );

    const adminNotes = await listMyNotifications({ userId: adminUserId, limit: 20 });
    const reviewNotes = adminNotes.notifications.filter(
      (n) =>
        n.eventType === "blog_author_application_review_requested" &&
        n.relatedEntityId === application.applicationId,
    );
    assert.equal(reviewNotes.length, 1);
    assert.match(reviewNotes[0]!.message, /submitted an Author application/);

    await assert.rejects(
      () =>
        applyForBlogAuthorCapability({
          actorParticipantId: applicant.participantId,
          body: { ...validApplicationBody, motivation: "Second attempt with enough characters." },
        }),
      BlogConflictError,
    );

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "application_submitted");
    assert.equal(state.canApply, false);
  });

  it("Admin review modal payload; non-admin denied", async () => {
    const applicant = await registerParticipant("review");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    const review = await getAdminAuthorApplicationReview({
      actorUserId: adminUserId,
      applicationId: application.applicationId,
    });
    assert.equal(review.applicationId, application.applicationId);
    assert.equal(review.participantId, applicant.participantId);
    assert.equal(review.status, "submitted");
    assert.match(review.motivation, /constructive/);

    await assert.rejects(
      () =>
        getAdminAuthorApplicationReview({
          actorUserId: applicant.userId,
          applicationId: application.applicationId,
        }),
      BlogAccessDeniedError,
    );
  });

  it("Invite accepts once, grants Author, notifies applicant; duplicate Invite idempotent", async () => {
    const applicant = await registerParticipant("invite");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    const accepted = await decideBlogAuthorApplicationAsAdmin({
      actorUserId: adminUserId,
      applicationId: application.applicationId,
      decision: "approve",
    });
    assert.equal(accepted.status, "approved");
    assert.equal(accepted.decidedByParticipantId, adminMemberId);

    const caps = await resolveBlogCapabilities({ participantId: applicant.participantId });
    assert.equal(caps.has("author"), true);

    const notes = await listMyNotifications({ userId: applicant.userId, limit: 20 });
    assert.ok(
      notes.notifications.some((n) => n.eventType === "blog_author_application_approved"),
    );
    assert.ok(
      notes.notifications.some((n) => n.relatedUrl === "/workspace/publishing"),
    );

    const again = await decideBlogAuthorApplicationAsAdmin({
      actorUserId: adminUserId,
      applicationId: application.applicationId,
      decision: "approve",
    });
    assert.equal(again.status, "approved");

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "author");
    assert.equal(state.canApply, false);
    assert.equal(state.publishingWorkspaceHref, "/workspace/publishing");

    await assert.rejects(
      () =>
        applyForBlogAuthorCapability({
          actorParticipantId: applicant.participantId,
          body: { ...validApplicationBody },
        }),
      BlogConflictError,
    );
  });

  it("Refuse sets declined, no Author grant, applicant notified, reapply allowed", async () => {
    const applicant = await registerParticipant("refuse");
    const application = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: { ...validApplicationBody },
    });

    await assert.rejects(
      () =>
        decideBlogAuthorApplicationAsAdmin({
          actorUserId: applicant.userId,
          applicationId: application.applicationId,
          decision: "decline",
        }),
      BlogAccessDeniedError,
    );

    const refused = await decideBlogAuthorApplicationAsAdmin({
      actorUserId: adminUserId,
      applicationId: application.applicationId,
      decision: "decline",
      reviewNote: "Please strengthen topic focus.",
    });
    assert.equal(refused.status, "declined");
    assert.equal(refused.reviewNote, "Please strengthen topic focus.");

    const caps = await resolveBlogCapabilities({ participantId: applicant.participantId });
    assert.equal(caps.has("author"), false);

    const notes = await listMyNotifications({ userId: applicant.userId, limit: 20 });
    const declineNote = notes.notifications.find(
      (n) => n.eventType === "blog_author_application_declined",
    );
    assert.ok(declineNote);
    assert.match(declineNote!.message, /not accepted at this time/);
    assert.match(declineNote!.message, /strengthen topic focus/);

    const state = await getBlogAuthoringAccessState({
      actorParticipantId: applicant.participantId,
    });
    assert.equal(state.presentation, "application_declined");
    assert.equal(state.canApply, true);

    const reapply = await applyForBlogAuthorCapability({
      actorParticipantId: applicant.participantId,
      body: {
        ...validApplicationBody,
        motivation: "Revised motivation with clearer constructive intent.",
      },
    });
    assert.equal(reapply.status, "submitted");
    assert.notEqual(reapply.applicationId, application.applicationId);
  });
});
