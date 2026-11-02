/**
 * REGION-500B.3 — GET /api/v1/public/sitemap/regions lists only canonical
 * registry regions that have public regional initiatives, using the same
 * rules as the region projection (REGION-500B.1).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Initiative } from "@hu/types";

import {
  buildRegionPublicProjection,
  listPublicRegionsWithContent,
} from "../../../src/modules/country-statistics/region-public.service.js";
import {
  resetGlobalSearchIndexForTests,
  setGlobalSearchIndexForTests,
} from "../../../src/modules/global-search/global-search.index.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import publicSitemapRouter from "../../../src/modules/sitemap/public-sitemap.routes.js";

const STEWARD_ID = "r5b3-steward-private-id";
const createdIds: string[] = [];

function initiative(
  initiativeId: string,
  updatedAt: string,
  overrides: Partial<Initiative> & { metadata?: Partial<Initiative["metadata"]> } = {},
): Initiative {
  const { metadata, ...rest } = overrides;
  return {
    initiativeId,
    stewardId: STEWARD_ID,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt,
    title: `R5B3 ${initiativeId}`,
    description: "Region sitemap fixture.",
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
      participationScope: "region",
      countrySlug: "CA",
      regionSlug: "CA-BC",
      ...metadata,
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...rest,
  };
}

function track(record: Initiative): void {
  createdIds.push(record.initiativeId);
  createInitiative(record);
}

before(() => {
  setGlobalSearchIndexForTests([]);
  track(initiative("r5b3-bc-old", "2026-10-02T00:00:00.000Z"));
  track(initiative("r5b3-bc-new", "2026-10-20T00:00:00.000Z", { metadata: { regionSlug: "BC" } }));
  track(
    initiative("r5b3-ga", "2026-10-05T00:00:00.000Z", {
      metadata: { countrySlug: "US", regionSlug: "US-GA" },
    }),
  );
  // Never listed: private, unprojected, blocked, World scope, demonstration, no/unknown region.
  track(
    initiative("r5b3-on-private", "2026-10-03T00:00:00.000Z", {
      visibility: { policy: "private" },
      metadata: { regionSlug: "CA-ON" },
    }),
  );
  track(
    initiative("r5b3-qc-draft", "2026-10-03T00:00:00.000Z", {
      lifecyclePhase: "draft",
      metadata: { regionSlug: "CA-QC" },
    }),
  );
  track(
    initiative("r5b3-ab-blocked", "2026-10-03T00:00:00.000Z", {
      administrativelyBlocked: true,
      metadata: { regionSlug: "CA-AB" },
    }),
  );
  track(
    initiative("r5b3-mb-world", "2026-10-03T00:00:00.000Z", {
      metadata: { participationScope: "world", regionSlug: "CA-MB" },
    }),
  );
  track(
    initiative("initiative-bootstrap-r5b3", "2026-10-03T00:00:00.000Z", {
      metadata: { regionSlug: "CA-SK" },
    }),
  );
  track(
    initiative("r5b3-country-only", "2026-10-03T00:00:00.000Z", {
      metadata: { participationScope: "country", regionSlug: "" },
    }),
  );
  track(
    initiative("r5b3-unknown-region", "2026-10-03T00:00:00.000Z", {
      metadata: { regionSlug: "Atlantis" },
    }),
  );
});

after(() => {
  for (const initiativeId of createdIds) {
    deleteInitiative(initiativeId);
  }
  resetGlobalSearchIndexForTests();
});

describe("REGION-500B.3 — region sitemap inventory", () => {
  it("lists only canonical regions with public regional initiatives", () => {
    assert.deepEqual(listPublicRegionsWithContent(), [
      {
        countryCode: "CA",
        regionCode: "CA-BC",
        initiativeCount: 2,
        updatedAt: "2026-10-20T00:00:00.000Z",
      },
      {
        countryCode: "US",
        regionCode: "US-GA",
        initiativeCount: 1,
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
    ]);
  });

  it("matches the region projection for every listed region and excluded region", async () => {
    for (const entry of listPublicRegionsWithContent()) {
      const payload = await buildRegionPublicProjection(entry.countryCode, entry.regionCode);
      assert.equal(
        payload?.projections.latestInitiatives.initiatives.length,
        entry.initiativeCount,
      );
    }
    for (const [country, region] of [
      ["CA", "CA-ON"],
      ["CA", "CA-QC"],
      ["CA", "CA-AB"],
      ["CA", "CA-MB"],
      ["CA", "CA-SK"],
    ]) {
      const payload = await buildRegionPublicProjection(country as string, region as string);
      assert.deepEqual(payload?.projections.latestInitiatives.initiatives, [], region);
    }
  });

  it("returns nothing for an empty store", () => {
    assert.deepEqual(listPublicRegionsWithContent([]), []);
  });
});

describe("REGION-500B.3 — GET /api/v1/public/sitemap/regions", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    const app = express();
    app.use("/api/v1/public/sitemap", publicSitemapRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns canonical codes and dates only", async () => {
    const response = await fetch(`${baseUrl}/api/v1/public/sitemap/regions`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const text = await response.text();
    const body = JSON.parse(text) as {
      success: boolean;
      data: { entries: Array<Record<string, string>> };
      meta: { total: number };
    };
    assert.equal(body.success, true);
    assert.equal(body.meta.total, 2);
    assert.deepEqual(body.data.entries, [
      { countryCode: "CA", regionCode: "CA-BC", updatedAt: "2026-10-20T00:00:00.000Z" },
      { countryCode: "US", regionCode: "US-GA", updatedAt: "2026-10-05T00:00:00.000Z" },
    ]);
    for (const forbidden of [
      STEWARD_ID,
      "stewardId",
      "r5b3-",
      "initiative-bootstrap",
      "CA-ON",
      "CA-MB",
    ]) {
      assert.equal(text.includes(forbidden), false, forbidden);
    }
  });
});
