/**
 * SEO-11B.1 — Admin SEO Overview dashboard: health model, six categories,
 * deferred handling, Region registry correction, radial accessibility.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildSeoDiagnosticsSnapshot,
  coverageStateToSeverity,
  getSeoSitemapProviderById,
  getSeoSurfaceById,
  summarizeSeoDiagnostics,
  type SeoDiagnosticCheck,
  type SeoDiagnosticSeverity,
  type SeoDiagnosticsSnapshot,
} from "../administration/admin-seo-diagnostics-model.js";
import {
  buildSeoActionItems,
  buildSeoOverviewCategories,
  computeSeoHealthScore,
  formatSeoHealthPercent,
} from "../administration/admin-seo-overview-model.js";
import type { AdminSeoRadialIndicator as AdminSeoRadialIndicatorFn } from "../administration/components/AdminSeoRadialIndicator.js";

let AdminSeoRadialIndicator: typeof AdminSeoRadialIndicatorFn;

before(async () => {
  // The test runner compiles JSX with the classic runtime.
  (globalThis as { React?: typeof React }).React = React;
  ({ AdminSeoRadialIndicator } =
    await import("../administration/components/AdminSeoRadialIndicator.js"));
});

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");

const PRODUCTION_ENV = {
  NEXT_PUBLIC_SITE_URL: "https://huws.org",
  NEXT_PUBLIC_PLATFORM_MODE: "production",
  NODE_ENV: "production",
};

function check(id: string, status: SeoDiagnosticSeverity): SeoDiagnosticCheck {
  return { id, category: "metadata", label: id, status, summary: `${id} summary` };
}

describe("SEO-11B.1 — SEO health score", () => {
  it("is Healthy / (Healthy + Warning + Missing), excluding Deferred and Not applicable", () => {
    const score = computeSeoHealthScore([
      check("a", "healthy"),
      check("b", "healthy"),
      check("c", "healthy"),
      check("d", "warning"),
      check("e", "missing"),
      check("f", "deferred"),
      check("g", "deferred"),
      check("h", "not_applicable"),
    ]);
    assert.deepEqual(score, {
      healthy: 3,
      warning: 1,
      missing: 1,
      deferred: 2,
      notApplicable: 1,
      scored: 5,
      percent: 60,
    });
  });

  it("shows No data, not 100%, when nothing is scored", () => {
    assert.equal(computeSeoHealthScore([]).percent, null);
    const onlyExcluded = computeSeoHealthScore([
      check("a", "deferred"),
      check("b", "not_applicable"),
    ]);
    assert.equal(onlyExcluded.percent, null);
    assert.equal(formatSeoHealthPercent(onlyExcluded.percent), "No data");
  });

  it("formats percentages with at most one decimal", () => {
    assert.equal(formatSeoHealthPercent(100), "100%");
    assert.equal(formatSeoHealthPercent((46 / 48) * 100), "95.8%");
    assert.equal(formatSeoHealthPercent(87.5), "87.5%");
    assert.equal(formatSeoHealthPercent(0), "0%");
  });

  it("scores the Production diagnostics at 46 of 48 (95.8%)", () => {
    const snapshot = buildSeoDiagnosticsSnapshot(PRODUCTION_ENV);
    const health = computeSeoHealthScore(snapshot.allChecks);
    assert.deepEqual(snapshot.summary, {
      healthy: 46,
      warning: 0,
      missing: 2,
      deferred: 0,
      notApplicable: 3,
    });
    assert.equal(health.scored, 48);
    assert.equal(formatSeoHealthPercent(health.percent), "95.8%");
  });
});

describe("SEO-11B.1 — Deferred stays distinct from Not applicable", () => {
  it("maps coverage states to separate severities and summary counts", () => {
    assert.equal(coverageStateToSeverity("deferred"), "deferred");
    assert.equal(coverageStateToSeverity("not_applicable"), "not_applicable");
    assert.deepEqual(
      summarizeSeoDiagnostics([check("a", "deferred"), check("b", "not_applicable")]),
      { healthy: 0, warning: 0, missing: 0, deferred: 1, notApplicable: 1 },
    );
  });

  it("lists deferred checks in the Action Center, after missing and warnings", () => {
    const base = buildSeoDiagnosticsSnapshot(PRODUCTION_ENV);
    const snapshot: SeoDiagnosticsSnapshot = {
      ...base,
      allChecks: [
        ...base.allChecks,
        check("deferred-example", "deferred"),
        check("warning-example", "warning"),
        check("not-applicable-example", "not_applicable"),
      ],
    };
    const actions = buildSeoActionItems(snapshot);
    assert.deepEqual(
      actions.map((action) => `${action.kind}:${action.id}`),
      [
        "missing:structured-data-region",
        "missing:surface-region",
        "warning:warning-example",
        "deferred:deferred-example",
      ],
    );
  });
});

describe("SEO-11B.1 — Region registry after REGION-500B", () => {
  it("covers the Regions sitemap provider and adds the Region surface", () => {
    assert.equal(getSeoSitemapProviderById("regions")?.state, "covered");
    const region = getSeoSurfaceById("region");
    assert.equal(region?.routePattern, "/region/{regionCode}");
    assert.equal(region?.metadata, "covered");
    assert.equal(region?.canonical, "covered");
    assert.equal(region?.openGraph, "covered");
    assert.equal(region?.sitemap, "covered");
    assert.equal(region?.structuredData, "missing");
  });

  it("reports Region structured data as Missing and the rest as Healthy", () => {
    const snapshot = buildSeoDiagnosticsSnapshot(PRODUCTION_ENV);
    const byId = new Map(snapshot.allChecks.map((entry) => [entry.id, entry.status]));
    assert.equal(byId.get("structured-data-region"), "missing");
    assert.equal(byId.get("surface-region"), "missing");
    assert.equal(byId.get("metadata-region"), "healthy");
    assert.equal(byId.get("canonical-region"), "healthy");
    assert.equal(byId.get("sitemap-regions"), "healthy");
  });
});

describe("SEO-11B.1 — six categories", () => {
  const snapshot = buildSeoDiagnosticsSnapshot(PRODUCTION_ENV);
  const categories = buildSeoOverviewCategories(snapshot);
  const byId = new Map(categories.map((category) => [category.id, category]));

  it("covers exactly the six approved categories", () => {
    assert.deepEqual(
      categories.map((category) => category.label),
      ["Metadata", "Canonical", "Indexing", "Sitemap", "Robots", "Structured Data"],
    );
  });

  it("maps existing checks once per category", () => {
    for (const category of categories) {
      const ids = category.checks.map((entry) => entry.id);
      assert.equal(new Set(ids).size, ids.length, category.id);
    }
    assert.deepEqual(
      byId.get("indexing")?.checks.map((entry) => entry.id),
      ["indexing-mode", "indexing-allowed", "public-site-origin"],
    );
    assert.deepEqual(
      byId.get("robots")?.checks.map((entry) => entry.id),
      ["robots-protection"],
    );
    assert.equal(byId.get("sitemap")?.checks[0]?.id, "sitemap-availability");
    assert.equal(byId.get("metadata")?.checks.length, snapshot.metadata.length);
    assert.equal(byId.get("canonical")?.checks.length, snapshot.canonical.length);
    assert.equal(byId.get("structured-data")?.checks.length, snapshot.structuredData.length);
  });

  it("scores each category from real diagnostics", () => {
    const percents = Object.fromEntries(
      categories.map((category) => [category.id, formatSeoHealthPercent(category.score.percent)]),
    );
    assert.deepEqual(percents, {
      metadata: "100%",
      canonical: "100%",
      indexing: "100%",
      sitemap: "100%",
      robots: "100%",
      "structured-data": "87.5%",
    });
  });

  it("documents that category totals differ from the overall total", () => {
    const categoryScored = categories.reduce((sum, category) => sum + category.score.scored, 0);
    assert.notEqual(categoryScored, computeSeoHealthScore(snapshot.allChecks).scored);
    assert.match(
      read("features/administration/components/AdminSeoOverviewView.tsx"),
      /category totals do not add up to the overall total/,
    );
  });
});

describe("SEO-11B.1 — radial indicator accessibility", () => {
  it("names a static indicator by label, value and caption; hides the SVG", () => {
    const html = renderToStaticMarkup(
      createElement(AdminSeoRadialIndicator, {
        label: "Metadata",
        percent: 100,
        size: "compact",
        caption: "9 of 9 healthy",
      }),
    );
    assert.match(html, /role="img"/);
    assert.match(html, /aria-label="Metadata: 100%. 9 of 9 healthy"/);
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.match(html, /admin-seo-radial__progress/);
  });

  it("draws no arc and no percentage without data", () => {
    const html = renderToStaticMarkup(
      createElement(AdminSeoRadialIndicator, {
        label: "Search visibility",
        percent: null,
        size: "large",
      }),
    );
    assert.match(html, /aria-label="Search visibility: No data"/);
    assert.doesNotMatch(html, /admin-seo-radial__progress/);
    assert.doesNotMatch(html, /\d%/);
  });

  it("renders a clickable indicator as a native button named by its visible text", () => {
    const html = renderToStaticMarkup(
      createElement(AdminSeoRadialIndicator, {
        label: "Structured Data",
        percent: 87.5,
        size: "compact",
        caption: "7 of 8 healthy",
        onSelect: () => {},
      }),
    );
    assert.match(html, /^<button type="button"/);
    assert.doesNotMatch(html, /<button[^>]*aria-label/);
    assert.match(html, />87\.5%</);
    assert.match(html, />Structured Data</);
  });
});

describe("SEO-11B.1 — Overview layout", () => {
  const overview = read("features/administration/components/AdminSeoOverviewView.tsx");
  const css = read("features/administration/components/admin-seo-overview.css");

  it("shows Search visibility from the search performance API, as No data without any estimate", () => {
    const card = read("features/administration/components/AdminSeoSearchVisibilityCard.tsx");
    assert.match(overview, /<AdminSeoSearchVisibilityCard onNavigate=\{onNavigate\} \/>/);
    assert.match(card, /label="Search visibility" percent=\{null\}/);
    assert.match(card, /No visibility figure is estimated/);
    assert.doesNotMatch(card, /percent=\{[^n]/);
  });

  it("uses the health score, six compact indicators and the Action Center", () => {
    assert.match(overview, /computeSeoHealthScore\(diagnostics\.allChecks\)/);
    assert.match(overview, /size="large"/);
    assert.match(overview, /size="compact"/);
    assert.match(overview, /buildSeoOverviewCategories\(diagnostics\)/);
    assert.match(overview, /buildSeoActionItems\(diagnostics\)/);
    assert.match(overview, /onNavigate\("diagnostics"\)/);
    assert.match(overview, /onNavigate\("pages"\)/);
    assert.match(
      read("features/administration/components/AdminSeoSection.tsx"),
      /onNavigate=\{setView\}/,
    );
  });

  it("is responsive", () => {
    assert.match(css, /clamp\(8rem, 24vw, 10\.5rem\)/);
    assert.match(css, /@media \(max-width: 1100px\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(
      css,
      /@media \(max-width: 760px\)[\s\S]*__headline \{\s*grid-template-columns: 1fr;[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("keeps the Pack 05 notes and does not repeat diagnostic tables", () => {
    assert.match(overview, /Petition is Initiative-owned/);
    assert.match(overview, /Participant Profile/);
    assert.doesNotMatch(overview, /diagnostics\.(metadata|canonical|structuredData|sitemap)\.map/);
  });
});
