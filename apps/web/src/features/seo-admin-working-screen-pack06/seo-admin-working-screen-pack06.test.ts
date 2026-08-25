/**
 * SEO Pack 06 — Admin SEO Working Screen Foundation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getCountries } from "@hu/geography";

import {
  ADMIN_SEO_VIEWS,
  ADMIN_SEO_VIEW_LABELS,
  buildBlogSeoInventoryRow,
  buildCivicArchiveSeoInventoryRow,
  buildCountrySeoInventoryRows,
  buildHomeSeoInventoryRow,
  buildInitiativeSeoInventoryRow,
  buildKnowledgeSeoInventoryRow,
  buildParticipantProfileSeoInventoryRow,
  buildPetitionFamilyDeferredRow,
  buildStructuredDataTypeCoverage,
  filterSeoPageInventoryRows,
  isSeoPageOverrideEditableFamily,
  resolveBlogSeoMode,
} from "../administration/admin-seo-console-model";
import { buildSeoDiagnosticsSnapshot } from "../administration/admin-seo-diagnostics-model";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 06 — working screen views", () => {
  it("defines four SEO views and defaults Overview in AdminSeoSection", () => {
    assert.deepEqual([...ADMIN_SEO_VIEWS], [
      "overview",
      "pages",
      "diagnostics",
      "structured-data",
    ]);
    assert.equal(ADMIN_SEO_VIEW_LABELS.overview, "Overview");

    const section = readWeb("features/administration/components/AdminSeoSection.tsx");
    assert.match(section, /useState<AdminSeoViewId>\("overview"\)/);
    assert.match(section, /AdminSeoOverviewView/);
    assert.match(section, /AdminSeoPagesView/);
    assert.match(section, /AdminSeoDiagnosticsView/);
    assert.match(section, /AdminSeoStructuredDataView/);
  });

  it("keeps Pack 05 Diagnostics available and Structured Data coverage rendered", () => {
    const diagnosticsView = readWeb(
      "features/administration/components/AdminSeoDiagnosticsView.tsx",
    );
    assert.match(diagnosticsView, /buildSeoDiagnosticsSnapshot|SeoDiagnosticsSnapshot/);
    assert.match(diagnosticsView, /SEO Diagnostics/);
    assert.match(diagnosticsView, /Indexing|Sitemap coverage|Metadata coverage/);

    const structured = readWeb(
      "features/administration/components/AdminSeoStructuredDataView.tsx",
    );
    assert.match(structured, /buildStructuredDataTypeCoverage/);
    assert.match(structured, /WebSite|Organization|BlogPosting|ProfilePage|Person/);

    const coverage = buildStructuredDataTypeCoverage();
    assert.ok(coverage.some((entry) => entry.schemaType === "WebSite" && entry.status === "healthy"));
    assert.ok(
      coverage.some(
        (entry) => entry.id === "petition-initiative-owned" && entry.status === "not_applicable",
      ),
    );
  });

  it("exposes Pages view with inventory loading", () => {
    const pages = readWeb("features/administration/components/AdminSeoPagesView.tsx");
    assert.match(pages, /Pages inventory/);
    assert.match(pages, /filterSeoPageInventoryRows/);
    assert.match(pages, /Open public page/);
    assert.match(pages, /Edit SEO/);
    assert.doesNotMatch(pages, /seoSettings|SEO_SETTINGS/);

    const inventory = readWeb("features/administration/admin-seo-page-inventory.ts");
    assert.match(inventory, /getCountries|listAdminPublishingPublications|listAdminInitiatives/);
    assert.match(inventory, /fetchKnowledgeListing|listPublicCivicArchiveIndex/);
  });
});

describe("SEO Pack 06 — Countries inventory", () => {
  it("lists every Country under /countries/{code} and never legacy /country/{slug}", () => {
    const rows = buildCountrySeoInventoryRows(getCountries());
    assert.equal(rows.length, getCountries().length);
    assert.ok(rows.every((row) => row.family === "country"));
    assert.ok(rows.every((row) => row.canonicalPath.startsWith("/countries/")));
    assert.ok(rows.every((row) => !row.canonicalPath.startsWith("/country/")));
    assert.ok(rows.every((row) => row.metadata === "healthy"));
    assert.ok(rows.every((row) => row.sitemap === "healthy"));
    assert.ok(rows.every((row) => row.structuredData === "healthy"));
  });
});

describe("SEO Pack 06 — Blog / Initiative / deferred families", () => {
  it("reports Blog Automatic/Customized from optimization presence", () => {
    assert.equal(resolveBlogSeoMode({}), "automatic");
    assert.equal(resolveBlogSeoMode({ seoTitle: "Custom" }), "customized");
    assert.equal(resolveBlogSeoMode({ seoDescription: "Desc" }), "customized");

    const automatic = buildBlogSeoInventoryRow({
      postId: "p1",
      title: "Hello",
      slug: "hello",
      seoMode: "automatic",
    });
    const customized = buildBlogSeoInventoryRow({
      postId: "p2",
      title: "Custom",
      slug: "custom",
      seoMode: "customized",
    });
    assert.equal(automatic.seoMode, "automatic");
    assert.equal(customized.seoMode, "customized");
    assert.equal(automatic.canonicalPath, "/blog/hello");
    assert.equal(automatic.structuredData, "healthy");
  });

  it("represents Initiative public pages with covered SEO capabilities", () => {
    const row = buildInitiativeSeoInventoryRow({
      initiativeId: "init-1",
      title: "Clean Water",
    });
    assert.equal(row.canonicalPath, "/initiatives/public/init-1");
    assert.equal(row.metadata, "healthy");
    assert.equal(row.seoMode, "automatic");
  });

  it("marks Profile inventory rows as Automatic and Petition as Initiative-owned N/A", () => {
    const profile = buildParticipantProfileSeoInventoryRow({ publicName: "ada-lovelace" });
    assert.equal(profile.inventoryKind, "page");
    assert.equal(profile.seoMode, "automatic");
    assert.equal(profile.sitemap, "healthy");
    assert.equal(profile.metadata, "healthy");
    assert.equal(profile.canonicalPath, "/member/ada-lovelace");
    assert.equal(isSeoPageOverrideEditableFamily("participant-profile"), false);

    const petition = buildPetitionFamilyDeferredRow();
    assert.equal(petition.inventoryKind, "family-deferred");
    assert.equal(petition.structuredData, "not_applicable");
    assert.equal(petition.canonical, "not_applicable");
    assert.equal(petition.sitemap, "not_applicable");
    assert.equal(petition.openGraph, "not_applicable");
    assert.match(petition.note ?? "", /Initiative-owned|Strategy B/i);
    assert.match(petition.canonicalPath, /#petition/);
  });
});

describe("SEO Pack 06 — Knowledge / Civic / Home coverage", () => {
  it("marks Knowledge/Civic metadata and Structured Data covered", () => {
    const knowledge = buildKnowledgeSeoInventoryRow({ slug: "rights", title: "Rights" });
    assert.equal(knowledge.metadata, "healthy");
    assert.equal(knowledge.structuredData, "healthy");
    assert.equal(knowledge.sitemap, "healthy");

    const civic = buildCivicArchiveSeoInventoryRow({
      initiativeId: "arch-1",
      title: "Archive item",
    });
    assert.equal(civic.metadata, "healthy");
    assert.equal(civic.structuredData, "healthy");
  });

  it("marks Home canonical and Open Graph covered", () => {
    const home = buildHomeSeoInventoryRow();
    assert.equal(home.canonicalPath, "/");
    assert.equal(home.canonical, "healthy");
    assert.equal(home.openGraph, "healthy");
    assert.equal(home.metadata, "healthy");
    assert.equal(home.structuredData, "healthy");
  });
});

describe("SEO Pack 06 — search/filter and security", () => {
  it("filters inventory by text, family, and SEO status", () => {
    const rows = [
      buildHomeSeoInventoryRow(),
      ...buildCountrySeoInventoryRows([{ code: "CA", name: "Canada" }, { code: "FR", name: "France" }]),
      buildBlogSeoInventoryRow({
        postId: "b1",
        title: "Water Rights",
        slug: "water-rights",
        seoMode: "customized",
      }),
      buildKnowledgeSeoInventoryRow({ slug: "guide", title: "Guide" }),
      buildParticipantProfileSeoInventoryRow({ publicName: "ada-lovelace" }),
    ];

    assert.equal(filterSeoPageInventoryRows(rows, { query: "canada", family: "all", status: "all" }).length, 1);
    assert.equal(
      filterSeoPageInventoryRows(rows, { query: "", family: "country", status: "all" }).length,
      2,
    );
    assert.ok(
      filterSeoPageInventoryRows(rows, { query: "", family: "all", status: "missing" }).every(
        (row) =>
          row.metadata === "missing" ||
          row.canonical === "missing" ||
          row.sitemap === "missing" ||
          row.structuredData === "missing",
      ),
    );
    assert.equal(
      filterSeoPageInventoryRows(rows, {
        query: "",
        family: "participant-profile",
        status: "all",
      }).length,
      1,
    );
  });

  it("keeps AdminAccessGate and avoids Technical Health / settings-store coupling", () => {
    const section = readWeb("features/administration/components/AdminSeoSection.tsx");
    assert.doesNotMatch(section, /seoSettings|SEO_SETTINGS/);
    assert.doesNotMatch(section, /Mongo|fetchApiHealth|buildTechnicalHealthSnapshot/);

    const page = readWeb("app/admin/seo/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminSeoSection/);

    const model = readWeb("features/administration/admin-seo-console-model.ts");
    assert.match(model, /SeoPageEntityDescriptor/);
    assert.doesNotMatch(model, /overrideApi|seoOverrideCollection/);

    // Pack 05 snapshot still builds for Overview/Diagnostics.
    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.ok(snapshot.summary.healthy > 0);
  });
});
