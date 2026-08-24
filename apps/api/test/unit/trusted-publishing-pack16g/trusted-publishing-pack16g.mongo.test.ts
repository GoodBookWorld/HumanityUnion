/**
 * Pack 16G — Per-Author Trusted Publishing (Mongo, isolated hu_test_*).
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
import { listAdministrationAuditsForTarget } from "../../../src/modules/administration/audit.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  blockAdminAuthor,
  blockAdminPublication,
  listAdminAuthors,
  setAdminAuthorTrustedPublishing,
  unblockAdminAuthor,
} from "../../../src/modules/blog/admin-publishing.service.js";
import { BlogAccessDeniedError } from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByIdsForTests,
  findBlogCapabilityGrant,
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

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("pack16g");
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
      email: `${TEST_PREFIX}-${label}@pack16g.test`,
      password: "Password123!",
      displayName: `Pack16G ${label}`,
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

async function trackDraft(input: {
  author: TestParticipant;
  title: string;
  content?: string;
  publicationDate?: string;
}) {
  const draft = await createBlogDraft({
    actorParticipantId: input.author.participantId,
    actorDisplayName: input.author.displayName,
    body: {
      title: `${TEST_PREFIX} ${input.title}`,
      categoryId: "our_life",
      content: input.content ?? "<p>Trusted publishing body</p>",
      excerpt: "Excerpt",
      ...(input.publicationDate ? { publicationDate: input.publicationDate } : {}),
    },
  });
  createdPostIds.push(draft.postId);
  return draft;
}

describe("Pack 16G — Trusted Publishing Mongo", () => {
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
    const focusedRun = process.env.PACK16G_FOCUSED_MONGO === "1";
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
      try {
        await disconnectMongoClient();
      } catch {
        // ignore
      }
    }
  });

  beforeEach(() => {
    setSafetyProviderForTests(permissiveSafety);
  });

  it("defaults publishWithoutManualReview to false for new Authors", async () => {
    const author = await registerParticipant("default-off");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const grant = await findBlogCapabilityGrant(author.participantId);
    assert.equal(grant?.publishWithoutManualReview === true, false);

    const listed = await listAdminAuthors({ actorUserId: adminUserId, status: "all" });
    const row = listed.authors.find((item) => item.participantId === author.participantId);
    assert.ok(row);
    assert.equal(row.publishWithoutManualReview, false);
    assert.equal(row.status, "active");
  });

  it("normal Author submit enters review; trusted Author submit publishes immediately", async () => {
    const normal = await registerParticipant("normal");
    await grantBlogCapabilitiesForTests({
      participantId: normal.participantId,
      capabilities: ["author"],
    });
    const normalDraft = await trackDraft({ author: normal, title: "Normal Review" });
    const reviewed = await submitBlogPostForReview({
      postId: normalDraft.postId,
      actorParticipantId: normal.participantId,
    });
    assert.equal(reviewed.status, "submitted_for_review");

    const trusted = await registerParticipant("trusted");
    await grantBlogCapabilitiesForTests({
      participantId: trusted.participantId,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
    const trustedDraft = await trackDraft({
      author: trusted,
      title: "Trusted Now",
      publicationDate: "2022-01-01",
    });
    const published = await submitBlogPostForReview({
      postId: trustedDraft.postId,
      actorParticipantId: trusted.participantId,
    });
    assert.equal(published.status, "published");
    const publicPost = await getPublicBlogPostBySlug(published.slug);
    assert.equal(publicPost.postId, published.postId);
  });

  it("trusted + future date schedules; never publishes before publishedAt", async () => {
    const author = await registerParticipant("future");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
    const draft = await trackDraft({
      author,
      title: "Future Schedule",
      publicationDate: "2099-08-01",
    });
    const scheduled = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.publishedAt, "2099-08-01T12:00:00.000Z");
    await assert.rejects(() => getPublicBlogPostBySlug(scheduled.slug));
  });

  it("blocked trusted Author cannot bypass the block", async () => {
    const author = await registerParticipant("blocked-trusted");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
    await blockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });
    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          actorDisplayName: author.displayName,
          body: {
            title: `${TEST_PREFIX} Blocked`,
            categoryId: "our_life",
            content: "<p>nope</p>",
            excerpt: "nope",
          },
        }),
      BlogAccessDeniedError,
    );
    await unblockAdminAuthor({
      actorUserId: adminUserId,
      participantId: author.participantId,
    });
    const grant = await findBlogCapabilityGrant(author.participantId);
    assert.equal(grant?.publishWithoutManualReview, true);
  });

  it("publication blocked stays non-public even for trusted Authors", async () => {
    const author = await registerParticipant("pub-block");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
    const draft = await trackDraft({
      author,
      title: "Pub Block",
      publicationDate: "2022-06-01",
    });
    const published = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(published.status, "published");

    await blockAdminPublication({
      actorUserId: adminUserId,
      postId: published.postId,
    });
    await assert.rejects(() => getPublicBlogPostBySlug(published.slug));
    await assert.rejects(
      () =>
        publishBlogPost({
          postId: published.postId,
          actorParticipantId: author.participantId,
        }),
      BlogAccessDeniedError,
    );
  });

  it("Author cannot spoof Trusted Publishing; direct publish denied without grant flag", async () => {
    const author = await registerParticipant("spoof");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const draft = await trackDraft({ author, title: "Spoof Publish" });
    await assert.rejects(
      () =>
        publishBlogPost({
          postId: draft.postId,
          actorParticipantId: author.participantId,
        }),
      BlogAccessDeniedError,
    );
    const submitted = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(submitted.status, "submitted_for_review");
  });

  it("Admin disable mid-session forces next submission into review", async () => {
    const author = await registerParticipant("mid-session");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await setAdminAuthorTrustedPublishing({
      actorUserId: adminUserId,
      participantId: author.participantId,
      publishWithoutManualReview: true,
    });

    const first = await trackDraft({
      author,
      title: "While Trusted",
      publicationDate: "2023-01-01",
    });
    const published = await submitBlogPostForReview({
      postId: first.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(published.status, "published");

    await setAdminAuthorTrustedPublishing({
      actorUserId: adminUserId,
      participantId: author.participantId,
      publishWithoutManualReview: false,
    });

    const second = await trackDraft({ author, title: "After Disable" });
    const reviewed = await submitBlogPostForReview({
      postId: second.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(reviewed.status, "submitted_for_review");
  });

  it("enabling Trusted Publishing does not auto-release existing pending review", async () => {
    const author = await registerParticipant("pending-hold");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const draft = await trackDraft({ author, title: "Already Pending" });
    const pending = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(pending.status, "submitted_for_review");

    await setAdminAuthorTrustedPublishing({
      actorUserId: adminUserId,
      participantId: author.participantId,
      publishWithoutManualReview: true,
    });

    const stillPending = await findBlogPostById(draft.postId);
    assert.equal(stillPending?.status, "submitted_for_review");
  });

  it("records Trusted Publishing enable/disable audits and notifies the Author", async () => {
    const author = await registerParticipant("audit-notify");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const enabled = await setAdminAuthorTrustedPublishing({
      actorUserId: adminUserId,
      participantId: author.participantId,
      publishWithoutManualReview: true,
    });
    assert.equal(enabled.publishWithoutManualReview, true);

    const disabled = await setAdminAuthorTrustedPublishing({
      actorUserId: adminUserId,
      participantId: author.participantId,
      publishWithoutManualReview: false,
    });
    assert.equal(disabled.publishWithoutManualReview, false);

    const audits = await listAdministrationAuditsForTarget({
      targetType: "blog_capability_grant",
      targetId: author.participantId,
      limit: 20,
    });
    assert.ok(
      audits.some((row) => row.action === "blog.author.trusted_publishing.enable"),
    );
    assert.ok(
      audits.some((row) => row.action === "blog.author.trusted_publishing.disable"),
    );

    const notifications = await listMyNotifications({
      userId: author.userId,
      limit: 20,
    });
    assert.ok(
      notifications.notifications.some(
        (row) => row.eventType === "blog_author_trusted_publishing_enabled",
      ),
    );
    assert.ok(
      notifications.notifications.some(
        (row) => row.eventType === "blog_author_trusted_publishing_disabled",
      ),
    );
  });

  it("future-dated draft can still be updated before trusted submit", async () => {
    const author = await registerParticipant("update-then-submit");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    });
    const draft = await trackDraft({ author, title: "Update First" });
    const updated = await updateBlogDraft({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      body: { publicationDate: "2099-12-15", content: "<p>Updated</p>" },
    });
    assert.equal(updated.status, "draft");
    const scheduled = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(scheduled.status, "scheduled");
  });
});
