/**
 * HU-UX-01C — never-published draft discard. No production database writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogPost } from "@hu/types";

import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogNotFoundError,
} from "../../../src/modules/blog/blog.errors.js";
import { canTransitionBlogStatus } from "../../../src/modules/blog/blog-status-transitions.js";
import { archiveBlogPost, discardUnpublishedBlogDraft, grantBlogCapabilitiesForTests } from "../../../src/modules/blog/blog.service.js";
import {
  deleteNeverPublishedOwnedDraft,
  findBlogPostById,
  insertBlogPost,
  replaceBlogPost,
  resetBlogMemoryPersistenceForTests,
  upsertBlogCapabilityGrant,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  getMediaRecordById,
  resetMediaUploadMemoryStoreForTests,
  saveMediaRecord,
} from "../../../src/modules/media-upload/media-upload.service.js";
import {
  insertArticleDelivery,
  resetArticleDeliveriesForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";

const OWNER = "member-draft-owner";
const OTHER = "member-draft-other";

function draft(overrides: Partial<BlogPost> = {}): BlogPost {
  const now = "2026-11-26T00:00:00.000Z";
  return {
    postId: "blog-draft-1",
    authorParticipantId: OWNER,
    authorDisplayNameSnapshot: "Author",
    title: "Unpublished draft",
    slug: "unpublished-draft",
    excerpt: "Excerpt",
    content: "<p>Draft</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: null,
    status: "draft",
    originalLanguage: "en",
    safetyOutcome: null,
    review: { reviewStatus: "none" },
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function asAuthor(): Promise<void> {
  await grantBlogCapabilitiesForTests({ participantId: OWNER, capabilities: ["author"] });
  await grantBlogCapabilitiesForTests({ participantId: OTHER, capabilities: ["author"] });
}

describe("HU-UX-01C unpublished draft discard", () => {
  beforeEach(() => {
    resetBlogMemoryPersistenceForTests();
    resetMediaUploadMemoryStoreForTests();
  });

  afterEach(() => {
    resetBlogMemoryPersistenceForTests();
  });

  it("lets the owner delete a never-published draft and rejects everyone else", async () => {
    await asAuthor();
    const post = draft();
    await insertBlogPost(post);
    await insertBlogPost(draft({ postId: "blog-draft-keep", slug: "keep", title: "Keep" }));

    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.ok(await findBlogPostById("blog-draft-keep"));

    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: "blog-draft-keep",
          actorParticipantId: OTHER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogNotFoundError,
    );
    assert.ok(await findBlogPostById("blog-draft-keep"));
  });

  it("rejects blocked, published, correction, review, scheduled, and archived posts", async () => {
    await asAuthor();
    const cases: Array<Partial<BlogPost>> = [
      { postId: "blocked", administrativelyBlocked: true },
      { postId: "published", status: "published", publishedVersion: 1 },
      { postId: "correction", status: "draft", publishedVersion: 2 },
      {
        postId: "history",
        editorialHistory: [
          {
            at: "2026-11-26T00:00:00.000Z",
            actorParticipantId: OWNER,
            action: "correction_started",
            publishedVersion: 1,
          },
        ],
      },
      { postId: "review", status: "submitted_for_review" },
      { postId: "scheduled", status: "scheduled" },
      { postId: "archived", status: "archived", publishedVersion: 1 },
    ];

    for (const item of cases) {
      const post = draft(item);
      await insertBlogPost(post);
      await assert.rejects(
        () =>
          discardUnpublishedBlogDraft({
            postId: post.postId,
            actorParticipantId: OWNER,
            expectedUpdatedAt: post.updatedAt,
          }),
        item.administrativelyBlocked ? BlogAccessDeniedError : BlogConflictError,
      );
      assert.equal((await findBlogPostById(post.postId))?.postId, post.postId);
    }

    await upsertBlogCapabilityGrant({
      participantId: OWNER,
      capabilities: ["author"],
      updatedAt: "2026-11-26T00:00:00.000Z",
      administrativelyBlocked: true,
    });
    const blockedAuthor = draft({ postId: "blocked-author" });
    await insertBlogPost(blockedAuthor);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: blockedAuthor.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: blockedAuthor.updatedAt,
        }),
      BlogAccessDeniedError,
    );
    assert.ok(await findBlogPostById(blockedAuthor.postId));
  });

  it("does not delete when publication history is missing or the draft changes", async () => {
    await asAuthor();
    const ambiguous = draft({ postId: "ambiguous" });
    delete (ambiguous as { publishedVersion?: number }).publishedVersion;
    await insertBlogPost(ambiguous);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: ambiguous.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: ambiguous.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(ambiguous.postId));
    assert.equal(
      await deleteNeverPublishedOwnedDraft({
        postId: ambiguous.postId,
        authorParticipantId: OWNER,
        expectedUpdatedAt: ambiguous.updatedAt,
      }),
      false,
    );

    const fresh = draft({ postId: "race" });
    await insertBlogPost(fresh);
    await replaceBlogPost({ ...fresh, status: "published", publishedVersion: 1, updatedAt: "2026-11-26T01:00:00.000Z" });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: fresh.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: fresh.updatedAt,
        }),
      BlogConflictError,
    );
    assert.equal((await findBlogPostById(fresh.postId))?.status, "published");

    const gone = draft({ postId: "gone" });
    await insertBlogPost(gone);
    await discardUnpublishedBlogDraft({
      postId: gone.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: gone.updatedAt,
    });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: gone.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: gone.updatedAt,
        }),
      BlogNotFoundError,
    );
  });

  it("keeps shared media and refuses an Integrity-linked draft", async () => {
    await asAuthor();
    saveMediaRecord({
      mediaId: "media-cover",
      mediaUrl: "/media/cover.jpg",
      mediaType: "image/jpeg",
      size: 10,
      createdAt: "2026-11-26T00:00:00.000Z",
      ownerUserId: "user-1",
      ownerParticipantId: OWNER,
      purpose: "blog-image",
      storageKey: "covers/cover.jpg",
    });
    const post = draft({
      postId: "with-cover",
      coverMedia: { mediaId: "media-cover", mediaUrl: "/media/cover.jpg" },
    });
    await insertBlogPost(post);
    await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.equal(getMediaRecordById("media-cover")?.storageKey, "covers/cover.jpg");

    const linked = draft({
      postId: "linked",
      externalCover: { source: "integrity-media", url: "https://integrity.example/cover.jpg" },
    });
    await insertBlogPost(linked);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: linked.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: linked.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(linked.postId));

    resetArticleDeliveriesForTests();
    const referenced = draft({ postId: "delivery-ref" });
    await insertBlogPost(referenced);
    await insertArticleDelivery({
      source: "integrity-media",
      publicationId: "im-publication-1",
      payloadDigest: "digest",
      postId: referenced.postId,
      status: "draft",
      phase: "complete",
      createdAt: referenced.createdAt,
      updatedAt: referenced.updatedAt,
    });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: referenced.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: referenced.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(referenced.postId));
  });

  it("leaves published archive transitions unchanged and requires authentication on the new route", () => {
    assert.equal(canTransitionBlogStatus("published", "archived"), true);
    assert.equal(canTransitionBlogStatus("draft", "archived"), false);
    assert.equal(canTransitionBlogStatus("scheduled", "archived"), true);
    assert.equal(canTransitionBlogStatus("submitted_for_review", "archived"), false);

    const service = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog.service.ts"),
      "utf8",
    );
    const archive = service.slice(service.indexOf("export async function archiveBlogPost"), service.indexOf("export async function listEditorialReviewQueue"));
    assert.match(archive, /assertBlogStatusTransition\(existing\.status, "archived"\)/);
    assert.doesNotMatch(archive, /deleteNeverPublishedOwnedDraft/);

    const routes = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog.routes.ts"),
      "utf8",
    );
    const discardRoute = routes.slice(routes.indexOf('"/posts/:postId/discard-draft"'), routes.indexOf('"/posts/:postId/start-correction"'));
    assert.match(discardRoute, /requireJwtAuthenticationMiddleware/);
    assert.match(discardRoute, /discardUnpublishedBlogDraft/);
    assert.match(routes, /\/posts\/:postId\/archive", requireJwtAuthenticationMiddleware/);
    assert.match(routes, /archiveBlogPost\(/);
  });

  it("still rejects archive of a draft through the published deletion path", async () => {
    await asAuthor();
    const post = draft({ postId: "archive-draft" });
    await insertBlogPost(post);
    await assert.rejects(
      () => archiveBlogPost({ postId: post.postId, actorParticipantId: OWNER }),
      /Invalid Blog status transition: draft → archived/,
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
  });
});
