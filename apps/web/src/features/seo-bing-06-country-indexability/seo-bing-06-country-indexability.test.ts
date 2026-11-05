/**
 * SEO-BING-06 — country page robots and the country sitemap share one public
 * country inventory. Unknown inventories never cause de-indexing or removal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getCountries } from "@hu/geography";

import {
  loadPublicCountryInventory,
  parsePublicCountryInventory,
  resolveCountryIndexability,
  type PublicCountryInventory,
} from "../../lib/seo/country-indexability.js";
import {
  filterCountrySitemapEntries,
  listCountrySitemapEntries,
  loadEligibleCountrySitemapEntries,
} from "../../lib/seo/sitemap/providers/countries.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const PAGE = readFileSync(path.join(webSrc, "app/countries/[countryCode]/page.tsx"), "utf8");
const BUILD = readFileSync(path.join(webSrc, "lib/seo/sitemap/build-public-sitemap.ts"), "utf8");

const ALL_COUNTRY_PATHS = listCountrySitemapEntries().map((entry) => entry.path);
const originalFetch = globalThis.fetch;
const originalProvider = process.env.PUBLIC_PROJECTION_PROVIDER;
let fetchCalls: string[] = [];

function envelope(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ success: status < 400, data, meta: {}, links: {}, message: "" }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function mockFetch(respond: () => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return respond();
  }) as typeof fetch;
}

const known = (...codes: string[]): PublicCountryInventory => ({
  status: "known",
  countryCodes: new Set(codes),
});

before(() => {
  process.env.PUBLIC_PROJECTION_PROVIDER = "api";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchCalls = [];
  process.env.PUBLIC_PROJECTION_PROVIDER = "api";
});

after(() => {
  if (originalProvider === undefined) delete process.env.PUBLIC_PROJECTION_PROVIDER;
  else process.env.PUBLIC_PROJECTION_PROVIDER = originalProvider;
});

describe("SEO-BING-06 — country inventory parsing", () => {
  it("1. valid inventory is known; duplicates removed; non-catalog codes ignored", () => {
    const inventory = parsePublicCountryInventory({
      entries: [
        { countryCode: "CA" },
        { countryCode: "DE" },
        { countryCode: "UA" },
        { countryCode: "CA" },
        { countryCode: "ZZ" },
      ],
    });
    assert.ok(inventory.status === "known");
    assert.deepEqual([...inventory.countryCodes].sort(), ["CA", "DE", "UA"]);
  });

  it("2. malformed payloads are unknown, never an empty list", () => {
    for (const data of [
      null,
      undefined,
      {},
      { entries: null },
      { entries: "CA" },
      { entries: [{ countryCode: "ca" }] },
      { entries: [{ countryCode: 7 }] },
      { entries: [{}] },
      { entries: [null] },
      { entries: [{ countryCode: "CA" }, { code: "DE" }] },
    ]) {
      assert.deepEqual(
        parsePublicCountryInventory(data),
        { status: "unknown" },
        JSON.stringify(data),
      );
    }
  });

  it("3. a valid empty inventory stays a valid response but never de-indexes", () => {
    const inventory = parsePublicCountryInventory({ entries: [] });
    assert.deepEqual(inventory, { status: "known", countryCodes: new Set() });
    assert.equal(resolveCountryIndexability(inventory, "CA"), "unknown");
    assert.equal(resolveCountryIndexability(inventory, "AF"), "unknown");

    const onlyNonCatalog = parsePublicCountryInventory({ entries: [{ countryCode: "ZZ" }] });
    assert.equal(onlyNonCatalog.status, "known");
    assert.equal(resolveCountryIndexability(onlyNonCatalog, "AF"), "unknown");
  });

  it("4. indexability maps eligible / ineligible / unknown", () => {
    assert.equal(resolveCountryIndexability(known("CA", "DE", "UA"), "DE"), "eligible");
    assert.equal(resolveCountryIndexability(known("CA", "DE", "UA"), "AF"), "ineligible");
    assert.equal(resolveCountryIndexability({ status: "unknown" }, "AF"), "unknown");
  });
});

describe("SEO-BING-06 — country inventory loading", () => {
  it("5. one request to the approved endpoint; success is known", async () => {
    mockFetch(() => envelope({ entries: [{ countryCode: "UA" }, { countryCode: "CA" }] }));
    const inventory = await loadPublicCountryInventory();
    assert.equal(inventory.status, "known");
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /\/api\/v1\/public\/sitemap\/countries$/);
  });

  it("6. HTTP 503, HTML errors, network failure and invalid JSON are unknown", async () => {
    const failures: Array<() => Response | Promise<Response>> = [
      () => envelope(null, 503),
      () => new Response("<html>Service Unavailable</html>", { status: 503 }),
      () => Promise.reject(new TypeError("fetch failed")),
      () => new Response("{not json", { status: 200 }),
      () => envelope({ entries: [{ countryCode: "xx-invalid" }] }),
    ];
    for (const failure of failures) {
      mockFetch(failure);
      assert.deepEqual(await loadPublicCountryInventory(), { status: "unknown" });
    }
  });

  it("7. non-API projection mode is unknown without a request", async () => {
    process.env.PUBLIC_PROJECTION_PROVIDER = "bootstrap";
    mockFetch(() => envelope({ entries: [] }));
    assert.deepEqual(await loadPublicCountryInventory(), { status: "unknown" });
    assert.equal(fetchCalls.length, 0);
  });
});

describe("SEO-BING-06 — country sitemap", () => {
  it("8. known inventory lists only eligible catalog countries; unknown or empty keeps all", () => {
    assert.equal(getCountries().length, ALL_COUNTRY_PATHS.length);
    assert.deepEqual(
      filterCountrySitemapEntries(known("UA", "CA", "DE", "ZZ"))
        .map((entry) => entry.path)
        .sort(),
      ["/countries/CA", "/countries/DE", "/countries/UA"],
    );
    for (const inventory of [known(), { status: "unknown" } as const]) {
      assert.deepEqual(
        filterCountrySitemapEntries(inventory).map((entry) => entry.path),
        ALL_COUNTRY_PATHS,
      );
    }
  });

  it("9. sitemap provider uses one inventory request and falls back to all on failure", async () => {
    mockFetch(() =>
      envelope({ entries: [{ countryCode: "CA" }, { countryCode: "DE" }, { countryCode: "UA" }] }),
    );
    assert.equal((await loadEligibleCountrySitemapEntries()).entries.length, 3);
    assert.equal(fetchCalls.length, 1, "no per-country requests");

    mockFetch(() => envelope(null, 503));
    assert.deepEqual(
      (await loadEligibleCountrySitemapEntries()).entries.map((entry) => entry.path),
      ALL_COUNTRY_PATHS,
    );
  });

  it("10. a valid empty API response keeps every country listed", async () => {
    mockFetch(() => envelope({ entries: [] }));
    assert.deepEqual(
      (await loadEligibleCountrySitemapEntries()).entries.map((entry) => entry.path),
      ALL_COUNTRY_PATHS,
    );
  });

  it("11. page robots and sitemap agree for every catalog country and inventory", () => {
    const inventories: PublicCountryInventory[] = [
      known("CA", "DE", "UA"),
      known("CA", "UA"),
      known(),
      { status: "unknown" },
    ];
    for (const inventory of inventories) {
      const listed = new Set(filterCountrySitemapEntries(inventory).map((entry) => entry.path));
      for (const country of getCountries()) {
        const noindex = resolveCountryIndexability(inventory, country.code) === "ineligible";
        assert.equal(
          listed.has(`/countries/${country.code}`),
          !noindex,
          `${country.code} in ${inventory.status}:${inventory.status === "known" ? [...inventory.countryCodes].join(",") : ""}`,
        );
      }
    }
  });
});

describe("SEO-BING-06 — wiring", () => {
  it("12. country page: noindex, follow only for known-ineligible countries", () => {
    assert.match(
      PAGE,
      /resolveCountryIndexability\(inventory, countryCode\) === "ineligible" &&\s*!shouldDisallowSearchIndexing\(\)/,
    );
    assert.match(PAGE, /return \{ \.\.\.metadata, robots: \{ index: false, follow: true \} \};/);
    assert.match(PAGE, /canonicalPath: `\/countries\/\$\{encodeURIComponent\(countryCode\)\}`/);
    assert.match(PAGE, /applyPageSeoOverrideToMetadataInput\(/);
    assert.match(PAGE, /loadPublicCountryInventory\(\)/);
  });

  it("13. sitemap build loads the inventory once alongside the dynamic providers", () => {
    assert.match(
      BUILD,
      /const \[countrySitemap, \.\.\.dynamicBatches\] = await Promise\.all\(\[\s*loadEligibleCountrySitemapEntries\(\),/,
    );
    assert.match(
      BUILD,
      /canonical = dedupeSitemapPathEntries\(\[\.\.\.staticEntries, \.\.\.listCountrySitemapEntries\(\)\]\);/,
    );
    assert.match(
      BUILD,
      /collectProviderEntries\("regions", listRegionSitemapEntries, failedProviderIds\)/,
    );
  });
});
