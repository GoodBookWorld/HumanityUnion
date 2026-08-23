/**
 * Pack 10G — City select discoverability (superseded UX by Pack 10H1 browseable lists).
 * Keeps error/empty/loading copy contracts from 10G/10F.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatCityListHelper,
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
    assert.match(GEOGRAPHY_EMPTY_COPY.citySearchPlaceholder, /Search cities or communities/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCities, /No cities or communities are listed/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCityMatches, /No matching cities or communities found/);
    assert.match(GEOGRAPHY_EMPTY_COPY.cityDeliveryFailure, /City data could not be loaded/);
    assert.match(GEOGRAPHY_EMPTY_COPY.selectRegionFirst, /Select a region to choose a city/);
    assert.match(formatCityListHelper(139), /139 cities and communities available/);
    assert.match(formatCityListHelper(1066), /Scroll the list or search to filter/);
  });

  it("CitySelect keeps shared search affordance without requiring search", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.match(city, /formatCityListHelper\(structuredCount\)/);
    assert.doesNotMatch(city, /requireSearch=\{/);
    assert.match(city, /GEOGRAPHY_EMPTY_COPY\.citySearchPlaceholder/);
    assert.match(city, /GEOGRAPHY_EMPTY_COPY\.noCityMatches/);
    assert.match(city, /key=\{`\$\{countryCode\}::\$\{regionCode\}`\}/);
  });

  it("GeographySearchSelect treats search as optional filter over a browseable list", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    assert.match(select, /role="listbox"/);
    assert.match(select, /noMatchMessage/);
    assert.doesNotMatch(select, /awaitingSearch/);
    assert.doesNotMatch(select, /requireSearch/);
    assert.doesNotMatch(select, /Start typing to search…/);
  });

  it("does not treat large-list pre-query as noCities emptyMessage", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.match(city, /emptyMessage=\{undefined\}/);
    assert.match(city, /noMatchMessage=\{GEOGRAPHY_EMPTY_COPY\.noCityMatches\}/);
  });

  it("Preferences multi-select keeps multi semantics with browseable city options", () => {
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");
    const multi = readWeb("design-system/components/GeographyMultiSelect.tsx");
    assert.match(preferred, /GeographyMultiSelect/);
    assert.match(preferred, /formatCityListHelper/);
    assert.doesNotMatch(preferred, /requireSearch=\{/);
    assert.match(preferred, /Add preferred cities/);
    assert.doesNotMatch(multi, /requireSearch/);
    assert.doesNotMatch(multi, /awaitingSearch/);
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
