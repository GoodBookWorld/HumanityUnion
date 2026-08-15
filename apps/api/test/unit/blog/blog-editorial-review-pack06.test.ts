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
import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  declineBlogPost,
  getBlogAuthoringAccessState,
  getEditorialReviewDetail,
  grantBlogCapabilitiesForTests,
  listEditorialReviewQueue,
  publishBlogPost,
  publishBlogPostAfterSafetyReview,
  requestBlogPostChanges,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import { resolveBlogCapabilities } from "../../../src/modules/blog/blog-permissions.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByAuthorPrefixForTests,
  findBlogPostById,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  isParticipantEmailNotificationsEnabled,
  MailDeliveryService,
} from "../../../src/modules/email/email.service.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
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
  getOrCreatePreferencesForMember,
  updatePreferencesRecord,
} from "../../../src/modules/preferences/preferences.repository.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-e06");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  displayName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@blog-editorial.test`;
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

async function createSubmittedPost(input: {
  author: TestParticipant;
  title: string;
}): Promise<{ postId: string; updatedAt: string }> {
  const draft = await createBlogDraft({
    actorParticipantId: input.author.participantId,
    actorDisplayName: input.author.displayName,
    body: {
      title: input.title,
      categoryId: "our_life",
      content: "<p>Constructive civic article for editorial review.</p>",
      excerpt: "Constructive excerpt",
    },
  });
  const submitted = await submitBlogPostForReview({
    postId: draft.postId,
    actorParticipantId: input.author.participantId,
  });
  return { postId: submitted.postId, updatedAt: submitted.updatedAt };
}

describe("Editorial Review Pack 06", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    resetSafetyProviderForTests();
    await disconnectMongoClient();
  });

  beforeEach(() => {
    resetSafetyProviderForTests();
    MockEmailProvider.clearForTests();
  });

  it("1/2 — Participant and Author without Editor cannot access Editorial queue", async () => {
    const participant = await registerParticipant("no-access");
    await assert.rejects(
      () => listEditorialReviewQueue({ actorParticipantId: participant.participantId }),
      BlogAccessDeniedError,
    );

    const author = await registerParticipant("author-only");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await assert.rejects(
      () => listEditorialReviewQueue({ actorParticipantId: author.participantId }),
      BlogAccessDeniedError,
    );

    const trusted = await registerParticipant("trusted-only");
    await grantBlogCapabilitiesForTests({
      participantId: trusted.participantId,
      capabilities: ["trusted_author"],
    });
    await assert.rejects(
      () => listEditorialReviewQueue({ actorParticipantId: trusted.participantId }),
      BlogAccessDeniedError,
    );
  });

  it("3/4/5/6 — Editor and Administrator see submitted queue; drafts excluded", async () => {
    const author = await registerParticipant("queue-author");
    const editor = await registerParticipant("queue-editor");
    const admin = await registerParticipant("queue-admin");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: admin.participantId,
      capabilities: ["administrator"],
    });

    await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Draft Only`,
        categoryId: "our_life",
        content: "<p>Draft</p>",
        excerpt: "Draft",
      },
    });
    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Queue Submitted`,
    });

    const editorQueue = await listEditorialReviewQueue({
      actorParticipantId: editor.participantId,
    });
    assert.ok(editorQueue.items.some((item) => item.postId === submitted.postId));
    assert.ok(!editorQueue.items.some((item) => item.title.includes("Draft Only")));

    const adminQueue = await listEditorialReviewQueue({
      actorParticipantId: admin.participantId,
    });
    assert.ok(adminQueue.items.some((item) => item.postId === submitted.postId));

    const editorState = await getBlogAuthoringAccessState({
      actorParticipantId: editor.participantId,
    });
    assert.equal(editorState.editorialReviewHref, "/workspace/editorial");
  });

  it("7/8 — Reviewer identity server-resolved; detail uses sanitized content", async () => {
    const author = await registerParticipant("sanitized-a");
    const editor = await registerParticipant("sanitized-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Sanitize`,
        categoryId: "our_life",
        content: '<p>Hello<script>alert(1)</script></p><p onclick="x">World</p>',
        excerpt: "Sanitize",
      },
    });
    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const detail = await getEditorialReviewDetail({
      postId: draft.postId,
      actorParticipantId: editor.participantId,
    });
    assert.equal(detail.authorParticipantId, author.participantId);
    assert.doesNotMatch(detail.content, /<script/i);
    assert.doesNotMatch(detail.content, /onclick/i);
  });

  it("9/10/11/12 — Request Changes requires note, returns editable draft, Author sees note, can resubmit", async () => {
    const author = await registerParticipant("changes-a");
    const editor = await registerParticipant("changes-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Needs Clarification`,
    });

    await assert.rejects(
      () =>
        requestBlogPostChanges({
          postId: submitted.postId,
          actorParticipantId: editor.participantId,
          reviewNote: "   ",
        }),
      BlogValidationError,
    );

    const changed = await requestBlogPostChanges({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Please clarify the sourcing for the main claim.",
      expectedUpdatedAt: submitted.updatedAt,
    });

    assert.equal(changed.status, "draft");
    assert.equal(changed.review.reviewStatus, "changes_requested");
    assert.equal(changed.review.reviewedByParticipantId, editor.participantId);
    assert.match(changed.review.reviewNote ?? "", /sourcing/);

    const updated = await updateBlogDraft({
      postId: submitted.postId,
      actorParticipantId: author.participantId,
      body: { content: "<p>Clarified constructive article with sourcing notes.</p>" },
    });
    assert.equal(updated.postId, submitted.postId);

    const resubmitted = await submitBlogPostForReview({
      postId: submitted.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(resubmitted.status, "submitted_for_review");
    assert.equal(resubmitted.postId, submitted.postId);
    assert.ok(resubmitted.editorialHistory?.some((entry) => entry.action === "resubmitted"));
  });

  it("13/14/15/16 — Normal approve publishes with attribution + reviewer metadata + version", async () => {
    const author = await registerParticipant("approve-a");
    const editor = await registerParticipant("approve-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Approve Publish`,
    });

    const published = await publishBlogPost({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      expectedUpdatedAt: submitted.updatedAt,
    });

    assert.equal(published.status, "published");
    assert.equal(published.publishedVersion, 1);
    const stored = await findBlogPostById(submitted.postId);
    assert.equal(stored?.authorParticipantId, author.participantId);
    assert.equal(stored?.publishedByParticipantId, editor.participantId);
    assert.equal(stored?.review.reviewedByParticipantId, editor.participantId);
    assert.ok(stored?.review.reviewedAt);
    assert.ok(stored?.editorialHistory?.some((entry) => entry.action === "approved_published"));
  });

  it("17/18 — Duplicate publish rejected; stale expectedUpdatedAt blocks publish", async () => {
    const author = await registerParticipant("stale-a");
    const editor = await registerParticipant("stale-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Stale`,
    });
    const staleUpdatedAt = submitted.updatedAt;

    await requestBlogPostChanges({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Please revise the introduction.",
      expectedUpdatedAt: staleUpdatedAt,
    });

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: submitted.postId,
          actorParticipantId: editor.participantId,
          expectedUpdatedAt: staleUpdatedAt,
        }),
      (error: unknown) =>
        error instanceof BlogConflictError &&
        error.message.includes("changed since you opened it"),
    );

    const again = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Dup Publish`,
    });
    await publishBlogPost({
      postId: again.postId,
      actorParticipantId: editor.participantId,
      expectedUpdatedAt: again.updatedAt,
    });
    const after = await findBlogPostById(again.postId);
    await assert.rejects(
      () =>
        publishBlogPost({
          postId: again.postId,
          actorParticipantId: editor.participantId,
          expectedUpdatedAt: after?.updatedAt,
        }),
      BlogConflictError,
    );
  });

  it("19/20/21 — needs_review requires explicit override with reason + audit", async () => {
    const author = await registerParticipant("safety-a");
    const editor = await registerParticipant("safety-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const uncertain: SafetyProvider = {
      providerId: "test-uncertain",
      evaluate: async () => ({
        signal: "uncertain",
        categories: [],
        providerId: "test-uncertain",
      }),
    };
    setSafetyProviderForTests(uncertain);

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Needs Safety`,
        categoryId: "our_life",
        content: "<p>Hold for safety-aware editorial review.</p>",
        excerpt: "Hold",
      },
    });
    const submitted = await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(submitted.safetyOutcome, "needs_review");

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: submitted.postId,
          actorParticipantId: editor.participantId,
          expectedUpdatedAt: submitted.updatedAt,
        }),
      BlogSafetyNeedsReviewError,
    );

    await assert.rejects(
      () =>
        publishBlogPostAfterSafetyReview({
          postId: submitted.postId,
          actorParticipantId: editor.participantId,
          expectedUpdatedAt: submitted.updatedAt,
          reviewNote: " ",
        }),
      BlogValidationError,
    );

    const published = await publishBlogPostAfterSafetyReview({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      expectedUpdatedAt: submitted.updatedAt,
      reviewNote: "Reviewed claims; publishing with human accountability.",
    });

    assert.equal(published.status, "published");
    const stored = await findBlogPostById(submitted.postId);
    assert.equal(stored?.safetyOutcome, "needs_review");
    assert.equal(stored?.review.reviewedByParticipantId, editor.participantId);
    assert.match(stored?.review.reviewNote ?? "", /accountability/);
    const override = stored?.editorialHistory?.find(
      (entry) => entry.action === "published_after_safety_review",
    );
    assert.ok(override);
    assert.equal(override?.safetyOutcome, "needs_review");
    assert.equal(override?.actorParticipantId, editor.participantId);
    assert.ok(override?.at);
    assert.match(override?.reviewNote ?? "", /accountability/);
  });

  it("22 — rejected Safety cannot ordinary-publish", async () => {
    const author = await registerParticipant("reject-a");
    const editor = await registerParticipant("reject-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Will Reject`,
        categoryId: "our_life",
        content: "<p>Clean draft body</p>",
        excerpt: "Clean",
      },
    });

    const unsafe: SafetyProvider = {
      providerId: "test-unsafe",
      evaluate: async () => ({
        signal: "unsafe",
        categories: [{ categoryId: "malware", confidence: "high", detail: "test" }],
        providerId: "test-unsafe",
      }),
    };
    setSafetyProviderForTests(unsafe);

    // Force safetyOutcome rejected on store path is blocked for rejected — use accepted draft then flip.
    resetSafetyProviderForTests();
    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    setSafetyProviderForTests(unsafe);

    const current = await findBlogPostById(draft.postId);
    await assert.rejects(
      () =>
        publishBlogPost({
          postId: draft.postId,
          actorParticipantId: editor.participantId,
          expectedUpdatedAt: current?.updatedAt,
        }),
      BlogSafetyRejectedError,
    );
  });

  it("23 — Author capability unchanged after Request Changes / Decline", async () => {
    const author = await registerParticipant("cap-a");
    const editor = await registerParticipant("cap-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Cap Preserve`,
    });
    await requestBlogPostChanges({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Please tighten the conclusion.",
      expectedUpdatedAt: submitted.updatedAt,
    });

    const capsAfterChanges = await resolveBlogCapabilities({
      participantId: author.participantId,
    });
    assert.equal(capsAfterChanges.has("author"), true);
    assert.equal(capsAfterChanges.has("editor"), false);

    const again = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Cap Decline`,
    });
    await declineBlogPost({
      postId: again.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Not a fit for Blog publication at this time.",
      expectedUpdatedAt: again.updatedAt,
    });
    const capsAfterDecline = await resolveBlogCapabilities({
      participantId: author.participantId,
    });
    assert.equal(capsAfterDecline.has("author"), true);
  });

  it("24/25/26/27 — Notifications + mail preference + mock transport", async () => {
    const author = await registerParticipant("mail-a");
    const editor = await registerParticipant("mail-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    assert.equal(await isParticipantEmailNotificationsEnabled(author.participantId), true);

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Notify Changes`,
    });
    await requestBlogPostChanges({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Add a clearer opening paragraph.",
      expectedUpdatedAt: submitted.updatedAt,
    });

    const afterChanges = await listMyNotifications({ userId: author.userId, limit: 20 });
    assert.ok(
      afterChanges.notifications.some((n) => n.eventType === "blog_post_changes_requested"),
    );
    assert.ok(
      afterChanges.notifications.some(
        (n) => n.relatedUrl === `/workspace/publishing/${submitted.postId}`,
      ),
    );

    const publishCase = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} Notify Publish`,
    });
    await publishBlogPost({
      postId: publishCase.postId,
      actorParticipantId: editor.participantId,
      expectedUpdatedAt: publishCase.updatedAt,
    });
    const afterPublish = await listMyNotifications({ userId: author.userId, limit: 30 });
    assert.ok(afterPublish.notifications.some((n) => n.eventType === "blog_post_published"));

    MockEmailProvider.clearForTests();
    const prefs = await getOrCreatePreferencesForMember({
      memberId: author.participantId,
      userId: author.userId,
    });
    await updatePreferencesRecord(author.participantId, {
      ...prefs,
      communicationPreferences: {
        ...prefs.communicationPreferences,
        emailNotificationsEnabled: false,
      },
    });
    assert.equal(await isParticipantEmailNotificationsEnabled(author.participantId), false);
    const mailed = await MailDeliveryService.sendBlogPublicationStatusEmail({
      participantId: author.participantId,
      status: "published",
      postId: publishCase.postId,
    });
    assert.equal(mailed, null);
    assert.equal(MockEmailProvider.sentMessages.length, 0);
  });

  it("28/29/30 — Assistant cannot approve/publish; no Author scoring vocabulary", () => {
    const specialization = resolveAssistantSpecialization("blog");
    assert.match(specialization.instructionBlock, /NEVER/i);
    assert.match(specialization.instructionBlock, /approve|publish/i);
    assert.equal(specialization.canApplySuggestionsToDraft, false);
    assert.match(specialization.instructionBlock, /Do not invent Author scores/i);
  });

  it("31/32 — Review history preserves transitions; Decline uses existing draft status", async () => {
    const author = await registerParticipant("history-a");
    const editor = await registerParticipant("history-e");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: editor.participantId,
      capabilities: ["editor"],
    });

    const submitted = await createSubmittedPost({
      author,
      title: `${TEST_PREFIX} History`,
    });
    const declined = await declineBlogPost({
      postId: submitted.postId,
      actorParticipantId: editor.participantId,
      reviewNote: "Please pursue a more evidence-based framing.",
      expectedUpdatedAt: submitted.updatedAt,
    });

    assert.equal(declined.status, "draft");
    assert.equal(declined.review.reviewStatus, "declined");
    const actions = (declined.editorialHistory ?? []).map((entry) => entry.action);
    assert.ok(actions.includes("submitted"));
    assert.ok(actions.includes("declined"));
  });
});
