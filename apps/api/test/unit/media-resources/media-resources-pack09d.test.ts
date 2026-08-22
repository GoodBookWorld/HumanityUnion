/**
 * Pack 09D — Admin-managed Media Resources (seed, scope, CRUD, projections).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  MediaResourceConflictError,
  MediaResourceValidationError,
} from "../../../src/modules/media-resources/media-resource.errors.js";
import {
  createAdminMediaResource,
  deactivateAdminMediaResource,
  ensureMediaResourcesSeededOnce,
  listPublicCountryTrustedMedia,
  listPublicWorldFactChecking,
  listPublicWorldTrustedMedia,
  resetMediaResourceSeedStateForTests,
  setMediaResourceAdminAssertOverrideForTests,
} from "../../../src/modules/media-resources/media-resource.service.js";
import { buildMediaResourceSeedRecords } from "../../../src/modules/media-resources/media-resource.seed.js";
import { resetMediaResourcesMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  getMediaResourceById,
  listMediaResources,
  setMediaResourceForceMemoryForTests,
  upsertMediaResource,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { resetApprovedNewsSourcesCacheForTests } from "../../../src/modules/public-news/public-news.config.js";
import { projectFactCheckResources } from "../../../src/modules/media-resources/media-resource.projections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function installAdminOverride(role: "admin" | "member" = "admin"): void {
  setMediaResourceAdminAssertOverrideForTests(async (userId) => {
    if (!userId.trim()) {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    if (role !== "admin") {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return { userId, memberId: `member-${userId}` };
  });
}

beforeEach(() => {
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  setMediaResourceAdminAssertOverrideForTests(null);
});

afterEach(() => {
  setMediaResourceAdminAssertOverrideForTests(null);
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
});

describe("Media Resources Pack 09D", () => {
  it("seeds idempotently with stable ids", async () => {
    await ensureMediaResourcesSeededOnce();
    const first = await listMediaResources();
    assert.ok(first.length > 20);

    resetMediaResourceSeedStateForTests();
    await ensureMediaResourcesSeededOnce();
    const second = await listMediaResources();
    assert.equal(second.length, first.length);

    const reuters = await getMediaResourceById("reuters");
    assert.ok(reuters);
    assert.equal(reuters.resourceType, "TRUSTED_MEDIA");
    assert.equal(reuters.scopeType, "WORLD");

    const snopes = await getMediaResourceById("snopes");
    assert.ok(snopes);
    assert.equal(snopes.resourceType, "FACT_CHECKING");

    const cbc = await getMediaResourceById("cbc");
    assert.ok(cbc);
    assert.equal(cbc.scopeType, "COUNTRY");
    assert.equal(cbc.countryCode, "CA");
  });

  it("enforces WORLD/COUNTRY countryCode invariant on seed records", () => {
    const seeds = buildMediaResourceSeedRecords();
    for (const seed of seeds) {
      if (seed.scopeType === "WORLD") {
        assert.equal(seed.countryCode, null, seed.id);
      } else {
        assert.ok(seed.countryCode, seed.id);
        assert.match(seed.countryCode, /^[A-Z]{2}$/);
      }
    }
  });

  it("rejects WORLD create with countryCode and COUNTRY without", async () => {
    installAdminOverride("admin");
    await ensureMediaResourcesSeededOnce();

    await assert.rejects(
      () =>
        createAdminMediaResource({
          actorUserId: "admin-1",
          resourceType: "FACT_CHECKING",
          scopeType: "WORLD",
          countryCode: "CA",
          name: "Bad World",
          logoLabel: "BW",
          websiteUrl: "https://example-world-bad.test/",
          description: "mission",
          secondaryText: "coverage",
        }),
      MediaResourceValidationError,
    );

    await assert.rejects(
      () =>
        createAdminMediaResource({
          actorUserId: "admin-1",
          resourceType: "TRUSTED_MEDIA",
          scopeType: "COUNTRY",
          countryCode: null,
          name: "Bad Country",
          logoLabel: "BC",
          websiteUrl: "https://example-country-bad.test/",
          categoryId: "regional-public-media",
          description: "explanation",
          secondaryText: "Canada",
        }),
      MediaResourceValidationError,
    );
  });

  it("admin create and deactivate work; public projection filters inactive", async () => {
    installAdminOverride("admin");
    await ensureMediaResourcesSeededOnce();

    const created = await createAdminMediaResource({
      actorUserId: "admin-1",
      resourceType: "FACT_CHECKING",
      scopeType: "WORLD",
      name: "Pack09D Fact",
      logoLabel: "P9",
      websiteUrl: "https://pack09d-fact.example/",
      description: "mission text",
      secondaryText: "coverage text",
      sortOrder: 999,
    });
    assert.equal(created.active, true);

    const publicBefore = await listPublicWorldFactChecking();
    assert.ok(publicBefore.some((entry) => entry.id === created.id));

    const deactivated = await deactivateAdminMediaResource({
      actorUserId: "admin-1",
      id: created.id,
    });
    assert.equal(deactivated.active, false);

    const publicAfter = await listPublicWorldFactChecking();
    assert.equal(
      publicAfter.some((entry) => entry.id === created.id),
      false,
    );

    const allFact = await listMediaResources({ resourceType: "FACT_CHECKING" });
    const projectedActiveOnly = projectFactCheckResources(allFact);
    assert.equal(
      projectedActiveOnly.some((entry) => entry.id === created.id),
      false,
    );
  });

  it("rejects duplicate website for same type and scope", async () => {
    installAdminOverride("admin");
    await ensureMediaResourcesSeededOnce();

    await createAdminMediaResource({
      actorUserId: "admin-1",
      resourceType: "FACT_CHECKING",
      scopeType: "WORLD",
      name: "Dup A",
      logoLabel: "DA",
      websiteUrl: "https://www.pack09d-dup.example/path",
      description: "a",
      secondaryText: "b",
    });

    await assert.rejects(
      () =>
        createAdminMediaResource({
          actorUserId: "admin-1",
          resourceType: "FACT_CHECKING",
          scopeType: "WORLD",
          name: "Dup B",
          logoLabel: "DB",
          websiteUrl: "https://pack09d-dup.example/",
          description: "a",
          secondaryText: "b",
        }),
      MediaResourceConflictError,
    );
  });

  it("country trusted media filters by countryCode only", async () => {
    await ensureMediaResourcesSeededOnce();
    const canada = await listPublicCountryTrustedMedia("CA");
    assert.ok(canada.length > 0);
    assert.ok(canada.every((entry) => entry.countryCode === "CA"));

    const worldTrusted = await listPublicWorldTrustedMedia();
    assert.ok(worldTrusted.every((entry) => !entry.countryCode));
  });

  it("rejects non-admin actors", async () => {
    installAdminOverride("member");
    await ensureMediaResourcesSeededOnce();

    await assert.rejects(
      () =>
        createAdminMediaResource({
          actorUserId: "member-1",
          resourceType: "FACT_CHECKING",
          scopeType: "WORLD",
          name: "Nope",
          logoLabel: "N",
          websiteUrl: "https://pack09d-nonadmin.example/",
          description: "x",
          secondaryText: "y",
        }),
      AdministrationForbiddenError,
    );
  });

  it("wires admin routes and mongo collection key", () => {
    const appSource = read("apps/api/src/app.ts");
    const collections = read("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    const indexes = read("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
    const service = read("apps/api/src/modules/media-resources/media-resource.service.ts");

    assert.match(appSource, /\/api\/v1\/admin\/media-resources/);
    assert.match(collections, /mediaResources:\s*"media_resources"/);
    assert.match(indexes, /media_resources_id_unique/);
    assert.match(service, /role !== "admin"/);
  });
});
