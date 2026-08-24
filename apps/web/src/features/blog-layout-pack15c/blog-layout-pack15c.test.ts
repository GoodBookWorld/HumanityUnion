/**
 * Pack 15C — Public Blog 30/40/30 layout & Latest thumbnail contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 15C — Public Blog 30/40/30 layout", () => {
  it("desktop grid is explicit 30/40/30 with Search spanning center+right", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /minmax\(0,\s*3fr\)\s+minmax\(0,\s*4fr\)\s+minmax\(0,\s*3fr\)/);
    assert.match(css, /"left search search"/);
    assert.match(css, /"left center right"/);

    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogDiscoverySearch/);
    assert.match(index, /BlogDiscoveryLeftRail/);
    assert.match(index, /BlogDiscoveryRightRail/);

    const right = readWeb("features/blog/components/BlogDiscoveryRightRail.tsx");
    assert.doesNotMatch(right, /blog-layout__search|BlogDiscoverySearch/);
    assert.match(right, /BlogViewsWidget/);
    assert.match(right, /BlogCategoryChart/);
    assert.match(right, /BlogLatestMiniCards/);
  });

  it("Latest mini thumbnails use fixed square frame (no stretch)", () => {
    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");
    assert.match(latest, /blog-latest-mini__thumb-frame/);

    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-latest-mini__thumb-frame[\s\S]*width:\s*5rem/s);
    assert.match(css, /\.blog-latest-mini__thumb-frame[\s\S]*height:\s*5rem/s);
    assert.match(css, /\.blog-latest-mini__thumb[\s\S]*object-fit:\s*cover/s);
    assert.match(css, /\.blog-latest-mini__thumb[\s\S]*aspect-ratio:\s*1\s*\/\s*1/s);
    assert.match(css, /flex:\s*none/);
  });

  it("desktop keeps independent center/right scroll; tablet/mobile disable 30/40/30 panes", () => {
    const css = readWeb("features/blog/blog.css");
    assert.match(css, /\.blog-layout__center[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /\.blog-layout__right[\s\S]*overflow-y:\s*auto/s);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1099px\)/);
    assert.match(css, /display:\s*contents/);
  });

  it("pagination architecture remains pageSize 9", () => {
    const api = readWeb("features/blog/api.ts");
    assert.match(api, /BLOG_PAGE_SIZE = 9/);
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    assert.match(index, /BlogPagination/);
  });
});
