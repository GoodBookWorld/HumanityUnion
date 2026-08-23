/**
 * Pack 12A — Editor grants unit tests (scope + eligibility + architecture contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EDITOR_CAPABILITY_IDS } from "@hu/types";

import {
  contentMatchesEditorScope,
  formatEditorGeographicScope,
  normalizeEditorGeographicScope,
} from "../../../src/modules/editor-grants/editor-grant.scope.js";
import { normalizeEditorCapabilities } from "../../../src/modules/editor-grants/editor-grant.authorization.js";
import { AdministrationValidationError } from "../../../src/modules/administration/administration.errors.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12A — architecture contracts", () => {
  it("does not add editor as AuthUserAccountRole", () => {
    const authUser = readRepo("packages/types/src/domain/auth-user.ts");
    assert.match(authUser, /Extract<AuthRole, "member" \| "admin">/);
    assert.doesNotMatch(authUser, /"editor"/);

    const gate = readRepo("apps/web/src/features/administration/components/AdminAccessGate.tsx");
    assert.match(gate, /isAdminAccountRole/);
    assert.doesNotMatch(gate, /isEligibleForEditorPanel|editor\.status/);
  });

  it("registers stable editor_grants collection only", () => {
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /editorGrants:\s*"editor_grants"/);
    assert.doesNotMatch(collections, /editor_\$\{|country_editor_|editor_<|editor_grants_/);
  });

  it("exposes Admin Editors routes and mounts them under /api/v1/admin/editors", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/editors/);
    assert.match(app, /adminEditorGrantsRouter/);
  });
});

describe("Pack 12A — capability IDs", () => {
  it("uses stable IDs not display labels for authorization", () => {
    assert.deepEqual([...EDITOR_CAPABILITY_IDS], [
      "INITIATIVE_EDIT",
      "INITIATIVE_MODERATE",
      "PUBLIC_CHOICE_EDIT",
      "PUBLIC_CHOICE_MODERATE",
      "PUBLISHING_EDIT",
      "MEDIA_RESOURCE_EDIT",
      "COUNTRY_PEOPLE_EDIT",
      "BETA_ACCESS_EDIT",
    ]);

    assert.deepEqual(normalizeEditorCapabilities(["MEDIA_RESOURCE_EDIT", "INITIATIVE_EDIT"]), [
      "INITIATIVE_EDIT",
      "MEDIA_RESOURCE_EDIT",
    ]);

    assert.throws(
      () => normalizeEditorCapabilities(["Initiatives" as never]),
      AdministrationValidationError,
    );

    assert.throws(
      () => normalizeEditorCapabilities(["PUBLISHING_EDIT"]),
      AdministrationValidationError,
    );
  });
});

describe("Pack 12A — geographic scope", () => {
  it("WORLD allows all; COUNTRY/REGION/CITY constrain and deny unclassified content", () => {
    const world = normalizeEditorGeographicScope({ level: "WORLD" });
    assert.equal(contentMatchesEditorScope(world, {}), true);
    assert.equal(contentMatchesEditorScope(world, { countryCode: "UA" }), true);

    const country = normalizeEditorGeographicScope({ level: "COUNTRY", countryCode: "CA" });
    assert.equal(contentMatchesEditorScope(country, { countryCode: "CA" }), true);
    assert.equal(contentMatchesEditorScope(country, { countryCode: "UA" }), false);
    assert.equal(contentMatchesEditorScope(country, {}), false);

    const region = normalizeEditorGeographicScope({
      level: "REGION",
      countryCode: "CA",
      regionCode: "BC",
    });
    assert.equal(
      contentMatchesEditorScope(region, { countryCode: "CA", regionCode: "BC" }),
      true,
    );
    assert.equal(
      contentMatchesEditorScope(region, { countryCode: "CA", regionCode: "ON" }),
      false,
    );

    const city = normalizeEditorGeographicScope({
      level: "CITY",
      countryCode: "CA",
      regionCode: "BC",
      communityCode: "nelson",
    });
    assert.equal(
      contentMatchesEditorScope(city, {
        countryCode: "CA",
        regionCode: "BC",
        communityCode: "nelson",
      }),
      true,
    );
    assert.equal(
      contentMatchesEditorScope(city, {
        countryCode: "CA",
        regionCode: "BC",
        communityCode: "vancouver",
      }),
      false,
    );

    const presented = formatEditorGeographicScope(country);
    assert.equal(presented.levelLabel, "Country");
    assert.equal(presented.summary, "Canada");
  });

  it("rejects incomplete hierarchical scope", () => {
    assert.throws(
      () => normalizeEditorGeographicScope({ level: "COUNTRY" }),
      AdministrationValidationError,
    );
    assert.throws(
      () =>
        normalizeEditorGeographicScope({
          level: "REGION",
          countryCode: "CA",
        }),
      AdministrationValidationError,
    );
  });
});
