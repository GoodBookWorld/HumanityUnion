import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeCollaborationChannelMessage,
  InitiativeCollaborationChannelReadState,
} from "@hu/types";

import {
  InitiativeCollaborationChannelAccessDeniedError,
  InitiativeCollaborationChannelNotFoundError,
} from "../../../src/modules/initiative-collaboration-channel/initiative-collaboration-channel.errors.js";
import { resolveInitiativeCollaborationChannelAccess } from "../../../src/modules/initiative-collaboration-channel/initiative-collaboration-channel-access.js";
import {
  getInitiativeCollaborationChannelSummary,
  listInitiativeCollaborationChannelHistory,
  markInitiativeCollaborationChannelRead,
  postInitiativeCollaborationSystemEvent,
  sendInitiativeCollaborationChannelMessage,
  type InitiativeCollaborationChannelDependencies,
} from "../../../src/modules/initiative-collaboration-channel/initiative-collaboration-channel.service.js";

/**
 * Communication UX Pack 03.5 Part 15/13 — the Initiative Collaboration
 * Channel, exercised fully MongoDB-free through the module's injectable
 * dependencies (mirrors the Active Allies widget test convention, Part 25
 * of Communication UX Pack 03.3).
 */

const INITIATIVE_ID = "initiative-1";
const AUTHOR_ID = "participant-author";
const ALLY_ID = "participant-ally-1";
const OTHER_ALLY_ID = "participant-ally-2";
const OUTSIDER_ID = "participant-outsider";

function identity(participantId: string) {
  return { participantId };
}

interface FakeStoreState {
  messages: InitiativeCollaborationChannelMessage[];
  reads: Map<string, InitiativeCollaborationChannelReadState>;
  notifications: Array<{ kind: "message" | "system_event"; recipientParticipantId: string; actorParticipantId?: string }>;
}

function buildFakeState(): FakeStoreState {
  return { messages: [], reads: new Map(), notifications: [] };
}

function readKey(initiativeId: string, participantId: string): string {
  return `${initiativeId}::${participantId}`;
}

/** ISO timestamps are millisecond-precision; force distinct ticks so ordering assertions are deterministic. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDeps(
  state: FakeStoreState,
  overrides: Partial<InitiativeCollaborationChannelDependencies> = {},
): InitiativeCollaborationChannelDependencies {
  return {
    resolveAccess: (initiativeId, participantId) =>
      resolveInitiativeCollaborationChannelAccess(initiativeId, participantId, {
        getInitiative: (id) => (id === INITIATIVE_ID ? { initiativeId: INITIATIVE_ID, stewardId: AUTHOR_ID } : null),
        findActiveAlly: async (id, pid) =>
          id === INITIATIVE_ID && (pid === ALLY_ID || pid === OTHER_ALLY_ID)
            ? { status: "active" }
            : null,
      }),
    getInitiative: (id) => (id === INITIATIVE_ID ? { initiativeId: INITIATIVE_ID, stewardId: AUTHOR_ID } : null),
    insertMessage: async (message) => {
      state.messages.push(message);
    },
    listRecentMessages: async (initiativeId, limit) => {
      const sorted = [...state.messages]
        .filter((message) => message.initiativeId === initiativeId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const hasMore = sorted.length > limit;
      return { messages: hasMore ? sorted.slice(0, limit) : sorted, hasMore };
    },
    listMessagesBefore: async (initiativeId, cursor, limit) => {
      const sorted = [...state.messages]
        .filter((message) => message.initiativeId === initiativeId && message.createdAt < cursor.createdAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const hasMore = sorted.length > limit;
      return { messages: hasMore ? sorted.slice(0, limit) : sorted, hasMore };
    },
    findLastMessage: async (initiativeId) => {
      const sorted = [...state.messages]
        .filter((message) => message.initiativeId === initiativeId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return sorted[0] ?? null;
    },
    findReadState: async (initiativeId, participantId) =>
      state.reads.get(readKey(initiativeId, participantId)) ?? null,
    upsertReadState: async (readState) => {
      state.reads.set(readKey(readState.initiativeId, readState.participantId), readState);
    },
    countUnreadMessages: async (initiativeId, viewerParticipantId, sinceCreatedAt) =>
      state.messages.filter(
        (message) =>
          message.initiativeId === initiativeId &&
          message.senderParticipantId !== viewerParticipantId &&
          (!sinceCreatedAt || message.createdAt > sinceCreatedAt),
      ).length,
    resolveIdentities: async (participantIds) =>
      new Map(participantIds.map((id) => [id, { displayName: `Name ${id}` }])),
    listActiveAllies: async (initiativeId) =>
      initiativeId === INITIATIVE_ID
        ? [{ participantId: ALLY_ID }, { participantId: OTHER_ALLY_ID }]
        : [],
    getInitiativeTitle: (initiativeId) => (initiativeId === INITIATIVE_ID ? "Test Initiative" : null),
    notifyNewMessage: (input) => {
      state.notifications.push({ kind: "message", ...input });
    },
    notifySystemEvent: (input) => {
      state.notifications.push({ kind: "system_event", ...input });
    },
    ...overrides,
  };
}

describe("Initiative Collaboration Channel authorization", () => {
  it("throws not-found for an unknown Initiative", async () => {
    const state = buildFakeState();

    await assert.rejects(
      () => sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), "missing", "hi", buildDeps(state)),
      InitiativeCollaborationChannelNotFoundError,
    );
  });

  it("grants the Author access", async () => {
    const state = buildFakeState();
    const view = await sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "Hello", buildDeps(state));

    assert.equal(view.sender?.role, "author");
  });

  it("grants an active Ally access", async () => {
    const state = buildFakeState();
    const view = await sendInitiativeCollaborationChannelMessage(identity(ALLY_ID), INITIATIVE_ID, "Hello", buildDeps(state));

    assert.equal(view.sender?.role, "ally");
  });

  it("denies a Participant with no Ally relationship", async () => {
    const state = buildFakeState();

    await assert.rejects(
      () => sendInitiativeCollaborationChannelMessage(identity(OUTSIDER_ID), INITIATIVE_ID, "Hello", buildDeps(state)),
      InitiativeCollaborationChannelAccessDeniedError,
    );
  });

  it("denies a guest (no participantId concept — verified at the route layer, not here) and a pending Ally", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state, {
      resolveAccess: (initiativeId, participantId) =>
        resolveInitiativeCollaborationChannelAccess(initiativeId, participantId, {
          getInitiative: (id) => (id === INITIATIVE_ID ? { initiativeId: INITIATIVE_ID, stewardId: AUTHOR_ID } : null),
          findActiveAlly: async () => ({ status: "interest_pending" }),
        }),
    });

    await assert.rejects(
      () => sendInitiativeCollaborationChannelMessage(identity(OUTSIDER_ID), INITIATIVE_ID, "Hello", deps),
      InitiativeCollaborationChannelAccessDeniedError,
    );
  });
});

describe("Initiative Collaboration Channel messaging", () => {
  it("rejects empty and oversized text", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await assert.rejects(() => sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "   ", deps));
    await assert.rejects(() =>
      sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "x".repeat(2001), deps),
    );
  });

  it("notifies every other access holder, never the sender (Part 7)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "Hello team", deps);

    const recipients = state.notifications.filter((n) => n.kind === "message").map((n) => n.recipientParticipantId);
    assert.deepEqual(new Set(recipients), new Set([ALLY_ID, OTHER_ALLY_ID]));
  });

  it("returns chronological history with sender identity and isOwnMessage", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "First", deps);
    await sleep(2);
    await sendInitiativeCollaborationChannelMessage(identity(ALLY_ID), INITIATIVE_ID, "Second", deps);

    const history = await listInitiativeCollaborationChannelHistory(identity(ALLY_ID), INITIATIVE_ID, {}, deps);

    assert.equal(history.messages.length, 2);
    assert.equal(history.messages[0]?.text, "First");
    assert.equal(history.messages[0]?.isOwnMessage, false);
    assert.equal(history.messages[1]?.text, "Second");
    assert.equal(history.messages[1]?.isOwnMessage, true);
    assert.equal(history.hasMoreOlderMessages, false);
  });
});

describe("Initiative Collaboration Channel read state / unread count", () => {
  it("counts unread messages from others, excluding the viewer's own", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "From author", deps);
    await sendInitiativeCollaborationChannelMessage(identity(ALLY_ID), INITIATIVE_ID, "From ally, my own", deps);

    const summary = await getInitiativeCollaborationChannelSummary(identity(ALLY_ID), INITIATIVE_ID, deps);

    assert.equal(summary.unreadCount, 1);
    assert.equal(summary.participantCount, 3);
    assert.equal(summary.viewerRole, "active_ally");
  });

  it("zeroes unread count after marking read, even with zero messages", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await markInitiativeCollaborationChannelRead(identity(ALLY_ID), INITIATIVE_ID, deps);
    const summaryEmpty = await getInitiativeCollaborationChannelSummary(identity(ALLY_ID), INITIATIVE_ID, deps);
    assert.equal(summaryEmpty.unreadCount, 0);

    await sleep(2);
    await sendInitiativeCollaborationChannelMessage(identity(AUTHOR_ID), INITIATIVE_ID, "New", deps);
    const summaryAfterNew = await getInitiativeCollaborationChannelSummary(identity(ALLY_ID), INITIATIVE_ID, deps);
    assert.equal(summaryAfterNew.unreadCount, 1);

    await sleep(2);
    await markInitiativeCollaborationChannelRead(identity(ALLY_ID), INITIATIVE_ID, deps);
    const summaryAfterRead = await getInitiativeCollaborationChannelSummary(identity(ALLY_ID), INITIATIVE_ID, deps);
    assert.equal(summaryAfterRead.unreadCount, 0);
  });
});

describe("Initiative Collaboration Channel system events (Part 5/10/12)", () => {
  it("posts a visually-distinct system event message with no sender", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await postInitiativeCollaborationSystemEvent(
      { initiativeId: INITIATIVE_ID, kind: "ally_joined", subjectParticipantId: ALLY_ID, actorParticipantId: ALLY_ID },
      deps,
    );

    assert.equal(state.messages.length, 1);
    assert.equal(state.messages[0]?.type, "system_event");
    assert.equal(state.messages[0]?.senderParticipantId, undefined);
    assert.match(state.messages[0]?.text ?? "", /joined the Collaboration Channel/);
  });

  it("excludes the actor from the system-event notification fan-out", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await postInitiativeCollaborationSystemEvent(
      { initiativeId: INITIATIVE_ID, kind: "ally_joined", subjectParticipantId: ALLY_ID, actorParticipantId: ALLY_ID },
      deps,
    );

    const recipients = state.notifications.filter((n) => n.kind === "system_event").map((n) => n.recipientParticipantId);
    assert.deepEqual(new Set(recipients), new Set([AUTHOR_ID, OTHER_ALLY_ID]));
    assert.ok(!recipients.includes(ALLY_ID));
  });

  it("is a no-op for an unknown Initiative (never throws)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await postInitiativeCollaborationSystemEvent(
      { initiativeId: "missing-initiative", kind: "ally_joined" },
      deps,
    );

    assert.equal(state.messages.length, 0);
  });
});
