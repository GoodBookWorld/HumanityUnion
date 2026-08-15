import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicCommentAuthor } from "@hu/types";

import {
  buildAlliesSummary,
  type AlliesSummaryDependencies,
} from "../../../src/modules/workspace-home/workspace-home.service.js";
import type { WorkspaceAllyEntry } from "../../../src/modules/initiative-discussion-collaboration/workspace-allies.service.js";

/**
 * Communication UX Pack 03.3.1 Part 4/11 — `buildAlliesSummary` is the one
 * aggregation shared by the full `GET /home` payload (Workspace Home
 * "Allies" widget) and the new `GET /home/allies` route (Workspace Messages
 * "Active Allies" panel). Exercised fully MongoDB-free through its
 * injectable `AlliesSummaryDependencies`, with call-count assertions
 * guarding against the exact N+1 shape Part 11 forbids (one identity/ally
 * query and one unread query total, never one per Ally).
 */

function author(overrides: Partial<PublicCommentAuthor> = {}): PublicCommentAuthor {
  return { displayName: "Ally Participant", ...overrides };
}

function buildDeps(overrides: Partial<AlliesSummaryDependencies> = {}): AlliesSummaryDependencies {
  const allies: WorkspaceAllyEntry[] = [
    { participantId: "participant-ally-1", author: author({ displayName: "Ally One" }), sharedInitiativeCount: 2 },
    { participantId: "participant-ally-2", author: author({ displayName: "Ally Two" }), sharedInitiativeCount: 1 },
  ];

  return {
    listWorkspaceAlliesForParticipant: async () => allies,
    countActiveCollaborationsForParticipant: async () => 3,
    listUnreadDirectMessageSenderParticipantIds: async () => new Set(["participant-ally-2"]),
    ...overrides,
  };
}

describe("buildAlliesSummary", () => {
  it("maps Workspace Allies into the shared summary shape", async () => {
    const summary = await buildAlliesSummary("participant-viewer", buildDeps());

    assert.equal(summary.items.length, 2);
    assert.equal(summary.items[0]?.participantId, "participant-ally-1");
    assert.equal(summary.items[0]?.displayName, "Ally One");
    assert.equal(summary.items[0]?.sharedInitiativeCount, 2);
    assert.equal(summary.items[0]?.hasUnreadMessages, false);
    assert.equal(summary.items[1]?.hasUnreadMessages, true);
  });

  it("computes alliesCount and collaborationsCount independently", async () => {
    const summary = await buildAlliesSummary("participant-viewer", buildDeps());

    assert.equal(summary.alliesCount, 2);
    assert.equal(summary.collaborationsCount, 3);
  });

  it("returns an empty items list without throwing when there are no Allies", async () => {
    const summary = await buildAlliesSummary(
      "participant-viewer",
      buildDeps({
        listWorkspaceAlliesForParticipant: async () => [],
        countActiveCollaborationsForParticipant: async () => 0,
      }),
    );

    assert.deepEqual(summary.items, []);
    assert.equal(summary.alliesCount, 0);
  });

  it("calls each dependency exactly once regardless of Ally count (no N+1 queries)", async () => {
    let alliesCalls = 0;
    let collaborationsCalls = 0;
    let unreadCalls = 0;

    await buildAlliesSummary(
      "participant-viewer",
      buildDeps({
        listWorkspaceAlliesForParticipant: async () => {
          alliesCalls += 1;
          return [
            { participantId: "participant-ally-1", author: author(), sharedInitiativeCount: 1 },
            { participantId: "participant-ally-2", author: author(), sharedInitiativeCount: 1 },
            { participantId: "participant-ally-3", author: author(), sharedInitiativeCount: 1 },
          ];
        },
        countActiveCollaborationsForParticipant: async () => {
          collaborationsCalls += 1;
          return 0;
        },
        listUnreadDirectMessageSenderParticipantIds: async () => {
          unreadCalls += 1;
          return new Set<string>();
        },
      }),
    );

    assert.equal(alliesCalls, 1, "Allies must be resolved with exactly one batch call");
    assert.equal(collaborationsCalls, 1, "Collaborations count must be resolved with exactly one call");
    assert.equal(unreadCalls, 1, "Unread state must be resolved with exactly one batch call");
  });

  it("never exposes hidden fields beyond the documented public projection", async () => {
    const summary = await buildAlliesSummary("participant-viewer", buildDeps());

    for (const item of summary.items) {
      assert.deepEqual(Object.keys(item).sort(), [
        "avatarUrl",
        "displayName",
        "hasUnreadMessages",
        "participantId",
        "profileUrl",
        "sharedInitiativeCount",
      ]);
    }
  });
});
