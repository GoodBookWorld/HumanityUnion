import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MyInitiativeGroupSummary } from "@hu/types";

import { canScheduleSessionsForGroup, filterInitiativeGroupsByTitle } from "./initiative-group-chat-format";

function buildGroup(overrides: Partial<MyInitiativeGroupSummary> = {}): MyInitiativeGroupSummary {
  return {
    initiativeId: "initiative-a",
    title: "Clean Water Access",
    lifecyclePhase: "published",
    role: "author",
    ...overrides,
  };
}

describe("filterInitiativeGroupsByTitle (Communication UX Pack 03.9 Part 4)", () => {
  it("returns every group, in the same order, for an empty search term", () => {
    const groups = [buildGroup({ initiativeId: "a", title: "Clean Water" }), buildGroup({ initiativeId: "b", title: "Solar Grids" })];

    assert.deepEqual(filterInitiativeGroupsByTitle(groups, ""), groups);
  });

  it("filters case-insensitively by title substring", () => {
    const groups = [buildGroup({ initiativeId: "a", title: "Clean Water Access" }), buildGroup({ initiativeId: "b", title: "Solar Grids" })];

    const result = filterInitiativeGroupsByTitle(groups, "WATER");
    assert.equal(result.length, 1);
    assert.equal(result[0]!.initiativeId, "a");
  });

  it("matches a substring anywhere in the title", () => {
    const groups = [buildGroup({ title: "Community Solar Grids" })];

    assert.equal(filterInitiativeGroupsByTitle(groups, "solar").length, 1);
  });

  it("returns an empty list (no fallback to the full list) when nothing matches", () => {
    const groups = [buildGroup({ title: "Clean Water Access" })];

    assert.deepEqual(filterInitiativeGroupsByTitle(groups, "nonexistent"), []);
  });

  it("returns a new array instance rather than mutating or aliasing the input", () => {
    const groups = [buildGroup()];
    const result = filterInitiativeGroupsByTitle(groups, "");

    assert.notEqual(result, groups);
    assert.deepEqual(result, groups);
  });

  it("trims whitespace-only search terms to mean 'no filter'", () => {
    const groups = [buildGroup({ title: "Clean Water Access" })];

    assert.deepEqual(filterInitiativeGroupsByTitle(groups, "   "), groups);
  });
});

describe("canScheduleSessionsForGroup (Communication UX Pack 03.9 Part 6)", () => {
  it("is true for an Author's own group", () => {
    assert.equal(canScheduleSessionsForGroup(buildGroup({ role: "author" })), true);
  });

  it("is false for a group where the viewer is only an active Ally", () => {
    assert.equal(canScheduleSessionsForGroup(buildGroup({ role: "active_ally" })), false);
  });

  it("is false when no group is selected (root-cause regression guard)", () => {
    assert.equal(canScheduleSessionsForGroup(null), false);
  });
});
