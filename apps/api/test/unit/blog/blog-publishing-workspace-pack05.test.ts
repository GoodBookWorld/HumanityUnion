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
} from "../../../src/modules/blog/blog.errors.js";
import {
  createBlogDraft,
  getBlogAuthorWorkspacePost,
  grantBlogCapabilitiesForTests,
  listOwnBlogWorkspacePosts,
  publishBlogPost,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../../../src/modules/blog/blog.service.js";
import {
  deleteBlogCapabilityGrantsByParticipantIdsForTests,
  deleteBlogPostsByAuthorPrefixForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { findMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { deleteMemberProfilesByUserIdPrefix } from "../../../src/modules/member-profile/member-profile.repository.js";
import { saveMediaRecord } from "../../../src/modules/media-upload/media-upload.service.js";
import { createTestId, isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const TEST_PREFIX = createTestId("blog-p05");
const createdAuthUserIds: string[] = [];
const createdParticipantIds: string[] = [];

interface TestParticipant {
  userId: string;
  participantId: string;
  displayName: string;
}

async function registerParticipant(label: string): Promise<TestParticipant> {
  const email = `${TEST_PREFIX}-${label}@blog-publishing.test`;
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

describe("Publishing Workspace Pack 05 — Author post library & cover alt", () => {
  before(async () => {
    await connectMongoClient();
    await ensureMongoIndexes();
  });

  after(async () => {
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    await deleteBlogCapabilityGrantsByParticipantIdsForTests(createdParticipantIds);
    await deleteMemberProfilesByUserIdPrefix(TEST_PREFIX);
    await deleteAuthUsersByEmailPrefix(`${TEST_PREFIX}-`);
    await disconnectMongoClient();
  });

  beforeEach(async () => {
    await deleteBlogPostsByAuthorPrefixForTests(TEST_PREFIX);
    for (const participantId of createdParticipantIds) {
      await deleteBlogPostsByAuthorPrefixForTests(participantId);
    }
  });

  it("non-Author cannot list Publishing posts", async () => {
    const participant = await registerParticipant("no-author");
    await assert.rejects(
      () =>
        listOwnBlogWorkspacePosts({
          actorParticipantId: participant.participantId,
        }),
      BlogAccessDeniedError,
    );
  });

  it("Author lists only own posts; cannot load another Author draft", async () => {
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

    const draftA = await createBlogDraft({
      actorParticipantId: authorA.participantId,
      actorDisplayName: authorA.displayName,
      body: {
        title: "Alpha draft title",
        categoryId: "our_life",
        content: "<p>Alpha body</p>",
      },
    });
    await createBlogDraft({
      actorParticipantId: authorB.participantId,
      actorDisplayName: authorB.displayName,
      body: {
        title: "Beta draft title",
        categoryId: "human_security",
        content: "<p>Beta body</p>",
      },
    });

    const listed = await listOwnBlogWorkspacePosts({
      actorParticipantId: authorA.participantId,
      status: "draft",
    });
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0]?.postId, draftA.postId);
    assert.equal("content" in listed.items[0]!, false);

    await assert.rejects(
      () =>
        getBlogAuthorWorkspacePost({
          postId: draftA.postId,
          actorParticipantId: authorB.participantId,
        }),
      (error) => error instanceof BlogAccessDeniedError || error instanceof BlogNotFoundError,
    );
  });

  it("cover alt text is stored and unsafe HTML is sanitized on save", async () => {
    const author = await registerParticipant("cover-alt");
    await grantBlogCapabilitiesForTests({
      participantId: author.participantId,
      capabilities: ["author"],
    });

    const mediaId = `media-${TEST_PREFIX}-cover`;
    const media = saveMediaRecord({
      mediaId,
      mediaUrl: `/api/v1/media/files/blog/${mediaId}.webp`,
      mediaType: "image/webp",
      size: 1200,
      purpose: "blog-image",
      createdAt: new Date().toISOString(),
      ownerUserId: author.userId,
      ownerParticipantId: author.participantId,
      storageKey: `blog/${mediaId}.webp`,
    });

    const draft = await createBlogDraft({
      actorParticipantId: author.participantId,
      actorDisplayName: author.displayName,
      body: {
        title: "Cover alt publication",
        categoryId: "conscious_existence",
        content: '<p>Hello</p><script>alert(1)</script><img src="javascript:alert(1)" />',
        coverMedia: {
          mediaId: media.mediaId,
          altText: "Participants gathering outdoors",
        },
      },
    });

    assert.equal(draft.coverMedia?.altText, "Participants gathering outdoors");
    assert.equal(draft.content.includes("script"), false);
    assert.equal(draft.content.includes("javascript:"), false);
    assert.match(draft.content, /<p>Hello<\/p>/);
  });

  it("standard Author submits; Trusted Author can direct-publish when Safety accepts", async () => {
    const standard = await registerParticipant("std");
    const trusted = await registerParticipant("trusted");
    await grantBlogCapabilitiesForTests({
      participantId: standard.participantId,
      capabilities: ["author"],
    });
    await grantBlogCapabilitiesForTests({
      participantId: trusted.participantId,
      capabilities: ["trusted_author"],
    });

    const standardDraft = await createBlogDraft({
      actorParticipantId: standard.participantId,
      actorDisplayName: standard.displayName,
      body: {
        title: "Standard submission post",
        categoryId: "our_life",
        content: "<p>Enough content for publication.</p>",
        excerpt: "A short listing summary.",
      },
    });

    await assert.rejects(
      () =>
        publishBlogPost({
          postId: standardDraft.postId,
          actorParticipantId: standard.participantId,
        }),
      BlogAccessDeniedError,
    );

    const submitted = await submitBlogPostForReview({
      postId: standardDraft.postId,
      actorParticipantId: standard.participantId,
    });
    assert.equal(submitted.status, "submitted_for_review");

    const trustedDraft = await createBlogDraft({
      actorParticipantId: trusted.participantId,
      actorDisplayName: trusted.displayName,
      body: {
        title: "Trusted direct publish post",
        categoryId: "human_security",
        content: "<p>Trusted author content ready to publish.</p>",
        excerpt: "Trusted excerpt.",
      },
    });
    const published = await publishBlogPost({
      postId: trustedDraft.postId,
      actorParticipantId: trusted.participantId,
    });
    assert.equal(published.status, "published");
    assert.equal(published.publishedVersion, 1);

    const updated = await updateBlogDraft({
      postId: published.postId,
      actorParticipantId: trusted.participantId,
      body: { title: "Trusted direct publish post revised" },
    });
    assert.equal(updated.slug, published.slug);
    assert.equal(updated.publishedVersion, 2);
  });
});
