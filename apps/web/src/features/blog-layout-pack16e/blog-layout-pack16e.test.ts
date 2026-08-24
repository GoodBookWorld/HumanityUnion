/**
 * Pack 16E — Public Blog 25/50/25 layout and category dropdown.
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

describe("Pack 16E — Blog 25/50/25 and category dropdown", () => {
  it("desktop grid is 25/50/25 with Search spanning center+right", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /Pack 16E/);
    assert.match(css, /minmax\(0,\s*1fr\)\s+minmax\(0,\s*2fr\)\s+minmax\(0,\s*1fr\)/);
    assert.match(css, /"left search search"/);
    assert.match(css, /"left center right"/);
    assert.match(css, /--hu-scroll-margin-top/);
    assert.match(css, /\.blog-layout__center[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /\.blog-layout__right[\s\S]*overflow-y:\s*auto/s);
  });

  it("categories use accessible select dropdown with All Categories and deep links", () => {
    const categories = readWeb("features/blog/components/BlogCategoriesSidebar.tsx");
    assert.match(categories, /<select/);
    assert.match(categories, /All Categories/);
    assert.match(categories, /buildBlogIndexHref/);
    assert.match(categories, /categorySlug/);
    assert.match(categories, /router\.push/);
    assert.match(categories, /htmlFor|aria-labelledby|aria-describedby/);
    assert.match(categories, /Selected:/);
    assert.match(categories, /categoryCounts/);
    assert.doesNotMatch(categories, /blog-categories-list__link/);
  });

  it("left rail passes category counts; chart and authors remain", () => {
    const left = readWeb("features/blog/components/BlogDiscoveryLeftRail.tsx");
    assert.match(left, /categoryCounts/);
    assert.match(left, /BlogCategoriesSidebar/);
    assert.match(left, /BlogAuthorsSidebar/);

    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);

    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /categoryCounts=\{categoryCounts\}/);
  });

  it("preserves pagination 9, single-post shell, and ?category= URLs", () => {
    assert.equal(BLOG_PAGE_SIZE, 9);
    assert.equal(
      buildBlogIndexHref({ q: "peace", categorySlug: "human-security", page: 2 }),
      "/blog?q=peace&category=human-security&page=2",
    );

    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(article, /BlogDiscoverySearch/);
    assert.match(article, /BlogDiscoveryLeftRail/);
    assert.match(article, /BlogDiscoveryRightRail/);
    assert.match(article, /blog-page--pack15c/);

    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-latest-mini__thumb-frame[\s\S]*width:\s*5rem/s);
    assert.match(css, /\.blog-latest-mini__thumb[\s\S]*object-fit:\s*cover/s);
  });
});
