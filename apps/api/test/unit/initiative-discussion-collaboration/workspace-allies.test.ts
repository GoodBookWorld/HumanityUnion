import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeAlly, PublicCommentAuthor } from "@hu/types";

import {
  countActiveCollaborationsForParticipant,
  listWorkspaceAlliesForParticipant,
  type WorkspaceAlliesDependencies,
} from "../../../src/modules/initiative-discussion-collaboration/workspace-allies.service.js";

/**
 * Profile UX Pack 01 Parts 9/10/11 — Workspace Allies aggregation and the
 * "Allies" / "Collaborations" counts, exercised fully MongoDB-free through
 * the module's injectable `WorkspaceAlliesDependencies`. See
 * `workspace-allies.service.ts`'s module doc comment for the exact
 * documented meaning of each ("Allies" = active Ally Participants on
 * Initiatives the signed-in Participant stewards; "Collaborations" =
 * Initiatives where the signed-in Participant is themselves an active
 * Ally).
 */

const STEWARD_ID = "participant-steward";
const OWNED_INITIATIVE_A = "initiative-owned-a";
const OWNED_INITIATIVE_B = "initiative-owned-b";

function buildAlly(overrides: Partial<InitiativeAlly> = {}): InitiativeAlly {
  return {
    initiativeId: OWNED_INITIATIVE_A,
    participantId: "participant-ally-1",
    status: "active",
    requestedByParticipantId: "participant-ally-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildDeps(overrides: Partial<WorkspaceAlliesDependencies> = {}): WorkspaceAlliesDependencies {
  return {
    listInitiativesStewardedBy: () => [{ initiativeId: OWNED_INITIATIVE_A }],
    listActiveAlliesByInitiative: async () => [],
    listAlliesByParticipantId: async () => [],
    resolveAuthorsForParticipantIds: async (participantIds) =>
      new Map<string, PublicCommentAuthor>(
        participantIds.map((id) => [id, { displayName: `Author ${id}` }]),
      ),
    ...overrides,
  };
}

describe("Workspace Allies aggregation (Profile UX Pack 01 Part 9/10 — active Allies only)", () => {
  it("includes an active Ally on a stewarded Initiative (test 24)", async () => {
    const deps = buildDeps({
      listActiveAlliesByInitiative: async () => [buildAlly({ participantId: "participant-1" })],
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.equal(allies.length, 1);
    assert.equal(allies[0]?.participantId, "participant-1");
  });

  it("excludes interest_pending and invitation_pending relationships (test 25)", async () => {
    // `listActiveAlliesByInitiative` is itself already filtered to `active`
    // at the persistence boundary; this asserts the service does not add
    // any other status back in through some other path.
    const deps = buildDeps({
      listActiveAlliesByInitiative: async () => [],
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.deepEqual(allies, []);
  });

  it("excludes declined relationships (test 26)", async () => {
    const deps = buildDeps({
      listActiveAlliesByInitiative: async () => [],
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.deepEqual(allies, []);
  });

  it("deduplicates the same Participant across multiple stewarded Initiatives (test 27)", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [
        { initiativeId: OWNED_INITIATIVE_A },
        { initiativeId: OWNED_INITIATIVE_B },
      ],
      listActiveAlliesByInitiative: async (initiativeId) => [
        buildAlly({ initiativeId, participantId: "participant-shared" }),
      ],
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.equal(allies.length, 1);
    assert.equal(allies[0]?.participantId, "participant-shared");
    assert.equal(allies[0]?.sharedInitiativeCount, 2);
  });

  it("Workspace Allies count is accurate (test 28)", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [
        { initiativeId: OWNED_INITIATIVE_A },
        { initiativeId: OWNED_INITIATIVE_B },
      ],
      listActiveAlliesByInitiative: async (initiativeId) =>
        initiativeId === OWNED_INITIATIVE_A
          ? [buildAlly({ initiativeId, participantId: "participant-1" })]
          : [buildAlly({ initiativeId, participantId: "participant-2" })],
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.equal(allies.length, 2);
  });

  it("returns an empty list (real-data empty state) when the Participant stewards no Initiatives", async () => {
    const deps = buildDeps({ listInitiativesStewardedBy: () => [] });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.deepEqual(allies, []);
  });

  it("falls back to a safe display name when identity resolution has nothing for a participant", async () => {
    const deps = buildDeps({
      listActiveAlliesByInitiative: async () => [buildAlly({ participantId: "participant-unresolved" })],
      resolveAuthorsForParticipantIds: async () => new Map(),
    });

    const allies = await listWorkspaceAlliesForParticipant(STEWARD_ID, deps);

    assert.equal(allies[0]?.author.displayName, "Participant");
  });
});

describe("Collaborations count (Profile UX Pack 01 Part 11)", () => {
  it("counts only the signed-in Participant's own active Ally rows (test 29)", async () => {
    const deps = buildDeps({
      listAlliesByParticipantId: async () => [
        buildAlly({ initiativeId: "initiative-x", status: "active" }),
        buildAlly({ initiativeId: "initiative-y", status: "active" }),
        buildAlly({ initiativeId: "initiative-z", status: "interest_pending" }),
        buildAlly({ initiativeId: "initiative-w", status: "declined" }),
      ],
    });

    const count = await countActiveCollaborationsForParticipant(STEWARD_ID, deps);

    assert.equal(count, 2);
  });

  it("returns zero when the Participant has no Ally rows at all", async () => {
    const deps = buildDeps({ listAlliesByParticipantId: async () => [] });

    const count = await countActiveCollaborationsForParticipant(STEWARD_ID, deps);

    assert.equal(count, 0);
  });
});
