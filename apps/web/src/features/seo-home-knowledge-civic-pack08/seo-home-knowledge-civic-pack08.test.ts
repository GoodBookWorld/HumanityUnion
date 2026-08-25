/**
 * SEO Pack 08 — Home, Knowledge & Civic Archive SEO Coverage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCivicArchiveSeoInventoryRow,
  buildHomeSeoInventoryRow,
  buildKnowledgeSeoInventoryRow,
  buildStructuredDataTypeCoverage,
} from "../administration/admin-seo-console-model";
import {
  getSeoSurfaceById,
  buildSeoDiagnosticsSnapshot,
} from "../administration/admin-seo-diagnostics-model";
import { applyPageSeoOverrideToMetadataInput } from "../../lib/seo/apply-page-seo-override";
import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildWebPageJsonLd } from "../../lib/seo/structured-data";
import { STATIC_PUBLIC_SITEMAP_PATHS } from "../../lib/seo/sitemap/providers/static-public-pages";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 08 — Home metadata", () => {
  it("builds Home absolute canonical and OG/social metadata", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata({
        title: "Humanity Union",
        description: "World Solidarity civic technology platform",
        canonicalPath: "/",
        socialTitle: "Humanity Union",
        socialDescription: "World Solidarity civic technology platform",
        imageUrl: "/brand/logo-512.png",
        openGraphType: "website",
        titleBrandSuffix: "",
      });
      assert.equal(meta.alternates?.canonical, "https://example.org/");
      assert.equal(meta.openGraph?.url, "https://example.org/");
      assert.equal(meta.openGraph?.title, "Humanity Union");
      assert.ok(meta.openGraph?.images);
      assert.ok(meta.twitter);
      assert.equal(
        (meta.twitter as { card?: string }).card,
        "summary_large_image",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }

    const page = readWeb("app/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /canonicalPath:\s*"\/"/);
    assert.match(page, /HUMANITY_UNION_LOGO_PATH|logo-512/);
  });

  it("keeps Home noindex when platform indexing is disallowed", () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example";
    try {
      assert.equal(shouldDisallowSearchIndexing(), true);
      const meta = buildPublicPageMetadata({
        title: "Humanity Union",
        description: "World Solidarity civic technology platform",
        canonicalPath: "/",
        titleBrandSuffix: "",
      });
      assert.equal((meta.robots as { index?: boolean }).index, false);
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });
});

describe("SEO Pack 08 — Knowledge coverage", () => {
  it("wires Knowledge metadata, canonical, override merge, and WebPage JSON-LD", () => {
    const page = readWeb("app/knowledge/[slug]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /applyPageSeoOverrideToMetadataInput/);
    assert.match(page, /fetchPublicSeoPageOverride/);
    assert.match(page, /buildWebPageJsonLd/);
    assert.match(page, /buildUnavailablePublicMetadata/);
    assert.match(page, /\/knowledge/);
    assert.match(page, /Home.*Knowledge|Knowledge.*path:\s*"\/knowledge"/s);

    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata(
        applyPageSeoOverrideToMetadataInput(
          {
            title: "Rights",
            description: "Purpose text",
            canonicalPath: "/knowledge/rights",
            socialTitle: "Rights",
          },
          { seoTitle: "Custom Rights" },
        ),
      );
      assert.match(String(meta.title), /Custom Rights/);
      assert.equal(meta.alternates?.canonical, "https://example.org/knowledge/rights");

      const nodes = buildWebPageJsonLd({
        name: "Rights",
        description: "Purpose text",
        canonicalPath: "/knowledge/rights",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Knowledge", path: "/knowledge" },
          { name: "Rights", path: "/knowledge/rights" },
        ],
      });
      assert.ok(nodes);
      assert.equal(nodes?.[0]?.["@type"], "WebPage");
      assert.equal(nodes?.[1]?.["@type"], "BreadcrumbList");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it("documents missing Knowledge safe behavior", () => {
    const page = readWeb("app/knowledge/[slug]/page.tsx");
    assert.match(page, /buildUnavailablePublicMetadata/);
    assert.match(page, /notFound\(\)/);
  });
});

describe("SEO Pack 08 — Civic Archive coverage", () => {
  it("wires Civic Archive metadata, canonical, override merge, and WebPage JSON-LD", () => {
    const page = readWeb("app/civic-archive/[initiativeId]/page.tsx");
    assert.match(page, /buildPublicPageMetadata/);
    assert.match(page, /applyPageSeoOverrideToMetadataInput/);
    assert.match(page, /fetchPublicSeoPageOverride/);
    assert.match(page, /buildWebPageJsonLd/);
    assert.match(page, /buildUnavailablePublicMetadata/);
    assert.match(page, /\/civic-archive/);

    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata(
        applyPageSeoOverrideToMetadataInput(
          {
            title: "Archive Title",
            description: "Summary",
            canonicalPath: "/civic-archive/init-1",
          },
          { seoDescription: "Custom archive desc" },
        ),
      );
      assert.equal(meta.description, "Custom archive desc");
      assert.equal(meta.alternates?.canonical, "https://example.org/civic-archive/init-1");

      const nodes = buildWebPageJsonLd({
        name: "Archive Title",
        description: "Summary",
        canonicalPath: "/civic-archive/init-1",
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: "Civic Archive", path: "/civic-archive" },
          { name: "Archive Title", path: "/civic-archive/init-1" },
        ],
      });
      assert.ok(nodes);
      assert.equal(nodes?.[0]?.["@type"], "WebPage");
      assert.equal(nodes?.[1]?.["@type"], "BreadcrumbList");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});

describe("SEO Pack 08 — Admin registry and inventory", () => {
  it("updates diagnostics and inventory to Healthy for Home/Knowledge/Civic", () => {
    assert.equal(getSeoSurfaceById("home")?.canonical, "covered");
    assert.equal(getSeoSurfaceById("home")?.openGraph, "covered");
    assert.equal(getSeoSurfaceById("knowledge")?.structuredData, "covered");
    assert.equal(getSeoSurfaceById("civic-archive")?.structuredData, "covered");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(snapshot.canonical.find((row) => row.id === "canonical-home")?.status, "healthy");
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-knowledge")?.status,
      "healthy",
    );

    assert.equal(buildHomeSeoInventoryRow().seoMode, "automatic");
    assert.equal(
      buildKnowledgeSeoInventoryRow({ slug: "a", title: "A", seoMode: "customized" }).seoMode,
      "customized",
    );
    assert.equal(
      buildCivicArchiveSeoInventoryRow({
        initiativeId: "i1",
        title: "I",
        seoMode: "automatic",
      }).structuredData,
      "healthy",
    );

    const coverage = buildStructuredDataTypeCoverage();
    assert.ok(
      coverage.some(
        (entry) =>
          entry.schemaType === "WebPage" &&
          entry.surfaces.includes("Knowledge article") &&
          entry.status === "healthy",
      ),
    );
    assert.ok(!coverage.some((entry) => entry.id === "knowledge-missing"));
  });

  it("keeps sitemap path alignment for Home/Knowledge/Civic Archive", () => {
    assert.ok(STATIC_PUBLIC_SITEMAP_PATHS.includes("/"));
    assert.ok(STATIC_PUBLIC_SITEMAP_PATHS.includes("/knowledge"));
    assert.ok(STATIC_PUBLIC_SITEMAP_PATHS.includes("/civic-archive"));
    assert.match(readWeb("lib/seo/sitemap/providers/knowledge-articles.ts"), /\/knowledge\//);
    assert.match(readWeb("lib/seo/sitemap/providers/civic-archive.ts"), /\/civic-archive\//);
  });
});
