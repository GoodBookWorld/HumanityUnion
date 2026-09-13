/**
 * Step 07E — Registry-driven multilingual sitemap expansion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPublicSeoLocalePath } from "@hu/types";

import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import {
  buildPublicSitemap,
  collectPublicSitemapPathEntries,
} from "../../lib/seo/sitemap/build-public-sitemap";
import { expandPublicSitemapEntriesForSeoLocales } from "../../lib/seo/sitemap/expand-public-sitemap-for-seo-locales";
import { listStaticPublicSitemapEntries } from "../../lib/seo/sitemap/providers/static-public-pages";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Step 07E — Registry-driven multilingual sitemap", () => {
  it("architecture: expands via shared SEO perimeter helpers; one Registry path", () => {
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(builder, /expandPublicSitemapEntriesForSeoLocales/);
    assert.match(builder, /listPublicSeoRoutingCatalogForRequest/);
    assert.doesNotMatch(builder, /contentTranslationEnabled|languageDataReady|searchEnabled/);
    assert.doesNotMatch(builder, /TranslationProvider|PLP|generateContentTranslation/);

    const expand = readWeb("lib/seo/sitemap/expand-public-sitemap-for-seo-locales.ts");
    assert.match(expand, /isPublicSeoLocalePath/);
    assert.match(expand, /buildPublicSeoLocalePrefixedPath/);
    assert.doesNotMatch(expand, /\b(uk|ar|zh-Hant|ka|he)\b/);
  });

  it("1. canonical locale-free entries remain present", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [
        { path: "/" },
        { path: "/initiatives/public/init-1", lastModified: "2024-01-01" },
        { path: "/countries/US" },
      ],
      seoIndexableLocales: ["en", "uk"],
    });
    assert.ok(expanded.some((e) => e.path === "/"));
    assert.ok(expanded.some((e) => e.path === "/initiatives/public/init-1"));
    assert.ok(expanded.some((e) => e.path === "/countries/US"));
  });

  it("2–5. SEO locales expand; SEO-disabled/disabled/English do not invent /en", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [{ path: "/media" }],
      // Caller filters; helper only expands listed non-default locales.
      seoIndexableLocales: ["en", "uk", "xx-SEOFUT"],
    });
    const paths = expanded.map((e) => e.path);
    assert.ok(paths.includes("/media"));
    assert.ok(paths.includes("/uk/media"));
    assert.ok(paths.includes("/xx-seofut/media"));
    assert.ok(!paths.some((p) => /^\/en(\/|$)/.test(p)));
  });

  it("6. routes outside PUBLIC_SEO_LOCALE_PATH_PATTERNS remain locale-free only", () => {
    assert.equal(isPublicSeoLocalePath("/countries/US"), false);
    assert.equal(isPublicSeoLocalePath("/search"), false);
    assert.equal(isPublicSeoLocalePath("/civic-archive"), false);
    assert.equal(isPublicSeoLocalePath("/member/ada"), false);

    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [
        { path: "/countries/US" },
        { path: "/search" },
        { path: "/civic-archive" },
        { path: "/member/ada" },
        { path: "/support" },
      ],
      seoIndexableLocales: ["uk", "ar"],
    });
    assert.deepEqual(
      expanded.map((e) => e.path),
      ["/countries/US", "/search", "/civic-archive", "/member/ada", "/support"],
    );
  });

  it("7–10. Initiative / Blog / Knowledge / Home expand correctly", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [
        { path: "/" },
        { path: "/initiatives/public/abc" },
        { path: "/blog/hello" },
        { path: "/knowledge/guide" },
      ],
      seoIndexableLocales: ["uk"],
    });
    const paths = new Set(expanded.map((e) => e.path));
    assert.ok(paths.has("/"));
    assert.ok(paths.has("/uk"));
    assert.ok(paths.has("/initiatives/public/abc"));
    assert.ok(paths.has("/uk/initiatives/public/abc"));
    assert.ok(paths.has("/blog/hello"));
    assert.ok(paths.has("/uk/blog/hello"));
    assert.ok(paths.has("/knowledge/guide"));
    assert.ok(paths.has("/uk/knowledge/guide"));
  });

  it("11. reserved Blog/Knowledge route rules preserved", () => {
    assert.equal(isPublicSeoLocalePath("/blog/subscribe"), false);
    assert.equal(isPublicSeoLocalePath("/knowledge/media"), false);
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [{ path: "/blog/subscribe" }, { path: "/knowledge/media" }],
      seoIndexableLocales: ["uk"],
    });
    assert.deepEqual(
      expanded.map((e) => e.path),
      ["/blog/subscribe", "/knowledge/media"],
    );
  });

  it("12. lastModified preserved on locale variants", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [{ path: "/blog/a", lastModified: "2024-06-01T00:00:00.000Z" }],
      seoIndexableLocales: ["uk"],
    });
    const uk = expanded.find((e) => e.path === "/uk/blog/a");
    assert.equal(uk?.lastModified, "2024-06-01T00:00:00.000Z");
  });

  it("13. duplicate inputs do not create duplicate output URLs", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [
        { path: "/media", lastModified: "2024-01-01" },
        { path: "/media", lastModified: "2024-02-01" },
      ],
      seoIndexableLocales: ["uk"],
    });
    const media = expanded.filter((e) => e.path === "/media");
    const ukMedia = expanded.filter((e) => e.path === "/uk/media");
    assert.equal(media.length, 1);
    assert.equal(ukMedia.length, 1);
    assert.equal(media[0]?.lastModified, "2024-01-01");
  });

  it("14. synthetic future locale works without application hardcoding", () => {
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [{ path: "/institutions" }],
      seoIndexableLocales: ["zz-FUTURE"],
    });
    assert.ok(expanded.some((e) => e.path === "/zz-future/institutions"));
  });

  it("15. Registry failure / empty locales → canonical-only sitemap", async () => {
    const entries = await collectPublicSitemapPathEntries({
      includeDynamicProviders: false,
      seoIndexableLocales: [],
    });
    assert.ok(entries.some((e) => e.path === "/"));
    assert.ok(entries.every((e) => !/^\/[a-z]{2}(-[a-z0-9]+)*\//i.test(e.path) || e.path.startsWith("/countries/")));
    // No SEO-prefixed media/home variants when locales empty.
    assert.ok(!entries.some((e) => e.path === "/uk/media" || e.path === "/uk"));
  });

  it("16. platform indexing disabled still returns empty sitemap", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      assert.deepEqual(await buildPublicSitemap({ seoIndexableLocales: ["uk"] }), []);
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });

  it("17. no CT/PLP/content readiness requirement in expansion path", () => {
    const expand = readWeb("lib/seo/sitemap/expand-public-sitemap-for-seo-locales.ts");
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.doesNotMatch(expand, /contentTranslation|PLP|languageDataReady|searchEnabled/);
    assert.doesNotMatch(builder, /contentTranslationEnabled|languageDataReady|PLP/);
  });

  it("static provider inventory itself stays locale-free (expansion is a separate step)", () => {
    for (const entry of listStaticPublicSitemapEntries()) {
      assert.doesNotMatch(entry.path, /^\/(uk|ar|en)\//);
    }
  });
});
