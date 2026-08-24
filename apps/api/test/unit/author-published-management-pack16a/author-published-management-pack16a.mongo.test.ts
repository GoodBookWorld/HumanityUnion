/**
 * Pack 16A — Author published Edit/Correct + Delete (Mongo).
 * Uses insertAuthUser (not full registration) so NODE_TEST_ENV does not block member writes.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  deleteAuthUsersByEmailPrefix,
  insertAuthUser,
  markAuthUserEmailVerified,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogNotFoundError,
} from "../../../src/modules/blog/blog.errors.js";
import {
  archiveBlogPost,
  createBlogDraft,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
  startPublishedCorrection,
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
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-p16a");
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

async function registerParticipant(label: string): Promise<TestParticipant> {
  const user = await insertAuthUser(
    {
      email: `${TEST_PREFIX}-${label}@blog-16a.test`,
      password: "Password123!",
      displayName: `Blog ${label}`,
      role: "member",
    },
    `member-${label}-${TEST_PREFIX}`,
  );
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  await markAuthUserEmailVerified(user.userId);
  await createMemberProfileForUser({
    userId: user.userId,
    displayName: user.displayName,
  });
  return {
    userId: user.userId,
    participantId: user.memberId,
    displayName: user.displayName,
  };
}

describe("Pack 16A — Author published management (Mongo)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    try {
      await deleteBlogPostsByIdsForTests(createdPostIds);
      await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
      for (const userId of createdAuthUserIds) {
        await deleteMemberProfilesByUserIdPrefix(userId);
      }
      await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
      resetSafetyProviderForTests();
    } catch {
      // best effort
    }
    await disconnectMongoClient();
  });

  beforeEach(() => {
    setSafetyProviderForTests(permissiveSafety);
  });

  it("standard Author cannot PATCH published; startPublishedCorrection → draft, same identity, not public", async () => {
    const author = await registerParticipant("std");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Correct Me`,
        categoryId: "our_life",
        content: "<p>Public V1</p>",
        excerpt: "V1",
      },
    });
    createdPostIds.push(draft.postId);
    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const editor = await registerParticipant("ed");
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });
    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: editor.participantId,
    });

    await assert.rejects(
      () =>
        updateBlogDraft({
          postId: draft.postId,
          actorParticipantId: author.participantId,
          body: { content: "<p>sneaky</p>" },
        }),
      BlogAccessDeniedError,
    );

    const correcting = await startPublishedCorrection({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(correcting.status, "draft");
    assert.equal(correcting.postId, draft.postId);
    assert.equal(correcting.slug, published.slug);
    assert.equal(correcting.publishedVersion, published.publishedVersion);

    await assert.rejects(() => getPublicBlogPostBySlug(published.slug), BlogNotFoundError);

    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.status, "draft");
    assert.ok(stored?.editorialHistory?.some((entry) => entry.action === "correction_started"));
  });

  it("Trusted Author corrects in place (publishedVersion++); start-correction rejected", async () => {
    const author = await registerParticipant("trusted");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Trusted Correct`,
        categoryId: "our_life",
        content: "<p>V1</p>",
        excerpt: "V1",
      },
    });
    createdPostIds.push(draft.postId);
    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const updated = await updateBlogDraft({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      body: { content: "<p>V2</p>" },
    });
    assert.equal(updated.status, "published");
    assert.equal(updated.publishedVersion, published.publishedVersion + 1);
    assert.equal(updated.slug, published.slug);

    const publicPost = await getPublicBlogPostBySlug(published.slug);
    assert.match(publicPost.content, /V2/);

    await assert.rejects(
      () =>
        startPublishedCorrection({
          postId: draft.postId,
          actorParticipantId: author.participantId,
        }),
      BlogConflictError,
    );
  });

  it("Delete archives (soft); public hidden; record retained", async () => {
    const author = await registerParticipant("del");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Delete Me`,
        categoryId: "our_life",
        content: "<p>Gone public</p>",
        excerpt: "Delete",
      },
    });
    createdPostIds.push(draft.postId);
    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await archiveBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await assert.rejects(() => getPublicBlogPostBySlug(published.slug), BlogNotFoundError);
    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.status, "archived");
    assert.ok(stored?.archivedAt);
  });
});
