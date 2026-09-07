/**
 * RESET 05A — country Initiative card projection emits geography codes;
 * PUBLIC_CHOICE does not mix election name into geographyLabel.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import { toCountryInitiativeCardProjection } from "../../../src/modules/country-statistics/country-public.service.js";

function sampleInitiative(
  overrides: Partial<Initiative> & {
    metadata?: Partial<Initiative["metadata"]>;
  } = {},
): Initiative {
  const base: Initiative = {
    initiativeId: "init-pc-1",
    title: "Kelowna Mayor Election",
    description: "Description long enough for summary.",
    status: "active",
    lifecycleProfile: "PUBLIC_CHOICE",
    lifecyclePhase: "projected",
    currentVersion: 1,
    createdAt: "2029-01-01T00:00:00.000Z",
    updatedAt: "2029-01-01T00:00:00.000Z",
    stewardParticipantId: "p1",
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Democracy and Governance",
      category: "Election",
      countrySlug: "CA",
      regionSlug: "CA-BC",
      communitySlug: "kelowna",
      region: "British Columbia",
      communityAssociation: "Community Mayor Election — Staging Test",
      language: "en",
      participationScope: "community",
      ballotMode: "SELECT_ONE_CANDIDATE",
    },
  } as Initiative;

  return {
    ...base,
    ...overrides,
    metadata: {
      ...base.metadata,
      ...overrides.metadata,
    },
  } as Initiative;
}

describe("RESET 05A — country card geography projection", () => {
  it("emits country/region/community codes for rail GEOGRAPHY authority", () => {
    const card = toCountryInitiativeCardProjection(sampleInitiative());
    assert.equal(card.countryCode, "CA");
    assert.equal(card.regionCode, "CA-BC");
    assert.equal(card.communitySlug, "kelowna");
  });

  it("PUBLIC_CHOICE geographyLabel excludes election-name communityAssociation", () => {
    const card = toCountryInitiativeCardProjection(sampleInitiative());
    assert.doesNotMatch(card.geographyLabel, /Community Mayor Election/);
    assert.notEqual(card.geographyLabel, "World");
    assert.match(card.geographyLabel, /Canada|British Columbia/i);
  });

  it("STANDARD may still use communityAssociation as city in geographyLabel", () => {
    const card = toCountryInitiativeCardProjection(
      sampleInitiative({
        lifecycleProfile: "STANDARD",
        metadata: {
          communityAssociation: "Downtown Neighbourhood Association",
        },
      }),
    );
    assert.match(card.geographyLabel, /Downtown Neighbourhood Association/);
  });
});
