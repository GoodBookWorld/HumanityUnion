/**
 * REGION-500B.1 — GET /api/v1/public/countries/:cc/regions/:regionCode.
 * Real public records only: registry identity, ordinary-public initiatives of the
 * region (World scope excluded), published linked records from the search index,
 * and communities that have public initiatives.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { CivicEntityType, Initiative, RegionExperiencePublicProjections } from "@hu/types";

import countryStatisticsRouter from "../../../src/modules/country-statistics/country-statistics.routes.js";
import {
  buildRegionPublicProjection,
  resolvePublicRegion,
} from "../../../src/modules/country-statistics/region-public.service.js";
import {
  resetGlobalSearchIndexForTests,
  setGlobalSearchIndexForTests,
} from "../../../src/modules/global-search/global-search.index.js";
import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const STEWARD_ID = "r5b1-steward-private-id";
const createdIds: string[] = [];

function initiative(
  initiativeId: string,
  overrides: Partial<Initiative> & { metadata?: Partial<Initiative["metadata"]> } = {},
): Initiative {
  const now = "2026-11-01T00:00:00.000Z";
  const { metadata, ...rest } = overrides;
  return {
    initiativeId,
    stewardId: STEWARD_ID,
    createdAt: now,
    updatedAt: now,
    title: `R5B1 ${initiativeId}`,
    description: "Region projection fixture.",
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

function indexEntry(
  entityType: CivicEntityType,
  entityId: string,
  initiativeId: string,
): GlobalSearchIndexEntry {
  return {
    entityType,
    entityId,
    title: `R5B1 ${entityType} ${entityId}`,
    summary: "",
    country: "CA",
    region: "CA-BC",
    community: "",
    activityArea: "",
    status: "published",
    publicUrl: `/initiatives/public/${initiativeId}`,
    updatedAt: "2026-11-01T00:00:00.000Z",
    initiativeId,
    normalizedTitle: entityId,
    normalizedSummary: "",
    normalizedCountry: "ca",
    normalizedRegion: "ca-bc",
    normalizedCommunity: "",
    normalizedActivityArea: "",
    normalizedStatus: "published",
    normalizedEntityType: entityType,
    normalizedCountryLabel: "",
    normalizedRegionLabel: "",
    normalizedCountryCode: "ca",
    normalizedRegionCode: "ca-bc",
    normalizedTranslatedTitles: {},
    normalizedTranslatedSummaries: {},
    normalizedTerminologyAliasesByLanguage: {},
  };
}

function indicator(projections: RegionExperiencePublicProjections, id: string): number | undefined {
  return projections.statistics.indicators.find((entry) => entry.id === id)?.value;
}

function stage(
  projections: RegionExperiencePublicProjections,
  stageId: string,
): number | undefined {
  return projections.pipeline.stages.find((entry) => entry.stageId === stageId)?.count;
}

before(() => {
  // Public British Columbia initiatives (one in Nelson, one stored with the local code).
  track(initiative("r5b1-bc-nelson", { metadata: { communitySlug: "16735" } }));
  track(initiative("r5b1-bc-local-code", { metadata: { regionSlug: "BC" } }));
  // Not public, not regional, or demonstration — must never appear.
  track(initiative("r5b1-bc-private", { visibility: { policy: "private" } }));
  track(initiative("r5b1-bc-draft", { lifecyclePhase: "draft" }));
  track(initiative("r5b1-bc-blocked", { administrativelyBlocked: true }));
  track(initiative("r5b1-bc-world", { metadata: { participationScope: "world" } }));
  track(initiative("initiative-bootstrap-r5b1", { metadata: { communitySlug: "16536" } }));
  track(
    initiative("r5b1-bc-unknown-community", {
      metadata: { communitySlug: "nelson-community-garden" },
    }),
  );
  // Other regions.
  track(initiative("r5b1-on", { metadata: { regionSlug: "CA-ON" } }));
  track(initiative("r5b1-us-ca", { metadata: { countrySlug: "US", regionSlug: "US-CA" } }));

  setGlobalSearchIndexForTests([
    indexEntry("initiative", "r5b1-bc-nelson", "r5b1-bc-nelson"),
    indexEntry("initiative_revision", "r5b1-bc-nelson::1", "r5b1-bc-nelson"),
    indexEntry("analysis", "r5b1-analysis-1", "r5b1-bc-nelson"),
    indexEntry("analysis", "r5b1-analysis-2", "r5b1-bc-local-code"),
    indexEntry("collective_decision", "r5b1-decision-1", "r5b1-bc-nelson"),
    indexEntry("petition", "r5b1-petition-1", "r5b1-bc-local-code"),
    indexEntry("implementation_commitment", "r5b1-commitment-1", "r5b1-bc-nelson"),
    indexEntry("official_response", "r5b1-response-1", "r5b1-bc-nelson"),
    // Linked to excluded initiatives or another region — must not be counted.
    indexEntry("analysis", "r5b1-analysis-private", "r5b1-bc-private"),
    indexEntry("petition", "r5b1-petition-blocked", "r5b1-bc-blocked"),
    indexEntry("analysis", "r5b1-analysis-world", "r5b1-bc-world"),
    indexEntry("analysis", "r5b1-analysis-demo", "initiative-bootstrap-r5b1"),
    indexEntry("analysis", "r5b1-analysis-on", "r5b1-on"),
  ]);
});

after(() => {
  for (const initiativeId of createdIds) {
    deleteInitiative(initiativeId);
  }
  resetGlobalSearchIndexForTests();
});

describe("REGION-500B.1 — region resolution", () => {
  it("resolves the canonical ISO code from code, case, local code, name and slug", () => {
    for (const input of ["CA-BC", "ca-bc", "BC", "British Columbia", "british-columbia"]) {
      assert.deepEqual(resolvePublicRegion("CA", input), {
        countryCode: "CA",
        countryName: "Canada",
        regionCode: "CA-BC",
        regionName: "British Columbia",
        administrativeType: "province",
      });
    }
    assert.equal(resolvePublicRegion("ca", "CA-BC")?.regionCode, "CA-BC");
  });

  it("rejects unknown regions, other-country regions and unknown countries", () => {
    assert.equal(resolvePublicRegion("CA", "CA-ZZ"), null);
    assert.equal(resolvePublicRegion("CA", "atlantis"), null);
    assert.equal(resolvePublicRegion("CA", "other-not-listed"), null);
    assert.equal(resolvePublicRegion("US", "CA-BC"), null);
    assert.equal(resolvePublicRegion("FR", "CA-ON"), null);
    assert.equal(resolvePublicRegion("XX", "CA-BC"), null);
    assert.equal(resolvePublicRegion("CA", ""), null);
  });
});

describe("REGION-500B.1 — CA-BC projection", () => {
  it("returns registry identity without demonstration content", async () => {
    const payload = await buildRegionPublicProjection("CA", "CA-BC");
    assert.ok(payload);
    assert.equal(payload.canonical, true);
    const { identity } = payload.projections;
    assert.equal(identity.slug, "CA-BC");
    assert.equal(identity.regionCode, "CA-BC");
    assert.equal(identity.name, "British Columbia");
    assert.equal(identity.countryCode, "CA");
    assert.equal(identity.countrySlug, "CA");
    assert.equal(identity.countryLabel, "Canada");
    assert.equal(identity.administrativeType, "province");
    assert.equal(identity.description, "");
    assert.equal(identity.source, "projection");
    for (const section of [
      "statistics",
      "pipeline",
      "latestInitiatives",
      "communityCatalog",
    ] as const) {
      assert.equal(payload.projections[section].source, "projection");
    }
  });

  it("lists only ordinary-public, non-World, non-demonstration initiatives of the region", async () => {
    const payload = await buildRegionPublicProjection("CA", "CA-BC");
    assert.ok(payload);
    const ids = payload.projections.latestInitiatives.initiatives.map((card) => card.initiativeId);
    assert.deepEqual(
      [...ids].sort(),
      ["r5b1-bc-local-code", "r5b1-bc-nelson", "r5b1-bc-unknown-community"].sort(),
    );
    const card = payload.projections.latestInitiatives.initiatives.find(
      (entry) => entry.initiativeId === "r5b1-bc-nelson",
    );
    assert.equal(card?.publicRouteStatus, "active");
    assert.equal(card?.publicInitiativeHref, "/initiatives/public/r5b1-bc-nelson");
    assert.deepEqual(card?.relatedPublicLinks, []);
    assert.equal(payload.projections.latestInitiatives.scope, "region");
  });

  it("counts statistics and pipeline from public linked records only", async () => {
    const payload = await buildRegionPublicProjection("CA", "CA-BC");
    assert.ok(payload);
    const { projections } = payload;
    assert.equal(indicator(projections, "region-initiatives"), 3);
    assert.equal(indicator(projections, "region-collaborative-analyses"), 2);
    assert.equal(indicator(projections, "region-collective-decisions"), 1);
    assert.equal(indicator(projections, "region-petitions"), 1);
    assert.equal(indicator(projections, "region-official-responses"), 1);
    assert.equal(indicator(projections, "region-civic-action-packages"), 0);
    assert.equal(indicator(projections, "region-civic-archive"), 0);
    assert.equal(indicator(projections, "region-communities"), 1);
    assert.ok(projections.statistics.indicators.every((entry) => entry.derived === false));

    assert.equal(stage(projections, "initiative"), 3);
    assert.equal(stage(projections, "collaborative-analysis"), 2);
    assert.equal(stage(projections, "collective-decision"), 1);
    assert.equal(stage(projections, "petition"), 1);
    assert.equal(stage(projections, "implementation-commitment"), 1);
    assert.equal(stage(projections, "implementation"), 0);
  });

  it("lists only registry communities that have public initiatives", async () => {
    const payload = await buildRegionPublicProjection("CA", "CA-BC");
    assert.ok(payload);
    assert.deepEqual(payload.projections.communityCatalog.communities, [
      {
        slug: "16735",
        name: "Nelson",
        description: "",
        activityArea: "",
        regionLabel: "British Columbia",
        countryLabel: "Canada",
        regionSlug: "CA-BC",
        countrySlug: "CA",
        initiativeCount: 1,
        communityHref: "/search?country=CA&region=CA-BC&community=16735",
        communityRouteStatus: "active",
      },
    ]);
  });

  it("marks non-canonical input and still returns the canonical code", async () => {
    const payload = await buildRegionPublicProjection("ca", "british-columbia");
    assert.ok(payload);
    assert.equal(payload.canonical, false);
    assert.equal(payload.projections.identity.regionCode, "CA-BC");
  });
});

describe("REGION-500B.1 — empty region", () => {
  it("returns an empty but valid projection for a region without activity", async () => {
    const payload = await buildRegionPublicProjection("CA", "CA-NU");
    assert.ok(payload);
    const { projections } = payload;
    assert.equal(projections.identity.name, "Nunavut");
    assert.equal(projections.identity.administrativeType, "territory");
    assert.deepEqual(projections.latestInitiatives.initiatives, []);
    assert.deepEqual(projections.communityCatalog.communities, []);
    assert.ok(projections.statistics.indicators.length > 0);
    assert.ok(projections.statistics.indicators.every((entry) => entry.value === 0));
    assert.ok(projections.pipeline.stages.every((entry) => entry.count === 0));
  });
});

describe("REGION-500B.1 — HTTP route", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    const app = express();
    app.use("/api/v1/public", countryStatisticsRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/public`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function get(path: string) {
    const response = await fetch(`${baseUrl}${path}`);
    const text = await response.text();
    return { status: response.status, text, body: JSON.parse(text) as Record<string, unknown> };
  }

  it("returns the CA-BC projection with canonical metadata", async () => {
    const { status, body } = await get("/countries/CA/regions/CA-BC");
    assert.equal(status, 200);
    assert.equal(body.success, true);
    const meta = body.meta as Record<string, unknown>;
    assert.equal(meta.regionCode, "CA-BC");
    assert.equal(meta.regionName, "British Columbia");
    assert.equal(meta.countryCode, "CA");
    assert.equal(meta.administrativeType, "province");
    assert.equal(meta.canonical, true);
    const data = body.data as RegionExperiencePublicProjections;
    assert.equal(data.identity.regionCode, "CA-BC");
    assert.equal(data.latestInitiatives.initiatives.length, 3);
  });

  it("returns 404 for unknown regions, mismatched pairs and unknown countries", async () => {
    for (const path of [
      "/countries/CA/regions/CA-ZZ",
      "/countries/US/regions/CA-BC",
      "/countries/CA/regions/other-not-listed",
      "/countries/XX/regions/CA-BC",
    ]) {
      const { status, body } = await get(path);
      assert.equal(status, 404, path);
      assert.equal(body.success, false, path);
      assert.equal(body.data, null, path);
    }
  });

  it("resolves another country's region by its own code", async () => {
    const { status, body } = await get("/countries/US/regions/US-CA");
    assert.equal(status, 200);
    const data = body.data as RegionExperiencePublicProjections;
    assert.equal(data.identity.name, "California");
    assert.deepEqual(
      data.latestInitiatives.initiatives.map((card) => card.initiativeId),
      ["r5b1-us-ca"],
    );
  });

  it("never exposes private, demonstration or participant data", async () => {
    const { text } = await get("/countries/CA/regions/CA-BC");
    for (const forbidden of [
      STEWARD_ID,
      "stewardId",
      "r5b1-bc-private",
      "r5b1-bc-draft",
      "r5b1-bc-blocked",
      "r5b1-bc-world",
      "initiative-bootstrap",
      "nelson-community-garden",
      "Demonstration",
      "email",
      "participantId",
    ]) {
      assert.equal(text.includes(forbidden), false, `response must not contain ${forbidden}`);
    }
  });
});
