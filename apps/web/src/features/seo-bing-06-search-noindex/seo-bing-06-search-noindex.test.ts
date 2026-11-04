/**
 * SEO-BING-06 — `/search` is a crawlable, query-driven utility page:
 * `noindex, follow`, canonical `/search`, and absent from the public sitemap.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata.js";
import {
  STATIC_PUBLIC_SITEMAP_PATHS,
  listStaticPublicSitemapEntries,
} from "../../lib/seo/sitemap/providers/static-public-pages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const SEARCH_PAGE = readFileSync(path.join(webSrc, "app/search/page.tsx"), "utf8");

const ENV_KEYS = ["NEXT_PUBLIC_PLATFORM_MODE", "PLATFORM_MODE", "NEXT_PUBLIC_SITE_URL"] as const;
const previousEnv = new Map<string, string | undefined>();

before(() => {
  for (const key of ENV_KEYS) previousEnv.set(key, process.env[key]);
  process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
  delete process.env.PLATFORM_MODE;
  process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
});

after(() => {
  for (const key of ENV_KEYS) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("SEO-BING-06 — search page indexing", () => {
  it("1. /search and query variants are absent from the static sitemap; other paths unchanged", () => {
    const paths = listStaticPublicSitemapEntries().map((entry) => entry.path);
    assert.deepEqual(paths, [
      "/",
      "/blog",
      "/initiatives",
      "/institutions",
      "/knowledge",
      "/media",
      "/volunteer",
      "/civic-archive",
      "/membership",
      "/contact",
      "/privacy",
      "/terms",
      "/support",
    ]);
    assert.equal(STATIC_PUBLIC_SITEMAP_PATHS.length, 13);
    assert.equal(
      paths.some((entry) => entry.startsWith("/search") || entry.includes("?")),
      false,
    );
  });

  it("2. search metadata ends with noindex, follow outside platform-disallowed environments", () => {
    assert.match(
      SEARCH_PAGE,
      /if \(shouldDisallowSearchIndexing\(\)\) \{\s*return metadata;\s*\}\s*return \{ \.\.\.metadata, robots: \{ index: false, follow: true \} \};/,
    );
    assert.match(
      SEARCH_PAGE,
      /import \{ shouldDisallowSearchIndexing \} from "\.\.\/\.\.\/lib\/platform-indexing";/,
    );
  });

  it("3. canonical stays /search and query parameters never reach metadata", () => {
    assert.match(SEARCH_PAGE, /canonicalPath: "\/search",/);
    assert.equal(/searchParams/.test(SEARCH_PAGE), false);
    assert.match(SEARCH_PAGE, /export async function generateMetadata\(\): Promise<Metadata>/);
    assert.match(SEARCH_PAGE, /<GlobalSearchPageContent \/>/);
  });

  it("4. the shared builder still defaults other public pages to index, follow", () => {
    const metadata = buildPublicPageMetadata({ title: "Support", canonicalPath: "/support" });
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.alternates?.canonical, "https://huws.org/support");
  });
});
