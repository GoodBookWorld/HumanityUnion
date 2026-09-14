/**
 * Pack 08J.1 — historical recovery discovery expands to all AUTO_TRANSLATABLE
 * projection families (blog_post + civic_media + remaining civic kinds).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BlogPost } from "@hu/types";

import { CIVIC_MEDIA_RECORD_ID } from "../../../src/modules/language/content-translation-civic-loaders.js";
import {
  CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS,
  STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS,
  discoverStagingInitiativePathWarmSources,
  discoverStagingUniversalWarmSources,
} from "../../../src/modules/language/content-translation-staging-warm-backfill.js";

function samplePublishedBlog(postId: string): BlogPost {
  const now = new Date().toISOString();
  return {
    postId,
    slug: `${postId}-slug`,
    title: `Published ${postId}`,
    excerpt: "Public excerpt for recovery discovery.",
    content: "<p>Published body for recovery discovery.</p>",
    status: "published",
    originalLanguage: "en",
    authorParticipantId: "member-08j1",
    authorDisplayNameSnapshot: "Member",
    categoryId: "governance",
    tags: [],
    publishedVersion: 1,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    coverMedia: null,
    editorialHistory: [],
    safetyOutcome: "accepted",
    review: {
      reviewStatus: "approved",
    },
  };
}

describe("Pack 08J.1 — historical recovery discovery expansion", () => {
  it("recovery kinds include blog_post and civic_media (alias stays in sync)", () => {
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("blog_post"));
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("civic_media"));
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("improvement_proposal"));
    assert.ok(CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS.includes("initiative_revision"));
    assert.equal(
      STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS,
      CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS,
    );
  });

  it("published blog fixture yields blog_post candidates; civic_media is singleton", async () => {
    const published = samplePublishedBlog("08j1-blog-published");
    const discovered = await discoverStagingUniversalWarmSources({
      kinds: ["blog_post", "civic_media"],
      deps: {
        listInitiatives: () => [],
        listPublishedBlogPostsForSearch: async () => [published],
      },
    });

    const byKind = Object.fromEntries(
      [...discovered.discoveryByKind.entries()].map(([kind, row]) => [kind, row]),
    );

    assert.equal(byKind.blog_post?.sourceRecordsDiscovered, 1);
    assert.equal(byKind.blog_post?.publicRecords, 1);
    assert.ok(
      discovered.candidates.some(
        (c) => c.sourceKind === "blog_post" && c.sourceRecordId === published.postId,
      ),
    );

    assert.equal(byKind.civic_media?.sourceRecordsDiscovered, 1);
    assert.equal(byKind.civic_media?.publicRecords, 1);
    assert.ok(
      discovered.candidates.some(
        (c) =>
          c.sourceKind === "civic_media" && c.sourceRecordId === CIVIC_MEDIA_RECORD_ID,
      ),
    );
  });

  it("discoverStagingInitiativePathWarmSources aliases universal discovery", async () => {
    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: ["civic_media"],
      deps: {
        listInitiatives: () => [],
        listPublishedBlogPostsForSearch: async () => [],
      },
    });
    assert.equal(discovered.candidates.length, 1);
    assert.equal(discovered.candidates[0]?.sourceKind, "civic_media");
    assert.equal(discovered.candidates[0]?.sourceRecordId, CIVIC_MEDIA_RECORD_ID);
  });
});
