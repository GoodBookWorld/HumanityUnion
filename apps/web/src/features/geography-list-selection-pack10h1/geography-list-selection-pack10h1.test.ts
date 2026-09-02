/**
 * Pack 10H1 — Canonical city list selection & reselection.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  computeGeographyWindowSlice,
  GEOGRAPHY_WINDOW_ABOVE,
  shouldWindowGeographyOptions,
} from "../../design-system/components/geography-list-window";
import {
  formatCityListHelper,
  GEOGRAPHY_EMPTY_COPY,
} from "../geography-integrity/geography-cascade-contract";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 10H1 — city list browseable selection", () => {
  it("window helper slices large lists without requiring search", () => {
    assert.equal(shouldWindowGeographyOptions(GEOGRAPHY_WINDOW_ABOVE), false);
    assert.equal(shouldWindowGeographyOptions(GEOGRAPHY_WINDOW_ABOVE + 1), true);
    assert.equal(shouldWindowGeographyOptions(1066), true);

    const slice = computeGeographyWindowSlice(1066, 400);
    assert.ok(slice.startIndex >= 0);
    assert.ok(slice.endIndex > slice.startIndex);
    assert.ok(slice.endIndex - slice.startIndex < 1066);
    assert.equal(slice.totalHeight, 1066 * 40);
  });

  it("CitySelect removes requireSearch / requireSearchAbove divergence", () => {
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.doesNotMatch(city, /requireSearch/);
    assert.doesNotMatch(city, /CITY_REQUIRE_SEARCH_ABOVE/);
    assert.match(city, /manage\.geography\.citiesAvailable/);
    assert.match(city, /emptyOptionLabel/);
    assert.match(city, /manage\.geography\.allCommunities/);
  });

  it("GeographySearchSelect opens a browseable listbox with optional filter", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    assert.match(select, /geography-search-select__trigger/);
    assert.match(select, /role="listbox"/);
    assert.match(select, /role="option"/);
    assert.match(select, /shouldWindowGeographyOptions/);
    assert.match(select, /computeGeographyWindowSlice/);
    assert.match(select, /setQuery\(""\)/);
    assert.doesNotMatch(select, /requireSearchAbove/);
    assert.doesNotMatch(select, /requireSearch/);
  });

  it("reselection clears filter query so the full list returns", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    assert.match(select, /function choose\(slug: string\)/);
    assert.match(select, /onChange\(slug\);\s*setQuery\(""\)/s);
  });

  it("state copy distinguishes loaded / no-match / empty / failure", () => {
    assert.match(formatCityListHelper(139), /Scroll the list or search to filter/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCityMatches, /No matching cities/);
    assert.match(GEOGRAPHY_EMPTY_COPY.noCities, /No cities or communities are listed/);
    assert.match(GEOGRAPHY_EMPTY_COPY.cityDeliveryFailure, /City data could not be loaded/);
  });

  it("Preferences keeps multi-select with browseable cities and clearer copy", () => {
    const preferred = readWeb("features/preferences/components/PreferredGeographyFields.tsx");
    assert.match(preferred, /Add preferred cities/);
    assert.doesNotMatch(preferred, /Add preferred region/);
    assert.match(preferred, /from multiple regions/);
    assert.match(preferred, /GeographyMultiSelect/);
    assert.doesNotMatch(preferred, /requireSearch/);
  });

  it("shared surfaces still use CitySelect / canonical fetch", () => {
    assert.match(
      readWeb("features/global-search/components/GlobalSearchPageContent.tsx"),
      /CitySelect/,
    );
    assert.match(
      readWeb("features/country-experience/components/CountryExperienceDynamicPage.tsx"),
      /CitySelect/,
    );
    assert.match(readWeb("features/initiatives/components/InitiativeFormFields.tsx"), /CitySelect/);
    assert.match(
      readWeb("features/participation-area/components/ParticipationAreaSection.tsx"),
      /CitySelect/,
    );
  });

  it("Pack 10F delivery + packaging guards remain", () => {
    const communities = readFileSync(
      path.join(webSrc, "../../../packages/geography/src/geography.communities.ts"),
      "utf8",
    );
    const verify = readFileSync(
      path.join(webSrc, "../../api/src/modules/staging-reconciliation/verify.ts"),
      "utf8",
    );
    const pkg = JSON.parse(
      readFileSync(path.join(webSrc, "../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.match(communities, /GeographyCommunityDeliveryError/);
    assert.match(verify, /webGeographyAssets/);
    assert.match(pkg.scripts.build ?? "", /copy-standalone-public-assets/);
  });
});
