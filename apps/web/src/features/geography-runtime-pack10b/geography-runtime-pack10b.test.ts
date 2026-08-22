/**
 * Geography Runtime Correction Pack 10B —
 * City data deployment + Search form alignment + Admin field containment.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  fetchCommunitiesByRegion,
  normalizeCountryInput,
  normalizeRegionInput,
} from "@hu/geography";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Geography Runtime Correction Pack 10B — assets + forms", () => {
  it("CA-BC community asset exists at the fetchCommunitiesByRegion URL path", () => {
    const country = normalizeCountryInput("CA");
    const region = normalizeRegionInput("CA", "CA-BC");
    assert.equal(country, "CA");
    assert.equal(region, "CA-BC");

    const relativeUrl = `/data/geography/communities/${country}/${region}.json`;
    const diskPath = path.join(webRoot, "public", relativeUrl.replace(/^\//, ""));
    assert.ok(existsSync(diskPath), `missing ${diskPath}`);

    const records = JSON.parse(readFileSync(diskPath, "utf8")) as Array<{
      code: string;
      label: string;
    }>;
    assert.ok(records.length > 50, `expected structured BC cities, got ${records.length}`);
    assert.ok(records.some((row) => /vancouver/i.test(row.label)));
    assert.ok(records.every((row) => row.code && row.label));
  });

  it("representative non-CA region asset also ships", () => {
    const uaPath = path.join(
      webRoot,
      "public/data/geography/communities/UA/UA-30.json",
    );
    const usPath = path.join(
      webRoot,
      "public/data/geography/communities/US/US-CA.json",
    );
    assert.ok(existsSync(uaPath) || existsSync(usPath), "expected UA or US region asset");
    const sample = existsSync(usPath) ? usPath : uaPath;
    const records = JSON.parse(readFileSync(sample, "utf8")) as unknown[];
    assert.ok(records.length > 0);
  });

  it("gitignore and dockerignore allow public geography communities into the artifact", () => {
    const gitignore = readRepo(".gitignore");
    const dockerignore = readRepo(".dockerignore");
    assert.match(gitignore, /!apps\/web\/public\/data\/geography\/\*\*/);
    assert.match(dockerignore, /!apps\/web\/public\/data/);
    assert.match(dockerignore, /^data$/m);
  });

  it("fetchCommunitiesByRegion resolves CA-BC from local public file (node fetch mock path)", async () => {
    const diskPath = path.join(
      webRoot,
      "public/data/geography/communities/CA/CA-BC.json",
    );
    const payload = readFileSync(diskPath, "utf8");
    const records = JSON.parse(payload) as Array<{ code: string; label: string }>;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      assert.match(url, /\/data\/geography\/communities\/CA\/CA-BC\.json$/);
      return new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const communities = await fetchCommunitiesByRegion("CA", "CA-BC");
      assert.equal(communities.length, records.length);
      assert.ok(communities.some((community) => /vancouver/i.test(community.name)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("CitySelect / RegionSelect render empty message once via helperText only", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    const region = readWeb("features/geography-integrity/RegionSelect.tsx");
    assert.match(city, /emptyMessage=\{undefined\}/);
    assert.match(region, /emptyMessage=\{undefined\}/);
    assert.match(city, /GEOGRAPHY_EMPTY_COPY\.noCities/);
    assert.doesNotMatch(
      city,
      /emptyMessage=\{[\s\S]*GEOGRAPHY_EMPTY_COPY\.noCities/,
    );
  });

  it("Country Search filters share aligned hu-form-control heights and containment", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const css = readWeb("features/country-experience/country-experience-dynamic.css");
    assert.match(page, /Entity Type[\s\S]*className="hu-form-control"/);
    assert.match(page, /Activity Area[\s\S]*className="hu-form-control"/);
    assert.match(css, /min-height:\s*2\.75rem/);
    assert.match(css, /minmax\(0,\s*1fr\)/);
    assert.match(css, /min-width:\s*0/);
  });

  it("Admin Media + Country People Country fields are width-contained", () => {
    const mediaCss = readWeb(
      "features/administration/components/admin-media-resources.css",
    );
    const peopleCss = readWeb(
      "features/administration/components/admin-country-people.css",
    );
    const filtersCss = readWeb(
      "features/administration/components/admin-initiatives.css",
    );
    const geoCss = readWeb("design-system/components/geography-search-select.css");

    for (const css of [mediaCss, peopleCss, geoCss, filtersCss]) {
      assert.match(css, /min-width:\s*0/);
      assert.match(css, /max-width:\s*100%/);
    }
    assert.match(mediaCss, /geography-search-select|width:\s*100%/);
    assert.match(peopleCss, /geography-search-select|width:\s*100%/);
    assert.match(filtersCss, /\.admin-initiatives-filters__row select/);
  });

  it("360/430 containment rules remain on admin + country search grids", () => {
    const mediaCss = readWeb(
      "features/administration/components/admin-media-resources.css",
    );
    const peopleCss = readWeb(
      "features/administration/components/admin-country-people.css",
    );
    const countryCss = readWeb(
      "features/country-experience/country-experience-dynamic.css",
    );
    assert.match(mediaCss, /@media \(max-width:\s*900px\)/);
    assert.match(peopleCss, /@media \(max-width:\s*900px\)/);
    assert.match(countryCss, /@media \(max-width:\s*768px\)/);
    assert.match(countryCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});
