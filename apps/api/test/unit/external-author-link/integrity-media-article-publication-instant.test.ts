import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { integrityMediaArticlePublicationInstant } from "../../../src/modules/external-author-link/external-author-link.article-publication-instant.js";
import {
  createBlogDraft,
  grantBlogCapabilitiesForTests,
  publishBlogPost,
  releaseDueScheduledBlogPublications,
} from "../../../src/modules/blog/blog.service.js";
import {
  findBlogPostById,
  listBlogMemoryPostsForTests,
  replaceBlogPost,
  resetBlogMemoryPersistenceForTests,
  upsertBlogCapabilityGrant,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { resetSafetyProviderForTests } from "../../../src/modules/lifecycle-safety/safety-provider.js";

const MEMBER = "22222222-2222-4222-8222-222222222222";

describe("Integrity Media publication instant", () => {
  it("keeps noon UTC except for a same-day instant that is not yet noon", () => {
    const beforeNoon = new Date("2026-10-22T11:00:00.000Z");
    const afterNoon = new Date("2026-10-22T15:00:00.000Z");
    assert.equal(
      integrityMediaArticlePublicationInstant("2026-10-22", beforeNoon),
      "2026-10-22T11:00:00.000Z",
    );
    assert.equal(
      integrityMediaArticlePublicationInstant("2026-10-22", afterNoon),
      "2026-10-22T12:00:00.000Z",
    );
    assert.equal(
      integrityMediaArticlePublicationInstant("2026-10-21", beforeNoon),
      "2026-10-21T12:00:00.000Z",
    );
    assert.equal(
      integrityMediaArticlePublicationInstant("2026-10-23", afterNoon),
      afterNoon.toISOString(),
    );
    assert.equal(
      integrityMediaArticlePublicationInstant("2026-10-23", afterNoon).slice(0, 10),
      "2026-10-22",
    );
  });
});

describe("ordinary Blog scheduling stays on noon UTC", () => {
  beforeEach(() => {
    resetBlogMemoryPersistenceForTests();
    resetSafetyProviderForTests();
  });

  it("schedules a future-dated Blog article at noon UTC", async () => {
    await grantBlogCapabilitiesForTests({
      participantId: MEMBER,
      capabilities: ["author", "trusted_author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: MEMBER,
      actorDisplayName: "Participant",
      body: {
        title: "Future ordinary article",
        excerpt: "A short public excerpt for the Humanity Union Blog.",
        content: "<p>A public article for the Humanity Union Blog.</p>",
        categoryId: "conscious_existence",
        originalLanguage: "en",
        publicationDate: "2099-06-01",
        tags: [],
      },
    });
    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: MEMBER,
      publicationDate: "2099-06-01",
    });
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.publishedAt, "2099-06-01T12:00:00.000Z");
  });

  it("does not publish a due scheduled article while the author is soft-blocked", async () => {
    await grantBlogCapabilitiesForTests({
      participantId: MEMBER,
      capabilities: ["author", "trusted_author"],
    });
    const draft = await createBlogDraft({
      actorParticipantId: MEMBER,
      actorDisplayName: "Participant",
      body: {
        title: "Scheduled then blocked",
        excerpt: "A short public excerpt for the Humanity Union Blog.",
        content: "<p>A public article for the Humanity Union Blog.</p>",
        categoryId: "conscious_existence",
        originalLanguage: "en",
        publicationDate: "2099-04-01",
        tags: [],
      },
    });
    const scheduled = await publishBlogPost({
      postId: draft.postId,
      actorParticipantId: MEMBER,
      publicationDate: "2099-04-01",
    });
    assert.equal(scheduled.status, "scheduled");

    await upsertBlogCapabilityGrant({
      participantId: MEMBER,
      capabilities: ["author", "trusted_author"],
      updatedAt: "2026-10-22T12:00:00.000Z",
      administrativelyBlocked: true,
      administrativeBlockAuthority: "ADMIN",
    });
    const pending = await findBlogPostById(scheduled.postId);
    assert.ok(pending);
    await replaceBlogPost({
      ...pending,
      publishedAt: "2024-02-01T12:00:00.000Z",
    });

    const released = await releaseDueScheduledBlogPublications({
      nowIso: "2026-10-22T15:00:00.000Z",
    });
    assert.equal(released.releasedCount, 0);
    assert.equal((await findBlogPostById(scheduled.postId))?.status, "scheduled");
    assert.equal(listBlogMemoryPostsForTests()[0]?.status, "scheduled");
  });
});
