import { randomUUID } from "node:crypto";

import type {
  InitiativeCollaborationSession,
  InitiativeCollaborationSessionAttendance,
  InitiativeCollaborationSessionAttendanceResponse,
  InitiativeCollaborationSessionAttendanceRosterEntry,
  InitiativeCollaborationSessionAttendanceTotals,
  InitiativeCollaborationSessionInput,
  InitiativeCollaborationSessionListResult,
  InitiativeCollaborationSessionStatus,
  InitiativeCollaborationSessionView,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { resolvePublicAuthorsForParticipantIds } from "../initiative-discussion-collaboration/public-participant-identity.projection.js";
import {
  resolveInitiativeCollaborationChannelAccess,
  type InitiativeCollaborationChannelAccessDependencies,
} from "../initiative-collaboration-channel/initiative-collaboration-channel-access.js";

import {
  InitiativeCollaborationSessionAttendanceRestrictedError,
  InitiativeCollaborationSessionAuthorOnlyError,
  InitiativeCollaborationSessionNotFoundError,
  InitiativeCollaborationSessionValidationError,
} from "./initiative-collaboration-sessions.errors.js";
import {
  emitInitiativeCollaborationSessionAttendanceChangedNotification,
  emitInitiativeCollaborationSessionCancelledNotification,
  emitInitiativeCollaborationSessionCreatedNotification,
  emitInitiativeCollaborationSessionUpdatedNotification,
} from "./initiative-collaboration-sessions-notifications.js";
import { emitInitiativeCollaborationSessionUpcomingReminder } from "./initiative-collaboration-sessions-reminders.js";
import {
  validateEstimatedDurationMinutes,
  validateExternalMeetingLink,
  validateMeetingDate,
  validateMeetingTime,
  validateOptionalSessionText,
  validateSessionTitle,
  validateTimezone,
  resolveScheduledAtUtc,
  MAX_SESSION_AGENDA_LENGTH,
  MAX_SESSION_DESCRIPTION_LENGTH,
} from "./initiative-collaboration-sessions.validators.js";
import {
  findCollaborationSessionById,
  insertCollaborationSessionDocument,
  listCollaborationSessionAttendanceByInitiativeId,
  listCollaborationSessionAttendanceBySessionId,
  listCollaborationSessionsByInitiative,
  replaceCollaborationSessionDocument,
  upsertCollaborationSessionAttendanceDocument,
} from "./persistence/initiative-collaboration-sessions.repository.js";

/**
 * Communication UX Pack 03.6 — the Collaboration Sessions service. One
 * schedule per Initiative (Part 1): every function here is keyed by
 * `initiativeId` alone. Reuses the exact same Author-or-Active-Ally
 * authorization boundary as the Collaboration Channel (Part 14 — "reuse
 * Initiative authorization" — never a second, parallel access resolver).
 */

interface IdentitySummary {
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
}

export interface InitiativeCollaborationSessionDependencies {
  resolveAccess: typeof resolveInitiativeCollaborationChannelAccess;
  accessDeps?: InitiativeCollaborationChannelAccessDependencies;
  insertSession: typeof insertCollaborationSessionDocument;
  replaceSession: typeof replaceCollaborationSessionDocument;
  findSessionById: typeof findCollaborationSessionById;
  listSessionsByInitiative: typeof listCollaborationSessionsByInitiative;
  upsertAttendance: typeof upsertCollaborationSessionAttendanceDocument;
  listAttendanceBySessionId: typeof listCollaborationSessionAttendanceBySessionId;
  listAttendanceByInitiativeId: typeof listCollaborationSessionAttendanceByInitiativeId;
  resolveIdentities(participantIds: readonly string[]): Promise<Map<string, IdentitySummary>>;
  /** Part 13/14 — the single Active Allies read; every list/roster/totals computation below reuses this one call, never a duplicate participant query. */
  listActiveAllies(initiativeId: string): Promise<Array<{ participantId: string }>>;
  notifyCreated: typeof emitInitiativeCollaborationSessionCreatedNotification;
  notifyUpdated: typeof emitInitiativeCollaborationSessionUpdatedNotification;
  notifyCancelled: typeof emitInitiativeCollaborationSessionCancelledNotification;
  notifyAttendanceChanged: typeof emitInitiativeCollaborationSessionAttendanceChangedNotification;
  /** Part 6/7 — generates the "Upcoming Collaboration Session" Reminder for every other Active Ally when a Session is scheduled. */
  remindUpcoming: typeof emitInitiativeCollaborationSessionUpcomingReminder;
  /** Injectable so status derivation (Part 3) is deterministically testable without real wall-clock timing. */
  now(): Date;
}

const defaultDependencies: InitiativeCollaborationSessionDependencies = {
  resolveAccess: resolveInitiativeCollaborationChannelAccess,
  insertSession: insertCollaborationSessionDocument,
  replaceSession: replaceCollaborationSessionDocument,
  findSessionById: findCollaborationSessionById,
  listSessionsByInitiative: listCollaborationSessionsByInitiative,
  upsertAttendance: upsertCollaborationSessionAttendanceDocument,
  listAttendanceBySessionId: listCollaborationSessionAttendanceBySessionId,
  listAttendanceByInitiativeId: listCollaborationSessionAttendanceByInitiativeId,
  resolveIdentities: resolvePublicAuthorsForParticipantIds,
  listActiveAllies: listActiveAlliesByInitiative,
  notifyCreated: emitInitiativeCollaborationSessionCreatedNotification,
  notifyUpdated: emitInitiativeCollaborationSessionUpdatedNotification,
  notifyCancelled: emitInitiativeCollaborationSessionCancelledNotification,
  notifyAttendanceChanged: emitInitiativeCollaborationSessionAttendanceChangedNotification,
  remindUpcoming: emitInitiativeCollaborationSessionUpcomingReminder,
  now: () => new Date(),
};

function nowIso(deps: InitiativeCollaborationSessionDependencies): string {
  return deps.now().toISOString();
}

function validateSessionInput(rawInput: InitiativeCollaborationSessionInput): {
  title: string;
  agenda?: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  timezone: string;
  estimatedDurationMinutes: number;
  externalMeetingLink?: string;
} {
  return {
    title: validateSessionTitle(rawInput.title),
    agenda: validateOptionalSessionText(rawInput.agenda, "Agenda", MAX_SESSION_AGENDA_LENGTH),
    description: validateOptionalSessionText(rawInput.description, "Description", MAX_SESSION_DESCRIPTION_LENGTH),
    meetingDate: validateMeetingDate(rawInput.meetingDate),
    meetingTime: validateMeetingTime(rawInput.meetingTime),
    timezone: validateTimezone(rawInput.timezone),
    estimatedDurationMinutes: validateEstimatedDurationMinutes(rawInput.estimatedDurationMinutes),
    externalMeetingLink: validateExternalMeetingLink(rawInput.externalMeetingLink),
  };
}

/** Part 3 — always derived from `scheduledAtUtc` + duration compared against "now"; never trusted from storage. */
function deriveSessionStatus(
  session: InitiativeCollaborationSession,
  nowMs: number,
): InitiativeCollaborationSessionStatus {
  if (session.cancelledAt) {
    return "cancelled";
  }

  const endMs = new Date(session.scheduledAtUtc).getTime() + session.estimatedDurationMinutes * 60_000;

  return nowMs >= endMs ? "completed" : "upcoming";
}

function buildAttendanceTotals(
  activeAllyParticipantIds: readonly string[],
  responseByParticipantId: ReadonlyMap<string, InitiativeCollaborationSessionAttendanceResponse>,
): InitiativeCollaborationSessionAttendanceTotals {
  const totals: InitiativeCollaborationSessionAttendanceTotals = {
    accepted: 0,
    maybe: 0,
    declined: 0,
    noResponse: 0,
  };

  for (const participantId of activeAllyParticipantIds) {
    const response = responseByParticipantId.get(participantId);

    if (response === "accepted") {
      totals.accepted += 1;
    } else if (response === "maybe") {
      totals.maybe += 1;
    } else if (response === "declined") {
      totals.declined += 1;
    } else {
      totals.noResponse += 1;
    }
  }

  return totals;
}

function buildSessionView(params: {
  session: InitiativeCollaborationSession;
  attendance: readonly InitiativeCollaborationSessionAttendance[];
  activeAllyParticipantIds: readonly string[];
  identities: ReadonlyMap<string, IdentitySummary>;
  viewerParticipantId: string;
  viewerRole: "author" | "active_ally";
  nowMs: number;
}): InitiativeCollaborationSessionView {
  const { session, attendance, activeAllyParticipantIds, identities, viewerParticipantId, viewerRole, nowMs } = params;
  const responseByParticipantId = new Map(attendance.map((entry) => [entry.participantId, entry.response]));
  const createdByIdentity = identities.get(session.createdByParticipantId);
  const isAuthor = viewerRole === "author";

  return {
    ...session,
    status: deriveSessionStatus(session, nowMs),
    createdBy: {
      displayName: createdByIdentity?.displayName ?? "Participant",
      avatarUrl: createdByIdentity?.avatarUrl,
      profileUrl: createdByIdentity?.profileUrl,
    },
    attendanceTotals: buildAttendanceTotals(activeAllyParticipantIds, responseByParticipantId),
    viewerResponse: viewerRole === "active_ally" ? (responseByParticipantId.get(viewerParticipantId) ?? null) : null,
    canEdit: isAuthor,
    canRespond: viewerRole === "active_ally",
    ...(isAuthor
      ? {
          attendanceRoster: activeAllyParticipantIds.map(
            (participantId): InitiativeCollaborationSessionAttendanceRosterEntry => ({
              participantId,
              displayName: identities.get(participantId)?.displayName ?? "Participant",
              avatarUrl: identities.get(participantId)?.avatarUrl,
              response: responseByParticipantId.get(participantId) ?? null,
            }),
          ),
        }
      : {}),
  };
}

/** Part 4 — Upcoming first (soonest first), then Completed/Cancelled history (most recent first). */
function sortSessionViews(
  views: readonly InitiativeCollaborationSessionView[],
): InitiativeCollaborationSessionView[] {
  const upcoming = views
    .filter((view) => view.status === "upcoming")
    .sort((left, right) => left.scheduledAtUtc.localeCompare(right.scheduledAtUtc));
  const history = views
    .filter((view) => view.status !== "upcoming")
    .sort((left, right) => right.scheduledAtUtc.localeCompare(left.scheduledAtUtc));

  return [...upcoming, ...history];
}

async function requireAuthorAccess(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeCollaborationSessionDependencies,
): Promise<{ stewardId: string }> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);

  if (access.role !== "author") {
    throw new InitiativeCollaborationSessionAuthorOnlyError();
  }

  return access;
}

export async function createInitiativeCollaborationSession(
  identity: RequestIdentity,
  initiativeId: string,
  rawInput: InitiativeCollaborationSessionInput,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionView> {
  await requireAuthorAccess(identity, initiativeId, deps);

  const input = validateSessionInput(rawInput);
  const timestamp = nowIso(deps);
  const session: InitiativeCollaborationSession = {
    sessionId: randomUUID(),
    initiativeId,
    title: input.title,
    agenda: input.agenda,
    description: input.description,
    meetingDate: input.meetingDate,
    meetingTime: input.meetingTime,
    timezone: input.timezone,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    externalMeetingLink: input.externalMeetingLink,
    scheduledAtUtc: resolveScheduledAtUtc(input.meetingDate, input.meetingTime, input.timezone),
    createdByParticipantId: identity.participantId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await deps.insertSession(session);

  const activeAllies = await deps.listActiveAllies(initiativeId);

  for (const ally of activeAllies) {
    deps.notifyCreated({ recipientParticipantId: ally.participantId, actorParticipantId: identity.participantId, initiativeId });
    deps.remindUpcoming({
      recipientParticipantId: ally.participantId,
      actorParticipantId: identity.participantId,
      initiativeId,
      sessionId: session.sessionId,
      sessionTitle: session.title,
      scheduledAtUtc: session.scheduledAtUtc,
    });
  }

  return buildSessionView({
    session,
    attendance: [],
    activeAllyParticipantIds: activeAllies.map((ally) => ally.participantId),
    identities: await deps.resolveIdentities([identity.participantId]),
    viewerParticipantId: identity.participantId,
    viewerRole: "author",
    nowMs: deps.now().getTime(),
  });
}

export async function updateInitiativeCollaborationSession(
  identity: RequestIdentity,
  initiativeId: string,
  sessionId: string,
  rawInput: InitiativeCollaborationSessionInput,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionView> {
  await requireAuthorAccess(identity, initiativeId, deps);

  const existing = await deps.findSessionById(initiativeId, sessionId);

  if (!existing) {
    throw new InitiativeCollaborationSessionNotFoundError("Collaboration Session not found.");
  }

  if (existing.cancelledAt) {
    throw new InitiativeCollaborationSessionValidationError("A cancelled Collaboration Session cannot be edited.");
  }

  const input = validateSessionInput(rawInput);
  const updated: InitiativeCollaborationSession = {
    ...existing,
    title: input.title,
    agenda: input.agenda,
    description: input.description,
    meetingDate: input.meetingDate,
    meetingTime: input.meetingTime,
    timezone: input.timezone,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    externalMeetingLink: input.externalMeetingLink,
    scheduledAtUtc: resolveScheduledAtUtc(input.meetingDate, input.meetingTime, input.timezone),
    updatedAt: nowIso(deps),
  };

  await deps.replaceSession(updated);

  const activeAllies = await deps.listActiveAllies(initiativeId);

  for (const ally of activeAllies) {
    deps.notifyUpdated({ recipientParticipantId: ally.participantId, actorParticipantId: identity.participantId, initiativeId });
  }

  const [attendance, identities] = await Promise.all([
    deps.listAttendanceBySessionId(sessionId),
    deps.resolveIdentities([identity.participantId, ...activeAllies.map((ally) => ally.participantId)]),
  ]);

  return buildSessionView({
    session: updated,
    attendance,
    activeAllyParticipantIds: activeAllies.map((ally) => ally.participantId),
    identities,
    viewerParticipantId: identity.participantId,
    viewerRole: "author",
    nowMs: deps.now().getTime(),
  });
}

export async function cancelInitiativeCollaborationSession(
  identity: RequestIdentity,
  initiativeId: string,
  sessionId: string,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionView> {
  await requireAuthorAccess(identity, initiativeId, deps);

  const existing = await deps.findSessionById(initiativeId, sessionId);

  if (!existing) {
    throw new InitiativeCollaborationSessionNotFoundError("Collaboration Session not found.");
  }

  const timestamp = nowIso(deps);
  const cancelled: InitiativeCollaborationSession = existing.cancelledAt
    ? existing
    : { ...existing, cancelledAt: timestamp, updatedAt: timestamp };
  const wasAlreadyCancelled = Boolean(existing.cancelledAt);

  if (!wasAlreadyCancelled) {
    await deps.replaceSession(cancelled);
  }

  const activeAllies = await deps.listActiveAllies(initiativeId);

  if (!wasAlreadyCancelled) {
    for (const ally of activeAllies) {
      deps.notifyCancelled({ recipientParticipantId: ally.participantId, actorParticipantId: identity.participantId, initiativeId });
    }
  }

  const [attendance, identities] = await Promise.all([
    deps.listAttendanceBySessionId(sessionId),
    deps.resolveIdentities([identity.participantId, ...activeAllies.map((ally) => ally.participantId)]),
  ]);

  return buildSessionView({
    session: cancelled,
    attendance,
    activeAllyParticipantIds: activeAllies.map((ally) => ally.participantId),
    identities,
    viewerParticipantId: identity.participantId,
    viewerRole: "author",
    nowMs: deps.now().getTime(),
  });
}

export async function listInitiativeCollaborationSessions(
  identity: RequestIdentity,
  initiativeId: string,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionListResult> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);

  const [sessions, activeAllies, attendanceRecords] = await Promise.all([
    deps.listSessionsByInitiative(initiativeId),
    deps.listActiveAllies(initiativeId),
    deps.listAttendanceByInitiativeId(initiativeId),
  ]);

  const activeAllyParticipantIds = activeAllies.map((ally) => ally.participantId);
  const identities = await deps.resolveIdentities([
    ...new Set([...sessions.map((session) => session.createdByParticipantId), ...activeAllyParticipantIds]),
  ]);
  const nowMs = deps.now().getTime();

  const views = sessions.map((session) =>
    buildSessionView({
      session,
      attendance: attendanceRecords.filter((entry) => entry.sessionId === session.sessionId),
      activeAllyParticipantIds,
      identities,
      viewerParticipantId: identity.participantId,
      viewerRole: access.role,
      nowMs,
    }),
  );

  return {
    initiativeId,
    sessions: sortSessionViews(views),
    viewerRole: access.role,
    canCreate: access.role === "author",
  };
}

export async function getInitiativeCollaborationSession(
  identity: RequestIdentity,
  initiativeId: string,
  sessionId: string,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionView> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);
  const session = await deps.findSessionById(initiativeId, sessionId);

  if (!session) {
    throw new InitiativeCollaborationSessionNotFoundError("Collaboration Session not found.");
  }

  const [activeAllies, attendance] = await Promise.all([
    deps.listActiveAllies(initiativeId),
    deps.listAttendanceBySessionId(sessionId),
  ]);
  const activeAllyParticipantIds = activeAllies.map((ally) => ally.participantId);
  const identities = await deps.resolveIdentities([session.createdByParticipantId, ...activeAllyParticipantIds]);

  return buildSessionView({
    session,
    attendance,
    activeAllyParticipantIds,
    identities,
    viewerParticipantId: identity.participantId,
    viewerRole: access.role,
    nowMs: deps.now().getTime(),
  });
}

function validateAttendanceResponse(rawResponse: unknown): InitiativeCollaborationSessionAttendanceResponse {
  if (rawResponse === "accepted" || rawResponse === "maybe" || rawResponse === "declined") {
    return rawResponse;
  }

  throw new InitiativeCollaborationSessionValidationError(
    'Attendance response must be "accepted", "maybe", or "declined".',
  );
}

/** Part 6 — Active Ally only; the Author organizes a Session and never RSVPs to their own. */
export async function setInitiativeCollaborationSessionAttendance(
  identity: RequestIdentity,
  initiativeId: string,
  sessionId: string,
  rawResponse: unknown,
  deps: InitiativeCollaborationSessionDependencies = defaultDependencies,
): Promise<InitiativeCollaborationSessionView> {
  const access = await deps.resolveAccess(initiativeId, identity.participantId, deps.accessDeps);

  if (access.role !== "active_ally") {
    throw new InitiativeCollaborationSessionAttendanceRestrictedError();
  }

  const session = await deps.findSessionById(initiativeId, sessionId);

  if (!session) {
    throw new InitiativeCollaborationSessionNotFoundError("Collaboration Session not found.");
  }

  if (session.cancelledAt) {
    throw new InitiativeCollaborationSessionValidationError("A cancelled Collaboration Session no longer accepts attendance.");
  }

  const response = validateAttendanceResponse(rawResponse);
  const attendance: InitiativeCollaborationSessionAttendance = {
    sessionId,
    initiativeId,
    participantId: identity.participantId,
    response,
    respondedAt: nowIso(deps),
  };

  await deps.upsertAttendance(attendance);

  deps.notifyAttendanceChanged({
    recipientParticipantId: access.stewardId,
    actorParticipantId: identity.participantId,
    initiativeId,
  });

  const [allAttendance, activeAllies] = await Promise.all([
    deps.listAttendanceBySessionId(sessionId),
    deps.listActiveAllies(initiativeId),
  ]);
  const activeAllyParticipantIds = activeAllies.map((ally) => ally.participantId);
  const identities = await deps.resolveIdentities([session.createdByParticipantId, ...activeAllyParticipantIds]);

  return buildSessionView({
    session,
    attendance: allAttendance,
    activeAllyParticipantIds,
    identities,
    viewerParticipantId: identity.participantId,
    viewerRole: "active_ally",
    nowMs: deps.now().getTime(),
  });
}
