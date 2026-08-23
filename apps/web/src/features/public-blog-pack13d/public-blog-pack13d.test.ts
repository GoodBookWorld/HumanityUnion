/**
 * Pack 13D — Public Blog three-column experience contracts.
 * Pack 14D evolves Search into the right rail and equal center/right columns.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 13D — Public Blog three-column experience", () => {
  it("layout: left categories/authors; center feed; right discovery with Search", () => {
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogDiscoveryLeftRail/);
    assert.match(index, /BlogDiscoveryRightRail/);
    assert.match(index, /blog-layout__center/);

    const left = readWeb("features/blog/components/BlogDiscoveryLeftRail.tsx");
    assert.match(left, /blog-layout__categories/);
    assert.match(left, /blog-layout__authors/);
    assert.match(left, /BlogCategoriesSidebar/);
    assert.match(left, /BlogAuthorsSidebar/);

    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    assert.match(right, /blog-layout__search/);
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);

    const searchIdx = right.indexOf("blog-layout__search");
    const viewsIdx = right.indexOf("blog-layout__views");
    assert.ok(searchIdx >= 0 && searchIdx < viewsIdx);
  });

  it("categories widget uses deep-linkable URL state with active state", () => {
    const categories = readWeb("features/blog/components/BlogCategoriesSidebar.tsx");
    assert.match(categories, /Categories/);
    assert.match(categories, /All Categories/);
    assert.match(categories, /is-active/);
    assert.match(categories, /aria-current/);
    assert.match(categories, /buildBlogIndexHref/);
  });

  it("authors widget links Profile + latest publication via public authors API", () => {
    const authors = readWeb("features/blog/components/BlogAuthorsSidebar.tsx");
    assert.match(authors, /Authors/);
    assert.match(authors, /fetchPublicBlogAuthors/);
    assert.match(authors, /profileUrl/);
    assert.match(authors, /latestPublication/);
    assert.match(authors, /\/blog\/\$\{/);

    const api = readWeb("features/blog/api.ts");
    assert.match(api, /\/api\/v1\/public\/blog\/authors/);
  });

  it("publication card metadata uses date/comments/folder icons and real comment count", () => {
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    assert.match(card, /\/icons\/workspace\/date\.png/);
    assert.match(card, /\/icons\/workspace\/comments\.png/);
    assert.match(card, /\/icons\/workspace\/opened-folder\.png/);
    assert.match(card, /aria-hidden="true"/);
    assert.match(card, /No Comments/);
    assert.match(card, /1 Comment/);
    assert.match(card, /Comments/);
    assert.match(card, /commentCount/);
    assert.match(card, /#comments/);
    assert.match(card, /post\.excerpt/);
    assert.match(card, /buildBlogIndexHref/);
    assert.match(card, /BlogCoverImage/);
    assert.match(card, /Read more/);
    assert.doesNotMatch(card, /Read Article/);
  });

  it("icon assets exist in public runtime path", () => {
    for (const name of ["date.png", "comments.png", "opened-folder.png"]) {
      const asset = path.join(webRoot, "public/icons/workspace", name);
      assert.equal(existsSync(asset), true, asset);
    }
  });

  it("responsive CSS is 3-column desktop, stacked mobile, no page overflow", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /grid-template-areas:/);
    assert.match(css, /"left center right"/);
    assert.match(css, /minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
    assert.match(css, /"search"\s*"categories"\s*"center"\s*"authors"\s*"views"\s*"chart"\s*"latest4"/s);
    assert.match(css, /overflow-x:\s*clip/);
    assert.match(css, /blog-post-card__content/);
    assert.match(css, /@media \(min-width: 1100px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
  });
});
