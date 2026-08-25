/**
 * SEO Pack 01 — Shared Metadata & Canonical Foundation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import {
  formatPublicPageTitle,
  normalizeMetaDescription,
  stripHtmlToPlainText,
} from "../../lib/seo/normalize-seo-text";
import {
  normalizeCanonicalPath,
  resolvePublicSiteOrigin,
  toAbsolutePublicUrl,
} from "../../lib/seo/public-site-url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 01 — canonical site URL", () => {
  it("resolves origin from NEXT_PUBLIC_SITE_URL only", () => {
    assert.equal(
      resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://example.org/" }),
      "https://example.org",
    );
    assert.equal(
      resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://staging.example.org/app" }),
      "https://staging.example.org",
    );
    assert.equal(resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "" }), "");
    assert.equal(resolvePublicSiteOrigin({}), "");
  });

  it("rejects non-http protocols and invalid values", () => {
    assert.equal(resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "ftp://x.test" }), "");
    assert.equal(resolvePublicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "not a url" }), "");
  });

  it("builds absolute URLs without inventing a host from request", () => {
    assert.equal(
      toAbsolutePublicUrl("/blog/hello", "https://example.org"),
      "https://example.org/blog/hello",
    );
    assert.equal(toAbsolutePublicUrl("/blog/hello", ""), "/blog/hello");
    assert.equal(
      toAbsolutePublicUrl("https://cdn.example/img.png", "https://example.org"),
      "https://cdn.example/img.png",
    );
  });

  it("normalizes canonical paths", () => {
    assert.equal(normalizeCanonicalPath("blog/x"), "/blog/x");
    assert.equal(normalizeCanonicalPath("/countries/US"), "/countries/US");
    assert.equal(normalizeCanonicalPath("https://example.org/member/ada"), "/member/ada");
  });
});

describe("SEO Pack 01 — indexability remains environment-safe", () => {
  it("disallows staging/development/other; allows production", () => {
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "staging" }), true);
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "development" }), true);
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "other" }), true);
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "production" }), false);
  });

  it("builder cannot enable indexing when platform disallows", () => {
    const prev = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      const meta = buildPublicPageMetadata({
        title: "Test",
        canonicalPath: "/blog/test",
        indexable: true,
      });
      assert.deepEqual(meta.robots, { index: false, follow: false, nocache: true });
    } finally {
      if (prev === undefined) {
        delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      } else {
        process.env.NEXT_PUBLIC_PLATFORM_MODE = prev;
      }
    }
  });
});

describe("SEO Pack 01 — title and description normalization", () => {
  it("formats public titles with a single Humanity Union suffix", () => {
    assert.equal(formatPublicPageTitle("Climate Action"), "Climate Action | Humanity Union");
    assert.equal(
      formatPublicPageTitle("Climate Action | Humanity Union"),
      "Climate Action | Humanity Union",
    );
    assert.equal(
      formatPublicPageTitle("My Post", "Blog | Humanity Union"),
      "My Post | Blog | Humanity Union",
    );
    assert.equal(
      formatPublicPageTitle("My Post | Blog | Humanity Union", "Blog | Humanity Union"),
      "My Post | Blog | Humanity Union",
    );
  });

  it("does not append when title already ends with Humanity Union", () => {
    assert.equal(
      formatPublicPageTitle("Already Branded | Humanity Union", "Blog | Humanity Union"),
      "Already Branded | Humanity Union",
    );
  });

  it("strips HTML and truncates descriptions", () => {
    assert.equal(stripHtmlToPlainText("<p>Hello <b>world</b></p>"), "Hello world");
    assert.equal(
      normalizeMetaDescription("  plain text with   spaces  "),
      "plain text with spaces",
    );
    const long = "a".repeat(250);
    assert.equal(normalizeMetaDescription(long, 200)?.length, 200);
    assert.equal(normalizeMetaDescription("<p></p>"), undefined);
  });
});

describe("SEO Pack 01 — buildPublicPageMetadata", () => {
  it("emits absolute canonical and Open Graph when site URL is configured", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_SITE_URL = "https://humanity.example";
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    try {
      const meta = buildPublicPageMetadata({
        title: "Open Seas",
        description: "A public initiative about oceans.",
        canonicalPath: "/initiatives/public/init_1",
        imageUrl: "https://cdn.example/cover.jpg",
        imageAlt: "Ocean cover",
        openGraphType: "website",
      });

      assert.equal(meta.title, "Open Seas | Humanity Union");
      assert.equal(meta.description, "A public initiative about oceans.");
      assert.equal(
        meta.alternates?.canonical,
        "https://humanity.example/initiatives/public/init_1",
      );
      assert.equal(meta.openGraph?.url, "https://humanity.example/initiatives/public/init_1");
      assert.equal(meta.openGraph?.title, "Open Seas");
      assert.equal((meta.openGraph as { type?: string } | undefined)?.type, "website");
      const images = meta.openGraph?.images;
      assert.ok(Array.isArray(images) && images.length === 1);
      assert.equal(
        typeof images[0] === "object" && images[0] && "url" in images[0]
          ? images[0].url
          : undefined,
        "https://cdn.example/cover.jpg",
      );
      assert.equal((meta.twitter as { card?: string } | undefined)?.card, "summary_large_image");
      assert.equal(meta.twitter?.title, "Open Seas");
      assert.deepEqual(meta.robots, { index: true, follow: true });
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
    }
  });

  it("preserves Blog SEO overrides and intentional Blog title wording", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://humanity.example";
    try {
      const meta = buildPublicPageMetadata({
        title: "SEO Override Title",
        titleBrandSuffix: "Blog | Humanity Union",
        description: "SEO override description",
        canonicalPath: "/blog/custom-canonical",
        socialTitle: "Social Override",
        socialDescription: "Social desc",
        imageUrl: "https://cdn.example/social.jpg",
        openGraphType: "article",
      });

      assert.equal(meta.title, "SEO Override Title | Blog | Humanity Union");
      assert.equal(meta.description, "SEO override description");
      assert.equal(meta.alternates?.canonical, "https://humanity.example/blog/custom-canonical");
      assert.equal(meta.openGraph?.title, "Social Override");
      assert.equal(meta.openGraph?.description, "Social desc");
      assert.equal((meta.openGraph as { type?: string } | undefined)?.type, "article");
      assert.equal(meta.twitter?.title, "Social Override");
      assert.equal(meta.twitter?.description, "Social desc");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });

  it("supports Blog fallback title/description from entity fields", () => {
    const meta = buildPublicPageMetadata({
      title: "Post Title",
      titleBrandSuffix: "Blog | Humanity Union",
      description: "Excerpt text",
      canonicalPath: "/blog/post-title",
      openGraphType: "article",
    });
    assert.equal(meta.title, "Post Title | Blog | Humanity Union");
    assert.equal(meta.description, "Excerpt text");
    assert.equal(meta.openGraph?.title, "Post Title");
  });

  it("supports Initiative-shaped metadata without duplicate brand", () => {
    const meta = buildPublicPageMetadata({
      title: "Green Cities",
      description: "Local climate work",
      canonicalPath: "/initiatives/public/abc",
      socialTitle: "Green Cities",
      imageUrl: "/media/cover.jpg",
      imageAlt: "Green Cities",
      openGraphType: "website",
    });
    assert.equal(meta.title, "Green Cities | Humanity Union");
    assert.doesNotMatch(String(meta.title), /Humanity Union \| Humanity Union/);
    assert.equal(meta.openGraph?.title, "Green Cities");
    assert.equal(meta.description, "Local climate work");
  });

  it("is ready for Country, Profile, and Initiative canonical paths", () => {
    for (const canonicalPath of [
      "/countries/US",
      "/member/ada-lovelace",
      "/initiatives/public/init_1",
    ]) {
      const meta = buildPublicPageMetadata({
        title: "Surface",
        description: "Public surface description",
        canonicalPath,
        openGraphType: canonicalPath.startsWith("/member/") ? "profile" : "website",
      });
      assert.equal(meta.alternates?.canonical, canonicalPath);
      assert.ok(meta.openGraph);
      assert.ok(meta.twitter);
    }
  });
});

describe("SEO Pack 01 — route migration and Country readiness", () => {
  it("Blog generateMetadata uses shared builder and preserves Blog brand suffix", () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /titleBrandSuffix:\s*"Blog \| Humanity Union"/);
    assert.match(page, /seo\?\.title|seo\?\.description|seo\?\.socialTitle|seo\?\.canonicalPath/);
    assert.match(page, /openGraphType:\s*"article"/);
    assert.doesNotMatch(page, /resolveSiteOrigin/);
  });

  it("Initiative generateMetadata uses shared builder", () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}/);
    assert.match(page, /resolveMediaUrl/);
    assert.doesNotMatch(page, /function resolveSiteOrigin/);
    assert.doesNotMatch(page, /function toAbsoluteUrl/);
  });

  it("documents canonical Country route as /countries/{countryCode}", () => {
    const countryPage = readWeb("app/countries/[countryCode]/page.tsx");
    assert.match(countryPage, /CountryExperienceDynamicPage/);
    assert.match(countryPage, /redirect\(`\/countries\/\$\{countryCode\}`\)/);
    assert.equal(
      normalizeCanonicalPath("/countries/DE"),
      "/countries/DE",
    );
  });

  it("does not introduce SeoSettings store or Structured Data in this Pack", () => {
    const builder = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.doesNotMatch(builder, /json-ld|schema\.org|SeoSettings|seo_settings/i);
  });
});
