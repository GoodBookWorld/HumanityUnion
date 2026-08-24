/**
 * Pack 14E — Single-post shell + Block 14 final certification (Web contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_PAGE_SIZE } from "../blog/api.js";
import { buildBlogIndexHref } from "../blog/blog-url.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 14E — Single-post shell & Block 14 certification (Web)", () => {
  it("single-post uses shared discovery rails + Search span (no duplicate sidebars)", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogDiscoverySearch/);
    assert.match(article, /BlogDiscoveryLeftRail/);
    assert.match(article, /BlogDiscoveryRightRail/);
    assert.match(article, /usePublicBlogDiscovery/);
    assert.match(article, /blog-layout__center/);
    assert.match(article, /blog-page--pack15c/);
    assert.doesNotMatch(article, /function BlogCategoriesSidebar/);
    assert.doesNotMatch(article, /function BlogViewsWidget/);

    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogDiscoverySearch/);
    assert.match(index, /BlogDiscoveryLeftRail/);
    assert.match(index, /BlogDiscoveryRightRail/);

    const left = readWeb("features/blog/components/BlogDiscoveryLeftRail.tsx");
    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    const search = readWeb("features/blog/components/BlogDiscoverySearch.tsx");
    assert.match(left, /BlogCategoriesSidebar/);
    assert.match(left, /BlogAuthorsSidebar/);
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);
    assert.doesNotMatch(right, /blog-layout__search/);
    assert.match(search, /blog-layout__search/);
  });

  it("center post renders canonical article fields + comments metadata", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /blog-article__title/);
    assert.match(article, /formatBlogPublishedDate/);
    assert.match(article, /BlogAuthorInline/);
    assert.match(article, /commentsLabel|commentCount/);
    assert.match(article, /BlogCoverImage/);
    assert.match(article, /BlogArticleBody/);
    assert.match(article, /BlogCommentsSection/);
    assert.match(article, /post\.category/);
    assert.match(article, /BlogReactionControls/);
  });

  it("rich content body is sanitized HTML only (no editor chrome)", () => {
    const body = readWeb("features/blog/components/BlogArticleBody.tsx");
    assert.match(body, /dangerouslySetInnerHTML/);
    assert.match(body, /Server-sanitized Blog HTML/);
    assert.doesNotMatch(body, /contenteditable|ProseMirror/i);

    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-article-body h2/);
    assert.match(css, /\.blog-article-body blockquote/);
    assert.match(css, /\.blog-article-body img/);
    assert.match(css, /\.blog-article-body a/);
  });

  it("desktop independent scroll; Pack 15C Search span; mobile document order", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /"left search search"/);
    assert.match(css, /"left center right"/);
    assert.match(css, /\.blog-layout__center\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.blog-layout__right\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /display:\s*contents/);
    assert.match(css, /"search"\s*"categories"\s*"center"\s*"authors"\s*"views"\s*"chart"\s*"latest4"/s);
  });

  it("pagination contracts: pageSize 9 + shareable URL state", () => {
    assert.equal(BLOG_PAGE_SIZE, 9);
    assert.equal(buildBlogIndexHref({ page: 2 }), "/blog?page=2");
    assert.equal(
      buildBlogIndexHref({ categorySlug: "impact", q: "peace", page: 2 }),
      "/blog?q=peace&category=impact&page=2",
    );
  });

  it("Pack 14A–14C UI surfaces remain wired", () => {
    const admin = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(admin, /Pending applications/);
    assert.match(admin, /Pending Review/);
    assert.match(admin, /AuthorApplicationReviewModal/);

    const editor = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(editor, /"bold"|"italic"|Bold|Italic/);
    assert.match(editor, /Underline|Alignment|uploadImage/);

    const notifications = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(notifications, /blog_publication_review_requested/);
    assert.match(notifications, /blog_author_application_review_requested/);
  });

  it("public article does not embed admin analytics or review internals", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.doesNotMatch(article, /visitorId|sessionId|referrer|allTimeSessions/i);
    assert.doesNotMatch(article, /reviewNote|safetyOutcome|authorParticipantId/);
    assert.doesNotMatch(article, /administrativelyBlocked/);

    const views = readWeb("features/blog/components/BlogViewsWidget.tsx");
    assert.match(views, /Aggregate only/);
    assert.doesNotMatch(views, /visitorId|sessionId|referrerHost/i);
  });
});
