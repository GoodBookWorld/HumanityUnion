import type {
  InitiativeCollaborationSessionAttendanceResponse,
  InitiativeCollaborationSessionInput,
  InitiativeCollaborationSessionListResult,
  InitiativeCollaborationSessionView,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type {
  InitiativeCollaborationSessionAttendanceResponse,
  InitiativeCollaborationSessionAttendanceRosterEntry,
  InitiativeCollaborationSessionAttendanceTotals,
  InitiativeCollaborationSessionInput,
  InitiativeCollaborationSessionListResult,
  InitiativeCollaborationSessionStatus,
  InitiativeCollaborationSessionView,
} from "@hu/types";

/**
 * Communication UX Pack 03.6 — Collaboration Sessions' web client.
 * Independent from `initiative-collaboration-channel/api.ts` and
 * `direct-messaging/api.ts` (Part 1/9): its own base path, its own
 * persistence domain. Every call requires authentication (Part 2 — never
 * publicly visible).
 */
function sessionsBasePath(initiativeId: string): string {
  return `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collaboration-sessions`;
}

export async function listInitiativeCollaborationSessions(
  initiativeId: string,
): Promise<InitiativeCollaborationSessionListResult> {
  return apiRequest<InitiativeCollaborationSessionListResult>(sessionsBasePath(initiativeId));
}

export async function getInitiativeCollaborationSession(
  initiativeId: string,
  sessionId: string,
): Promise<InitiativeCollaborationSessionView> {
  return apiRequest<InitiativeCollaborationSessionView>(
    `${sessionsBasePath(initiativeId)}/${encodeURIComponent(sessionId)}`,
  );
}

export async function createInitiativeCollaborationSession(
  initiativeId: string,
  input: InitiativeCollaborationSessionInput,
): Promise<InitiativeCollaborationSessionView> {
  return apiRequest<InitiativeCollaborationSessionView>(sessionsBasePath(initiativeId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Part 5 — also used for "Reschedule Session": rescheduling is simply an edit of the date/time/timezone fields. */
export async function updateInitiativeCollaborationSession(
  initiativeId: string,
  sessionId: string,
  input: InitiativeCollaborationSessionInput,
): Promise<InitiativeCollaborationSessionView> {
  return apiRequest<InitiativeCollaborationSessionView>(
    `${sessionsBasePath(initiativeId)}/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function cancelInitiativeCollaborationSession(
  initiativeId: string,
  sessionId: string,
): Promise<InitiativeCollaborationSessionView> {
  return apiRequest<InitiativeCollaborationSessionView>(
    `${sessionsBasePath(initiativeId)}/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  );
}

export async function setInitiativeCollaborationSessionAttendance(
  initiativeId: string,
  sessionId: string,
  response: InitiativeCollaborationSessionAttendanceResponse,
): Promise<InitiativeCollaborationSessionView> {
  return apiRequest<InitiativeCollaborationSessionView>(
    `${sessionsBasePath(initiativeId)}/${encodeURIComponent(sessionId)}/attendance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    },
  );
}
