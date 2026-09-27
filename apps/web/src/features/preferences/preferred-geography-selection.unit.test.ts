import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { ParticipationPreferences } from "@hu/types";
import {
  formatPreferredCityCommunityId,
  formatPreferredRegionId,
  sanitizeParticipationGeography,
} from "@hu/geography";

import {
  applyPreferredCountrySelection,
  commitPreferredRegionSelection,
  removePreferredRegionSelection,
} from "./preferred-geography-selection";

const VANCOUVER = "17145";
const BC = formatPreferredRegionId("CA", "CA-BC");
const AB = formatPreferredRegionId("CA", "CA-AB");
const CALIFORNIA = formatPreferredRegionId("US", "US-CA");
const VANCOUVER_ID = formatPreferredCityCommunityId("CA", "CA-BC", VANCOUVER);

function emptyPreferences(): ParticipationPreferences {
  return {
    interestedTopics: [],
    preferredInitiativeTypes: [],
    volunteerInterests: [],
    preferredCountryIds: [],
    preferredRegions: [],
    preferredCityCommunityIds: [],
    participationAvailability: "",
    preferredActivityAreas: [],
    preferredGeographicScopes: [],
    initiativeParticipationInterests: [],
    contributionWillingness: [],
  };
}

describe("PREFERENCES GEO 01 selected region persistence", () => {
  it("1. selecting Canada stores CA before any region is chosen", () => {
    const next = applyPreferredCountrySelection(emptyPreferences(), ["CA"]);
    assert.deepEqual(next.preferredCountryIds, ["CA"]);
    assert.deepEqual(next.preferredRegions, []);
  });

  it("2. selecting Canada and British Columbia stores CA::CA-BC before Save", () => {
    const next = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(next);
    assert.ok(next.preferredCountryIds.includes("CA"));
    assert.ok(next.preferredRegions.includes(BC));
  });

  it("3. Save and reload representation preserves CA::CA-BC", () => {
    const committed = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(committed);
    const reloaded = sanitizeParticipationGeography(committed).participationPreferences;
    assert.ok(reloaded.preferredRegions.includes("CA::CA-BC"));
    assert.deepEqual(reloaded.preferredRegions, committed.preferredRegions);
  });

  it("4. selecting the same region again does not duplicate it", () => {
    const first = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(first);
    const second = commitPreferredRegionSelection(first, "CA", "CA-BC");
    assert.ok(second);
    assert.deepEqual(second.preferredRegions, [BC]);
  });

  it("5. British Columbia then Alberta both remain", () => {
    const britishColumbia = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(britishColumbia);
    const alberta = commitPreferredRegionSelection(britishColumbia, "CA", "CA-AB");
    assert.ok(alberta);
    assert.deepEqual(alberta.preferredRegions, [BC, AB]);
    assert.deepEqual(alberta.preferredCountryIds, ["CA"]);
  });

  it("6. removing British Columbia removes that region and its city", () => {
    const withRegions = commitPreferredRegionSelection(
      commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC")!,
      "CA",
      "CA-AB",
    );
    assert.ok(withRegions);
    const withCity: ParticipationPreferences = {
      ...withRegions,
      preferredCityCommunityIds: [VANCOUVER_ID],
    };
    const next = removePreferredRegionSelection(withCity, BC);
    assert.deepEqual(next.preferredRegions, [AB]);
    assert.deepEqual(next.preferredCityCommunityIds, []);
    assert.deepEqual(
      next,
      sanitizeParticipationGeography({
        ...withCity,
        preferredRegions: withCity.preferredRegions.filter((regionId) => regionId !== BC),
      }).participationPreferences,
    );
  });

  it("7. removing Canada sanitizes dependent cities through the existing sanitizer", () => {
    const canada = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(canada);
    const both = commitPreferredRegionSelection(
      { ...canada, preferredCountryIds: ["CA", "US"] },
      "US",
      "US-CA",
    );
    assert.ok(both);
    const withCity: ParticipationPreferences = {
      ...both,
      preferredCityCommunityIds: [VANCOUVER_ID],
    };
    const next = applyPreferredCountrySelection(withCity, ["US"]);
    assert.deepEqual(next.preferredCountryIds, ["US"]);
    assert.equal(next.preferredCityCommunityIds.includes(VANCOUVER_ID), false);
    assert.deepEqual(
      next,
      sanitizeParticipationGeography({
        ...withCity,
        preferredCountryIds: ["US"],
      }).participationPreferences,
    );
    assert.ok(next.preferredRegions.includes(CALIFORNIA));
  });

  it("8. incomplete or unrecognized country and region selections are not committed", () => {
    const current = applyPreferredCountrySelection(emptyPreferences(), ["CA"]);
    assert.equal(commitPreferredRegionSelection(current, "", "CA-BC"), null);
    assert.equal(commitPreferredRegionSelection(current, "CA", ""), null);
    assert.equal(commitPreferredRegionSelection(current, "CA", "other-not-listed"), null);
    assert.equal(commitPreferredRegionSelection(current, "ZZ", "NOPE"), null);
    assert.deepEqual(current.preferredRegions, []);
  });

  it("9. a committed region is what enables city and community selection", () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "components/PreferredGeographyFields.tsx"),
      "utf8",
    );
    const committed = commitPreferredRegionSelection(emptyPreferences(), "CA", "CA-BC");
    assert.ok(committed);
    assert.equal(committed.preferredRegions.length > 0, true);
    assert.match(source, /const citiesDisabled = preferredRegions\.length === 0/);
    assert.match(source, /id="preferences-preferred-cities"/);
    assert.match(source, /handlePreferredCitiesChange/);
    assert.match(source, /commitPreferredRegionSelection/);
  });
});
