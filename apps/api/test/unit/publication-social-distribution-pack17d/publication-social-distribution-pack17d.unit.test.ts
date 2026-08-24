/**
 * Pack 17D — Publication social distribution permissions (unit).
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { BlogPost } from "@hu/types";

import {
  enqueueBlogSocialDistributionBestEffort,
  resolveHuPlatformDistributionDestinations,
} from "../../../src/modules/blog/blog-social-distribution.js";
import { listBlogSocialExternalProviderDescriptors } from "../../../src/modules/blog/blog-social-distribution-provider.js";
import {
  gateBlogPublicationOptimizationAgainstPlatformAccounts,
  validateBlogPublicationOptimization,
  validateHuPlatformChannels,
} from "../../../src/modules/blog/blog-seo.js";
import { BlogValidationError } from "../../../src/modules/blog/blog.errors.js";
import {
  resetPlatformSocialAccountsStoreForTests,
  setPlatformSocialAccountsForceMemoryForTests,
  upsertPlatformSocialAccount,
} from "../../../src/modules/platform-social-accounts/index.js";
import { getPlatformSocialAccountMemory } from "../../../src/modules/platform-social-accounts/persistence/platform-social-accounts.memory.store.js";

function basePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    postId: "blog-pack17d-1",
    authorParticipantId: "member-pack17d",
    authorDisplayNameSnapshot: "Author",
    title: "Distribution Title",
    slug: "distribution-title",
    excerpt: "Excerpt",
    content: "<p>Body</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: null,
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

describe("Pack 17D — publication social distribution permissions", () => {
  beforeEach(() => {
    setPlatformSocialAccountsForceMemoryForTests(true);
    resetPlatformSocialAccountsStoreForTests();
  });

  it("rejects client-supplied destination URLs and credentials on channel rows", () => {
    assert.throws(
      () =>
        validateHuPlatformChannels([
          { networkId: "facebook", permitted: true, url: "https://facebook.com/evil" },
        ]),
      BlogValidationError,
    );
    assert.throws(
      () =>
        validateBlogPublicationOptimization({
          distribution: {
            huPlatformChannels: [
              { networkId: "x", permitted: true, accessToken: "secret" },
            ],
          },
        }),
      BlogValidationError,
    );
  });

  it("saves permitted selection and forces personal authorExternalAccounts off", () => {
    const cleaned = validateBlogPublicationOptimization({
      distribution: {
        huPlatformChannels: [
          { networkId: "facebook", permitted: true },
          { networkId: "youtube", permitted: false },
        ],
        authorExternalAccounts: [
          { provider: "facebook", enabled: true, connectionStatus: "connected" },
        ],
      },
    });
    assert.ok(cleaned?.distribution);
    assert.equal(cleaned.distribution.huSocialShare, "opt_in");
    assert.equal(
      cleaned.distribution.huPlatformChannels?.find((row) => row.networkId === "facebook")
        ?.permitted,
      true,
    );
    assert.equal(cleaned.distribution.authorExternalAccounts?.[0]?.enabled, false);
    assert.equal(cleaned.distribution.authorExternalAccounts?.[0]?.connectionStatus, "not_connected");
  });

  it("gates unconfigured networks unavailable and keeps configured selectable", async () => {
    const youtube = getPlatformSocialAccountMemory("youtube");
    assert.ok(youtube);
    await upsertPlatformSocialAccount({
      ...youtube,
      url: null,
      enabled: false,
      updatedAt: new Date().toISOString(),
    });

    const gated = await gateBlogPublicationOptimizationAgainstPlatformAccounts({
      distribution: {
        huSocialShare: "opt_in",
        huPlatformChannels: [
          { networkId: "facebook", permitted: true },
          { networkId: "youtube", permitted: true },
          { networkId: "instagram", permitted: true },
          { networkId: "x", permitted: true },
        ],
      },
    });

    const byId = new Map(
      (gated?.distribution?.huPlatformChannels ?? []).map((row) => [row.networkId, row]),
    );
    assert.equal(byId.get("facebook")?.permitted, true);
    assert.equal(byId.get("youtube")?.permitted, false);
    assert.equal(byId.get("instagram")?.permitted, true);
    assert.equal(byId.get("x")?.permitted, true);
  });

  it("resolves destinations server-side and never claims provider delivery", async () => {
    const destinations = await resolveHuPlatformDistributionDestinations(
      basePost({
        optimization: {
          distribution: {
            huSocialShare: "opt_in",
            huPlatformChannels: [
              { networkId: "facebook", permitted: true },
              { networkId: "youtube", permitted: true },
            ],
          },
        },
      }),
    );
    assert.ok(destinations.length >= 1);
    assert.ok(destinations.every((row) => row.destinationUrl.startsWith("https://")));
    assert.ok(destinations.every((row) => row.providerReadiness === "not_connected"));
    assert.ok(destinations.every((row) => row.deliveryStatus === "awaiting_provider"));
    assert.doesNotMatch(JSON.stringify(destinations), /Published to|delivered successfully/i);

    const providers = listBlogSocialExternalProviderDescriptors();
    assert.equal(providers.length, 4);
    assert.ok(providers.every((row) => row.readiness === "not_connected"));
  });

  it("blocked/scheduled publications cannot distribute early; no fake success", async () => {
    const scheduled = await enqueueBlogSocialDistributionBestEffort({
      post: basePost({
        status: "scheduled",
        optimization: {
          distribution: {
            huSocialShare: "opt_in",
            huPlatformChannels: [{ networkId: "facebook", permitted: true }],
          },
        },
      }),
      actorParticipantId: "member-pack17d",
    });
    assert.equal(scheduled.enqueued, false);
    assert.equal(scheduled.reason, "blocked_not_published");

    const blocked = await enqueueBlogSocialDistributionBestEffort({
      post: basePost({
        status: "published",
        administrativelyBlocked: true,
        optimization: {
          distribution: {
            huSocialShare: "opt_in",
            huPlatformChannels: [{ networkId: "x", permitted: true }],
          },
        },
      }),
      actorParticipantId: "member-pack17d",
    });
    assert.equal(blocked.enqueued, false);
    assert.equal(blocked.reason, "administratively_blocked");

    const published = await enqueueBlogSocialDistributionBestEffort({
      post: basePost({
        optimization: {
          distribution: {
            huSocialShare: "opt_in",
            huPlatformChannels: [{ networkId: "instagram", permitted: true }],
          },
        },
      }),
      actorParticipantId: "member-pack17d",
    });
    assert.ok(published.reason === "queued" || published.reason === "outbox_enqueue_failed");
    assert.equal(typeof published.enqueued, "boolean");
  });
});
