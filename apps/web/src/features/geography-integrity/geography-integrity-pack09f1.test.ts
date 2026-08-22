/**
 * Geography Integrity Pack 09F1 — Country → Region → City contract.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getCountries,
  getRegionsByCountry,
  isRecognizedCountrySlug,
  isRecognizedRegionSlug,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_REGION_SLUG,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
} from "@hu/geography";

import {
  countryHasStructuredRegions,
  isStructuredGeographyConsistent,
  patchAfterCountryChange,
  patchAfterRegionChange,
} from "./geography-cascade-contract";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");
const repoRoot = path.resolve(webRoot, "../../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Geography Integrity Pack 09F1 — shared contract", () => {
  it("uses one canonical Country source from @hu/geography", () => {
    const options = toGeographyCountryOptions();
    assert.ok(options.length > 100);
    assert.equal(normalizeCountryInput("Canada"), "CA");
    assert.equal(normalizeCountryInput("CA"), "CA");
    assert.ok(isRecognizedCountrySlug("CA"));
    assert.ok(isRecognizedCountrySlug("UA"));
  });

  it("Region resolver is Country-scoped; invalid CA + US-CA rejected", () => {
    const regions = toGeographyRegionOptions("CA", false);
    assert.ok(regions.some((region) => region.slug === "CA-BC"));
    assert.ok(!regions.some((region) => region.slug === "US-CA"));
    assert.equal(normalizeRegionInput("CA", "US-CA"), undefined);
    assert.equal(isRecognizedRegionSlug("CA", "US-CA"), false);
    assert.equal(isRecognizedRegionSlug("CA", "CA-BC"), true);
  });

  it("changing Country clears Region and City via patch helpers", () => {
    const afterCountry = patchAfterCountryChange("UA", "Ukraine");
    assert.equal(afterCountry.countryCode, "UA");
    assert.equal(afterCountry.regionCode, "");
    assert.equal(afterCountry.communityCode, "");

    const afterRegion = patchAfterRegionChange("UA-30", "Kyiv Oblast");
    assert.equal(afterRegion.regionCode, "UA-30");
    assert.equal(afterRegion.communityCode, "");
  });

  it("rejects inconsistent structured triples in client helper", () => {
    assert.equal(
      isStructuredGeographyConsistent({
        countryCode: "CA",
        regionCode: "US-CA",
        communityCode: "16146",
      }),
      false,
    );
    assert.equal(
      isStructuredGeographyConsistent({
        countryCode: "CA",
        regionCode: "CA-BC",
      }),
      true,
    );
  });

  it("exposes CountrySelect / RegionSelect / CitySelect shared controls", () => {
    const index = readWeb("features/geography-integrity/index.ts");
    assert.match(index, /CountrySelect/);
    assert.match(index, /RegionSelect/);
    assert.match(index, /CitySelect/);
    assert.match(index, /useGeographyCommunityOptions/);
    assert.match(index, /patchAfterCountryChange/);
  });
});

describe("Geography Integrity Pack 09F1 — surface wiring", () => {
  it("Initiative form uses shared cascade controls", () => {
    const form = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    assert.match(form, /CountrySelect/);
    assert.match(form, /RegionSelect/);
    assert.match(form, /CitySelect/);
    assert.match(form, /patchAfterCountryChange/);
    assert.match(form, /Free-text fallback/);
    assert.doesNotMatch(form, /toGeographyCountryOptions\(\)/);
  });

  it("Public Choice keeps Country required and World unavailable via presentation", () => {
    const form = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    assert.match(form, /presentation\.requireCountry/);
    assert.match(form, /presentation\.requireCountry \? null : <option value="world">/);
  });

  it("Country search uses RegionSelect + CitySelect for fixed Country page", () => {
    const page = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    assert.match(page, /RegionSelect/);
    assert.match(page, /CitySelect/);
    assert.match(page, /includeOther=\{false\}/);
    assert.doesNotMatch(page, /fetchCommunitiesByRegion/);
  });

  it("Global search and civic archive use shared geography controls", () => {
    const search = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const archive = readWeb(
      "features/public-civic-archive/components/CivicArchiveFiltersForm.tsx",
    );
    assert.match(search, /CountrySelect/);
    assert.match(search, /RegionSelect/);
    assert.match(search, /CitySelect/);
    assert.match(archive, /CountrySelect/);
    assert.match(archive, /CitySelect/);
    assert.doesNotMatch(archive, /Promise\.all\(\s*regions\.map/);
  });

  it("Admin Media Resources and Country People use toGeographyCountryOptions", () => {
    const media = readWeb("features/administration/components/AdminMediaResourcesSection.tsx");
    const people = readWeb("features/administration/components/AdminCountryPeopleSection.tsx");
    assert.match(media, /toGeographyCountryOptions/);
    assert.match(people, /toGeographyCountryOptions/);
    assert.doesNotMatch(media, /regionCode|cityCommunity/);
    assert.doesNotMatch(people, /regionSlug|communitySlug/);
  });
});

describe("Geography Integrity Pack 09F1 — data gaps", () => {
  it("reports countries without structured regions (explicit fallback required)", () => {
    const withoutRegions = getCountries().filter(
      (country) => getRegionsByCountry(country.code).length === 0,
    );
    assert.ok(withoutRegions.length > 0);
    assert.equal(countryHasStructuredRegions(withoutRegions[0]!.code), false);
    assert.equal(countryHasStructuredRegions("CA"), true);
  });

  it("community JSON is region-scoped under public data", () => {
    const communitiesRoot = path.join(
      repoRoot,
      "apps/web/public/data/geography/communities",
    );
    assert.ok(existsSync(communitiesRoot));
    const caBc = path.join(communitiesRoot, "CA", "CA-BC.json");
    assert.ok(existsSync(caBc));
    const records = JSON.parse(readFileSync(caBc, "utf8")) as Array<{ code: string }>;
    assert.ok(records.length > 0);
    assert.ok(records.every((row) => /^\d+$/.test(row.code)));
  });

  it("Other region sentinel is explicit, not a fake ISO subdivision", () => {
    assert.equal(OTHER_REGION_SLUG, "other-not-listed");
    const withOther = toGeographyRegionOptions("CA", true);
    assert.ok(withOther.some((option) => option.slug === OTHER_REGION_SLUG));
  });
});

describe("Geography Integrity Pack 09F1 — a11y / responsive hooks", () => {
  it("GeographySearchSelect exposes labels, focus, loading, and mobile targets", () => {
    const select = readWeb("design-system/components/GeographySearchSelect.tsx");
    const css = readWeb("design-system/components/geography-search-select.css");
    assert.match(select, /aria-busy/);
    assert.match(select, /aria-describedby/);
    assert.match(select, /requireSearchAbove/);
    assert.match(css, /focus-visible/);
    assert.match(css, /min-height:\s*2\.75rem/);
    assert.match(css, /max-width:\s*100%/);
  });
});

describe("Geography Integrity Pack 09F1 — server validation surface", () => {
  it("API initiative validators call assertOptionalStructuredGeography", () => {
    const validators = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/initiatives/initiative.validators.ts"),
      "utf8",
    );
    const geographyValidators = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/initiatives/initiative-geography.validators.ts"),
      "utf8",
    );
    assert.match(validators, /assertOptionalStructuredGeography/);
    assert.match(geographyValidators, /regionSlug must belong to the selected countrySlug/);
    assert.match(geographyValidators, /communitySlug must belong/);
  });
});
