/**
 * REGION-500B.3 — region metadata and indexing, region sitemap, missing
 * messages and accessibility fixes.
 *
 * Rendered checks live in `region-500b3-seo-a11y.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RegionExperiencePublicProjections } from "@hu/types";

import { listRegionSitemapEntries } from "../../lib/seo/sitemap/providers/regions.js";
import { isRegionProjectionIndexable } from "../region-experience/region-projection-labels.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");
const catalog = (locale: string) =>
  JSON.parse(read(`features/i18n/messages/${locale}.json`)) as Record<string, unknown>;
const lookup = (messages: Record<string, unknown>, key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      messages,
    );

function projections(
  source: "projection" | "bootstrap",
  initiatives: number,
): RegionExperiencePublicProjections {
  const generatedAt = "2026-11-01T00:00:00.000Z";
  return {
    identity: {
      slug: "CA-BC",
      name: "British Columbia",
      description: "",
      countrySlug: "CA",
      countryLabel: "Canada",
      representativeVisual: { kind: "placeholder", caption: "British Columbia", initials: "BC" },
      source,
    },
    statistics: {
      scope: "region",
      scopeLabel: "British Columbia",
      generatedAt,
      source,
      indicators: [
        {
          id: "region-initiatives",
          label: "Public initiatives",
          value: initiatives,
          derived: false,
        },
      ],
    },
    pipeline: { scope: "region", scopeLabel: "British Columbia", generatedAt, source, stages: [] },
    latestInitiatives: {
      scope: "region",
      scopeLabel: "British Columbia",
      source,
      generatedAt,
      initiatives: [],
    },
    communityCatalog: { source, generatedAt, communities: [] },
  };
}

describe("REGION-500B.3 — indexing policy", () => {
  it("indexes only real regions with public regional initiatives", () => {
    assert.equal(isRegionProjectionIndexable(projections("projection", 2)), true);
    assert.equal(isRegionProjectionIndexable(projections("projection", 0)), false);
    assert.equal(isRegionProjectionIndexable(projections("bootstrap", 2)), false);
  });

  it("builds metadata through the shared builder with a canonical ISO path", () => {
    const page = read("app/region/[regionSlug]/page.tsx");
    assert.match(page, /export async function generateMetadata\(/);
    assert.match(page, /buildPublicPageMetadata\(\{/);
    assert.match(page, /canonicalPath: regionHref\(route\.regionCode\)/);
    assert.match(page, /indexable,/);
    assert.match(page, /title = `\$\{identity\.name\}, \$\{identity\.countryLabel\}`/);
    assert.match(
      page,
      /t\("contextIntroduction", \{ regionName: identity\.name, siteName: brand\.siteName \}\)/,
    );
    // Empty real regions: noindex, follow — only where the platform allows indexing at all.
    assert.match(
      page,
      /!indexable && identity\.source === "projection" && !shouldDisallowSearchIndexing\(\)/,
    );
    assert.match(page, /robots: \{ index: false, follow: true \}/);
    assert.match(page, /if \(route\.kind !== "canonical"\) \{\s*return \{\};/);
  });

  it("redirects legacy slugs permanently and loads the projection once per request", () => {
    const page = read("app/region/[regionSlug]/page.tsx");
    assert.match(page, /permanentRedirect\(regionHref\(route\.regionCode\)\)/);
    assert.doesNotMatch(page, /[^t]redirect\(/);
    assert.match(page, /const loadLocalizedRegionProjections = cache\(/);
    assert.match(page, /^export const dynamic = "force-dynamic";$/m);
  });
});

describe("REGION-500B.3 — region sitemap provider", () => {
  const realFetch = globalThis.fetch;
  const realProvider = process.env.PUBLIC_PROJECTION_PROVIDER;
  const calls: string[] = [];

  function stubFetch(entries: unknown[]) {
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json({ success: true, data: { entries }, meta: {}, links: {}, message: "" });
    }) as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realProvider === undefined) {
      delete process.env.PUBLIC_PROJECTION_PROVIDER;
    } else {
      process.env.PUBLIC_PROJECTION_PROVIDER = realProvider;
    }
  });

  it("lists canonical region URLs from one inventory request", async () => {
    process.env.PUBLIC_PROJECTION_PROVIDER = "api";
    stubFetch([
      { countryCode: "CA", regionCode: "CA-BC", updatedAt: "2026-10-20T00:00:00.000Z" },
      { countryCode: "US", regionCode: "US-GA", updatedAt: "2026-10-05T00:00:00.000Z" },
      { countryCode: "CA", regionCode: "british-columbia", updatedAt: "2026-10-05T00:00:00.000Z" },
      { countryCode: "CA", regionCode: "ca-on", updatedAt: "2026-10-05T00:00:00.000Z" },
      { countryCode: "XX", regionCode: "XX-ZZ", updatedAt: "2026-10-05T00:00:00.000Z" },
    ]);
    assert.deepEqual(await listRegionSitemapEntries(), [
      { path: "/region/CA-BC", lastModified: "2026-10-20T00:00:00.000Z" },
      { path: "/region/US-GA", lastModified: "2026-10-05T00:00:00.000Z" },
    ]);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /\/api\/v1\/public\/sitemap\/regions$/);
  });

  it("lists nothing and makes no request for bootstrap projections", async () => {
    process.env.PUBLIC_PROJECTION_PROVIDER = "bootstrap";
    stubFetch([{ countryCode: "CA", regionCode: "CA-BC", updatedAt: "2026-10-20T00:00:00.000Z" }]);
    assert.deepEqual(await listRegionSitemapEntries(), []);
    assert.equal(calls.length, 0);
  });

  it("is an isolated sitemap provider", () => {
    const builder = read("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(
      builder,
      /collectProviderEntries\("regions", listRegionSitemapEntries, failedProviderIds\)/,
    );
  });
});

describe("REGION-500B.3 — region messages", () => {
  it("every message key used by region components exists in all bundled catalogs", () => {
    const dir = path.join(webSrc, "features/region-experience/components");
    const used: string[] = [];
    for (const file of readdirSync(dir)) {
      const source = readFileSync(path.join(dir, file), "utf8");
      const namespaces = new Map<string, string>();
      for (const match of source.matchAll(/const (\w+) = useTranslations\((?:"([^"]*)")?\)/g)) {
        namespaces.set(match[1] ?? "", match[2] ?? "");
      }
      for (const match of source.matchAll(/\b(\w+)\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        const namespace = namespaces.get(match[1] ?? "");
        if (namespace === undefined) continue;
        used.push(namespace ? `${namespace}.${match[2]}` : (match[2] ?? ""));
      }
    }
    assert.ok(used.length > 40, `found ${used.length} keys`);
    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      const messages = catalog(locale);
      const missing = used.filter((key) => typeof lookup(messages, key) !== "string");
      assert.deepEqual(missing, [], `${locale} missing ${missing.join(", ")}`);
    }
  });
});

describe("REGION-500B.3 — accessibility", () => {
  it("region styles use accessible text colors", () => {
    const css = read("features/region-experience/region-experience.css");
    assert.doesNotMatch(css, /#df9815|#737373/i);
    assert.match(
      css,
      /\.region-experience-page \{[^}]*color: var\(--hu-color-accent-text, #966510\)/,
    );
    assert.match(
      css,
      /\.region-experience-page \.geographic-navigator__label \{\s*color: var\(--hu-color-text-muted, #5f6b7a\);/,
    );
    assert.match(
      css,
      /\.region-experience-page \.global-statistics__value \{\s*color: var\(--hu-color-accent-text, #966510\);/,
    );
    assert.match(
      css,
      /\.region-experience-page \.latest-initiative-card__related-label \{\s*color: var\(--hu-color-text-muted, #5f6b7a\);/,
    );
  });

  it("map sub-area buttons are named by their visible text", () => {
    const map = read("features/region-experience/components/RegionalInteractiveMapEvidence.tsx");
    const button = map.slice(map.indexOf("regional-interactive-map__subregion-button"));
    assert.doesNotMatch(button.slice(0, button.indexOf("</button>")), /aria-label=/);
    assert.match(map, /t\("previewLabel", \{ label: subRegion\.label \}\)/);
  });
});
