import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  listMyInitiativeGroups,
  type MyInitiativeGroupsDependencies,
} from "../../../src/modules/initiatives/initiative.service.js";

/**
 * Communication UX Pack 03.9 Part 3 — "My Initiative Groups" (the
 * Initiative Group Chat picker) aggregation, exercised fully MongoDB-free
 * through the injectable `MyInitiativeGroupsDependencies`, matching the
 * pattern `workspace-allies.service.ts`'s own tests already use.
 */

const PARTICIPANT_ID = "participant-signed-in";

function buildInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: "initiative-a",
    stewardId: "participant-someone-else",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    title: "Initiative A",
    description: "Description",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "",
      language: "en",
      communitySlug: "",
      participationScope: "community",
      activityArea: "environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

function buildDeps(overrides: Partial<MyInitiativeGroupsDependencies> = {}): MyInitiativeGroupsDependencies {
  return {
    listInitiativesStewardedBy: () => [],
    listAlliesByParticipantId: async () => [],
    getInitiativeById: () => null,
    ...overrides,
  };
}

describe("listMyInitiativeGroups (Communication UX Pack 03.9 Part 3)", () => {
  it("includes an Initiative the Participant stewards, tagged role author", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [buildInitiative({ initiativeId: "initiative-authored" })],
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.initiativeId, "initiative-authored");
    assert.equal(groups[0]?.role, "author");
  });

  it("includes an Initiative where the Participant is an active Ally, tagged role active_ally", async () => {
    const alliedInitiative = buildInitiative({ initiativeId: "initiative-allied", title: "Allied Initiative" });
    const deps = buildDeps({
      listAlliesByParticipantId: async () => [{ initiativeId: "initiative-allied", status: "active" }],
      getInitiativeById: (initiativeId) => (initiativeId === "initiative-allied" ? alliedInitiative : null),
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.initiativeId, "initiative-allied");
    assert.equal(groups[0]?.role, "active_ally");
  });

  it("excludes interest_pending, invitation_pending, and declined Ally rows", async () => {
    const deps = buildDeps({
      listAlliesByParticipantId: async () => [
        { initiativeId: "initiative-pending-interest", status: "interest_pending" },
        { initiativeId: "initiative-pending-invitation", status: "invitation_pending" },
        { initiativeId: "initiative-declined", status: "declined" },
      ],
      getInitiativeById: (initiativeId) => buildInitiative({ initiativeId }),
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.deepEqual(groups, []);
  });

  it("deduplicates an Initiative the Participant both authors and has an Ally row on, keeping role author", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [buildInitiative({ initiativeId: "initiative-both" })],
      listAlliesByParticipantId: async () => [{ initiativeId: "initiative-both", status: "active" }],
      getInitiativeById: (initiativeId) => buildInitiative({ initiativeId }),
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.role, "author");
  });

  it("excludes archived Initiatives from both the authored and active-Ally sides", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [
        buildInitiative({ initiativeId: "initiative-archived-authored", lifecyclePhase: "archived" }),
      ],
      listAlliesByParticipantId: async () => [{ initiativeId: "initiative-archived-allied", status: "active" }],
      getInitiativeById: (initiativeId) =>
        buildInitiative({ initiativeId, lifecyclePhase: "archived" }),
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.deepEqual(groups, []);
  });

  it("returns an empty list when the Participant neither authors nor collaborates on any Initiative", async () => {
    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, buildDeps());

    assert.deepEqual(groups, []);
  });

  it("sorts the combined list alphabetically by title", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [
        buildInitiative({ initiativeId: "initiative-z", title: "Zebra Initiative" }),
        buildInitiative({ initiativeId: "initiative-a", title: "Alpha Initiative" }),
      ],
    });

    const groups = await listMyInitiativeGroups({ participantId: PARTICIPANT_ID }, deps);

    assert.deepEqual(
      groups.map((group) => group.title),
      ["Alpha Initiative", "Zebra Initiative"],
    );
  });
});
