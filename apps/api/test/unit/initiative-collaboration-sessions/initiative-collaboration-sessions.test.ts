import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeCollaborationSession,
  InitiativeCollaborationSessionAttendance,
  InitiativeCollaborationSessionInput,
} from "@hu/types";

import {
  InitiativeCollaborationSessionAttendanceRestrictedError,
  InitiativeCollaborationSessionAuthorOnlyError,
  InitiativeCollaborationSessionNotFoundError,
} from "../../../src/modules/initiative-collaboration-sessions/initiative-collaboration-sessions.errors.js";
import { resolveInitiativeCollaborationChannelAccess } from "../../../src/modules/initiative-collaboration-channel/initiative-collaboration-channel-access.js";
import {
  cancelInitiativeCollaborationSession,
  createInitiativeCollaborationSession,
  getInitiativeCollaborationSession,
  listInitiativeCollaborationSessions,
  setInitiativeCollaborationSessionAttendance,
  updateInitiativeCollaborationSession,
  type InitiativeCollaborationSessionDependencies,
} from "../../../src/modules/initiative-collaboration-sessions/initiative-collaboration-sessions.service.js";
import { resolveScheduledAtUtc } from "../../../src/modules/initiative-collaboration-sessions/initiative-collaboration-sessions.validators.js";

/**
 * Communication UX Pack 03.6 Part 16 — Collaboration Sessions, exercised
 * fully MongoDB-free through the module's injectable dependencies (mirrors
 * the Collaboration Channel test convention, Communication UX Pack 03.5).
 */

const INITIATIVE_ID = "initiative-1";
const AUTHOR_ID = "participant-author";
const ALLY_ID = "participant-ally-1";
const OTHER_ALLY_ID = "participant-ally-2";
const OUTSIDER_ID = "participant-outsider";

function identity(participantId: string) {
  return { participantId };
}

function validSessionInput(overrides: Partial<InitiativeCollaborationSessionInput> = {}): InitiativeCollaborationSessionInput {
  return {
    title: "Weekly sync",
    agenda: "Review open items",
    description: "Discuss progress on the improvement proposal.",
    meetingDate: "2099-01-15",
    meetingTime: "14:00",
    timezone: "UTC",
    estimatedDurationMinutes: 30,
    externalMeetingLink: "https://meet.example.com/abc-defg-hij",
    ...overrides,
  };
}

interface FakeStoreState {
  sessions: InitiativeCollaborationSession[];
  attendance: InitiativeCollaborationSessionAttendance[];
  notifications: Array<{ kind: string; recipientParticipantId: string; actorParticipantId?: string }>;
  currentTime: Date;
}

function buildFakeState(): FakeStoreState {
  return { sessions: [], attendance: [], notifications: [], currentTime: new Date("2090-01-01T00:00:00.000Z") };
}

function buildDeps(
  state: FakeStoreState,
  overrides: Partial<InitiativeCollaborationSessionDependencies> = {},
): InitiativeCollaborationSessionDependencies {
  return {
    resolveAccess: (initiativeId, participantId) =>
      resolveInitiativeCollaborationChannelAccess(initiativeId, participantId, {
        getInitiative: (id) => (id === INITIATIVE_ID ? { initiativeId: INITIATIVE_ID, stewardId: AUTHOR_ID } : null),
        findActiveAlly: async (id, pid) =>
          id === INITIATIVE_ID && (pid === ALLY_ID || pid === OTHER_ALLY_ID) ? { status: "active" } : null,
      }),
    insertSession: async (session) => {
      state.sessions.push(session);
    },
    replaceSession: async (session) => {
      state.sessions = state.sessions.map((existing) => (existing.sessionId === session.sessionId ? session : existing));
    },
    findSessionById: async (initiativeId, sessionId) =>
      state.sessions.find((session) => session.initiativeId === initiativeId && session.sessionId === sessionId) ?? null,
    listSessionsByInitiative: async (initiativeId) =>
      state.sessions.filter((session) => session.initiativeId === initiativeId),
    upsertAttendance: async (attendance) => {
      const index = state.attendance.findIndex(
        (existing) => existing.sessionId === attendance.sessionId && existing.participantId === attendance.participantId,
      );

      if (index >= 0) {
        state.attendance[index] = attendance;
      } else {
        state.attendance.push(attendance);
      }
    },
    listAttendanceBySessionId: async (sessionId) =>
      state.attendance.filter((entry) => entry.sessionId === sessionId),
    listAttendanceByInitiativeId: async (initiativeId) =>
      state.attendance.filter((entry) => entry.initiativeId === initiativeId),
    resolveIdentities: async (participantIds) =>
      new Map(participantIds.map((id) => [id, { displayName: `Name ${id}` }])),
    listActiveAllies: async (initiativeId) =>
      initiativeId === INITIATIVE_ID ? [{ participantId: ALLY_ID }, { participantId: OTHER_ALLY_ID }] : [],
    notifyCreated: (input) => {
      state.notifications.push({ kind: "created", ...input });
    },
    notifyUpdated: (input) => {
      state.notifications.push({ kind: "updated", ...input });
    },
    notifyCancelled: (input) => {
      state.notifications.push({ kind: "cancelled", ...input });
    },
    notifyAttendanceChanged: (input) => {
      state.notifications.push({ kind: "attendance_changed", ...input });
    },
    remindUpcoming: () => {},
    now: () => state.currentTime,
    ...overrides,
  };
}

describe("Initiative Collaboration Sessions authorization", () => {
  it("throws not-found for an unknown Initiative", async () => {
    const state = buildFakeState();

    await assert.rejects(
      () => createInitiativeCollaborationSession(identity(AUTHOR_ID), "missing", validSessionInput(), buildDeps(state)),
      { name: "InitiativeCollaborationChannelNotFoundError" },
    );
  });

  it("denies a guest/non-Ally from listing Sessions", async () => {
    const state = buildFakeState();

    await assert.rejects(
      () => listInitiativeCollaborationSessions(identity(OUTSIDER_ID), INITIATIVE_ID, buildDeps(state)),
      { name: "InitiativeCollaborationChannelAccessDeniedError" },
    );
  });

  it("allows the Author to create; denies an Active Ally (Part 5)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);
    assert.equal(created.canEdit, true);

    await assert.rejects(
      () => createInitiativeCollaborationSession(identity(ALLY_ID), INITIATIVE_ID, validSessionInput(), deps),
      InitiativeCollaborationSessionAuthorOnlyError,
    );
  });

  it("denies an Active Ally from editing or cancelling another Author's session", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    await assert.rejects(
      () => updateInitiativeCollaborationSession(identity(ALLY_ID), INITIATIVE_ID, created.sessionId, validSessionInput(), deps),
      InitiativeCollaborationSessionAuthorOnlyError,
    );
    await assert.rejects(
      () => cancelInitiativeCollaborationSession(identity(ALLY_ID), INITIATIVE_ID, created.sessionId, deps),
      InitiativeCollaborationSessionAuthorOnlyError,
    );
  });

  it("denies the Author from recording attendance on their own session (Part 6)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    await assert.rejects(
      () => setInitiativeCollaborationSessionAttendance(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, "accepted", deps),
      InitiativeCollaborationSessionAttendanceRestrictedError,
    );
  });
});

describe("Initiative Collaboration Sessions CRUD (Part 3/5)", () => {
  it("rejects invalid input (empty title, bad date/time, unknown timezone, oversized duration, non-http link)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await assert.rejects(() =>
      createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput({ title: "   " }), deps),
    );
    await assert.rejects(() =>
      createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput({ meetingDate: "2099-13-40" }), deps),
    );
    await assert.rejects(() =>
      createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput({ meetingTime: "25:99" }), deps),
    );
    await assert.rejects(() =>
      createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput({ timezone: "Not/AZone" }), deps),
    );
    await assert.rejects(() =>
      createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput({ estimatedDurationMinutes: 10_000 }), deps),
    );
    await assert.rejects(() =>
      createInitiativeCollaborationSession(
        identity(AUTHOR_ID),
        INITIATIVE_ID,
        validSessionInput({ externalMeetingLink: "javascript:alert(1)" }),
        deps,
      ),
    );
  });

  it("creates a Session, deriving scheduledAtUtc from date+time+timezone, and notifies every Active Ally", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    assert.equal(created.title, "Weekly sync");
    assert.equal(created.status, "upcoming");
    assert.equal(created.createdByParticipantId, AUTHOR_ID);
    assert.equal(created.scheduledAtUtc, resolveScheduledAtUtc("2099-01-15", "14:00", "UTC"));

    const recipients = state.notifications.filter((n) => n.kind === "created").map((n) => n.recipientParticipantId);
    assert.deepEqual(new Set(recipients), new Set([ALLY_ID, OTHER_ALLY_ID]));
  });

  it("edits/reschedules a Session and notifies every Active Ally", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);
    state.currentTime = new Date(state.currentTime.getTime() + 60_000);

    const updated = await updateInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      created.sessionId,
      validSessionInput({ title: "Rescheduled sync", meetingTime: "16:00" }),
      deps,
    );

    assert.equal(updated.title, "Rescheduled sync");
    assert.equal(updated.meetingTime, "16:00");
    assert.equal(updated.createdAt, created.createdAt, "createdAt must never change on edit");
    assert.notEqual(updated.updatedAt, created.updatedAt);

    const recipients = state.notifications.filter((n) => n.kind === "updated").map((n) => n.recipientParticipantId);
    assert.deepEqual(new Set(recipients), new Set([ALLY_ID, OTHER_ALLY_ID]));
  });

  it("cancels a Session (idempotently) and notifies every Active Ally exactly once", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    const cancelled = await cancelInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, deps);
    assert.equal(cancelled.status, "cancelled");

    await cancelInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, deps);

    const recipients = state.notifications.filter((n) => n.kind === "cancelled");
    assert.equal(recipients.length, 2, "cancel notification fan-out must not repeat on a second cancel call");
  });

  it("rejects editing a cancelled Session and rejects attendance on a cancelled Session", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);
    await cancelInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, deps);

    await assert.rejects(() =>
      updateInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, validSessionInput(), deps),
    );
    await assert.rejects(() =>
      setInitiativeCollaborationSessionAttendance(identity(ALLY_ID), INITIATIVE_ID, created.sessionId, "accepted", deps),
    );
  });

  it("throws not-found for an unknown sessionId", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);

    await assert.rejects(
      () => getInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, "missing-session", deps),
      InitiativeCollaborationSessionNotFoundError,
    );
  });
});

describe("Initiative Collaboration Sessions status derivation (Part 3)", () => {
  it("derives upcoming vs completed purely from scheduledAtUtc + duration compared to the injected clock", async () => {
    const state = buildFakeState();
    state.currentTime = new Date("2099-01-15T13:00:00.000Z");
    const deps = buildDeps(state);

    const created = await createInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      validSessionInput({ meetingDate: "2099-01-15", meetingTime: "14:00", estimatedDurationMinutes: 30 }),
      deps,
    );
    assert.equal(created.status, "upcoming");

    state.currentTime = new Date("2099-01-15T14:45:00.000Z");
    const midway = await getInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, deps);
    assert.equal(midway.status, "completed");
  });
});

describe("Initiative Collaboration Sessions attendance (Part 6)", () => {
  it("records Accept/Maybe/Decline, updates totals, and notifies the Author", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    const afterAllyOne = await setInitiativeCollaborationSessionAttendance(
      identity(ALLY_ID),
      INITIATIVE_ID,
      created.sessionId,
      "accepted",
      deps,
    );
    assert.equal(afterAllyOne.viewerResponse, "accepted");
    assert.equal(afterAllyOne.attendanceTotals.accepted, 1);
    assert.equal(afterAllyOne.attendanceTotals.noResponse, 1);

    await setInitiativeCollaborationSessionAttendance(identity(OTHER_ALLY_ID), INITIATIVE_ID, created.sessionId, "declined", deps);

    const asAuthor = await getInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, created.sessionId, deps);
    assert.equal(asAuthor.attendanceTotals.accepted, 1);
    assert.equal(asAuthor.attendanceTotals.declined, 1);
    assert.equal(asAuthor.attendanceTotals.noResponse, 0);
    assert.equal(asAuthor.viewerResponse, null, "the Author never has a viewerResponse — they organize, they do not RSVP");
    assert.ok(asAuthor.attendanceRoster);
    assert.equal(asAuthor.attendanceRoster!.length, 2);

    const recipients = state.notifications.filter((n) => n.kind === "attendance_changed").map((n) => n.recipientParticipantId);
    assert.deepEqual(recipients, [AUTHOR_ID, AUTHOR_ID]);
  });

  it("allows an Ally to change their response idempotently (no duplicate attendance rows)", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    await setInitiativeCollaborationSessionAttendance(identity(ALLY_ID), INITIATIVE_ID, created.sessionId, "maybe", deps);
    const updated = await setInitiativeCollaborationSessionAttendance(
      identity(ALLY_ID),
      INITIATIVE_ID,
      created.sessionId,
      "accepted",
      deps,
    );

    assert.equal(updated.viewerResponse, "accepted");
    assert.equal(updated.attendanceTotals.accepted, 1);
    assert.equal(updated.attendanceTotals.maybe, 0);
    assert.equal(state.attendance.length, 1);
  });

  it("does not expose the attendance roster to an Active Ally viewer", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    const created = await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    const asAlly = await getInitiativeCollaborationSession(identity(ALLY_ID), INITIATIVE_ID, created.sessionId, deps);
    assert.equal(asAlly.attendanceRoster, undefined);
    assert.equal(asAlly.canRespond, true);
    assert.equal(asAlly.canEdit, false);
  });
});

describe("Initiative Collaboration Sessions list ordering (Part 4)", () => {
  it("orders Upcoming first (soonest first), then history most-recent-first, with Cancelled remaining visible", async () => {
    const state = buildFakeState();
    state.currentTime = new Date("2099-01-10T00:00:00.000Z");
    const deps = buildDeps(state);

    const past = await createInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      validSessionInput({ title: "Past session", meetingDate: "2099-01-01", meetingTime: "09:00", estimatedDurationMinutes: 30 }),
      deps,
    );
    const soon = await createInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      validSessionInput({ title: "Soon session", meetingDate: "2099-01-11", meetingTime: "09:00" }),
      deps,
    );
    const later = await createInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      validSessionInput({ title: "Later session", meetingDate: "2099-01-20", meetingTime: "09:00" }),
      deps,
    );
    const toCancel = await createInitiativeCollaborationSession(
      identity(AUTHOR_ID),
      INITIATIVE_ID,
      validSessionInput({ title: "Cancelled session", meetingDate: "2099-01-05", meetingTime: "09:00" }),
      deps,
    );
    await cancelInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, toCancel.sessionId, deps);

    const list = await listInitiativeCollaborationSessions(identity(AUTHOR_ID), INITIATIVE_ID, deps);
    const titles = list.sessions.map((session) => session.title);

    assert.deepEqual(titles, ["Soon session", "Later session", "Cancelled session", "Past session"]);
    assert.equal(list.canCreate, true);
    assert.equal(list.sessions.find((s) => s.sessionId === past.sessionId)?.status, "completed");
    assert.equal(list.sessions.find((s) => s.sessionId === soon.sessionId)?.status, "upcoming");
    assert.equal(list.sessions.find((s) => s.sessionId === later.sessionId)?.status, "upcoming");
  });

  it("gives an Active Ally viewer canCreate=false and canEdit=false on every session", async () => {
    const state = buildFakeState();
    const deps = buildDeps(state);
    await createInitiativeCollaborationSession(identity(AUTHOR_ID), INITIATIVE_ID, validSessionInput(), deps);

    const list = await listInitiativeCollaborationSessions(identity(ALLY_ID), INITIATIVE_ID, deps);

    assert.equal(list.canCreate, false);
    assert.ok(list.sessions.every((session) => session.canEdit === false));
  });
});
