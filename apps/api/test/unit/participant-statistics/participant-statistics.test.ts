import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getParticipantStatistics,
  type ParticipantStatisticsDependencies,
} from "../../../src/modules/participant-statistics/participant-statistics.service.js";

/**
 * Profile UX Pack 02 Part 1/11 — the single shared aggregation layer behind
 * Workspace, Member Profile, and Public Profile statistics. Exercised fully
 * Mongo-free through the module's injectable `ParticipantStatisticsDependencies`,
 * mirroring `workspace-allies.test.ts`.
 */

const PARTICIPANT_ID = "participant-1";

function buildDeps(
  overrides: Partial<ParticipantStatisticsDependencies> = {},
): ParticipantStatisticsDependencies {
  return {
    listInitiativesStewardedBy: () => [],
    listWorkspaceAlliesForParticipant: async () => [],
    countActiveCollaborationsForParticipant: async () => 0,
    ...overrides,
  };
}

describe("getParticipantStatistics (Profile UX Pack 02 Part 1/11)", () => {
  it("returns all zeros for a Participant with no Initiatives, Allies, or Collaborations", async () => {
    const statistics = await getParticipantStatistics(PARTICIPANT_ID, buildDeps());

    assert.deepEqual(statistics, {
      initiativesCount: 0,
      collectiveDecisionsCount: 0,
      alliesCount: 0,
    });
  });

  it("Initiatives count reflects the number of Initiatives stewarded by the Participant", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [
        { initiativeId: "initiative-a" },
        { initiativeId: "initiative-b" },
        { initiativeId: "initiative-c" },
      ],
    });

    const statistics = await getParticipantStatistics(PARTICIPANT_ID, deps);

    assert.equal(statistics.initiativesCount, 3);
  });

  it("Collective Decisions count reuses the real active-collaboration-membership count (not Discussion clicks)", async () => {
    const deps = buildDeps({
      countActiveCollaborationsForParticipant: async () => 4,
    });

    const statistics = await getParticipantStatistics(PARTICIPANT_ID, deps);

    assert.equal(statistics.collectiveDecisionsCount, 4);
  });

  it("Allies count reuses the existing Workspace Allies aggregation, counting unique active Allies", async () => {
    const deps = buildDeps({
      listWorkspaceAlliesForParticipant: async () => [
        { participantId: "ally-1" },
        { participantId: "ally-2" },
      ],
    });

    const statistics = await getParticipantStatistics(PARTICIPANT_ID, deps);

    assert.equal(statistics.alliesCount, 2);
  });

  it("computes all three numbers independently in a single call", async () => {
    const deps = buildDeps({
      listInitiativesStewardedBy: () => [{ initiativeId: "initiative-a" }],
      countActiveCollaborationsForParticipant: async () => 2,
      listWorkspaceAlliesForParticipant: async () => [
        { participantId: "ally-1" },
        { participantId: "ally-2" },
        { participantId: "ally-3" },
      ],
    });

    const statistics = await getParticipantStatistics(PARTICIPANT_ID, deps);

    assert.deepEqual(statistics, {
      initiativesCount: 1,
      collectiveDecisionsCount: 2,
      alliesCount: 3,
    });
  });

  it("passes the exact participantId through to every dependency", async () => {
    const seenIds: string[] = [];
    const deps = buildDeps({
      listInitiativesStewardedBy: (participantId) => {
        seenIds.push(participantId);
        return [];
      },
      listWorkspaceAlliesForParticipant: async (participantId) => {
        seenIds.push(participantId);
        return [];
      },
      countActiveCollaborationsForParticipant: async (participantId) => {
        seenIds.push(participantId);
        return 0;
      },
    });

    await getParticipantStatistics(PARTICIPANT_ID, deps);

    assert.deepEqual(seenIds, [PARTICIPANT_ID, PARTICIPANT_ID, PARTICIPANT_ID]);
  });
});
