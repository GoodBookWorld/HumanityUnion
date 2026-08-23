/**
 * Pack 13D — Public Blog three-column experience contracts.
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
  it("layout: search above columns; left categories/authors; center feed; right rail", () => {
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /blog-layout__search/);
    assert.match(index, /blog-layout__categories/);
    assert.match(index, /blog-layout__authors/);
    assert.match(index, /blog-layout__center/);
    assert.match(index, /blog-layout__right/);
    assert.match(index, /Latest Publications/);
    assert.match(index, /BlogCategoriesSidebar/);
    assert.match(index, /BlogAuthorsSidebar/);

    const searchIndex = index.indexOf("blog-layout__search");
    const categoriesIndex = index.indexOf("blog-layout__categories");
    const centerIndex = index.indexOf("blog-layout__center");
    const authorsIndex = index.indexOf("blog-layout__authors");
    assert.ok(searchIndex < categoriesIndex);
    assert.ok(categoriesIndex < centerIndex);
    assert.ok(centerIndex < authorsIndex);
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
    assert.match(css, /"search search search"/);
    assert.match(css, /"categories center right"/);
    assert.match(css, /"authors center right"/);
    assert.match(css, /"search"\s*"categories"\s*"center"\s*"authors"\s*"right"/s);
    assert.match(css, /overflow-x:\s*clip/);
    assert.match(css, /blog-post-card__content/);
    assert.match(css, /@media \(min-width: 1100px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
  });
});
