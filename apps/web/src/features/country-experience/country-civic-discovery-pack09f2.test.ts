/**
 * Country Civic Discovery Pack 09F2 — Action placement + rails + Entity Type.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS,
  resolveCountryDiscoveryScope,
  resolveCountrySearchFilterParams,
} from "./country-discovery-entity-types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");
const repoRoot = path.resolve(webRoot, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.join(repoRoot, "apps/api/src", relativePath), "utf8");
}

describe("Country Civic Discovery Pack 09F2 — layout", () => {
  it("places Country Action directly below Search card; removes duplicate old Action block", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const bodyStart = page.indexOf("return (");
    const searchIdx = page.indexOf("country-experience-dynamic__search-card", bodyStart);
    const actionIdx = page.indexOf("<CountryCivicActionSection", bodyStart);
    const mediaIdx = page.indexOf("country-media-", bodyStart);
    const teamIdx = page.indexOf("<CountryTeamSection", bodyStart);
    const partnersIdx = page.indexOf("<CountryPartnersSection", bodyStart);
    const statsIdx = page.indexOf("country-statistics-title", bodyStart);

    assert.ok(searchIdx > 0);
    assert.ok(actionIdx > searchIdx);
    assert.ok(mediaIdx > actionIdx);
    assert.ok(statsIdx > 0 && teamIdx > statsIdx && partnersIdx > teamIdx);
    assert.ok(partnersIdx < searchIdx);
    assert.doesNotMatch(page, /sectionId=\{`country-initiatives-/);
    assert.match(page, /CountryCivicActionSection/);
  });

  it("Team/Partners remain after Statistics and before Search", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const bodyStart = page.indexOf("return (");
    const order = [
      "country-statistics-title",
      "<CountryTeamSection",
      "<CountryPartnersSection",
      "country-search-title",
      "<CountryCivicActionSection",
      "country-media-",
    ];
    let previous = bodyStart;
    for (const token of order) {
      const idx = page.indexOf(token, bodyStart);
      assert.ok(idx > previous, `${token} out of order`);
      previous = idx;
    }
  });
});

describe("Country Civic Discovery Pack 09F2 — Entity Type", () => {
  it("exposes All / Standard Initiatives / Public Choice and maps to lifecycleProfile", () => {
    const labels = COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS.map((option) => option.label);
    assert.ok(labels.includes("All"));
    assert.ok(labels.includes("Standard Initiatives"));
    assert.ok(labels.includes("Public Choice"));
    assert.deepEqual(resolveCountrySearchFilterParams("standard_initiatives"), {
      entityType: "initiative",
      lifecycleProfile: "STANDARD",
    });
    assert.deepEqual(resolveCountrySearchFilterParams("public_choice"), {
      entityType: "initiative",
      lifecycleProfile: "PUBLIC_CHOICE",
    });
    assert.deepEqual(resolveCountrySearchFilterParams(""), {});
    assert.deepEqual(resolveCountrySearchFilterParams("petition"), {
      entityType: "petition",
    });
  });

  it("Country page Entity Type uses discovery options and lifecycleProfile query", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    assert.match(page, /COUNTRY_DISCOVERY_ENTITY_TYPE_OPTIONS/);
    assert.match(page, /resolveCountrySearchFilterParams/);
    assert.match(page, /lifecycleProfile/);
    assert.doesNotMatch(page, /Initiative type/);
  });
});

describe("Country Civic Discovery Pack 09F2 — rails and context", () => {
  it("resolves City > Region > Country scope", () => {
    assert.equal(
      resolveCountryDiscoveryScope({ regionCode: "", communityCode: "" }),
      "country",
    );
    assert.equal(
      resolveCountryDiscoveryScope({ regionCode: "CA-BC", communityCode: "" }),
      "region",
    );
    assert.equal(
      resolveCountryDiscoveryScope({ regionCode: "CA-BC", communityCode: "16146" }),
      "city",
    );
  });

  it("Civic Action renders Initiatives + Elections rails with contextual headings", () => {
    const action = readWeb(
      "features/country-experience/components/CountryCivicActionSection.tsx",
    );
    assert.match(action, /Country Initiatives/);
    assert.match(action, /Country Elections/);
    assert.match(action, /Region Initiatives/);
    assert.match(action, /Region Elections/);
    assert.match(action, /City Initiatives/);
    assert.match(action, /City Elections/);
    assert.match(action, /Civic Action/);
    assert.match(action, /lifecycleProfile: "STANDARD"/);
    assert.match(action, /lifecycleProfile: "PUBLIC_CHOICE"/);
    assert.match(action, /No initiatives found in/);
    assert.match(action, /No elections found in/);
    assert.match(action, /CountryInitiativeRailCard/);
    assert.match(action, /CountryElectionRailCard/);
  });

  it("Election card uses Public Choice status/candidates and blocked presentation", () => {
    const card = readWeb(
      "features/country-experience/components/CountryElectionRailCard.tsx",
    );
    assert.match(card, /electionVotingStatusLabel/);
    assert.match(card, /candidateCount/);
    assert.match(card, /administrativelyBlocked/);
    assert.match(card, /View Election/);
    assert.match(card, /Unavailable — administratively blocked/);
  });
});

describe("Country Civic Discovery Pack 09F2 — API geography filters", () => {
  it("country initiatives endpoint accepts region/community/lifecycleProfile", () => {
    const routes = readApi("modules/country-statistics/country-statistics.routes.ts");
    const service = readApi("modules/country-statistics/country-public.service.ts");
    assert.match(routes, /lifecycleProfile/);
    assert.match(routes, /req\.query\.region/);
    assert.match(routes, /req\.query\.community/);
    assert.match(service, /matchesCountryDiscoveryGeography/);
    assert.match(service, /PUBLIC_CHOICE/);
    assert.match(service, /resolvePublicChoiceElectionVotingStatus/);
    assert.match(service, /participationScope[\s\S]*world/);
  });

  it("global search client forwards lifecycleProfile", () => {
    const api = readWeb("features/global-search/api.ts");
    const page = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    assert.match(api, /lifecycleProfile/);
    assert.match(page, /lifecycleProfile/);
    assert.match(page, /params\.set\("lifecycleProfile"/);
  });
});
