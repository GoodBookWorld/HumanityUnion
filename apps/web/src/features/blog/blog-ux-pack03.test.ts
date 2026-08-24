import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DESKTOP_CAPSULE_NAVIGATION,
  PRIMARY_NAVIGATION,
} from "../public-experience/constants.js";
import { FOOTER_PLATFORM_COLUMN_ONE } from "../public-experience/footer-links.js";
import {
  assistantWidgetCopy,
  resolveAssistantLaunchContext,
} from "../humanity-union-assistant/resolve-assistant-surface.js";
import { buildBlogIndexHref, parseBlogPageParam, resolveCategoryIdFromSlug } from "./blog-url.js";
import { BLOG_PAGE_SIZE, formatBlogPublishedDate } from "./api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Blog UX Pack 03 — Public Blog & Article Experience", () => {
  it("1/2 — /blog page and canonical heading exist", () => {
    const page = read("app/blog/page.tsx");
    assert.match(page, /BlogIndexPageContent/);
    assert.match(page, /title:\s*"Blog \| Humanity Union"/);

    const index = read("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /<h1[^>]*>Blog<\/h1>/);
    assert.match(
      index,
      /Ideas, reflections and perspectives from Humanity Union authors/,
    );
    assert.doesNotMatch(index, /Publications and Discussions/);
  });

  it("3/4/5 — category options and explicit search query wiring", () => {
    const index = read("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogCategoriesSidebar|BlogDiscoveryLeftRail/);
    assert.match(index, /fetchPublicBlogCategories/);
    assert.match(index, /BlogDiscoverySearch|type="search"/);
    assert.match(index, /blog-layout__search|BlogDiscoverySearch/);

    const categories = read("features/blog/components/BlogCategoriesSidebar.tsx");
    assert.match(categories, /All Categories/);
    assert.match(categories, /buildBlogIndexHref/);

    const search = read("features/blog/components/BlogDiscoverySearch.tsx");
    assert.match(search, /onSearchSubmit|type="search"/);
    assert.match(search, /blog-layout__search/);

    const api = read("features/blog/api.ts");
    assert.match(api, /params\.set\("q"/);
    assert.match(api, /params\.set\("categoryId"/);
    assert.match(api, /\/api\/v1\/public\/blog/);
  });

  it("6/7/8/9/10 — card projection without fake reactions or unpublished fields", () => {
    const card = read("features/blog/components/BlogPostCard.tsx");
    assert.match(card, /BlogPostCard/);
    assert.match(card, /post\.excerpt/);
    assert.match(card, /post\.author/);
    assert.match(card, /BlogAuthorInline/);
    assert.match(card, /No Comments|1 Comment|Comments/);
    const authorInline = read("features/blog/components/BlogAuthorInline.tsx");
    assert.match(authorInline, /profileUrl/);
    // Pack 07 may show real commentCount; reaction totals stay detail-only.
    assert.match(card, /commentCount/);
    assert.doesNotMatch(card, /Helpful/);
    assert.doesNotMatch(card, /Not Helpful/);
    assert.doesNotMatch(card, /legacy/);
    assert.doesNotMatch(card, /safetyOutcome/);
    assert.doesNotMatch(card, /submitted_for_review/);
  });

  it("11/12 — empty state and pagination controls", () => {
    const index = read("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /No publications found\./);
    assert.match(index, /Clear filters/);
    assert.match(index, /BlogPagination/);

    const pagination = read("features/blog/components/BlogPagination.tsx");
    assert.match(pagination, /Previous/);
    assert.match(pagination, /Next/);
    assert.match(pagination, /aria-label="Blog pagination"/);
    assert.doesNotMatch(pagination, /infinite/i);
  });

  it("13/14/15/16 — article page, sanitized content, author card, not-found", () => {
    const page = read("app/blog/[slug]/page.tsx");
    assert.match(page, /BlogArticlePageContent/);
    assert.match(page, /generateMetadata/);

    const article = read("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogArticleBody/);
    assert.match(article, /BlogAuthorCard/);
    assert.match(article, /This publication could not be found/);
    assert.match(article, /No Comments|commentsLabel/);
    // Pack 07 adds Helpful/Not Helpful + Comments below the article body.
    assert.match(article, /BlogReactionControls/);
    assert.match(article, /BlogCommentsSection/);

    const body = read("features/blog/components/BlogArticleBody.tsx");
    assert.match(body, /dangerouslySetInnerHTML/);
    assert.match(body, /Server-sanitized|server-side/i);
    assert.match(body, /Trust boundary/);
  });

  it("17/18/19 — footer Blog replaces Knowledge; header still has Knowledge", () => {
    const footerLabels = FOOTER_PLATFORM_COLUMN_ONE.map((item) => item.label);
    assert.ok(footerLabels.includes("Blog"));
    assert.ok(!footerLabels.includes("Knowledge"));
    assert.equal(
      FOOTER_PLATFORM_COLUMN_ONE.find((item) => item.label === "Blog")?.href,
      "/blog",
    );

    const headerLabels = DESKTOP_CAPSULE_NAVIGATION.map((item) => item.label);
    assert.deepEqual(headerLabels, [
      "Home",
      "Institutions",
      "Initiatives",
      "Knowledge",
      "Search",
    ]);
    assert.ok(PRIMARY_NAVIGATION.some((item) => item.label === "Knowledge"));
  });

  it("20 — Assistant surface resolves to blog", () => {
    assert.equal(resolveAssistantLaunchContext("/blog").surfaceId, "blog");
    assert.equal(resolveAssistantLaunchContext("/blog/some-slug").surfaceId, "blog");
    assert.match(assistantWidgetCopy("blog"), /Blog/);
  });

  it("21 — mobile/layout CSS stays bounded to DS tokens and responsive breakpoints", () => {
    const css = read("features/blog/blog.css");
    assert.match(css, /--hu-page|hu-page-container|--hu-card-gap|--hu-section-gap/);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /max-width:\s*var\(--hu-reading-max-width\)/);
    assert.match(css, /blog-layout/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);
    assert.doesNotMatch(css, /box-shadow:\s*[^v]/);
  });

  it("URL state helpers preserve q/category/page", () => {
    assert.equal(
      buildBlogIndexHref({ q: "humanity", categorySlug: "human-security", page: 2 }),
      "/blog?q=humanity&category=human-security&page=2",
    );
    assert.equal(parseBlogPageParam("3"), 3);
    assert.equal(parseBlogPageParam("0"), 1);
    assert.equal(
      resolveCategoryIdFromSlug(
        [
          {
            categoryId: "human_security",
            slug: "human-security",
            name: "Human Security",
          },
        ],
        "human-security",
      ),
      "human_security",
    );
    assert.equal(BLOG_PAGE_SIZE, 9);
    assert.match(formatBlogPublishedDate("2026-01-15T12:00:00.000Z"), /2026/);
  });

  it("documents Previous/Next deferral and related same-category bound", () => {
    const article = read("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /Previous\/Next neighbour navigation is deferred/);
    assert.match(article, /BlogRelatedPosts/);

    const related = read("features/blog/components/BlogRelatedPosts.tsx");
    assert.match(related, /More from this category/);
    assert.match(related, /slice\(0, 3\)/);
  });
});
