/**
 * HU-UX-01B — public author publications. No production database writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogPost, MemberProfile } from "@hu/types";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { setFindAuthUserByIdForTests } from "../../../src/modules/auth/auth-user.repository.js";
import { BlogValidationError } from "../../../src/modules/blog/blog.errors.js";
import {
  listPublicAuthorPublicationsByPublicName,
  parsePublicAuthorPublicationPage,
} from "../../../src/modules/blog/blog-public-author-publications.js";
import { isBlogAuthorAdministrativelyBlocked } from "../../../src/modules/blog/admin-publishing.service.js";
import {
  insertBlogPost,
  listPublicAuthorPublicationRecords,
  publicAuthorHasVisiblePublications,
  resetBlogMemoryPersistenceForTests,
  upsertBlogCapabilityGrant,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
} from "../../../src/modules/member-profile/member-profile.errors.js";
import { setFindMemberProfileByPublicNameForTests } from "../../../src/modules/member-profile/member-profile.repository.js";

const AUTHOR = "member-author";
const OTHER = "member-other";
const NOW = "2026-11-01T12:00:00.000Z";
const dir = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(dir, "../../../src");

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    postId: "post-native",
    authorParticipantId: AUTHOR,
    authorDisplayNameSnapshot: "Author",
    title: "Native article",
    slug: "native-article",
    excerpt: "Private excerpt",
    content: "<p>Private body</p>",
    categoryId: "our_life",
    tags: ["hidden-tag"],
    coverMedia: { mediaId: "media-1", mediaUrl: "/media/cover.jpg", altText: "Cover" },
    status: "published",
    originalLanguage: "en",
    safetyOutcome: null,
    review: { reviewStatus: "none" },
    publishedVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    profileId: "profile-1",
    userId: "user-1",
    memberNumber: "M-1",
    createdAt: NOW,
    updatedAt: NOW,
    displayName: "Author",
    publicName: "public-author",
    skills: [],
    participationVisibility: "public",
    language: "en",
    profileVisibility: "public",
    showOrganization: false,
    showLocation: false,
    showParticipationArea: false,
    membershipPubliclyVisible: false,
    skillsVisibility: "public",
    professionalLinksVisibility: "public",
    showInitiativesStatistics: true,
    showCollectiveDecisionsStatistics: true,
    showAlliesStatistics: true,
    showProposalsStatistics: true,
    showPetitionsStatistics: true,
    showCommitmentsStatistics: true,
    messagingPolicy: "active_allies",
    status: "active",
    ...overrides,
  };
}

function authUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    userId: "user-1",
    email: "author@example.com",
    passwordHash: "hash",
    displayName: "Author",
    role: "member",
    status: "active",
    memberId: AUTHOR,
    emailVerificationStatus: "verified",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("HU-UX-01B public author publications", () => {
  beforeEach(() => {
    resetBlogMemoryPersistenceForTests();
    setFindMemberProfileByPublicNameForTests(async (publicName) =>
      publicName === "public-author" ? profile() : null,
    );
    setFindAuthUserByIdForTests(async (userId) =>
      userId === "user-1" ? authUser() : null,
    );
  });

  afterEach(() => {
    resetBlogMemoryPersistenceForTests();
    setFindMemberProfileByPublicNameForTests(null);
    setFindAuthUserByIdForTests(null);
  });

  it("returns native and Integrity publications for the profile subject only", async () => {
    await insertBlogPost(post());
    await insertBlogPost(
      post({
        postId: "post-integrity",
        slug: "integrity-article",
        title: "Integrity article",
        publishedAt: "2026-10-02T12:00:00.000Z",
        coverMedia: null,
        externalCover: {
          source: "integrity-media",
          url: "https://cdn.example/integrity-cover.jpg",
        },
      }),
    );
    await insertBlogPost(
      post({
        postId: "post-other",
        authorParticipantId: OTHER,
        slug: "other-article",
        title: "Other author",
        publishedAt: "2026-10-03T12:00:00.000Z",
      }),
    );

    const page = await listPublicAuthorPublicationsByPublicName({
      publicName: "public-author",
      viewerIsAuthenticated: false,
    });

    assert.deepEqual(
      page.items.map((item) => item.postId),
      ["post-integrity", "post-native"],
    );
    assert.equal(page.items[0]?.coverImage?.mediaUrl, "https://cdn.example/integrity-cover.jpg");
    assert.equal(page.hasMore, false);
    assert.equal(page.limit, 10);
    const serialized = JSON.stringify(page);
    assert.equal(serialized.includes("Private body"), false);
    assert.equal(serialized.includes("Private excerpt"), false);
    assert.equal(serialized.includes("authorParticipantId"), false);
    assert.equal(serialized.includes("hidden-tag"), false);
    assert.equal(serialized.includes(AUTHOR), false);
    assert.equal("author" in (page.items[0] ?? {}), false);
  });

  it("excludes drafts, review, scheduled, future, archived, blocked, and missing dates", async () => {
    const hidden: Array<Partial<BlogPost>> = [
      { postId: "draft", slug: "draft", status: "draft", publishedVersion: 0, publishedAt: undefined },
      { postId: "review", slug: "review", status: "submitted_for_review" },
      { postId: "scheduled", slug: "scheduled", status: "scheduled", publishedAt: "2026-12-01T12:00:00.000Z" },
      { postId: "future", slug: "future", status: "published", publishedAt: "2999-01-01T12:00:00.000Z" },
      { postId: "archived", slug: "archived", status: "archived" },
      { postId: "blocked", slug: "blocked", administrativelyBlocked: true },
      { postId: "undated", slug: "undated", status: "published", publishedAt: undefined },
    ];
    for (const item of hidden) {
      await insertBlogPost(post(item));
    }
    await insertBlogPost(post({ postId: "visible", slug: "visible", title: "Visible" }));

    const page = await listPublicAuthorPublicationRecords({
      authorParticipantId: AUTHOR,
      limit: 20,
      offset: 0,
    });
    assert.deepEqual(page.items.map((item) => item.postId), ["visible"]);
    assert.equal(await publicAuthorHasVisiblePublications(AUTHOR), true);
    assert.equal(await publicAuthorHasVisiblePublications(OTHER), false);
  });

  it("keeps a blocked author's already published post visible", async () => {
    await upsertBlogCapabilityGrant({
      participantId: AUTHOR,
      capabilities: ["author"],
      updatedAt: NOW,
      administrativelyBlocked: true,
      administrativeBlockAuthority: "ADMIN",
    });
    await insertBlogPost(post());
    assert.equal(await isBlogAuthorAdministrativelyBlocked(AUTHOR), true);

    const page = await listPublicAuthorPublicationRecords({
      authorParticipantId: AUTHOR,
      limit: 10,
      offset: 0,
    });
    assert.deepEqual(page.items.map((item) => item.postId), ["post-native"]);
  });

  it("sorts by publishedAt descending and postId ascending, without overlap", async () => {
    await insertBlogPost(post({ postId: "b", slug: "b", publishedAt: "2026-10-01T12:00:00.000Z" }));
    await insertBlogPost(post({ postId: "a", slug: "a", publishedAt: "2026-10-01T12:00:00.000Z" }));
    await insertBlogPost(post({ postId: "c", slug: "c", publishedAt: "2026-09-01T12:00:00.000Z" }));
    await insertBlogPost(post({ postId: "d", slug: "d", publishedAt: "2026-11-01T12:00:00.000Z" }));

    const first = await listPublicAuthorPublicationRecords({
      authorParticipantId: AUTHOR,
      limit: 2,
      offset: 0,
    });
    const second = await listPublicAuthorPublicationRecords({
      authorParticipantId: AUTHOR,
      limit: 2,
      offset: 2,
    });
    assert.deepEqual(first.items.map((item) => item.postId), ["d", "a"]);
    assert.equal(first.hasMore, true);
    assert.deepEqual(second.items.map((item) => item.postId), ["b", "c"]);
    assert.equal(second.hasMore, false);
    const ids = [...first.items, ...second.items].map((item) => item.postId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("validates limit and offset and defaults the page size to 10", async () => {
    for (let index = 0; index < 11; index += 1) {
      await insertBlogPost(
        post({
          postId: `p-${String(index).padStart(2, "0")}`,
          slug: `p-${index}`,
          publishedAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
        }),
      );
    }
    const page = await listPublicAuthorPublicationsByPublicName({
      publicName: "public-author",
      viewerIsAuthenticated: false,
    });
    assert.equal(page.items.length, 10);
    assert.equal(page.limit, 10);
    assert.equal(page.offset, 0);
    assert.equal(page.hasMore, true);
    assert.deepEqual(parsePublicAuthorPublicationPage({}), { limit: 10, offset: 0 });
    assert.throws(() => parsePublicAuthorPublicationPage({ limit: 0 }), BlogValidationError);
    assert.throws(() => parsePublicAuthorPublicationPage({ limit: 21 }), BlogValidationError);
    assert.throws(() => parsePublicAuthorPublicationPage({ offset: -1 }), BlogValidationError);
    assert.throws(() => parsePublicAuthorPublicationPage({ limit: 1.5 }), BlogValidationError);
  });

  it("rejects unknown, closed, private, and guest members-only profiles", async () => {
    await insertBlogPost(post());
    await assert.rejects(
      () =>
        listPublicAuthorPublicationsByPublicName({
          publicName: "missing",
          viewerIsAuthenticated: false,
        }),
      MemberProfileNotFoundError,
    );

    setFindMemberProfileByPublicNameForTests(async () => profile({ status: "closed" }));
    await assert.rejects(
      () =>
        listPublicAuthorPublicationsByPublicName({
          publicName: "public-author",
          viewerIsAuthenticated: true,
          viewerUserId: "user-2",
        }),
      MemberProfileNotFoundError,
    );

    setFindMemberProfileByPublicNameForTests(async () =>
      profile({ profileVisibility: "private" }),
    );
    await assert.rejects(
      () =>
        listPublicAuthorPublicationsByPublicName({
          publicName: "public-author",
          viewerIsAuthenticated: true,
          viewerUserId: "user-2",
        }),
      MemberProfileAccessDeniedError,
    );

    setFindMemberProfileByPublicNameForTests(async () =>
      profile({ profileVisibility: "members_only" }),
    );
    await assert.rejects(
      () =>
        listPublicAuthorPublicationsByPublicName({
          publicName: "public-author",
          viewerIsAuthenticated: false,
        }),
      MemberProfileAccessDeniedError,
    );

    const visible = await listPublicAuthorPublicationsByPublicName({
      publicName: "public-author",
      viewerIsAuthenticated: true,
      viewerUserId: "user-2",
    });
    assert.equal(visible.items.length, 1);
    assert.equal(visible.items[0]?.postId, "post-native");
  });

  it("returns an empty page for a public profile with no visible publications", async () => {
    await insertBlogPost(post({ status: "draft", publishedVersion: 0, publishedAt: undefined }));
    const page = await listPublicAuthorPublicationsByPublicName({
      publicName: "public-author",
      viewerIsAuthenticated: false,
    });
    assert.deepEqual(page.items, []);
    assert.equal(page.hasMore, false);
    assert.equal(await publicAuthorHasVisiblePublications(AUTHOR), false);
  });

  it("uses one author query and does not add a blog index or archive the post", () => {
    const service = readFileSync(
      path.join(apiSrc, "modules/blog/blog-public-author-publications.ts"),
      "utf8",
    );
    const repository = readFileSync(
      path.join(apiSrc, "modules/blog/persistence/blog.repository.ts"),
      "utf8",
    );
    const routes = readFileSync(path.join(apiSrc, "modules/blog/blog.routes.ts"), "utf8");
    const indexes = readFileSync(
      path.join(apiSrc, "infrastructure/mongodb/mongo-indexes.ts"),
      "utf8",
    );
    const profile = readFileSync(
      path.join(apiSrc, "modules/member-profile/member-profile.service.ts"),
      "utf8",
    );
    assert.equal(service.includes("resolveBlogPublicAuthor"), false);
    assert.equal(service.includes("archiveBlogPost"), false);
    assert.equal(service.includes("discardUnpublishedBlogDraft"), false);
    assert.equal(service.includes("external-author-link"), false);
    assert.match(repository, /export async function publicAuthorHasVisiblePublications/);
    assert.match(repository, /findOne\(publicAuthorPublicationMongoFilter/);
    assert.equal(repository.includes("countDocuments(publicAuthorPublicationMongoFilter"), false);
    const routeAt = routes.indexOf('"/by-public-name/:publicName"');
    const slugAt = routes.indexOf('publicBlogRouter.get("/:slug"');
    assert.ok(routeAt > 0 && slugAt > routeAt);
    assert.match(routes, /optionalAuthenticationMiddleware,\s*async \(req, res\) => \{[\s\S]*listPublicAuthorPublicationsByPublicName/);
    assert.match(indexes, /blog_posts_author_updated_at/);
    assert.equal(indexes.includes("blog_posts_author_status_published_at"), false);
    assert.match(profile, /publicAuthorHasVisiblePublications/);
    assert.match(profile, /hasPublicAuthorPublications = true/);
    assert.equal(profile.includes("listPublicAuthorPublicationRecords"), false);
  });
});
