/**
 * SEO Pack 05 — Admin SEO Diagnostics Engine.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  SEO_PUBLIC_SURFACE_REGISTRY,
  SEO_SITEMAP_PROVIDER_REGISTRY,
  buildSeoDiagnosticsSnapshot,
  getSeoSitemapProviderById,
  getSeoSurfaceById,
  summarizeSeoDiagnostics,
} from "../administration/admin-seo-diagnostics-model";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 05 — diagnostic registry", () => {
  it("exposes a shared SEO diagnostic registry/model", () => {
    assert.ok(SEO_PUBLIC_SURFACE_REGISTRY.length >= 8);
    assert.ok(SEO_SITEMAP_PROVIDER_REGISTRY.length >= 9);
    assert.ok(getSeoSurfaceById("country"));
    assert.ok(getSeoSitemapProviderById("countries"));
  });

  it("marks Countries covered for sitemap, metadata, and Structured Data", () => {
    const country = getSeoSurfaceById("country");
    assert.equal(country?.sitemap, "covered");
    assert.equal(country?.metadata, "covered");
    assert.equal(country?.structuredData, "covered");
    assert.equal(getSeoSitemapProviderById("countries")?.state, "covered");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.country.find((row) => row.id === "country-sitemap")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.country.find((row) => row.id === "country-metadata")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.country.find((row) => row.id === "country-structured-data")?.status,
      "healthy",
    );
  });

  it("does not report /country/{slug} as canonical", () => {
    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    const legacy = snapshot.canonical.find((row) => row.id === "canonical-legacy-country");
    assert.equal(legacy?.status, "healthy");
    assert.match(legacy?.summary ?? "", /not canonical/i);
    assert.doesNotMatch(
      snapshot.canonical.find((row) => row.id === "canonical-country")?.summary ?? "",
      /\/country\/\{slug\}/,
    );
    assert.match(
      snapshot.canonical.find((row) => row.id === "canonical-country")?.summary ?? "",
      /\/countries\/\{countryCode\}/,
    );
  });
});

describe("SEO Pack 05 — indexing and origin", () => {
  it("marks missing NEXT_PUBLIC_SITE_URL as Warning", () => {
    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
    });
    const origin = snapshot.indexing.find((row) => row.id === "public-site-origin");
    assert.equal(origin?.status, "warning");
    assert.match(origin?.summary ?? "", /missing/i);
    assert.equal(snapshot.siteOriginConfigured, false);
  });

  it("represents protected staging/dev indexing correctly", () => {
    const staging = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "staging",
      NEXT_PUBLIC_SITE_URL: "https://staging.example",
    });
    assert.equal(staging.platformMode, "staging");
    assert.equal(staging.indexingAllowed, false);
    assert.equal(
      staging.indexing.find((row) => row.id === "indexing-allowed")?.status,
      "healthy",
    );
    assert.match(
      staging.indexing.find((row) => row.id === "indexing-allowed")?.summary ?? "",
      /Disallowed/,
    );
    assert.match(
      staging.indexing.find((row) => row.id === "robots-protection")?.summary ?? "",
      /noindex/i,
    );

    const development = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "development",
      NEXT_PUBLIC_SITE_URL: "https://dev.example",
    });
    assert.equal(development.indexingAllowed, false);
    assert.equal(development.platformMode, "development");
  });
});

describe("SEO Pack 05 — Profile and Petition coverage", () => {
  it("represents Profile metadata/Structured Data/sitemap coverage after Pack 11", () => {
    const profile = getSeoSurfaceById("participant-profile");
    assert.equal(profile?.metadata, "covered");
    assert.equal(profile?.structuredData, "covered");
    assert.equal(profile?.sitemap, "covered");
    assert.equal(getSeoSitemapProviderById("participant-profiles")?.state, "covered");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.sitemap.find((row) => row.id === "sitemap-participant-profiles")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.metadata.find((row) => row.id === "metadata-participant-profile")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-participant-profile")
        ?.status,
      "healthy",
    );
  });

  it("treats Petition as Initiative-owned — N/A canonical/sitemap/SD (no Warning)", () => {
    const petition = getSeoSurfaceById("petition");
    assert.equal(petition?.sitemap, "not_applicable");
    assert.equal(petition?.structuredData, "not_applicable");
    assert.equal(petition?.canonical, "not_applicable");
    assert.equal(petition?.openGraph, "not_applicable");
    assert.equal(petition?.metadata, "covered");
    assert.equal(getSeoSitemapProviderById("petitions")?.state, "not_applicable");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.sitemap.find((row) => row.id === "sitemap-petitions")?.status,
      "not_applicable",
    );
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-petition")?.status,
      "not_applicable",
    );
    assert.equal(
      snapshot.canonical.find((row) => row.id === "canonical-petition")?.status,
      "not_applicable",
    );
    assert.match(
      snapshot.canonical.find((row) => row.id === "canonical-petition")?.summary ?? "",
      /Initiative-owned|#petition/i,
    );
    assert.doesNotMatch(
      snapshot.canonical.find((row) => row.id === "canonical-petition")?.summary ?? "",
      /Unresolved/i,
    );
  });
});

describe("SEO Pack 05 — missing surfaces and summary", () => {
  it("marks Knowledge and Civic Archive Structured Data covered after Pack 08", () => {
    const knowledge = getSeoSurfaceById("knowledge");
    const civic = getSeoSurfaceById("civic-archive");
    assert.equal(knowledge?.metadata, "covered");
    assert.equal(knowledge?.structuredData, "covered");
    assert.equal(civic?.structuredData, "covered");

    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-knowledge")?.status,
      "healthy",
    );
    assert.equal(
      snapshot.structuredData.find((row) => row.id === "structured-data-civic-archive")?.status,
      "healthy",
    );
  });

  it("derives summary counts from diagnostics", () => {
    const snapshot = buildSeoDiagnosticsSnapshot({
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    const recomputed = summarizeSeoDiagnostics(snapshot.allChecks);
    assert.deepEqual(snapshot.summary, recomputed);
    assert.ok(snapshot.summary.healthy > 0);
    assert.ok(snapshot.summary.notApplicable > 0);
    assert.equal(
      snapshot.summary.healthy +
        snapshot.summary.warning +
        snapshot.summary.missing +
        snapshot.summary.notApplicable,
      snapshot.allChecks.length,
    );
  });
});

describe("SEO Pack 05 — Admin SEO screen wiring", () => {
  it("keeps SEO Diagnostics on /admin/seo without Technical Health duplication", () => {
    const page = readWeb("app/admin/seo/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminSeoSection/);

    const seo = readWeb("features/administration/components/AdminSeoSection.tsx");
    assert.match(seo, /buildSeoDiagnosticsSnapshot/);
    assert.match(seo, /AdminSeoDiagnosticsView/);
    assert.doesNotMatch(seo, /MongoDB|Outbox|fetchApiHealth|buildTechnicalHealthSnapshot/);
    assert.doesNotMatch(seo, /localStorage|seoSettings|SEO_SETTINGS/);
    assert.doesNotMatch(seo, /JSON-LD editor|manual Structured Data editor/i);

    const diagnostics = readWeb(
      "features/administration/components/AdminSeoDiagnosticsView.tsx",
    );
    assert.match(diagnostics, /SEO Diagnostics/);
    assert.match(diagnostics, /\/admin\/diagnostics/);
    assert.doesNotMatch(diagnostics, /MongoDB|Outbox|fetchApiHealth|buildTechnicalHealthSnapshot/);
  });

  it("removes stale Blog SEO deferred copy and documents current architecture", () => {
    const seo = readWeb("features/administration/components/AdminSeoSection.tsx");
    assert.doesNotMatch(seo, /Blog SEO title\/description fields are deferred/);
    assert.doesNotMatch(seo, /No shared JSON-LD \/ structured data helper/);

    const consoleModel = readWeb("features/administration/admin-seo-console-model.ts");
    assert.match(consoleModel, /BlogPosting/);

    const overview = readWeb("features/administration/components/AdminSeoOverviewView.tsx");
    assert.match(overview, /Petition/);
    assert.match(overview, /Initiative-owned|Participant Profile/i);
    assert.doesNotMatch(overview, /independent canonical|strategy unresolved/i);
  });

  it("preserves Admin access protection on the SEO route", () => {
    const page = readWeb("app/admin/seo/page.tsx");
    assert.match(page, /AdminAccessGate/);
    const gate = readWeb("features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /admin|capability|Access/i);
  });
});
