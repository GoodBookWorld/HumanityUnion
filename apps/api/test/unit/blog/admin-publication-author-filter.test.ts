/**
 * Admin publications are selected by authorParticipantId, and IM authors are
 * recognized from external_author_links rather than display names.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BlogPost } from "@hu/types";

import { INTEGRITY_MEDIA_SOURCE } from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { createMemoryExternalAuthorLinkStore } from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import {
  listAdminBlogPublications,
  replaceBlogPost,
  resetBlogMemoryPersistenceForTests,
} from "../../../src/modules/blog/persistence/blog.repository.js";

const IM_AUTHOR = "11111111-1111-4111-8111-111111111111";
const HU_AUTHOR = "22222222-2222-4222-8222-222222222222";

function post(input: {
  postId: string;
  authorParticipantId: string;
  title: string;
  updatedAt: string;
  status?: BlogPost["status"];
  blocked?: boolean;
  tags?: readonly string[];
}): BlogPost {
  return {
    postId: input.postId,
    authorParticipantId: input.authorParticipantId,
    authorDisplayNameSnapshot: "Participant",
    title: input.title,
    slug: input.postId,
    excerpt: "Excerpt",
    content: "<p>Body</p>",
    categoryId: "our_life",
    tags: input.tags ?? ["dispatch"],
    coverMedia: null,
    status: input.status ?? "published",
    originalLanguage: "en",
    safetyOutcome: "accepted",
    review: { reviewStatus: "none" },
    publishedVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: input.updatedAt,
    ...(input.blocked ? { administrativelyBlocked: true } : {}),
  };
}

function link(memberId: string, state: ExternalAuthorLinkRecord["state"]): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: `ext-${memberId}`,
    memberId,
    state,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    confirmedAt: "2026-01-01T00:00:00.000Z",
    disconnectedAt: state === "disabled" ? "2026-02-01T00:00:00.000Z" : null,
  };
}

describe("Admin publication author filter", () => {
  it("returns every publication for the participant, including a Participant snapshot", async () => {
    resetBlogMemoryPersistenceForTests();
    await replaceBlogPost(
      post({
        postId: "im-1",
        authorParticipantId: IM_AUTHOR,
        title: "Syndicated dispatch",
        updatedAt: "2026-03-02T00:00:00.000Z",
      }),
    );
    await replaceBlogPost(
      post({
        postId: "im-2",
        authorParticipantId: IM_AUTHOR,
        title: "Second dispatch",
        updatedAt: "2026-03-03T00:00:00.000Z",
        status: "draft",
      }),
    );
    await replaceBlogPost(
      post({
        postId: "hu-1",
        authorParticipantId: HU_AUTHOR,
        title: "Ordinary essay",
        updatedAt: "2026-03-04T00:00:00.000Z",
      }),
    );

    const listed = await listAdminBlogPublications({
      authorParticipantId: IM_AUTHOR,
      statusFilter: "all",
      limit: 50,
      offset: 0,
    });
    assert.deepEqual(
      listed.items.map((item) => item.postId),
      ["im-2", "im-1"],
    );
    assert.equal(listed.total, 2);
    assert.ok(listed.items.every((item) => item.authorDisplayNameSnapshot === "Participant"));

    const published = await listAdminBlogPublications({
      authorParticipantId: IM_AUTHOR,
      statusFilter: "published",
      q: "dispatch",
      limit: 1,
      offset: 0,
    });
    assert.equal(published.total, 1);
    assert.equal(published.items[0]?.postId, "im-1");

    const nextPage = await listAdminBlogPublications({
      authorParticipantId: IM_AUTHOR,
      statusFilter: "all",
      limit: 1,
      offset: 1,
    });
    assert.equal(nextPage.total, 2);
    assert.equal(nextPage.items[0]?.postId, "im-1");
  });

  it("keeps a blocked publication on the author list without treating it as deleted", async () => {
    resetBlogMemoryPersistenceForTests();
    await replaceBlogPost(
      post({
        postId: "blocked-1",
        authorParticipantId: IM_AUTHOR,
        title: "Hidden dispatch",
        updatedAt: "2026-04-01T00:00:00.000Z",
        blocked: true,
      }),
    );
    const blocked = await listAdminBlogPublications({
      authorParticipantId: IM_AUTHOR,
      statusFilter: "blocked",
      limit: 10,
      offset: 0,
    });
    assert.equal(blocked.total, 1);
    assert.equal(blocked.items[0]?.administrativelyBlocked, true);
    assert.equal(blocked.items[0]?.status, "published");

    const published = await listAdminBlogPublications({
      authorParticipantId: IM_AUTHOR,
      statusFilter: "published",
      limit: 10,
      offset: 0,
    });
    assert.equal(published.total, 0);
  });
});

describe("Integrity Media author identification", () => {
  it("matches link records, including a disabled connection, and ignores ordinary authors", async () => {
    const store = createMemoryExternalAuthorLinkStore();
    assert.equal((await store.insertLink(link(IM_AUTHOR, "linked"))).toString(), "inserted");
    assert.equal(
      (await store.insertLink(link("33333333-3333-4333-8333-333333333333", "disabled"))).toString(),
      "inserted",
    );

    const listed = await store.listForAdminByMemberIds({
      source: INTEGRITY_MEDIA_SOURCE,
      memberIds: [IM_AUTHOR, HU_AUTHOR, "33333333-3333-4333-8333-333333333333"],
      limit: 10,
      offset: 0,
    });
    assert.deepEqual(
      listed.items.map((item) => item.memberId).sort(),
      [IM_AUTHOR, "33333333-3333-4333-8333-333333333333"].sort(),
    );
    assert.equal(listed.items.some((item) => item.memberId === HU_AUTHOR), false);
  });
});
