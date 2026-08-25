/**
 * SEO Pack 02 — Sitemap Architecture.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getCountries } from "@hu/geography";

import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import {
  buildPublicSitemap,
  collectPublicSitemapPathEntries,
  toMetadataRouteSitemap,
} from "../../lib/seo/sitemap/build-public-sitemap";
import { dedupeSitemapPathEntries } from "../../lib/seo/sitemap/dedupe-sitemap-entries";
import { listCountrySitemapEntries } from "../../lib/seo/sitemap/providers/countries";
import {
  STATIC_PUBLIC_SITEMAP_PATHS,
  listStaticPublicSitemapEntries,
} from "../../lib/seo/sitemap/providers/static-public-pages";
import { resolvePublicSiteOrigin } from "../../lib/seo/public-site-url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const apiSrc = path.resolve(dir, "../../../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

describe("SEO Pack 02 — sitemap architecture", () => {
  it("exposes Next.js sitemap entry at app/sitemap.ts → /sitemap.xml", () => {
    const sitemap = readWeb("app/sitemap.ts");
    assert.match(sitemap, /buildPublicSitemap/);
    assert.match(sitemap, /MetadataRoute\.Sitemap/);
  });

  it("reuses Pack 01 canonical origin helpers", () => {
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(builder, /resolvePublicSiteOrigin/);
    assert.match(builder, /toAbsolutePublicUrl/);
    assert.doesNotMatch(builder, /headers\(\)|req\.headers|x-forwarded-host/i);
  });

  it("returns an empty sitemap when search indexing is disallowed", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      assert.deepEqual(await buildPublicSitemap(), []);
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });

  it("returns an empty sitemap when NEXT_PUBLIC_SITE_URL is unset", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      assert.equal(resolvePublicSiteOrigin(), "");
      assert.deepEqual(await buildPublicSitemap(), []);
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });
});

describe("SEO Pack 02 — static and excluded routes", () => {
  it("includes only audited static public pages", () => {
    const paths: string[] = listStaticPublicSitemapEntries().map((entry) => entry.path);
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("/blog"));
    assert.ok(paths.includes("/initiatives"));
    assert.ok(paths.includes("/institutions"));
    assert.ok(paths.includes("/knowledge"));
    assert.ok(paths.includes("/media"));
    assert.ok(paths.includes("/civic-archive"));
    assert.ok(paths.includes("/membership"));
    assert.ok(!paths.includes("/about"));
    assert.equal(STATIC_PUBLIC_SITEMAP_PATHS.length, paths.length);
  });

  it("excludes Admin, Workspace, Auth, and owner routes from static inventory", () => {
    const joined = STATIC_PUBLIC_SITEMAP_PATHS.join("\n");
    assert.doesNotMatch(joined, /^\/admin/m);
    assert.doesNotMatch(joined, /^\/workspace/m);
    assert.doesNotMatch(joined, /^\/login/m);
    assert.doesNotMatch(joined, /^\/register/m);
    assert.doesNotMatch(joined, /^\/account/m);
    assert.doesNotMatch(joined, /^\/preferences/m);
    assert.doesNotMatch(joined, /^\/profile/m);
    assert.doesNotMatch(joined, /^\/password-reset/m);
    assert.doesNotMatch(joined, /^\/member$/m);
    assert.doesNotMatch(joined, /preview/);
  });
});

describe("SEO Pack 02 — Country pages (required)", () => {
  it("includes every geography catalog country under /countries/{code}", () => {
    const countries = getCountries();
    const entries = listCountrySitemapEntries(countries);
    assert.ok(countries.length > 200);
    assert.equal(entries.length, countries.length);
    assert.ok(entries.every((entry) => entry.path.startsWith("/countries/")));
    assert.ok(entries.some((entry) => entry.path === "/countries/US"));
    assert.ok(entries.some((entry) => entry.path === "/countries/CA"));
  });

  it("never emits legacy /country/{slug} routes", () => {
    const entries = listCountrySitemapEntries();
    assert.ok(entries.every((entry) => /^\/countries\/[A-Z0-9-]+$/i.test(entry.path)));
    assert.ok(entries.every((entry) => !/^\/country\//.test(entry.path)));
    const countriesProvider = readWeb("lib/seo/sitemap/providers/countries.ts");
    assert.match(countriesProvider, /\/countries\//);
    assert.match(countriesProvider, /intentionally omitted/);
  });

  it("collects Country pages in the local sitemap inventory", async () => {
    const entries = await collectPublicSitemapPathEntries({ includeDynamicProviders: false });
    const countryPaths = entries.filter((entry) => entry.path.startsWith("/countries/"));
    assert.equal(countryPaths.length, getCountries().length);
  });
});

describe("SEO Pack 02 — Blog / Initiative rules and deferred surfaces", () => {
  it("Blog provider uses public published list API only", () => {
    const blog = readWeb("lib/seo/sitemap/providers/blog-posts.ts");
    assert.match(blog, /fetchPublicBlogPosts/);
    assert.match(blog, /\/blog\/\$\{encodeURIComponent\(slug\)\}/);
    assert.match(blog, /publishedAt/);
    assert.doesNotMatch(blog, /workspace\/publishing|draft/i);
  });

  it("Initiative provider uses public sitemap inventory with eligibility gate", () => {
    const web = readWeb("lib/seo/sitemap/providers/initiatives.ts");
    const service = readApi("modules/sitemap/public-sitemap.service.ts");
    assert.match(web, /\/api\/v1\/public\/sitemap\/initiatives/);
    assert.match(web, /\/initiatives\/public\//);
    assert.match(service, /canExposePublicInitiativeProjection/);
    assert.match(service, /listInitiatives/);
    assert.doesNotMatch(service, /lifecyclePhase === "draft"/);
  });

  it("includes Participant Profile provider for public /member/{uniqueName} paths", () => {
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(builder, /listParticipantProfileSitemapEntries|participant-profiles/);
    const provider = readWeb("lib/seo/sitemap/providers/participant-profiles.ts");
    assert.match(provider, /\/member\/\$\{encodeURIComponent\(publicName\)\}/);
    assert.match(provider, /\/api\/v1\/public\/sitemap\/participant-profiles/);
  });

  it("documents Petition Initiative-owned exclusion — no Petition URLs in sitemap", () => {
    const builder = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.doesNotMatch(builder, /\/petitions\//);
  });
});

describe("SEO Pack 02 — dedupe, lastModified, robots", () => {
  it("removes duplicate canonical paths", () => {
    const deduped = dedupeSitemapPathEntries([
      { path: "/blog/a", lastModified: "2024-01-01" },
      { path: "blog/a", lastModified: "2024-02-01" },
      { path: "/countries/US" },
      { path: "/countries/US" },
    ]);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0]?.path, "/blog/a");
    assert.equal(deduped[0]?.lastModified, "2024-01-01");
  });

  it("preserves trustworthy lastModified when converting to MetadataRoute entries", () => {
    const mapped = toMetadataRouteSitemap(
      [
        { path: "/blog/hello", lastModified: "2024-06-01T00:00:00.000Z" },
        { path: "/countries/US" },
      ],
      "https://example.org",
    );
    assert.equal(mapped[0]?.url, "https://example.org/blog/hello");
    assert.equal(mapped[0]?.lastModified, "2024-06-01T00:00:00.000Z");
    assert.equal(mapped[1]?.url, "https://example.org/countries/US");
    assert.equal(mapped[1]?.lastModified, undefined);
  });

  it("robots advertises sitemap only when indexing is allowed and origin is configured", () => {
    const robots = readWeb("app/robots.ts");
    assert.match(robots, /shouldDisallowSearchIndexing/);
    assert.match(robots, /resolvePublicSiteOrigin/);
    assert.match(robots, /\/sitemap\.xml/);
    assert.match(robots, /sitemap:/);
  });
});
