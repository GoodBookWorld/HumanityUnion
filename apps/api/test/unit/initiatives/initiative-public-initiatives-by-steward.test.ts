import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

/**
 * Profile UX Pack 02 Part 9/11 — "Recent Public Initiatives" on a Public
 * Profile must only ever surface Initiatives that are ALREADY publicly
 * projected (`lifecyclePhase === "projected"` AND `visibility.policy ===
 * "public"`), newest-first, bounded by a limit. Runs against the real,
 * in-memory Initiative store (`INITIATIVE_PERSISTENCE=memory`) so it never
 * touches the file-backed `.runtime/initiatives.json` used by `dev:api`,
 * following the established pattern from
 * `participation-area-cleanup.test.ts`.
 */

const STEWARD_ID = "test-recent-public-initiatives-steward";
const OTHER_STEWARD_ID = "test-recent-public-initiatives-other-steward";

function buildInitiative(overrides: Partial<Initiative> = {}): Initiative {
  const now = new Date().toISOString();

  return {
    initiativeId: `test-recent-public-initiatives-${Math.random().toString(36).slice(2)}`,
    stewardId: STEWARD_ID,
    createdAt: now,
    updatedAt: now,
    title: "Fixture Initiative",
    description: "Fixture description.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

describe("listPublicInitiativesBySteward (Profile UX Pack 02 Part 9/11)", () => {
  let createInitiative: (initiative: Initiative) => Initiative;
  let listPublicInitiativesBySteward: (stewardId: string, limit?: number) => Initiative[];

  before(async () => {
    process.env.INITIATIVE_PERSISTENCE = "memory";
    const storeModule = await import("../../../src/modules/initiatives/initiative.store.js");
    createInitiative = storeModule.createInitiative;
    listPublicInitiativesBySteward = storeModule.listPublicInitiativesBySteward;
  });

  it("includes an Initiative that is both projected and public", () => {
    const initiative = buildInitiative({ initiativeId: "test-rpi-included" });
    createInitiative(initiative);

    const results = listPublicInitiativesBySteward(STEWARD_ID);

    assert.ok(results.some((result) => result.initiativeId === "test-rpi-included"));
  });

  it("excludes an Initiative that is projected but not public (e.g. steward_only)", () => {
    const initiative = buildInitiative({
      initiativeId: "test-rpi-steward-only",
      visibility: { policy: "steward_only" },
    });
    createInitiative(initiative);

    const results = listPublicInitiativesBySteward(STEWARD_ID);

    assert.ok(!results.some((result) => result.initiativeId === "test-rpi-steward-only"));
  });

  it("excludes an Initiative that is public but not yet in the projected lifecycle phase", () => {
    const initiative = buildInitiative({
      initiativeId: "test-rpi-draft",
      lifecyclePhase: "draft",
    });
    createInitiative(initiative);

    const results = listPublicInitiativesBySteward(STEWARD_ID);

    assert.ok(!results.some((result) => result.initiativeId === "test-rpi-draft"));
  });

  it("excludes Initiatives stewarded by a different Participant", () => {
    const initiative = buildInitiative({
      initiativeId: "test-rpi-other-steward",
      stewardId: OTHER_STEWARD_ID,
    });
    createInitiative(initiative);

    const results = listPublicInitiativesBySteward(STEWARD_ID);

    assert.ok(!results.some((result) => result.initiativeId === "test-rpi-other-steward"));
  });

  it("orders results newest-first by updatedAt", () => {
    const older = buildInitiative({
      initiativeId: "test-rpi-older",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = buildInitiative({
      initiativeId: "test-rpi-newer",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    createInitiative(older);
    createInitiative(newer);

    const results = listPublicInitiativesBySteward(STEWARD_ID);
    const olderIndex = results.findIndex((result) => result.initiativeId === "test-rpi-older");
    const newerIndex = results.findIndex((result) => result.initiativeId === "test-rpi-newer");

    assert.ok(newerIndex < olderIndex);
  });

  it("bounds the result count to the provided limit", () => {
    for (let i = 0; i < 5; i += 1) {
      createInitiative(buildInitiative({ initiativeId: `test-rpi-limit-${i}` }));
    }

    const results = listPublicInitiativesBySteward(STEWARD_ID, 2);

    assert.equal(results.length, 2);
  });

  it("returns an empty list for a Participant who stewards no Initiatives at all", () => {
    const results = listPublicInitiativesBySteward("test-rpi-nonexistent-steward");

    assert.deepEqual(results, []);
  });
});
