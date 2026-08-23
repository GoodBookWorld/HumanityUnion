/**
 * Pack 14D — Public Blog discovery: right rail, pagination, metrics contracts (Web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_PAGE_SIZE } from "../blog/api.js";
import { buildVisiblePagesWithEllipsis } from "../blog/components/BlogPagination.js";
import { buildBlogIndexHref, parseBlogPageParam } from "../blog/blog-url.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 14D — Public Blog discovery (Web)", () => {
  it("page size is exactly 9; Search lives in right rail first", () => {
    assert.equal(BLOG_PAGE_SIZE, 9);

    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogDiscoveryLeftRail/);
    assert.match(index, /BlogDiscoveryRightRail/);
    assert.match(index, /includeDiscovery:\s*true/);

    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    const searchIdx = right.indexOf("blog-layout__search");
    const viewsIdx = right.indexOf("blog-layout__views");
    const chartIdx = right.indexOf("blog-layout__chart");
    const latestIdx = right.indexOf("blog-layout__latest4");
    assert.ok(searchIdx >= 0);
    assert.ok(viewsIdx > searchIdx);
    assert.ok(chartIdx > viewsIdx);
    assert.ok(latestIdx > chartIdx);
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);
  });

  it("desktop CSS: equal center/right, independent scroll; mobile document order", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /minmax\(11rem,\s*14rem\)\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
    assert.match(css, /"left center right"/);
    assert.match(
      css,
      /\.blog-layout__center\s*\{[^}]*overflow-y:\s*auto/s,
    );
    assert.match(
      css,
      /\.blog-layout__right\s*\{[^}]*overflow-y:\s*auto/s,
    );
    assert.match(css, /"search"\s*"categories"\s*"center"\s*"authors"\s*"views"\s*"chart"\s*"latest4"/s);
    assert.match(css, /display:\s*contents/);
  });

  it("pagination URL state preserves category/search; ellipsis for large sets", () => {
    assert.equal(parseBlogPageParam("2"), 2);
    assert.equal(parseBlogPageParam(null), 1);
    assert.equal(buildBlogIndexHref({ page: 2 }), "/blog?page=2");
    assert.equal(
      buildBlogIndexHref({ categorySlug: "impact", page: 2 }),
      "/blog?category=impact&page=2",
    );
    assert.equal(
      buildBlogIndexHref({ q: "climate", categorySlug: "impact", page: 3 }),
      "/blog?q=climate&category=impact&page=3",
    );

    const pages = buildVisiblePagesWithEllipsis(5, 20);
    assert.ok(pages.includes(1));
    assert.ok(pages.includes(20));
    assert.ok(pages.includes("ellipsis"));
    assert.ok(!pages.includes(10));

    const pagination = readWeb("features/blog/components/BlogPagination.tsx");
    assert.match(pagination, /aria-label="Blog pagination"/);
    assert.match(pagination, /aria-current/);
    assert.match(pagination, /Next ≫/);
    assert.match(pagination, /buildBlogIndexHref/);
  });

  it("cards expose Read more CTA; views widget is aggregate-only", () => {
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    assert.match(card, /Read more/);
    assert.match(card, /blog-post-card__cta/);

    const views = readWeb("features/blog/components/BlogViewsWidget.tsx");
    assert.match(views, /Blog Views/);
    assert.match(views, /All-time views of the Blog page/);
    assert.doesNotMatch(views, /visitorId|session|IP|referrer/i);

    const chart = readWeb("features/blog/components/BlogCategoryChart.tsx");
    assert.match(chart, /Publications by Category/);
    assert.match(chart, /buildBlogIndexHref/);
    assert.match(chart, /blog-category-chart__count/);

    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");
    assert.match(latest, /Latest Publications/);
    assert.match(latest, /blog-latest-mini__thumb/);
  });

  it("API client requests page/pageSize and discovery payload", () => {
    const api = readWeb("features/blog/api.ts");
    assert.match(api, /params\.set\("pageSize"/);
    assert.match(api, /params\.set\("page"/);
    assert.match(api, /includeDiscovery/);
    assert.equal(BLOG_PAGE_SIZE, 9);
  });
});
