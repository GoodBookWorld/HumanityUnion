import type { Document } from "mongodb";

import type { InitiativeAlly, InitiativeAllyStatus } from "@hu/types";

import { InitiativeAllyPersistenceError } from "../initiative-discussion-collaboration.errors.js";

const VALID_STATUSES = new Set<InitiativeAllyStatus>([
  "interest_pending",
  "invitation_pending",
  "active",
  "declined",
]);

/**
 * Authoritative Mongo document for the `initiative_allies` collection
 * (UX Evolution Pack 02.1). One document per (initiativeId, participantId)
 * pair — see the module-level doc comment in `initiative-ally.store.ts` for
 * why that single mutable-status row is the entire uniqueness authority.
 */
export interface InitiativeAllyMongoDocument extends Document {
  initiativeId: string;
  participantId: string;
  status: InitiativeAllyStatus;
  requestedByParticipantId: string;
  createdAt: string;
  updatedAt: string;
}

export function toInitiativeAllyMongoDocument(record: InitiativeAlly): InitiativeAllyMongoDocument {
  return {
    initiativeId: record.initiativeId,
    participantId: record.participantId,
    status: record.status,
    requestedByParticipantId: record.requestedByParticipantId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Rejects malformed persisted Ally documents rather than silently coercing
 * them, mirroring `fromInitiativeDecisionVoteMongoDocument`.
 */
export function fromInitiativeAllyMongoDocument(document: InitiativeAllyMongoDocument): InitiativeAlly {
  if (typeof document.initiativeId !== "string" || document.initiativeId.length === 0) {
    throw new InitiativeAllyPersistenceError("Persisted Initiative Ally is missing a valid initiativeId.");
  }

  if (typeof document.participantId !== "string" || document.participantId.length === 0) {
    throw new InitiativeAllyPersistenceError(
      `Persisted Initiative Ally for initiative "${document.initiativeId}" is missing a valid participantId.`,
    );
  }

  if (!VALID_STATUSES.has(document.status)) {
    throw new InitiativeAllyPersistenceError(
      `Persisted Initiative Ally "${document.initiativeId}:${document.participantId}" has an invalid status.`,
    );
  }

  if (
    typeof document.requestedByParticipantId !== "string" ||
    document.requestedByParticipantId.length === 0
  ) {
    throw new InitiativeAllyPersistenceError(
      `Persisted Initiative Ally "${document.initiativeId}:${document.participantId}" is missing a valid requestedByParticipantId.`,
    );
  }

  if (typeof document.createdAt !== "string" || Number.isNaN(Date.parse(document.createdAt))) {
    throw new InitiativeAllyPersistenceError(
      `Persisted Initiative Ally "${document.initiativeId}:${document.participantId}" has an invalid createdAt.`,
    );
  }

  if (typeof document.updatedAt !== "string" || Number.isNaN(Date.parse(document.updatedAt))) {
    throw new InitiativeAllyPersistenceError(
      `Persisted Initiative Ally "${document.initiativeId}:${document.participantId}" has an invalid updatedAt.`,
    );
  }

  return {
    initiativeId: document.initiativeId,
    participantId: document.participantId,
    status: document.status,
    requestedByParticipantId: document.requestedByParticipantId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
