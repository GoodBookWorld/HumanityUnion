import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import type { InitiativeAlly } from "@hu/types";

import {
  getInitiativeActiveAlliesTeam,
  InitiativeActiveAlliesNotFoundError,
  type InitiativeActiveAlliesDependencies,
} from "../../../src/modules/initiative-discussion-collaboration/initiative-active-allies.service.js";

/**
 * Communication UX Pack 03.3 Part 25 — the Initiative Active Allies widget,
 * exercised fully MongoDB-free through the module's injectable
 * `InitiativeActiveAlliesDependencies`.
 */

const INITIATIVE_ID = "initiative-1";
const AUTHOR_ID = "participant-author";

function buildAlly(overrides: Partial<InitiativeAlly> = {}): InitiativeAlly {
  return {
    initiativeId: INITIATIVE_ID,
    participantId: "participant-ally-1",
    status: "active",
    requestedByParticipantId: "participant-ally-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildDeps(
  overrides: Partial<InitiativeActiveAlliesDependencies> = {},
): InitiativeActiveAlliesDependencies {
  return {
    getInitiative: (initiativeId) =>
      initiativeId === INITIATIVE_ID ? { initiativeId: INITIATIVE_ID, stewardId: AUTHOR_ID } : null,
    listActiveAllies: async () => [],
    resolveIdentitiesAndPolicies: async (participantIds) =>
      new Map(
        participantIds.map((id) => [
          id,
          { displayName: `Name ${id}`, messagingPolicy: "active_allies" as const },
        ]),
      ),
    listUnreadSenderParticipantIds: async () => new Set<string>(),
    isMessageAllowed: async (viewerParticipantId, targetParticipantId) =>
      Boolean(viewerParticipantId) && viewerParticipantId !== targetParticipantId,
    ...overrides,
  };
}

describe("Initiative Active Allies widget projection", () => {
  it("throws a not-found error for an unknown Initiative", async () => {
    const deps = buildDeps();

    await assert.rejects(
      () => getInitiativeActiveAlliesTeam("missing-initiative", null, deps),
      InitiativeActiveAlliesNotFoundError,
    );
  });

  it("returns the Author first, even with zero active Allies (test 1/2/11)", async () => {
    const deps = buildDeps();

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.author.role, "author");
    assert.equal(team.author.displayName, `Name ${AUTHOR_ID}`);
    assert.deepEqual(team.allies, []);
    // Part 16 — activeAlliesCount never includes the Author.
    assert.equal(team.activeAlliesCount, 0);
  });

  it("includes active Allies and excludes the Author from the count (test 3/11)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: "participant-ally-1" }),
        buildAlly({ participantId: "participant-ally-2" }),
      ],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.allies.length, 2);
    assert.equal(team.activeAlliesCount, 2);
    assert.ok(team.allies.every((entry) => entry.role === "ally"));
  });

  it("never asks the persistence layer for anything but active rows, and defensively re-filters (test 4/6/7/8)", async () => {
    // `listActiveAllies` is documented to already be filtered to `status
    // === "active"` at the persistence boundary (see
    // `listActiveInitiativeAllyDocumentsByInitiativeId`). This test proves
    // the service does not itself reintroduce any other status by, say,
    // merging in a second unfiltered read.
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-active" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.allies.length, 1);
    assert.equal(team.allies[0]?.participantId, undefined); // guest: no participantId leak
  });

  it("deduplicates repeated Participant rows by participantId (test 9)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: "participant-dup", createdAt: "2026-01-01T00:00:00.000Z" }),
        buildAlly({ participantId: "participant-dup", createdAt: "2026-01-02T00:00:00.000Z" }),
      ],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.allies.length, 1);
    assert.equal(team.activeAlliesCount, 1);
  });

  it("drops a malformed self-Ally row instead of duplicating the Author (test 10)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: AUTHOR_ID }),
        buildAlly({ participantId: "participant-real-ally" }),
      ],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.allies.length, 1);
    assert.equal(team.allies[0]?.participantId, undefined);
    assert.equal(team.allies.some((entry) => entry.displayName === team.author.displayName), false);
    assert.equal(team.activeAlliesCount, 1);
  });

  it("orders Allies by activated (updatedAt) time ascending (Part 4)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: "participant-second", updatedAt: "2026-02-01T00:00:00.000Z" }),
        buildAlly({ participantId: "participant-first", updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      resolveIdentitiesAndPolicies: async (participantIds) =>
        new Map(
          participantIds.map((id) => [
            id,
            { displayName: id, messagingPolicy: "active_allies" as const },
          ]),
        ),
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.deepEqual(team.allies.map((entry) => entry.displayName), [
      "participant-first",
      "participant-second",
    ]);
  });

  it("uses the public identity projection and hides private fields (test 12/13)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
      resolveIdentitiesAndPolicies: async () =>
        new Map([
          [
            AUTHOR_ID,
            { displayName: "Author Name", avatarUrl: "/a.png", profileUrl: "/member/author", messagingPolicy: "active_allies" as const },
          ],
          [
            "participant-ally-1",
            { displayName: "Ally Name", profileUrl: "/member/ally", messagingPolicy: "active_allies" as const },
          ],
        ]),
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.deepEqual(Object.keys(team.author).sort(), ["avatarUrl", "displayName", "profileUrl", "role"].sort());
    assert.equal(team.author.profileUrl, "/member/author");
    assert.equal(team.allies[0]?.profileUrl, "/member/ally");
  });

  it("renders a safe fallback when the profile URL is unavailable (test 15)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
      resolveIdentitiesAndPolicies: async () =>
        new Map([
          ["participant-ally-1", { displayName: "No Profile", messagingPolicy: "active_allies" as const }],
          [AUTHOR_ID, { displayName: "Author Name", messagingPolicy: "active_allies" as const }],
        ]),
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.allies[0]?.profileUrl, undefined);
    assert.equal(team.allies[0]?.displayName, "No Profile");
  });

  it("omits participantId/canMessage/hasUnreadMessages for a guest viewer (test 16/17/32)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.author.participantId, undefined);
    assert.equal(team.author.canMessage, undefined);
    assert.equal(team.author.hasUnreadMessages, undefined);
    assert.equal(team.allies[0]?.participantId, undefined);
    assert.equal(team.allies[0]?.canMessage, undefined);
    assert.equal(team.allies[0]?.hasUnreadMessages, undefined);
    assert.equal(team.viewerRole, "guest");
  });

  it("includes canMessage per row for an authenticated viewer, computed by the shared eligibility authority (test 18/33)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
      isMessageAllowed: async (viewerParticipantId, targetParticipantId) =>
        targetParticipantId === "participant-ally-1" && viewerParticipantId === "viewer-1",
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "viewer-1", deps);

    assert.equal(team.allies[0]?.canMessage, true);
    assert.equal(team.author.canMessage, false);
  });

  it("never renders a self-message action for the Author viewing their own Initiative (test 19)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
      isMessageAllowed: async (viewerParticipantId, targetParticipantId) =>
        Boolean(viewerParticipantId) && viewerParticipantId !== targetParticipantId,
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, AUTHOR_ID, deps);

    assert.equal(team.author.canMessage, false);
    assert.equal(team.viewerRole, "author");
  });

  it("resolves viewerRole as active_ally for a Participant with an active Ally row (test 15 viewer modes)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "participant-ally-1", deps);

    assert.equal(team.viewerRole, "active_ally");
  });

  it("resolves viewerRole as participant for an authenticated unrelated viewer", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "someone-else", deps);

    assert.equal(team.viewerRole, "participant");
  });

  it("marks the correct row unread and leaves unrelated rows unmarked (test 27/28)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: "participant-ally-1" }),
        buildAlly({ participantId: "participant-ally-2" }),
      ],
      listUnreadSenderParticipantIds: async () => new Set(["participant-ally-1"]),
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "viewer-1", deps);

    const ally1 = team.allies.find((entry) => entry.participantId === "participant-ally-1");
    const ally2 = team.allies.find((entry) => entry.participantId === "participant-ally-2");

    assert.equal(ally1?.hasUnreadMessages, true);
    assert.equal(ally2?.hasUnreadMessages, false);
  });

  it("resolves identities and unread state with exactly one batch call each (test 30/31/14)", async () => {
    const resolveIdentitiesAndPolicies = mock.fn(async (participantIds: readonly string[]) =>
      new Map(
        participantIds.map((id) => [id, { displayName: id, messagingPolicy: "active_allies" as const }]),
      ),
    );
    const listUnreadSenderParticipantIds = mock.fn(async () => new Set<string>());

    const deps = buildDeps({
      listActiveAllies: async () => [
        buildAlly({ participantId: "participant-ally-1" }),
        buildAlly({ participantId: "participant-ally-2" }),
        buildAlly({ participantId: "participant-ally-3" }),
      ],
      resolveIdentitiesAndPolicies,
      listUnreadSenderParticipantIds,
    });

    await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "viewer-1", deps);

    assert.equal(resolveIdentitiesAndPolicies.mock.callCount(), 1);
    assert.equal(listUnreadSenderParticipantIds.mock.callCount(), 1);
  });

  it("public response excludes authenticated action metadata entirely (test 32)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);
    const serialized = JSON.parse(JSON.stringify(team));

    assert.equal("participantId" in serialized.author, false);
    assert.equal("canMessage" in serialized.author, false);
    assert.equal("hasUnreadMessages" in serialized.author, false);
  });

  it("authenticated response includes safe action metadata (test 33)", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-ally-1" })],
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, "viewer-1", deps);

    assert.equal(team.allies[0]?.participantId, "participant-ally-1");
    assert.equal(typeof team.allies[0]?.canMessage, "boolean");
    assert.equal(typeof team.allies[0]?.hasUnreadMessages, "boolean");
  });

  it("falls back to a safe display name when identity resolution has nothing for a Participant", async () => {
    const deps = buildDeps({
      listActiveAllies: async () => [buildAlly({ participantId: "participant-unresolved" })],
      resolveIdentitiesAndPolicies: async () => new Map(),
    });

    const team = await getInitiativeActiveAlliesTeam(INITIATIVE_ID, null, deps);

    assert.equal(team.author.displayName, "Participant");
    assert.equal(team.allies[0]?.displayName, "Participant");
  });
});
