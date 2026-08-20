import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateCreateInitiativeDraftInput,
  validateInitiativeForPublication,
} from "../../../src/modules/initiatives/initiative.validators.js";
import type { Initiative } from "@hu/types";

function baseInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: "initiative-pc-1",
    stewardId: "participant-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "City Election",
    description: "Public choice description",
    status: "draft",
    lifecyclePhase: "draft",
    lifecycleProfile: "PUBLIC_CHOICE",
    visibility: { policy: "public" },
    metadata: {
      category: "",
      tags: [],
      region: "",
      language: "en",
      countrySlug: "us",
      communitySlug: "",
      participationScope: "country",
      activityArea: "",
    },
    revisions: [],
    contributions: [],
    ...overrides,
  } as Initiative;
}

describe("Public Choice Experience Pack 01 — creation validation", () => {
  it("STANDARD still requires Activity area on create", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          title: "Standard",
          description: "Desc",
          lifecycleProfile: "STANDARD",
        }),
      /Activity area/i,
    );
  });

  it("PUBLIC_CHOICE requires Country and allows missing Activity area", () => {
    assert.throws(
      () =>
        validateCreateInitiativeDraftInput({
          title: "Election",
          description: "Desc",
          lifecycleProfile: "PUBLIC_CHOICE",
        }),
      /Country is required for Public Choice/,
    );

    const created = validateCreateInitiativeDraftInput({
      title: "Election",
      description: "Desc",
      lifecycleProfile: "PUBLIC_CHOICE",
      countrySlug: "ca",
      participationScope: "country",
    });

    assert.equal(created.lifecycleProfile, "PUBLIC_CHOICE");
    assert.equal(created.countrySlug, "ca");
    assert.equal(created.activityArea, undefined);
  });

  it("PUBLIC_CHOICE publication rejects missing Country and skips Activity area", () => {
    assert.throws(
      () =>
        validateInitiativeForPublication(
          baseInitiative({
            metadata: {
              category: "",
              tags: [],
              region: "",
              language: "en",
              communitySlug: "",
              participationScope: "country",
              activityArea: "",
            },
          }),
        ),
      /Country is required for Public Choice/,
    );

    assert.doesNotThrow(() => validateInitiativeForPublication(baseInitiative()));
  });
});
