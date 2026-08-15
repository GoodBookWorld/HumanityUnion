import type { Document } from "mongodb";

import type {
  InitiativeCollaborationSession,
  InitiativeCollaborationSessionAttendance,
  InitiativeCollaborationSessionAttendanceResponse,
} from "@hu/types";

import { InitiativeCollaborationSessionPersistenceError } from "../initiative-collaboration-sessions.errors.js";

export interface InitiativeCollaborationSessionMongoDocument extends Document {
  sessionId: string;
  initiativeId: string;
  title: string;
  agenda?: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  timezone: string;
  estimatedDurationMinutes: number;
  externalMeetingLink?: string;
  scheduledAtUtc: string;
  createdByParticipantId: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

/**
 * Optional fields must be OMITTED entirely when absent, never set to
 * `undefined` — this driver's default `ignoreUndefined: false` would
 * otherwise serialize `undefined` as BSON `null`, mirroring the exact
 * reasoning already documented in
 * `initiative-collaboration-channel.mongo-document.ts` and Direct
 * Messaging's persistence layer.
 */
export function toInitiativeCollaborationSessionMongoDocument(
  record: InitiativeCollaborationSession,
): InitiativeCollaborationSessionMongoDocument {
  return {
    sessionId: record.sessionId,
    initiativeId: record.initiativeId,
    title: record.title,
    meetingDate: record.meetingDate,
    meetingTime: record.meetingTime,
    timezone: record.timezone,
    estimatedDurationMinutes: record.estimatedDurationMinutes,
    scheduledAtUtc: record.scheduledAtUtc,
    createdByParticipantId: record.createdByParticipantId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.agenda !== undefined ? { agenda: record.agenda } : {}),
    ...(record.description !== undefined ? { description: record.description } : {}),
    ...(record.externalMeetingLink !== undefined ? { externalMeetingLink: record.externalMeetingLink } : {}),
    ...(record.cancelledAt !== undefined ? { cancelledAt: record.cancelledAt } : {}),
  };
}

export function fromInitiativeCollaborationSessionMongoDocument(
  document: InitiativeCollaborationSessionMongoDocument,
): InitiativeCollaborationSession {
  if (typeof document.sessionId !== "string" || document.sessionId.length === 0) {
    throw new InitiativeCollaborationSessionPersistenceError(
      "Persisted Collaboration Session is missing a valid sessionId.",
    );
  }

  if (typeof document.initiativeId !== "string" || document.initiativeId.length === 0) {
    throw new InitiativeCollaborationSessionPersistenceError(
      `Persisted Collaboration Session "${document.sessionId}" is missing a valid initiativeId.`,
    );
  }

  return {
    sessionId: document.sessionId,
    initiativeId: document.initiativeId,
    title: document.title,
    agenda: document.agenda,
    description: document.description,
    meetingDate: document.meetingDate,
    meetingTime: document.meetingTime,
    timezone: document.timezone,
    estimatedDurationMinutes: document.estimatedDurationMinutes,
    externalMeetingLink: document.externalMeetingLink,
    scheduledAtUtc: document.scheduledAtUtc,
    createdByParticipantId: document.createdByParticipantId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    cancelledAt: document.cancelledAt,
  };
}

const VALID_ATTENDANCE_RESPONSES = new Set<InitiativeCollaborationSessionAttendanceResponse>([
  "accepted",
  "maybe",
  "declined",
]);

export interface InitiativeCollaborationSessionAttendanceMongoDocument extends Document {
  sessionId: string;
  initiativeId: string;
  participantId: string;
  response: InitiativeCollaborationSessionAttendanceResponse;
  respondedAt: string;
}

export function toInitiativeCollaborationSessionAttendanceMongoDocument(
  record: InitiativeCollaborationSessionAttendance,
): InitiativeCollaborationSessionAttendanceMongoDocument {
  return {
    sessionId: record.sessionId,
    initiativeId: record.initiativeId,
    participantId: record.participantId,
    response: record.response,
    respondedAt: record.respondedAt,
  };
}

export function fromInitiativeCollaborationSessionAttendanceMongoDocument(
  document: InitiativeCollaborationSessionAttendanceMongoDocument,
): InitiativeCollaborationSessionAttendance {
  if (!VALID_ATTENDANCE_RESPONSES.has(document.response)) {
    throw new InitiativeCollaborationSessionPersistenceError(
      `Persisted Collaboration Session attendance for session "${document.sessionId}" has an invalid response.`,
    );
  }

  return {
    sessionId: document.sessionId,
    initiativeId: document.initiativeId,
    participantId: document.participantId,
    response: document.response,
    respondedAt: document.respondedAt,
  };
}
