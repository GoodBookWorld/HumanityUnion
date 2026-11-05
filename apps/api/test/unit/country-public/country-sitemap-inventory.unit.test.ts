/**
 * SEO-BING-06 — GET /api/v1/public/sitemap/countries lists only countries with
 * meaningful public content: public country-discovery initiatives (the country
 * page card rule), active curated trusted media, or active affiliations.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { CountryAffiliationEntry, Initiative, MediaResource } from "@hu/types";

import {
  setCountryAffiliationForceMemoryForTests,
  upsertCountryAffiliation,
} from "../../../src/modules/country-affiliation/persistence/country-affiliation.repository.js";
import {
  listCountryAffiliationsMemory,
  resetCountryAffiliationsMemoryForTests,
} from "../../../src/modules/country-affiliation/persistence/country-affiliation.memory.store.js";
import {
  listCountryCodesWithPublicAffiliations,
  listCountryCodesWithPublicInitiatives,
  listCountryCodesWithPublicTrustedMedia,
  listCountryInitiativeCardProjections,
  listPublicCountriesWithContent,
} from "../../../src/modules/country-statistics/country-public.service.js";
import { listPublicRegionsWithContent } from "../../../src/modules/country-statistics/region-public.service.js";
import {
  createInitiative,
  deleteInitiative,
  listInitiatives,
} from "../../../src/modules/initiatives/initiative.store.js";
import {
  deleteMediaResourceMemory,
  listMediaResourcesMemory,
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  setMediaResourceForceMemoryForTests,
  upsertMediaResource,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import publicSitemapRouter from "../../../src/modules/sitemap/public-sitemap.routes.js";

const STEWARD_ID = "sb06-steward-private-id";
const TIMESTAMP = "2026-10-01T00:00:00.000Z";
const createdIds: string[] = [];

function initiative(
  initiativeId: string,
  overrides: Omit<Partial<Initiative>, "metadata"> & {
    metadata?: Partial<Initiative["metadata"]>;
  } = {},
): Initiative {
  const { metadata, ...rest } = overrides;
  return {
    initiativeId,
    stewardId: STEWARD_ID,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    title: `SB06 ${initiativeId}`,
    description: "Country sitemap fixture.",
    status: "discussion",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Governance",
      tags: [],
      region: "",
      language: "en",
      communitySlug: "",
      activityArea: "Governance",
      participationScope: "country",
      countrySlug: "CA",
      regionSlug: "",
      ...metadata,
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...rest,
  };
}

function media(id: string, overrides: Partial<MediaResource> = {}): MediaResource {
  return {
    id,
    resourceType: "TRUSTED_MEDIA",
    scopeType: "COUNTRY",
    countryCode: "DE",
    name: `Media ${id}`,
    logoLabel: id.slice(0, 2).toUpperCase(),
    websiteUrl: `https://${id}.example.test`,
    categoryId: "public_broadcaster",
    description: "Curated fixture.",
    active: true,
    sortOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function affiliation(
  entryId: string,
  overrides: Partial<CountryAffiliationEntry> = {},
): CountryAffiliationEntry {
  return {
    entryId,
    countryCode: "NZ",
    entryType: "PARTNER",
    name: `Affiliation ${entryId}`,
    sortOrder: 1,
    active: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function track(record: Initiative): void {
  createdIds.push(record.initiativeId);
  createInitiative(record);
}

let server: Server;
let baseUrl = "";

before(async () => {
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  setCountryAffiliationForceMemoryForTests(true);
  resetCountryAffiliationsMemoryForTests();

  // Initiatives: only the public, country-scoped, non-demonstration CA records count.
  track(initiative("sb06-ca-country"));
  track(
    initiative("sb06-ca-region", {
      metadata: { participationScope: "region", regionSlug: "CA-BC" },
    }),
  );
  track(
    initiative("sb06-us-world", { metadata: { countrySlug: "US", participationScope: "world" } }),
  );
  track(initiative("sb06-fr-draft", { lifecyclePhase: "draft", metadata: { countrySlug: "FR" } }));
  track(
    initiative("sb06-it-private", {
      visibility: { policy: "steward_only" },
      metadata: { countrySlug: "IT" },
    }),
  );
  track(initiative("initiative-bootstrap-sb06-mx", { metadata: { countrySlug: "MX" } }));

  // Trusted media: active, categorised COUNTRY TRUSTED_MEDIA only.
  await upsertMediaResource(media("sb06-de-1", { countryCode: "DE" }));
  await upsertMediaResource(media("sb06-ua-1", { countryCode: "UA" }));
  await upsertMediaResource(media("sb06-ua-2", { countryCode: "UA", sortOrder: 2 }));
  await upsertMediaResource(media("sb06-ca-1", { countryCode: "CA" }));
  await upsertMediaResource(media("sb06-pl-inactive", { countryCode: "PL", active: false }));
  await upsertMediaResource(
    media("sb06-jp-uncategorised", { countryCode: "JP", categoryId: null }),
  );
  await upsertMediaResource(
    media("sb06-gb-news", { countryCode: "GB", resourceType: "NEWS_SOURCE", categoryId: null }),
  );
  await upsertMediaResource(media("sb06-world", { scopeType: "WORLD", countryCode: null }));

  // Affiliations: active entries are public; inactive ones are not.
  await upsertCountryAffiliation(affiliation("sb06-nz-partner", { countryCode: "NZ" }));
  await upsertCountryAffiliation(
    affiliation("sb06-au-inactive", { countryCode: "AU", entryType: "TEAM_MEMBER", active: false }),
  );

  const app = express();
  app.use("/api/v1/public/sitemap", publicSitemapRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const id of createdIds) {
    deleteInitiative(id);
  }
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
  resetCountryAffiliationsMemoryForTests();
  setCountryAffiliationForceMemoryForTests(false);
});

describe("SEO-BING-06 — public country content inventory", () => {
  it("1. initiatives: country page card rule, excluding World, draft, private and demo records", async () => {
    const codes = listCountryCodesWithPublicInitiatives(
      listInitiatives().filter((record) => createdIds.includes(record.initiativeId)),
    );
    assert.deepEqual([...codes].sort(), ["CA"]);

    for (const code of ["US", "FR", "IT"]) {
      assert.equal(
        (await listCountryInitiativeCardProjections(code)).length,
        0,
        `${code} shows no cards`,
      );
    }
    assert.ok((await listCountryInitiativeCardProjections("CA")).length >= 2, "CA shows cards");
  });

  it("2. trusted media: active, categorised COUNTRY TRUSTED_MEDIA only", async () => {
    assert.deepEqual([...(await listCountryCodesWithPublicTrustedMedia())].sort(), [
      "CA",
      "DE",
      "UA",
    ]);
  });

  it("3. affiliations: active entries only", async () => {
    assert.deepEqual([...(await listCountryCodesWithPublicAffiliations())], ["NZ"]);
  });

  it("4. aggregate: union of sources, de-duplicated and sorted", async () => {
    const entries = await listPublicCountriesWithContent();
    const fixtureCodes = entries
      .map((entry) => entry.countryCode)
      .filter((code) =>
        ["CA", "DE", "UA", "NZ", "US", "FR", "IT", "MX", "PL", "JP", "GB", "AU"].includes(code),
      );
    assert.deepEqual(fixtureCodes, ["CA", "DE", "NZ", "UA"]);
    const all = entries.map((entry) => entry.countryCode);
    assert.equal(new Set(all).size, all.length, "no duplicates");
    assert.deepEqual(
      all,
      [...all].sort((a, b) => a.localeCompare(b)),
      "sorted",
    );
  });

  it("5. GET /countries returns codes only, no-store, and does not write", async () => {
    const mediaBefore = listMediaResourcesMemory().length;
    const affiliationsBefore = listCountryAffiliationsMemory().length;
    const initiativesBefore = listInitiatives().length;

    const response = await fetch(`${baseUrl}/api/v1/public/sitemap/countries`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = (await response.json()) as {
      success: boolean;
      data: { entries: { countryCode: string }[] };
      meta: { total: number };
    };
    assert.equal(body.success, true);
    assert.equal(body.meta.total, body.data.entries.length);
    for (const entry of body.data.entries) {
      assert.deepEqual(Object.keys(entry), ["countryCode"]);
      assert.match(entry.countryCode, /^[A-Z]{2}$/);
    }
    for (const code of ["CA", "DE", "UA", "NZ"]) {
      assert.ok(
        body.data.entries.some((entry) => entry.countryCode === code),
        code,
      );
    }
    for (const code of ["US", "FR", "IT", "MX", "PL", "JP", "GB", "AU"]) {
      assert.equal(
        body.data.entries.some((entry) => entry.countryCode === code),
        false,
        code,
      );
    }
    assert.equal(JSON.stringify(body).includes(STEWARD_ID), false, "no internal identifiers");

    assert.equal(listMediaResourcesMemory().length, mediaBefore, "media seed hook not run");
    assert.equal(listCountryAffiliationsMemory().length, affiliationsBefore);
    assert.equal(listInitiatives().length, initiativesBefore);

    const write = await fetch(`${baseUrl}/api/v1/public/sitemap/countries`, { method: "POST" });
    assert.equal(write.status, 404, "read-only route");
  });

  it("6. a failing source returns 503 with no inventory, no partial results and no writes", async (t) => {
    const mediaBefore = listMediaResourcesMemory().length;
    const affiliationsBefore = listCountryAffiliationsMemory().length;
    const initiativesBefore = listInitiatives().length;

    // Simulate a media data-source read failure through the real repository path:
    // a stored record whose fields cannot be read makes listMediaResources() throw.
    const poisoned = media("sb06-poisoned-read");
    upsertMediaResourceMemory(poisoned);
    Object.defineProperty(poisoned, "resourceType", {
      get() {
        throw new Error("simulated media store read failure");
      },
    });
    const logged = t.mock.method(console, "error", () => {});

    try {
      await assert.rejects(listPublicCountriesWithContent(), /simulated media store read failure/);

      const response = await fetch(`${baseUrl}/api/v1/public/sitemap/countries`);
      assert.equal(response.status, 503);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(body.success, false);
      assert.equal(body.data, null, "no inventory, not even an empty one");
      assert.equal(JSON.stringify(body).includes("entries"), false, "no partial results");
      assert.equal(
        JSON.stringify(body).includes('"CA"'),
        false,
        "initiative-derived codes not leaked",
      );
      assert.equal(
        response.headers.get("cache-control"),
        null,
        "failure is not cached as an inventory",
      );
      assert.ok(
        logged.mock.calls.some((call) => call.arguments[0] === "public_sitemap.countries_failed"),
      );
    } finally {
      deleteMediaResourceMemory("TRUSTED_MEDIA", "sb06-poisoned-read");
    }

    assert.equal(listMediaResourcesMemory().length, mediaBefore, "no writes and no media seeding");
    assert.equal(listCountryAffiliationsMemory().length, affiliationsBefore);
    assert.equal(listInitiatives().length, initiativesBefore);

    const recovered = await fetch(`${baseUrl}/api/v1/public/sitemap/countries`);
    assert.equal(recovered.status, 200, "recovers once the source is readable again");
  });

  it("7. region inventory still excludes demonstration records", () => {
    const regions = listPublicRegionsWithContent(
      listInitiatives().filter((record) => createdIds.includes(record.initiativeId)),
    );
    assert.deepEqual(
      regions.map((region) => `${region.countryCode}:${region.regionCode}`),
      ["CA:CA-BC"],
    );
  });
});
