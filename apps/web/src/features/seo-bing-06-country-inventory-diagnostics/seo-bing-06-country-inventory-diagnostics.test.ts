/**
 * SEO-BING-06 — the sitemap_build log records why the country inventory was
 * known or unknown, without changing robots or sitemap behaviour.
 */
import assert from "node:assert/strict";
import { afterEach, before, after, describe, it } from "node:test";

import {
  loadPublicCountryInventory,
  loadPublicCountryInventoryWithDiagnostic,
} from "../../lib/seo/country-indexability.js";
import { collectPublicSitemapPathEntries } from "../../lib/seo/sitemap/build-public-sitemap.js";
import { listCountrySitemapEntries } from "../../lib/seo/sitemap/providers/countries.js";
import {
  buildSitemapDiagnosticRecord,
  readDeployCommit,
  resetSitemapBuildOverlapForTests,
} from "../../lib/system-health/sitemap-build-diagnostic.js";

const INVENTORY_PATH = "/api/v1/public/sitemap/countries";
const ALL_COUNTRY_COUNT = listCountrySitemapEntries().length;
const originalFetch = globalThis.fetch;
const originalProvider = process.env.PUBLIC_PROJECTION_PROVIDER;
const originalCommit = process.env.RENDER_GIT_COMMIT;
let inventoryCalls = 0;

function envelope(data: unknown, status = 200, success = status < 400): Response {
  return new Response(JSON.stringify({ success, data, meta: {}, links: {}, message: "" }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockInventory(respond: () => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith(INVENTORY_PATH)) {
      inventoryCalls += 1;
      return respond();
    }
    throw new Error("other providers are offline in this test");
  }) as typeof fetch;
}

const VALID = () =>
  envelope({ entries: [{ countryCode: "CA" }, { countryCode: "DE" }, { countryCode: "UA" }] });

before(() => {
  process.env.PUBLIC_PROJECTION_PROVIDER = "api";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  inventoryCalls = 0;
  process.env.PUBLIC_PROJECTION_PROVIDER = "api";
  if (originalCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = originalCommit;
});

after(() => {
  if (originalProvider === undefined) delete process.env.PUBLIC_PROJECTION_PROVIDER;
  else process.env.PUBLIC_PROJECTION_PROVIDER = originalProvider;
});

describe("SEO-BING-06 — country inventory diagnostic outcomes", () => {
  it("1. known inventory reports the eligible country count", async () => {
    mockInventory(VALID);
    const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
    assert.deepEqual(diagnostic, { outcome: "known", eligibleCount: 3 });
    assert.equal(inventory.status, "known");
  });

  it("2. projection_mode without any request", async () => {
    process.env.PUBLIC_PROJECTION_PROVIDER = "bootstrap";
    mockInventory(VALID);
    const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
    assert.deepEqual(diagnostic, { outcome: "unknown", reason: "projection_mode" });
    assert.deepEqual(inventory, { status: "unknown" });
    assert.equal(inventoryCalls, 0);
  });

  it("3. http_error keeps the HTTP status only", async () => {
    for (const [respond, status] of [
      [() => envelope(null, 503), 503],
      [() => new Response("<html>Bad gateway</html>", { status: 502 }), 502],
      [() => envelope(null, 404), 404],
    ] as const) {
      mockInventory(respond);
      const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
      assert.deepEqual(diagnostic, {
        outcome: "unknown",
        reason: "http_error",
        httpStatus: status,
      });
      assert.deepEqual(inventory, { status: "unknown" });
    }
  });

  it("4. network_error when the request cannot complete", async () => {
    mockInventory(() => Promise.reject(new TypeError("fetch failed")));
    const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
    assert.deepEqual(diagnostic, { outcome: "unknown", reason: "network_error" });
    assert.deepEqual(inventory, { status: "unknown" });
  });

  it("5. invalid_response for invalid JSON, success:false and malformed entries", async () => {
    const cases: Array<[() => Response, Record<string, unknown>]> = [
      [
        () => new Response("{not json", { status: 200 }),
        { outcome: "unknown", reason: "invalid_response", httpStatus: 200 },
      ],
      [
        () => envelope({ entries: [] }, 200, false),
        { outcome: "unknown", reason: "invalid_response", httpStatus: 200 },
      ],
      [() => envelope({ items: ["CA"] }), { outcome: "unknown", reason: "invalid_response" }],
      [
        () => envelope({ entries: [{ countryCode: "ca" }] }),
        { outcome: "unknown", reason: "invalid_response" },
      ],
    ];
    for (const [respond, expected] of cases) {
      mockInventory(respond);
      const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
      assert.deepEqual(diagnostic, expected);
      assert.deepEqual(inventory, { status: "unknown" });
    }
  });

  it("6. empty_inventory keeps the parser contract (valid, known, empty)", async () => {
    for (const entries of [[], [{ countryCode: "ZZ" }]]) {
      mockInventory(() => envelope({ entries }));
      const { inventory, diagnostic } = await loadPublicCountryInventoryWithDiagnostic();
      assert.deepEqual(diagnostic, { outcome: "unknown", reason: "empty_inventory" });
      assert.deepEqual(inventory, { status: "known", countryCodes: new Set() });
    }
  });

  it("7. the page loader returns the same inventory as before", async () => {
    mockInventory(VALID);
    const inventory = await loadPublicCountryInventory();
    assert.ok(inventory.status === "known");
    assert.deepEqual([...inventory.countryCodes].sort(), ["CA", "DE", "UA"]);
    mockInventory(() => envelope(null, 503));
    assert.deepEqual(await loadPublicCountryInventory(), { status: "unknown" });
  });
});

describe("SEO-BING-06 — sitemap_build log record", () => {
  const observation = { startedAtMs: 1_000, overlappingSitemapBuilds: 1 };
  const base = {
    observation,
    outcome: "completed" as const,
    failedProviderIds: [],
    partialProviderIds: [],
    canonicalPathCount: 273,
    seoLocaleCount: 0,
    entityResolveCount: 0,
    memoryAtStart: null,
    memoryAfterInventory: null,
    memoryAfterEligibility: null,
  };

  it("8. log carries a closed country inventory summary; persisted event is unchanged", () => {
    const known = buildSitemapDiagnosticRecord(
      { ...base, countryInventory: { outcome: "known", eligibleCount: 3 } },
      2_000,
    );
    assert.deepEqual(known.log.countryInventory, { outcome: "known", eligibleCount: 3 });
    assert.equal(known.persist, null);

    const failed = buildSitemapDiagnosticRecord(
      {
        ...base,
        countryInventory: { outcome: "unknown", reason: "http_error", httpStatus: 503 },
      },
      2_000,
    );
    assert.deepEqual(failed.log.countryInventory, {
      outcome: "unknown",
      reason: "http_error",
      httpStatus: 503,
    });

    const network = buildSitemapDiagnosticRecord(
      { ...base, countryInventory: { outcome: "unknown", reason: "network_error" } },
      2_000,
    );
    assert.deepEqual(network.log.countryInventory, {
      outcome: "unknown",
      reason: "network_error",
      httpStatus: null,
    });

    const notLoaded = buildSitemapDiagnosticRecord(base, 2_000);
    assert.equal(notLoaded.log.countryInventory, null);

    const memory = {
      rss: 1,
      heapUsed: 1,
      heapTotal: 1,
      external: 1,
      pid: 1,
      uptimeSeconds: 1,
      processStartedAt: "2026-11-05T00:00:00.000Z",
      instanceId: null,
      limitBytes: null,
      pressure: "unknown" as const,
    };
    const persisted = buildSitemapDiagnosticRecord(
      {
        ...base,
        outcome: "provider_failure",
        failedProviderIds: ["blog-posts"],
        memoryAtStart: memory,
        countryInventory: { outcome: "unknown", reason: "http_error", httpStatus: 503 },
      },
      2_000,
    ).persist;
    assert.ok(persisted);
    assert.equal("countryInventory" in persisted, false);
    assert.equal("deployCommit" in persisted, false);
  });

  it("9. deployCommit is Render's commit SHA or null, never other values", () => {
    const sha = "0d87f82d2497cd8fef595c0960c26648f044b17c";
    assert.equal(readDeployCommit({ RENDER_GIT_COMMIT: sha }), sha);
    assert.equal(readDeployCommit({ RENDER_GIT_COMMIT: ` ${sha.toUpperCase()} ` }), sha);
    assert.equal(readDeployCommit({}), null);
    for (const value of ["", "main", "abc", "0d87f82d; rm -rf /", "ghp_secretTokenValue123"]) {
      assert.equal(readDeployCommit({ RENDER_GIT_COMMIT: value }), null, value);
    }

    process.env.RENDER_GIT_COMMIT = sha;
    assert.equal(buildSitemapDiagnosticRecord(base, 2_000).log.deployCommit, sha);
    delete process.env.RENDER_GIT_COMMIT;
    assert.equal(buildSitemapDiagnosticRecord(base, 2_000).log.deployCommit, null);
  });
});

describe("SEO-BING-06 — one diagnostic per sitemap build, behaviour unchanged", () => {
  async function buildAndCaptureLog(): Promise<{
    countryPaths: number;
    log: Record<string, unknown>;
    logLines: string[];
  }> {
    const logLines: string[] = [];
    const previousLog = console.log;
    console.log = (...args: unknown[]) => {
      logLines.push(args.map(String).join(" "));
    };
    resetSitemapBuildOverlapForTests();
    try {
      const entries = await collectPublicSitemapPathEntries({ seoIndexableLocales: [] });
      const countryPaths = entries.filter((entry) =>
        /^\/countries\/[A-Z]{2}$/.test(entry.path),
      ).length;
      const builds = logLines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((record) => record.operation === "sitemap_build");
      assert.equal(builds.length, 1, "exactly one sitemap_build record");
      return { countryPaths, log: builds[0]!, logLines };
    } finally {
      console.log = previousLog;
      resetSitemapBuildOverlapForTests();
    }
  }

  it("10. known inventory: 3 countries listed and logged as known", async () => {
    mockInventory(VALID);
    const { countryPaths, log } = await buildAndCaptureLog();
    assert.equal(countryPaths, 3);
    assert.deepEqual(log.countryInventory, { outcome: "known", eligibleCount: 3 });
    assert.equal(inventoryCalls, 1, "one inventory request per sitemap build");
  });

  it("11. failed and empty inventories: all countries kept and the reason logged", async () => {
    const cases: Array<[() => Response | Promise<Response>, Record<string, unknown>]> = [
      [() => envelope(null, 503), { outcome: "unknown", reason: "http_error", httpStatus: 503 }],
      [
        () => Promise.reject(new TypeError("fetch failed")),
        { outcome: "unknown", reason: "network_error", httpStatus: null },
      ],
      [
        () => envelope({ entries: [] }),
        { outcome: "unknown", reason: "empty_inventory", httpStatus: null },
      ],
    ];
    for (const [respond, expected] of cases) {
      mockInventory(respond);
      const { countryPaths, log } = await buildAndCaptureLog();
      assert.equal(countryPaths, ALL_COUNTRY_COUNT);
      assert.deepEqual(log.countryInventory, expected);
    }

    process.env.PUBLIC_PROJECTION_PROVIDER = "bootstrap";
    mockInventory(VALID);
    const bootstrap = await buildAndCaptureLog();
    assert.equal(bootstrap.countryPaths, ALL_COUNTRY_COUNT);
    assert.deepEqual(bootstrap.log.countryInventory, {
      outcome: "unknown",
      reason: "projection_mode",
      httpStatus: null,
    });
  });

  it("12. the log line never contains response bodies or URLs", async () => {
    mockInventory(() =>
      envelope({ entries: [{ countryCode: "CA" }], note: "private-response-body" }),
    );
    const { logLines } = await buildAndCaptureLog();
    const line = logLines.find((entry) => entry.includes('"sitemap_build"')) ?? "";
    assert.equal(line.includes("private-response-body"), false);
    assert.equal(line.includes("countryCode"), false);
    assert.equal(line.includes("api.huws.org"), false);
    assert.equal(line.includes(INVENTORY_PATH), false);
  });
});
