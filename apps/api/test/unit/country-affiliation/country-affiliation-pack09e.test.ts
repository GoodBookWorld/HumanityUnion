/**
 * Pack 09E — Country Affiliations (team/partner CRUD, public projection).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  CountryAffiliationValidationError,
} from "../../../src/modules/country-affiliation/country-affiliation.errors.js";
import {
  activateAdminCountryAffiliation,
  createAdminCountryAffiliation,
  deactivateAdminCountryAffiliation,
  listPublicByCountry,
  setCountryAffiliationAdminAssertOverrideForTests,
  toPublicProjection,
} from "../../../src/modules/country-affiliation/country-affiliation.service.js";
import { resetCountryAffiliationsMemoryForTests } from "../../../src/modules/country-affiliation/persistence/country-affiliation.memory.store.js";
import {
  listCountryAffiliations,
  setCountryAffiliationForceMemoryForTests,
} from "../../../src/modules/country-affiliation/persistence/country-affiliation.repository.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function installAdminOverride(role: "admin" | "member" = "admin"): void {
  setCountryAffiliationAdminAssertOverrideForTests(async (userId) => {
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
  setCountryAffiliationForceMemoryForTests(true);
  resetCountryAffiliationsMemoryForTests();
  setCountryAffiliationAdminAssertOverrideForTests(null);
});

afterEach(() => {
  setCountryAffiliationAdminAssertOverrideForTests(null);
  resetCountryAffiliationsMemoryForTests();
  setCountryAffiliationForceMemoryForTests(false);
});

describe("Country Affiliation Pack 09E", () => {
  it("creates team members and partners", async () => {
    installAdminOverride("admin");

    const team = await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Alex Organizer",
      roleOrPosition: "Country Lead",
      email: "alex@example.com",
      sortOrder: 10,
    });
    assert.equal(team.entryType, "TEAM_MEMBER");
    assert.equal(team.countryCode, "CA");
    assert.equal(team.active, true);
    assert.equal(team.email, "alex@example.com");

    const partner = await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "PARTNER",
      name: "Civic Partner Org",
      websiteUrl: "https://partner.example/",
      imageUrl: "/media/partner.png",
      sortOrder: 20,
    });
    assert.equal(partner.entryType, "PARTNER");
    assert.equal(partner.websiteUrl, "https://partner.example/");
    assert.equal(partner.imageUrl, "/media/partner.png");

    const all = await listCountryAffiliations({ countryCode: "CA" });
    assert.equal(all.length, 2);
  });

  it("isolates entries by country", async () => {
    installAdminOverride("admin");

    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Canada Lead",
    });
    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "UA",
      entryType: "TEAM_MEMBER",
      name: "Ukraine Lead",
    });

    const canada = await listPublicByCountry("CA");
    assert.equal(canada.length, 1);
    assert.equal(canada[0]?.name, "Canada Lead");
    assert.equal(canada[0]?.countryCode, "CA");

    const ukraine = await listPublicByCountry("UA");
    assert.equal(ukraine.length, 1);
    assert.equal(ukraine[0]?.name, "Ukraine Lead");
    assert.equal(ukraine[0]?.countryCode, "UA");
  });

  it("excludes inactive entries from public listing", async () => {
    installAdminOverride("admin");

    const created = await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "PARTNER",
      name: "Visible Partner",
    });
    const before = await listPublicByCountry("CA");
    assert.ok(before.some((entry) => entry.entryId === created.entryId));

    await deactivateAdminCountryAffiliation({
      actorUserId: "admin-1",
      entryId: created.entryId,
    });
    const after = await listPublicByCountry("CA");
    assert.equal(
      after.some((entry) => entry.entryId === created.entryId),
      false,
    );

    const publicProjection = toPublicProjection({
      ...created,
      active: false,
    });
    assert.equal("active" in publicProjection, false);
    assert.equal("createdAt" in publicProjection, false);
    assert.equal("updatedAt" in publicProjection, false);
  });

  it("rejects invalid country codes", async () => {
    installAdminOverride("admin");

    await assert.rejects(
      () =>
        createAdminCountryAffiliation({
          actorUserId: "admin-1",
          countryCode: "ZZ",
          entryType: "TEAM_MEMBER",
          name: "Nobody",
        }),
      CountryAffiliationValidationError,
    );

    await assert.rejects(
      () =>
        createAdminCountryAffiliation({
          actorUserId: "admin-1",
          countryCode: "",
          entryType: "TEAM_MEMBER",
          name: "Nobody",
        }),
      CountryAffiliationValidationError,
    );
  });

  it("rejects invalid email addresses", async () => {
    installAdminOverride("admin");

    await assert.rejects(
      () =>
        createAdminCountryAffiliation({
          actorUserId: "admin-1",
          countryCode: "CA",
          entryType: "TEAM_MEMBER",
          name: "Bad Email",
          email: "not-an-email",
        }),
      CountryAffiliationValidationError,
    );
  });

  it("rejects non-admin actors", async () => {
    installAdminOverride("member");

    await assert.rejects(
      () =>
        createAdminCountryAffiliation({
          actorUserId: "member-1",
          countryCode: "CA",
          entryType: "TEAM_MEMBER",
          name: "Nope",
        }),
      AdministrationForbiddenError,
    );
  });

  it("activate and deactivate toggle public visibility", async () => {
    installAdminOverride("admin");

    const created = await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Toggle Person",
      active: false,
    });
    assert.equal(created.active, false);
    assert.equal((await listPublicByCountry("CA")).length, 0);

    const activated = await activateAdminCountryAffiliation({
      actorUserId: "admin-1",
      entryId: created.entryId,
    });
    assert.equal(activated.active, true);
    assert.equal((await listPublicByCountry("CA")).length, 1);

    const deactivated = await deactivateAdminCountryAffiliation({
      actorUserId: "admin-1",
      entryId: created.entryId,
    });
    assert.equal(deactivated.active, false);
    assert.equal((await listPublicByCountry("CA")).length, 0);
  });

  it("orders public results by sortOrder then name", async () => {
    installAdminOverride("admin");

    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Beta",
      sortOrder: 20,
    });
    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Alpha",
      sortOrder: 10,
    });
    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "TEAM_MEMBER",
      name: "Charlie",
      sortOrder: 10,
    });
    await createAdminCountryAffiliation({
      actorUserId: "admin-1",
      countryCode: "CA",
      entryType: "PARTNER",
      name: "Partner Z",
      sortOrder: 5,
    });

    const all = await listPublicByCountry("CA");
    assert.deepEqual(
      all.map((entry) => entry.name),
      ["Partner Z", "Alpha", "Charlie", "Beta"],
    );

    const teamOnly = await listPublicByCountry("CA", "TEAM_MEMBER");
    assert.deepEqual(
      teamOnly.map((entry) => entry.name),
      ["Alpha", "Charlie", "Beta"],
    );
  });

  it("wires admin routes, public route, and mongo collection key", () => {
    const appSource = read("apps/api/src/app.ts");
    const collections = read("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    const indexes = read("apps/api/src/infrastructure/mongodb/mongo-indexes.ts");
    const service = read(
      "apps/api/src/modules/country-affiliation/country-affiliation.service.ts",
    );
    const countryRoutes = read(
      "apps/api/src/modules/country-statistics/country-statistics.routes.ts",
    );
    const types = read("packages/types/src/domain/country-affiliation.ts");
    const adminAudit = read("packages/types/src/domain/administration.ts");

    assert.match(appSource, /\/api\/v1\/admin\/country-people/);
    assert.match(collections, /countryAffiliations:\s*"country_affiliations"/);
    assert.match(indexes, /country_affiliations_entry_id_unique/);
    assert.match(indexes, /country_affiliations_country_type_active/);
    assert.match(service, /role !== "admin"/);
    assert.match(countryRoutes, /\/countries\/:countryCode\/affiliations/);
    assert.match(types, /CountryAffiliationEntry/);
    assert.match(types, /CountryAffiliationPublic/);
    assert.match(adminAudit, /country_affiliation\.create/);
    assert.match(adminAudit, /country_affiliation\.delete/);
  });
});
