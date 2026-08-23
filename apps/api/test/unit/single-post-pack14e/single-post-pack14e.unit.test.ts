/**
 * Pack 14E — Single-post visibility + Block 14 final certification (API contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { sanitizeBlogHtml } from "../../../src/modules/blog/blog-content-sanitize.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 14E — Block 14 final certification (API)", () => {
  it("public slug detail hides draft/blocked/future scheduled", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    const detailFn = service.slice(service.indexOf("export async function getPublicBlogPostBySlug"));
    assert.match(detailFn, /status !== "published"/);
    assert.match(detailFn, /administrativelyBlocked === true/);
    assert.match(detailFn, /publishedAt > now/);
    assert.match(detailFn, /BlogNotFoundError/);
    assert.match(detailFn, /assertNoInternalBlogFields/);
  });

  it("list visibility filter + pageSize discovery remain Pack 14D contracts", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /listPublicBlogPosts/);
    assert.match(service, /categoryCounts/);
    assert.match(service, /latestPublications/);
    assert.match(service, /blogIndexViews/);
    assert.match(service, /totalPages/);

    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /status:\s*"published"/);
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
    assert.match(repo, /aggregatePublishedBlogPostCountsByCategory/);
  });

  it("Pack 14C sanitizer preserves rich marks and rejects scripts", () => {
    const html = sanitizeBlogHtml(
      [
        "<h2>Heading</h2>",
        "<p><strong>Bold</strong> and <em>italic</em></p>",
        "<ul><li>One</li></ul>",
        "<blockquote>Quote</blockquote>",
        '<p><a href="https://example.com">Link</a></p>',
        '<img src="https://cdn.example/x.jpg" alt="Inline alt" />',
        '<script>alert(1)</script>',
      ].join(""),
    );
    assert.match(html, /<h2>Heading<\/h2>/);
    assert.match(html, /<strong>Bold<\/strong>/);
    assert.match(html, /<em>italic<\/em>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<blockquote>/);
    assert.match(html, /href="https:\/\/example\.com"/);
    assert.match(html, /alt="Inline alt"/);
    assert.doesNotMatch(html, /<script/i);
  });

  it("Pack 14A reconciliation + 14B review notifications remain wired", () => {
    const index = readRepo("apps/api/src/index.ts");
    assert.match(index, /startAuthorApplicationReconciliationOnce/);
    assert.match(index, /startPublicationReviewReconciliationOnce/);

    const authorNotify = readRepo(
      "apps/api/src/modules/blog/blog-author-application-notifications.ts",
    );
    assert.match(authorNotify, /existsNotificationForRecipientEventAndRelatedEntity/);

    const pubNotify = readRepo("apps/api/src/modules/blog/blog-publication-notifications.ts");
    assert.match(pubNotify, /blog_publication_review_requested/);
    assert.match(pubNotify, /blogPublicationReviewNotificationEntityId/);

    const adminRoutes = readRepo("apps/api/src/modules/blog/admin-publishing.routes.ts");
    assert.match(adminRoutes, /author-applications\/pending/);
    assert.match(adminRoutes, /publications\/pending-review/);
  });

  it("Blog Views public getter exposes aggregate only", () => {
    const traffic = readRepo(
      "apps/api/src/modules/traffic-analytics/traffic-aggregate.repository.ts",
    );
    assert.match(traffic, /getPublicBlogIndexViewCount/);
    assert.match(traffic, /pathname === "\/blog"/);
    assert.match(traffic, /blogIndexAllTimeViews/);

    const projection = readRepo("apps/api/src/modules/blog/blog.projection.ts");
    assert.match(projection, /assertNoInternalBlogFields/);
    assert.match(projection, /authorParticipantId/);
    assert.match(projection, /reviewNote/);
  });

  it("Pack 13 block/schedule public semantics remain in list + detail filters", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    const listSlice = repo.slice(repo.indexOf("export async function listPublishedBlogPosts"));
    assert.match(listSlice, /publishedAt:\s*\{\s*\$lte:/);
    assert.match(listSlice, /administrativelyBlocked/);
    assert.match(listSlice, /status:\s*"published"/);
  });
});
