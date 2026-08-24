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
  BlogNotFoundError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "../../../src/modules/blog/blog.errors.js";
import {
  archiveBlogPost,
  createBlogDraft,
  getPublicBlogPostBySlug,
  grantBlogCapabilitiesForTests,
  listPublicBlogPosts,
  publishBlogPost,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import { assertNoInternalBlogFields } from "../../../src/modules/blog/blog.projection.js";
import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByAuthorPrefixForTests,
  findBlogPostById,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  resetSafetyProviderForTests,
  setSafetyProviderForTests,
  type SafetyProvider,
} from "../../../src/modules/lifecycle-safety/safety-provider.js";
import { findMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import { saveMediaRecord } from "../../../src/modules/media-upload/media-upload.service.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-svc");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  publicName: string;
  displayName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@blog.test`;
  await registerAuthUser({ email, password: "Password123!", displayName: `Blog ${label}` });

  const user = (await findAuthUserByEmail(email)) as AuthUserRecord;
  assert.ok(user);
  createdAuthUserIds.push(user.userId);
  createdParticipantIds.push(user.memberId);

  const code = getLastIssuedConfirmationCodeForTests(user.userId);
  assert.ok(code);
  await confirmRegistrationEmailCode({ userId: user.userId, code: code! });

  const profile = await findMemberProfileByUserId(user.userId);
  assert.ok(profile);

  return {
    userId: user.userId,
    participantId: user.memberId,
    publicName: profile!.publicName,
    displayName: profile!.displayName,
  };
}

function seedCoverMedia(owner: TestParticipant) {
  const mediaId = `media-${TEST_PREFIX}-${owner.participantId.slice(-6)}`;
  const mediaUrl = `/api/v1/media/files/blog/${mediaId}.webp`;
  saveMediaRecord({
    mediaId,
    mediaUrl,
    mediaType: "image/webp",
    size: 1024,
    createdAt: new Date().toISOString(),
    ownerUserId: owner.userId,
    ownerParticipantId: owner.participantId,
    purpose: "blog-image",
    storageKey: `blog/${mediaId}.webp`,
  });
  return { mediaId, mediaUrl };
}

describe("Blog service (Implementation Pack 02)", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  beforeEach(() => {
    resetSafetyProviderForTests();
  });

  after(async () => {
    resetSafetyProviderForTests();
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    for (const participantId of createdParticipantIds) {
      await deleteBlogPostsByAuthorPrefixForTests(participantId);
    }
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    for (const userId of createdAuthUserIds) {
      await deleteMemberProfilesByUserIdPrefix(userId);
    }
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  it("1 — Participant without Author capability cannot create Blog draft", async () => {
    const participant = await registerParticipant("no-cap");
    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: participant.participantId,
          actorDisplayName: participant.displayName,
          body: {
            title: `${TEST_PREFIX} Denied`,
            categoryId: "our_life",
            content: "<p>Hello</p>",
          },
        }),
      BlogAccessDeniedError,
    );
  });

  it("2/3 — Author can create own draft; cannot forge authorParticipantId", async () => {
    const author = await registerParticipant("author-create");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          actorDisplayName: author.displayName,
          body: {
            title: `${TEST_PREFIX} Forge`,
            categoryId: "our_life",
            content: "<p>Hi</p>",
            authorParticipantId: "someone-else",
          },
        }),
      BlogValidationError,
    );

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Create Draft`,
        categoryId: "conscious_existence",
        content: "<p>Draft body</p>",
        tags: ["Civic", "civic", "  Open  "],
      },
    });

    assert.equal(draft.status, "draft");
    assert.deepEqual([...draft.tags].sort(), ["civic", "open"]);
    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.authorParticipantId, author.participantId);
  });

  it("4/5 — Author can update own draft; cannot update another Author's draft", async () => {
    const authorA = await registerParticipant("author-a");
    const authorB = await registerParticipant("author-b");
    await grantBlogCapabilitiesForTests({
      participantId: authorA.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: authorB.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: authorA.participantId,
      actorDisplayName: authorA.displayName,
      body: {
        title: `${TEST_PREFIX} Own Draft`,
        categoryId: "human_security",
        content: "<p>One</p>",
      },
    });

    const updated = await updateBlogDraft({
      postId: draft.postId,
      actorParticipantId: authorA.participantId,
      body: { content: "<p>Two</p>", excerpt: "Two excerpt" },
    });
    assert.match(updated.content, /Two/);

    await assert.rejects(
      () =>
        updateBlogDraft({
          postId: draft.postId,
          actorParticipantId: authorB.participantId,
          body: { content: "<p>Hijack</p>" },
        }),
      BlogAccessDeniedError,
    );
  });

  it("6 — Valid category required", async () => {
    const author = await registerParticipant("cat");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    await assert.rejects(
      () =>
        createBlogDraft({
          actorParticipantId: author.participantId,
          actorDisplayName: author.displayName,
          body: {
            title: `${TEST_PREFIX} Bad Cat`,
            categoryId: "wordpress-misc",
            content: "<p>x</p>",
          },
        }),
      BlogValidationError,
    );
  });

  it("7/8/9 — Slug generated safely, collision handled, published slug stable", async () => {
    const author = await registerParticipant("slug");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const first = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Shared Title`,
        categoryId: "our_life",
        content: "<p>First</p>",
        excerpt: "First",
      },
    });
    const second = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Shared Title`,
        categoryId: "our_life",
        content: "<p>Second</p>",
        excerpt: "Second",
      },
    });

    assert.notEqual(first.slug, second.slug);
    assert.match(first.slug, /^[a-z0-9-]+$/);

    const published = await publishBlogPost({
      postId: first.postId,
      actorParticipantId: author.participantId,
    });
    const publishedSlug = published.slug;

    const retitled = await updateBlogDraft({
      postId: first.postId,
      actorParticipantId: author.participantId,
      body: { title: `${TEST_PREFIX} Renamed After Publish` },
    });
    assert.equal(retitled.slug, publishedSlug);
    assert.ok(retitled.publishedVersion >= 2);
  });

  it("10/11 — Standard Author can submit; cannot direct-publish", async () => {
    const author = await registerParticipant("standard");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Submit Me`,
        categoryId: "our_life",
        content: "<p>Ready for review</p>",
        excerpt: "Ready",
      },
    });

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
    assert.ok(submitted.submittedAt);
  });

  it("12 — Trusted Author can direct-publish when Safety permits", async () => {
    const author = await registerParticipant("trusted");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Trusted Publish`,
        categoryId: "human_security",
        content: "<p>Trusted content</p>",
        excerpt: "Trusted",
      },
    });

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });
    assert.equal(published.status, "published");
    assert.equal(published.publishedVersion, 1);
    assert.ok(published.publishedAt);
  });

  it("13 — needs_review Safety prevents Trusted Author direct publication", async () => {
    const author = await registerParticipant("needs-review");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
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
        title: `${TEST_PREFIX} Needs Review`,
        categoryId: "our_life",
        content: "<p>Hold</p>",
        excerpt: "Hold",
      },
    });

    // Reset to accepted for draft create path above used uncertain — draft create
    // allows needs_review storage. Re-set for publish.
    setSafetyProviderForTests(uncertain);

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: draft.postId,
          actorParticipantId: author.participantId,
        }),
      BlogSafetyNeedsReviewError,
    );
  });

  it("14 — rejected Safety blocks publication", async () => {
    const author = await registerParticipant("rejected");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Will Reject`,
        categoryId: "our_life",
        content: "<p>Clean draft</p>",
        excerpt: "Clean",
      },
    });

    const unsafe: SafetyProvider = {
      providerId: "test-unsafe",
      evaluate: async () => ({
        signal: "unsafe",
        categories: [
          {
            categoryId: "malware",
            confidence: "high",
            detail: "test",
          },
        ],
        providerId: "test-unsafe",
      }),
    };
    setSafetyProviderForTests(unsafe);

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: draft.postId,
          actorParticipantId: author.participantId,
        }),
      BlogSafetyRejectedError,
    );
  });

  it("15/16/17 — Editor can publish submitted post; author attribution + publish metadata preserved", async () => {
    const author = await registerParticipant("edited-author");
    const editor = await registerParticipant("editor");
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
        title: `${TEST_PREFIX} Editor Publish`,
        categoryId: "conscious_existence",
        content: "<p>Reviewed</p>",
        excerpt: "Reviewed",
      },
    });
    await submitBlogPostForReview({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: editor.participantId,
    });

    assert.equal(published.status, "published");
    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.authorParticipantId, author.participantId);
    assert.equal(stored?.publishedByParticipantId, editor.participantId);
    assert.ok(stored?.publishedAt);
    assert.equal(stored?.publishedVersion, 1);
  });

  it("18 — Post-publication update increments publishedVersion", async () => {
    const author = await registerParticipant("version");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Versioned`,
        categoryId: "our_life",
        content: "<p>V1</p>",
        excerpt: "V1",
      },
    });
    await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const updated = await updateBlogDraft({
      postId: draft.postId,
      actorParticipantId: author.participantId,
      body: { content: "<p>V2</p>" },
    });
    assert.equal(updated.publishedVersion, 2);
    assert.equal(updated.status, "published");
  });

  it("19/20 — Archive hides from public list but does not delete", async () => {
    const author = await registerParticipant("archive");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Archive Me`,
        categoryId: "our_life",
        content: "<p>Public then archive</p>",
        excerpt: "Archive",
      },
    });
    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await archiveBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    await assert.rejects(() => getPublicBlogPostBySlug(published.slug), BlogNotFoundError);

    const listing = await listPublicBlogPosts({ q: `${TEST_PREFIX} Archive Me` });
    assert.equal(listing.items.find((item) => item.postId === draft.postId), undefined);

    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.status, "archived");
    assert.ok(stored?.archivedAt);
  });

  it("21/22/23/24/25 — Public APIs return published only; no legacy/internal fields; author identity", async () => {
    const author = await registerParticipant("public");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Public Visible`,
        categoryId: "our_life",
        content: "<p>Hello public</p>",
        excerpt: "Hello",
      },
    });

    await assert.rejects(() => getPublicBlogPostBySlug(draft.slug), BlogNotFoundError);

    const published = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const detail = await getPublicBlogPostBySlug(published.slug);
    assert.equal(detail.title, `${TEST_PREFIX} Public Visible`);
    assert.equal(detail.author.displayName, author.displayName);
    // Public author identity comes from resolvePublicAuthorIdentity (same as comments).
    // profileUrl appears only when profileVisibility === "public".
    assert.ok(detail.author.publicUserId || detail.author.displayName);
    assertNoInternalBlogFields(detail);

    const list = await listPublicBlogPosts({ q: `${TEST_PREFIX} Public Visible` });
    assert.ok(list.items.some((item) => item.postId === draft.postId));
    assertNoInternalBlogFields(list);

    // Ensure draft of another post never appears
    const otherDraft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Still Draft`,
        categoryId: "our_life",
        content: "<p>hidden</p>",
        excerpt: "hidden",
      },
    });
    const list2 = await listPublicBlogPosts({ q: `${TEST_PREFIX} Still Draft` });
    assert.equal(
      list2.items.find((item) => item.postId === otherDraft.postId),
      undefined,
    );
  });

  it("26 — Cover media uses existing media reference", async () => {
    const author = await registerParticipant("cover");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });
    const cover = seedCoverMedia(author);

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} With Cover`,
        categoryId: "our_life",
        content: "<p>Covered</p>",
        coverMedia: { mediaId: cover.mediaId },
      },
    });

    assert.equal(draft.coverMedia?.mediaId, cover.mediaId);
    assert.equal(draft.coverMedia?.mediaUrl, cover.mediaUrl);

    await assert.rejects(
      () =>
        updateBlogDraft({
          postId: draft.postId,
          actorParticipantId: author.participantId,
          body: { coverMedia: { mediaUrl: "https://evil.example/x.png" } },
        }),
      BlogValidationError,
    );
  });

  it("27 — Unsafe rich content is sanitized", async () => {
    const author = await registerParticipant("sanitize");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Sanitize`,
        categoryId: "our_life",
        content: '<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      },
    });

    assert.doesNotMatch(draft.content, /script/i);
    assert.doesNotMatch(draft.content, /javascript:/i);
  });

  it("28 — Translation loads Blog source without overwriting canonical content", async () => {
    const author = await registerParticipant("i18n");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["trusted_author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Translate`,
        categoryId: "our_life",
        content: "<p>Canonical English</p>",
        excerpt: "Canonical",
        originalLanguage: "en",
      },
    });
    await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: author.participantId,
    });

    const source = await loadTranslatableSource({
      sourceKind: "blog_post",
      sourceRecordId: draft.postId,
    });
    assert.ok(source);
    assert.equal(source!.fields.title, `${TEST_PREFIX} Translate`);
    assert.equal(source!.sourceLanguage, "en");
    assert.equal(source!.isPublished, true);

    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.content.includes("Canonical English"), true);
  });

  it("29 — Assistant Blog knowledge never grants publish authority; Apply only via authoring path", () => {
    const specialization = resolveAssistantSpecialization("blog");
    assert.equal(specialization.featureLabel, "Blog");
    assert.equal(specialization.canApplySuggestionsToDraft, false);
    assert.match(specialization.instructionBlock, /NEVER publish/i);
    assert.ok(specialization.suggestedQuestions.some((q) => /Trusted Author/i.test(q)));
  });

  it("30 — No second Participant model: authorParticipantId is Auth memberId", async () => {
    const author = await registerParticipant("identity");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: `${TEST_PREFIX} Identity`,
        categoryId: "our_life",
        content: "<p>id</p>",
      },
    });

    const stored = await findBlogPostById(draft.postId);
    assert.equal(stored?.authorParticipantId, author.participantId);
    assert.equal(typeof stored?.authorParticipantId, "string");
  });
});
