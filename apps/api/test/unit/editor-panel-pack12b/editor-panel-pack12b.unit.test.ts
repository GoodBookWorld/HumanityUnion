/**
 * Pack 12B — Editor Panel scope filtering + enforcement contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  betaAccessCompatibleWithEditorScope,
  countryAffiliationCompatibleWithEditorScope,
  initiativeContentGeography,
  mediaResourceCompatibleWithEditorScope,
} from "../../../src/modules/editor-grants/editor-content-geography.js";
import { contentMatchesEditorScope } from "../../../src/modules/editor-grants/editor-grant.scope.js";
import { normalizeEditorGeographicScope } from "../../../src/modules/editor-grants/editor-grant.scope.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 12B — architecture wiring", () => {
  it("mounts Editor Panel under /api/v1/workspace/editor", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/workspace\/editor/);
    assert.match(app, /editorPanelRouter/);
  });

  it("dual-auths Media activate/deactivate and Country People mutations", () => {
    const media = readRepo("apps/api/src/modules/media-resources/media-resource.service.ts");
    assert.match(media, /assertMediaMutationActor/);
    assert.match(media, /MEDIA_RESOURCE_EDIT/);

    const country = readRepo(
      "apps/api/src/modules/country-affiliation/country-affiliation.service.ts",
    );
    assert.match(country, /assertCountryPeopleMutationActor/);
    assert.match(country, /COUNTRY_PEOPLE_EDIT/);
  });

  it("Public Choice candidate update allows Editors with scope checks", () => {
    const service = readRepo(
      "apps/api/src/modules/public-choice-candidate/public-choice-candidate.service.ts",
    );
    assert.match(service, /assertEditorMayMutatePublicChoiceElection/);
  });
});

describe("Pack 12B — scope compatibility policy", () => {
  it("filters Initiative geography; denies unclassified for COUNTRY Editors", () => {
    const country = normalizeEditorGeographicScope({ level: "COUNTRY", countryCode: "CA" });
    assert.equal(
      contentMatchesEditorScope(
        country,
        initiativeContentGeography({ countrySlug: "CA", regionSlug: "BC" }),
      ),
      true,
    );
    assert.equal(
      contentMatchesEditorScope(country, initiativeContentGeography({ countrySlug: "UA" })),
      false,
    );
    assert.equal(contentMatchesEditorScope(country, initiativeContentGeography({})), false);
  });

  it("Media/CountryPeople incompatible with REGION/CITY; Beta only WORLD", () => {
    const region = normalizeEditorGeographicScope({
      level: "REGION",
      countryCode: "CA",
      regionCode: "BC",
    });
    const world = normalizeEditorGeographicScope({ level: "WORLD" });
    const country = normalizeEditorGeographicScope({ level: "COUNTRY", countryCode: "CA" });

    assert.equal(
      mediaResourceCompatibleWithEditorScope(region, {
        scopeType: "COUNTRY",
        countryCode: "CA",
      }),
      false,
    );
    assert.equal(
      mediaResourceCompatibleWithEditorScope(country, {
        scopeType: "WORLD",
        countryCode: null,
      }),
      false,
    );
    assert.equal(
      mediaResourceCompatibleWithEditorScope(country, {
        scopeType: "COUNTRY",
        countryCode: "CA",
      }),
      true,
    );
    assert.equal(countryAffiliationCompatibleWithEditorScope(region, "CA"), false);
    assert.equal(countryAffiliationCompatibleWithEditorScope(country, "CA"), true);
    assert.equal(betaAccessCompatibleWithEditorScope(world), true);
    assert.equal(betaAccessCompatibleWithEditorScope(country), false);
  });
});
