import type { Document } from "mongodb";

import type { ParticipantActionRecord } from "../domain/participant-action.types.js";

/**
 * Recovery Task 27 Part 6 — typed Mongo document for the `participant_actions`
 * collection. Never exposed outside the repository (Part 6).
 *
 * Recovery Task 33 Part 7 adds `metadata`, mirroring the domain record
 * exactly (`| null`, never optional/undefined).
 */
export interface ParticipantActionMongoDocument extends Document {
  participantActionId: string;
  participantId: string;
  initiativeId: string;
  actionType: ParticipantActionRecord["actionType"];
  sourceType: ParticipantActionRecord["sourceType"];
  sourceId: string;
  sourceEventId: string;
  sourceEventName: ParticipantActionRecord["sourceEventName"];
  sourceEventSchemaVersion: ParticipantActionRecord["sourceEventSchemaVersion"];
  occurredAt: string;
  recordedAt: string;
  validityStatus: ParticipantActionRecord["validityStatus"];
  correlationId: string | null;
  causationId: string | null;
  metadata: ParticipantActionRecord["metadata"];
}

export function toParticipantActionMongoDocument(
  record: ParticipantActionRecord,
): ParticipantActionMongoDocument {
  return {
    participantActionId: record.participantActionId,
    participantId: record.participantId,
    initiativeId: record.initiativeId,
    actionType: record.actionType,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceEventId: record.sourceEventId,
    sourceEventName: record.sourceEventName,
    sourceEventSchemaVersion: record.sourceEventSchemaVersion,
    occurredAt: record.occurredAt,
    recordedAt: record.recordedAt,
    validityStatus: record.validityStatus,
    correlationId: record.correlationId,
    causationId: record.causationId,
    metadata: record.metadata,
  };
}

export function fromParticipantActionMongoDocument(
  document: ParticipantActionMongoDocument,
): ParticipantActionRecord {
  return {
    participantActionId: document.participantActionId,
    participantId: document.participantId,
    initiativeId: document.initiativeId,
    actionType: document.actionType,
    sourceType: document.sourceType,
    sourceId: document.sourceId,
    sourceEventId: document.sourceEventId,
    sourceEventName: document.sourceEventName,
    sourceEventSchemaVersion: document.sourceEventSchemaVersion,
    occurredAt: document.occurredAt,
    recordedAt: document.recordedAt,
    validityStatus: document.validityStatus,
    correlationId: document.correlationId ?? null,
    causationId: document.causationId ?? null,
    metadata: document.metadata ?? null,
  };
}
