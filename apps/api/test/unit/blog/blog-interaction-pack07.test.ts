import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.repository.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { confirmRegistrationEmailCode } from "../../../src/modules/auth/auth-email-confirmation.service.js";
import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserByEmail,
} from "../../../src/modules/auth/auth-user.repository.js";
import { getLastIssuedConfirmationCodeForTests } from "../../../src/modules/email/email-confirmation-code.repository.js";
import { BlogSafetyRejectedError } from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogComment,
  deleteOwnBlogComment,
  editBlogComment,
  listPublicBlogComments,
  moderateRemoveBlogComment,
  resetBlogCommentRateLimitsForTests,
  resetBlogInteractionRateLimitsForTests,
  setBlogPostReaction,
} from "../../../src/modules/blog/blog-interaction.service.js";
import {
  BlogCommentAccessDeniedError,
  BlogCommentRateLimitError,
  BlogCommentValidationError,
} from "../../../src/modules/blog/blog-interaction.errors.js";
import {
  createBlogDraft,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
} from "../../../src/modules/blog/blog.service.js";
import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import {
  resetSafetyProviderForTests,
  setSafetyProviderForTests,
  type SafetyProvider,
} from "../../../src/modules/lifecycle-safety/safety-provider.js";
import { findMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import { listMyNotifications } from "../../../src/modules/notifications/notification.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByAuthorPrefixForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  deleteBlogCommentsByPostIdsForTests,
  resetBlogCommentsMemoryForTests,
} from "../../../src/modules/blog/persistence/blog-comment.repository.js";
import {
  deleteBlogReactionsByPostIdsForTests,
  resetBlogReactionsMemoryForTests,
} from "../../../src/modules/blog/persistence/blog-reaction.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-i07");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];
const createdPostIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  displayName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@blog-interaction.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Blog ${label}` });
  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);
  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });
  await findMemberProfileByUserId(user.userId);
  return {
    userId: user.userId,
    participantId: user.memberId,
    displayName: user.displayName,
  };
}

async function publishPost(author: TestParticipant, title: string) {
  await grantBlogCapabilitiesForTests({
    participantId: author.participantId,
    capabilities: ["trusted_author"],
  });
  const draft = await createBlogDraft({
    actorParticipantId: author.participantId,
    actorDisplayName: author.displayName,
    body: {
      title,
      categoryId: "our_life",
      content: "<p>Constructive publication for interaction tests.</p>",
      excerpt: "Constructive excerpt",
    },
  });
  const published = await publishBlogPost({
    postId: draft.postId,
    actorParticipantId: author.participantId,
  });
  createdPostIds.push(published.postId);
  return published;
}

describe("Blog Interaction Pack 07", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteBlogCommentsByPostIdsForTests(createdPostIds);
    await deleteBlogReactionsByPostIdsForTests(createdPostIds);
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSafetyProviderForTests();
    await disconnectMongoClient();
  });

  beforeEach(() => {
    resetSafetyProviderForTests();
    resetBlogInteractionRateLimitsForTests();
    resetBlogCommentsMemoryForTests();
    resetBlogReactionsMemoryForTests();
  });

  it("1/2/3/4/5 — Guest reads; Participant posts; identity server-resolved", async () => {
    const author = await registerParticipant("author-a");
    const commenter = await registerParticipant("commenter-a");
    const post = await publishPost(author, `${TEST_PREFIX} Guest Read`);

    const empty = await listPublicBlogComments({ slug: post.slug });
    assert.equal(empty.comments.length, 0);

    const created = await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "A constructive observation about the publication.",
    });
    assert.equal(created.comment.status, "visible");
    assert.equal(created.comment.authorParticipantId, commenter.participantId);

    const listed = await listPublicBlogComments({ slug: post.slug });
    assert.equal(listed.comments.length, 1);
    assert.equal(listed.comments[0]!.author.displayName.length > 0, true);
    assert.doesNotMatch(JSON.stringify(listed), /authorParticipantId|email|safetyOutcome/);
  });

  it("6/7/8 — Requires published post; empty/max length rejected", async () => {
    const author = await registerParticipant("author-b");
    const commenter = await registerParticipant("commenter-b");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Draft Only`,
        categoryId: "our_life",
        content: "<p>Draft</p>",
        excerpt: "Draft",
      },
    });
    createdPostIds.push(draft.postId);

    await assert.rejects(
      () =>
        createBlogComment({
          slug: draft.slug,
          actorParticipantId: commenter.participantId,
          content: "Should fail",
        }),
      /not found/i,
    );

    const post = await publishPost(author, `${TEST_PREFIX} Validation`);
    await assert.rejects(
      () =>
        createBlogComment({
          slug: post.slug,
          actorParticipantId: commenter.participantId,
          content: "   ",
        }),
      BlogCommentValidationError,
    );
    await assert.rejects(
      () =>
        createBlogComment({
          slug: post.slug,
          actorParticipantId: commenter.participantId,
          content: "x".repeat(2001),
        }),
      BlogCommentValidationError,
    );
  });

  it("9/10/11 — Safety accepted/pending/rejected visibility", async () => {
    const author = await registerParticipant("author-c");
    const commenter = await registerParticipant("commenter-c");
    const post = await publishPost(author, `${TEST_PREFIX} Safety`);

    const accepted = await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "Accepted constructive comment.",
    });
    assert.equal(accepted.comment.status, "visible");

    const uncertain: SafetyProvider = {
      providerId: "test-uncertain",
      evaluate: async () => ({
        signal: "uncertain",
        categories: [],
        providerId: "test-uncertain",
      }),
    };
    setSafetyProviderForTests(uncertain);
    resetBlogCommentRateLimitsForTests();
    const pending = await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "Hold for review carefully worded text.",
    });
    assert.equal(pending.comment.status, "pending_review");
    assert.match(pending.publicMessage ?? "", /awaiting review/i);
    const publicList = await listPublicBlogComments({ slug: post.slug });
    assert.equal(publicList.comments.every((c) => c.commentId !== pending.comment.commentId), true);

    const unsafe: SafetyProvider = {
      providerId: "test-unsafe",
      evaluate: async () => ({
        signal: "unsafe",
        categories: [{ categoryId: "malware", confidence: "high", detail: "test" }],
        providerId: "test-unsafe",
      }),
    };
    setSafetyProviderForTests(unsafe);
    resetBlogCommentRateLimitsForTests();
    await assert.rejects(
      () =>
        createBlogComment({
          slug: post.slug,
          actorParticipantId: commenter.participantId,
          content: "Rejected body content for test.",
        }),
      BlogSafetyRejectedError,
    );
  });

  it("12/13/14 — One-level replies; reply-to-reply blocked; same post parent", async () => {
    const author = await registerParticipant("author-d");
    const a = await registerParticipant("reply-a");
    const b = await registerParticipant("reply-b");
    const post = await publishPost(author, `${TEST_PREFIX} Replies`);
    const other = await publishPost(author, `${TEST_PREFIX} Other Post`);

    const top = await createBlogComment({
      slug: post.slug,
      actorParticipantId: a.participantId,
      content: "Top-level comment for reply tests.",
    });
    resetBlogCommentRateLimitsForTests();
    const reply = await createBlogComment({
      slug: post.slug,
      actorParticipantId: b.participantId,
      content: "One-level reply.",
      parentCommentId: top.comment.commentId,
    });
    assert.equal(reply.comment.parentCommentId, top.comment.commentId);

    resetBlogCommentRateLimitsForTests();
    await assert.rejects(
      () =>
        createBlogComment({
          slug: post.slug,
          actorParticipantId: a.participantId,
          content: "Nested reply should fail.",
          parentCommentId: reply.comment.commentId,
        }),
      BlogCommentValidationError,
    );

    resetBlogCommentRateLimitsForTests();
    await assert.rejects(
      () =>
        createBlogComment({
          slug: other.slug,
          actorParticipantId: a.participantId,
          content: "Wrong post parent.",
          parentCommentId: top.comment.commentId,
        }),
      BlogCommentValidationError,
    );

    const listed = await listPublicBlogComments({ slug: post.slug });
    assert.equal(listed.comments[0]!.replies.length, 1);
  });

  it("15/16/17/18 — Edit own + Safety re-run; cannot edit others; delete own", async () => {
    const author = await registerParticipant("author-e");
    const owner = await registerParticipant("edit-owner");
    const other = await registerParticipant("edit-other");
    const post = await publishPost(author, `${TEST_PREFIX} Edit`);

    const created = await createBlogComment({
      slug: post.slug,
      actorParticipantId: owner.participantId,
      content: "Original comment text for editing.",
    });
    const edited = await editBlogComment({
      commentId: created.comment.commentId,
      actorParticipantId: owner.participantId,
      content: "Edited constructive comment text.",
    });
    assert.ok(edited.comment.editedAt);

    await assert.rejects(
      () =>
        editBlogComment({
          commentId: created.comment.commentId,
          actorParticipantId: other.participantId,
          content: "Forged edit",
        }),
      BlogCommentAccessDeniedError,
    );

    await deleteOwnBlogComment({
      commentId: created.comment.commentId,
      actorParticipantId: owner.participantId,
    });
    const listed = await listPublicBlogComments({ slug: post.slug });
    assert.equal(listed.comments.length, 0);
  });

  it("19/20 — Author cannot moderate by ownership; Editor can remove", async () => {
    const author = await registerParticipant("author-f");
    const commenter = await registerParticipant("commenter-f");
    const editor = await registerParticipant("editor-f");
    const post = await publishPost(author, `${TEST_PREFIX} Moderate`);
    const created = await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "Critical but legitimate disagreement.",
    });

    await assert.rejects(
      () =>
        moderateRemoveBlogComment({
          commentId: created.comment.commentId,
          actorParticipantId: author.participantId,
        }),
      BlogCommentAccessDeniedError,
    );

    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });
    const removed = await moderateRemoveBlogComment({
      commentId: created.comment.commentId,
      actorParticipantId: editor.participantId,
    });
    assert.equal(removed.status, "removed");
  });

  it("22/23/24/25/26/27/28/29 — Reactions: one per participant, change, remove, guest counts", async () => {
    const author = await registerParticipant("author-g");
    const reactor = await registerParticipant("reactor-g");
    const post = await publishPost(author, `${TEST_PREFIX} Reactions`);

    const guestDetail = await getPublicBlogPostBySlug(post.slug);
    assert.equal(guestDetail.reactionCounts.helpful, 0);
    assert.equal(guestDetail.currentUserReaction, undefined);

    let summary = await setBlogPostReaction({
      slug: post.slug,
      actorParticipantId: reactor.participantId,
      reaction: "helpful",
    });
    assert.equal(summary.helpful, 1);
    assert.equal(summary.currentUserReaction, "helpful");

    resetBlogInteractionRateLimitsForTests();
    summary = await setBlogPostReaction({
      slug: post.slug,
      actorParticipantId: reactor.participantId,
      reaction: "not_helpful",
    });
    assert.equal(summary.helpful, 0);
    assert.equal(summary.notHelpful, 1);
    assert.equal(summary.currentUserReaction, "not_helpful");

    resetBlogInteractionRateLimitsForTests();
    summary = await setBlogPostReaction({
      slug: post.slug,
      actorParticipantId: reactor.participantId,
      reaction: "not_helpful",
    });
    assert.equal(summary.currentUserReaction, "none");
    assert.equal(summary.notHelpful, 0);

    const detail = await getPublicBlogPostBySlug(post.slug, reactor.participantId);
    assert.equal(detail.currentUserReaction, "none");
    assert.doesNotMatch(JSON.stringify(detail), /actorParticipantId/);
  });

  it("30/32/33/34/35 — Comment count + notifications; no reaction notifications; skip self", async () => {
    const author = await registerParticipant("author-h");
    const commenter = await registerParticipant("commenter-h");
    const post = await publishPost(author, `${TEST_PREFIX} Notify`);

    await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "Notifying the Author about this top-level comment.",
    });
    const detail = await getPublicBlogPostBySlug(post.slug);
    assert.equal(detail.commentCount, 1);

    const authorNotes = await listMyNotifications({ userId: author.userId, limit: 20 });
    assert.ok(authorNotes.notifications.some((n) => n.eventType === "blog_comment_posted"));
    assert.ok(
      authorNotes.notifications.some((n) =>
        (n.relatedUrl ?? "").includes(`/blog/${post.slug}#comment-`),
      ),
    );

    const top = await listPublicBlogComments({ slug: post.slug });
    resetBlogCommentRateLimitsForTests();
    await createBlogComment({
      slug: post.slug,
      actorParticipantId: author.participantId,
      content: "Author replies to the commenter.",
      parentCommentId: top.comments[0]!.commentId,
    });
    const commenterNotes = await listMyNotifications({ userId: commenter.userId, limit: 20 });
    assert.ok(commenterNotes.notifications.some((n) => n.eventType === "blog_comment_reply"));

    // Self top-level comment does not notify Author about themselves.
    resetBlogCommentRateLimitsForTests();
    const beforeSelf = await listMyNotifications({ userId: author.userId, limit: 50 });
    const beforeCount = beforeSelf.notifications.filter(
      (n) => n.eventType === "blog_comment_posted",
    ).length;
    await createBlogComment({
      slug: post.slug,
      actorParticipantId: author.participantId,
      content: "Author commenting on their own publication.",
    });
    const afterSelf = await listMyNotifications({ userId: author.userId, limit: 50 });
    const afterCount = afterSelf.notifications.filter(
      (n) => n.eventType === "blog_comment_posted",
    ).length;
    assert.equal(afterCount, beforeCount);

    await setBlogPostReaction({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      reaction: "helpful",
    });
    const afterReaction = await listMyNotifications({ userId: author.userId, limit: 50 });
    assert.equal(
      afterReaction.notifications.some((n) => String(n.eventType).includes("reaction")),
      false,
    );
  });

  it("39 — Rate limit protects rapid comment submission", async () => {
    const author = await registerParticipant("author-i");
    const commenter = await registerParticipant("commenter-i");
    const post = await publishPost(author, `${TEST_PREFIX} Rate`);
    await createBlogComment({
      slug: post.slug,
      actorParticipantId: commenter.participantId,
      content: "First comment for rate limit.",
    });
    await assert.rejects(
      () =>
        createBlogComment({
          slug: post.slug,
          actorParticipantId: commenter.participantId,
          content: "Second comment too soon.",
        }),
      BlogCommentRateLimitError,
    );
  });

  it("38/40 — Assistant cannot post/moderate; no reputation scoring", () => {
    const specialization = resolveAssistantSpecialization("blog");
    assert.match(specialization.instructionBlock, /NEVER/i);
    assert.match(specialization.instructionBlock, /post comments|react automatically|moderate/i);
    assert.match(specialization.instructionBlock, /Do not invent Author scores/i);
    assert.equal(specialization.canApplySuggestionsToDraft, false);
  });
});
