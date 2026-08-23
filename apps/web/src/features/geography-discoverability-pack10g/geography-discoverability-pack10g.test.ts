/**
 * Pack 10G — City select discoverability & large-list UX.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CITY_REQUIRE_SEARCH_ABOVE,
  formatLargeCitySearchHelper,
  GEOGRAPHY_EMPTY_COPY,
} from "../geography-integrity/geography-cascade-contract";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 10G — city select large-list discoverability", () => {
  it("exposes distinct city UX copy for loading / large / empty / no-match / failure", () => {
    assert.match(GEOGRAPHY_EMPTY_COPY.loadingCities, /Loading cities and communities/);
    assert.match(GEOGRAPHY_EMPTY_COPY.citySearchPlaceholder, /Search for a city or community/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCities, /No cities or communities are listed/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCityMatches, /No matching cities or communities found/);
    assert.match(GEOGRAPHY_EMPTY_COPY.cityDeliveryFailure, /City data could not be loaded/);
    assert.match(GEOGRAPHY_EMPTY_COPY.selectRegionFirst, /Select a region to choose a city/);
    assert.equal(CITY_REQUIRE_SEARCH_ABOVE, 80);
    assert.equal(
      formatLargeCitySearchHelper(139),
      "139 cities and communities available. Start typing to search.",
    );
    assert.equal(
      formatLargeCitySearchHelper(1066),
      "1066 cities and communities available. Start typing to search.",
    );
  });

  it("CitySelect uses structured count helper and shared search affordance", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.match(city, /formatLargeCitySearchHelper\(structuredCount\)/);
    assert.match(city, /requireSearch=\{isLargeList\}/);
    assert.match(city, /CITY_REQUIRE_SEARCH_ABOVE/);
    assert.match(city, /GEOGRAPHY_EMPTY_COPY\.citySearchPlaceholder/);
    assert.match(city, /GEOGRAPHY_EMPTY_COPY\.noCityMatches/);
    assert.match(city, /key=\{`\$\{countryCode\}::\$\{regionCode\}`\}/);
    assert.doesNotMatch(city, /disabled=\{[^}]*loading/);
  });

  it("GeographySearchSelect distinguishes awaiting-search from no-match empty", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    assert.match(select, /awaitingSearch/);
    assert.match(select, /Start typing to search…/);
    assert.match(select, /noMatchMessage/);
    assert.match(select, /geography-search-select--awaiting-search/);
    assert.match(select, /requireSearch/);
    assert.doesNotMatch(
      select,
      /showSearchHint \? "Type to search…"/,
    );
  });

  it("does not treat large-list pre-query as noCities emptyMessage", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.match(city, /emptyMessage=\{undefined\}/);
    assert.match(city, /noMatchMessage=\{GEOGRAPHY_EMPTY_COPY\.noCityMatches\}/);
  });

  it("Preferences multi-select keeps multi semantics with large-list invite", () => {
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");
    const multi = readWeb("design-system/components/GeographyMultiSelect.tsx");
    assert.match(preferred, /GeographyMultiSelect/);
    assert.match(preferred, /formatLargeCitySearchHelper/);
    assert.match(preferred, /requireSearch=\{isLargeCityList\}/);
    assert.match(preferred, /GEOGRAPHY_EMPTY_COPY\.citySearchPlaceholder/);
    assert.match(multi, /requireSearch/);
    assert.match(multi, /awaitingSearch/);
    assert.match(multi, /searchInviteMessage/);
  });

  it("Pack 10F packaging and delivery guards remain intact", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(webSrc, "../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const dockerfile = readFileSync(path.join(webSrc, "../Dockerfile"), "utf8");
    const communities = readFileSync(
      path.join(webSrc, "../../../packages/geography/src/geography.communities.ts"),
      "utf8",
    );
    const verify = readFileSync(
      path.join(webSrc, "../../api/src/modules/staging-reconciliation/verify.ts"),
      "utf8",
    );

    assert.match(pkg.scripts.build ?? "", /copy-standalone-public-assets/);
    assert.ok(
      dockerfile.indexOf("COPY --from=build /app/apps/web/public") >
        dockerfile.indexOf(".next/standalone"),
    );
    assert.match(communities, /GeographyCommunityDeliveryError/);
    assert.match(verify, /webGeographyAssets/);
  });

  it("five surfaces still share CitySelect or canonical fetchCommunitiesByRegion", () => {
    const search = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const country = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const initiative = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    const participation = readWeb(
      "features/participation-area/components/ParticipationAreaSection.tsx",
    );
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");

    assert.match(search, /CitySelect/);
    assert.match(country, /CitySelect/);
    assert.match(initiative, /CitySelect/);
    assert.match(participation, /CitySelect/);
    assert.match(preferred, /fetchCommunitiesByRegion/);
  });
});
