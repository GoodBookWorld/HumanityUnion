/**
 * Pack 16C — SEO projection, sanitization, and distribution boundary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BlogPost } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  resolvePublicBlogPostSeo,
  sanitizeBlogPlainTextMeta,
  validateBlogPublicationOptimization,
} from "../../../src/modules/blog/blog-seo.js";
import { enqueueBlogSocialDistributionBestEffort } from "../../../src/modules/blog/blog-social-distribution.js";
import {
  assertNoInternalBlogFields,
  toPublicBlogPostDetail,
} from "../../../src/modules/blog/blog.projection.js";
import { BlogValidationError } from "../../../src/modules/blog/blog.errors.js";

function basePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    postId: "blog-pack16c-1",
    authorParticipantId: "member-pack16c",
    authorDisplayNameSnapshot: "Author",
    title: "Canonical Title",
    slug: "canonical-title",
    excerpt: "Canonical excerpt for listing cards.",
    content: "<p>Body</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: {
      mediaId: "media-cover",
      mediaUrl: "/api/v1/media/files/blog/cover.webp",
    },
    status: "published",
    originalLanguage: "en",
    safetyOutcome: "accepted",
    review: { reviewStatus: "approved" },
    publishedVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    publishedAt: "2026-01-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 16C — publication SEO and social distribution", () => {
  it("sanitizes plain-text SEO fields and strips HTML/script vectors", () => {
    assert.equal(
      sanitizeBlogPlainTextMeta('<script>alert(1)</script>Hello <b>world</b>'),
      "Hello world",
    );
    assert.equal(sanitizeBlogPlainTextMeta("javascript:alert(1) safe"), "alert(1) safe");
    assert.doesNotMatch(sanitizeBlogPlainTextMeta("javascript:alert(1) safe"), /javascript:/i);
    assert.doesNotMatch(
      sanitizeBlogPlainTextMeta('<img src=x onerror=alert(1)>Title'),
      /<|>|onerror=/i,
    );
  });

  it("validateBlogPublicationOptimization rejects oversized fields and forces not_connected", () => {
    assert.equal(validateBlogPublicationOptimization(undefined), undefined);
    assert.equal(validateBlogPublicationOptimization({}), undefined);

    const cleaned = validateBlogPublicationOptimization({
      seoTitle: "  Safe <b>Title</b>  ",
      seoDescription: "Desc with <script>x</script> text",
      distribution: {
        huSocialShare: "opt_in",
        authorExternalAccounts: [
          {
            provider: "facebook",
            enabled: true,
            connectionStatus: "connected",
            label: "My <b>Page</b>",
          },
        ],
      },
    });

    assert.ok(cleaned);
    assert.equal(cleaned.seoTitle, "Safe Title");
    assert.equal(cleaned.seoDescription, "Desc with text");
    assert.equal(cleaned.distribution?.huSocialShare, "opt_in");
    assert.equal(cleaned.distribution?.authorExternalAccounts?.[0]?.connectionStatus, "not_connected");
    assert.equal(cleaned.distribution?.authorExternalAccounts?.[0]?.enabled, false);
    assert.equal(cleaned.distribution?.authorExternalAccounts?.[0]?.label, "My Page");

    assert.throws(
      () =>
        validateBlogPublicationOptimization({
          seoTitle: "x".repeat(71),
        }),
      BlogValidationError,
    );
  });

  it("resolvePublicBlogPostSeo applies fallbacks for posts without optimization", () => {
    const seo = resolvePublicBlogPostSeo(basePost());
    assert.equal(seo.title, "Canonical Title");
    assert.equal(seo.description, "Canonical excerpt for listing cards.");
    assert.equal(seo.canonicalPath, "/blog/canonical-title");
    assert.equal(seo.socialTitle, "Canonical Title");
    assert.equal(seo.socialDescription, "Canonical excerpt for listing cards.");
    assert.equal(seo.socialImage?.mediaId, "media-cover");
  });

  it("resolvePublicBlogPostSeo prefers explicit SEO/social fields", () => {
    const seo = resolvePublicBlogPostSeo(
      basePost({
        optimization: {
          seoTitle: "SEO Title",
          seoDescription: "SEO Description",
          socialTitle: "Social Title",
          socialDescription: "Social Description",
          socialImage: {
            mediaId: "media-social",
            mediaUrl: "/api/v1/media/files/blog/social.webp",
          },
        },
      }),
    );
    assert.equal(seo.title, "SEO Title");
    assert.equal(seo.description, "SEO Description");
    assert.equal(seo.socialTitle, "Social Title");
    assert.equal(seo.socialDescription, "Social Description");
    assert.equal(seo.socialImage?.mediaId, "media-social");
  });

  it("public detail projection emits seo and never exposes optimization preferences", () => {
    const detail = toPublicBlogPostDetail(
      basePost({
        optimization: {
          seoTitle: "Public SEO",
          seoDescription: "Public meta",
          distribution: {
            huSocialShare: "opt_in",
            authorExternalAccounts: [
              { provider: "x", enabled: true, connectionStatus: "not_connected" },
            ],
          },
        },
      }),
      { publicUserId: "u1", displayName: "Author" },
    );

    assert.equal(detail.seo.title, "Public SEO");
    assert.equal(detail.seo.description, "Public meta");
    assert.equal(detail.seo.canonicalPath, "/blog/canonical-title");
    assertNoInternalBlogFields(detail);
    const serialized = JSON.stringify(detail);
    assert.doesNotMatch(serialized, /"optimization"/);
    assert.doesNotMatch(serialized, /huSocialShare|authorExternalAccounts|opt_in/);
  });

  it("distribution enqueue is best-effort and honest about provider state", async () => {
    const skipped = await enqueueBlogSocialDistributionBestEffort({
      post: basePost(),
      actorParticipantId: "member-pack16c",
    });
    assert.equal(skipped.enqueued, false);
    assert.equal(skipped.reason, "no_distribution_preference");

    // Without Mongo outbox this may fail enqueue — must not throw.
    const attempted = await enqueueBlogSocialDistributionBestEffort({
      post: basePost({
        optimization: {
          distribution: {
            huSocialShare: "opt_in",
            authorExternalAccounts: [
              { provider: "linkedin", enabled: true, connectionStatus: "connected" },
            ],
          },
        },
      }),
      actorParticipantId: "member-pack16c",
    });
    assert.ok(attempted.reason === "queued" || attempted.reason === "outbox_enqueue_failed");
    assert.equal(typeof attempted.enqueued, "boolean");
    assert.equal(CATALOGUE_EVENTS.blogPostSocialDistributionRequested, "BlogPostSocialDistributionRequested");
  });
});
