import type {
  CivicAccountability,
  CivicAccountabilityEvent,
  CivicAccountabilityEventType,
} from "@hu/types";
import { canTransitionCivicAccountabilityStatus } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertCanRecordCivicAccountability } from "./civic-accountability-identity.js";
import {
  createEvent,
  getAccountabilityById,
  listAccountabilities,
  listEventsByAccountabilityId,
  updateAccountability,
} from "./civic-accountability.store.js";

export interface AddCivicAccountabilityEventInput {
  eventType: CivicAccountabilityEventType;
  title: string;
  summary: string;
  evidenceReference?: string;
  occurredAt: string;
}

function getActiveAccountability(accountabilityId: string): CivicAccountability {
  const accountability = getAccountabilityById(accountabilityId);

  if (!accountability) {
    throw new Error("Civic accountability not found.");
  }

  if (accountability.status !== "active") {
    throw new Error("Only active civic accountability can receive new events.");
  }

  return accountability;
}

export function listMyCivicAccountabilities(identity: RequestIdentity): CivicAccountability[] {
  return listAccountabilities().filter((accountability) =>
    canRecordAccess(accountability, identity),
  );
}

function canRecordAccess(accountability: CivicAccountability, identity: RequestIdentity): boolean {
  try {
    assertCanRecordCivicAccountability(accountability, identity);
    return true;
  } catch {
    return false;
  }
}

export function getMyCivicAccountability(
  identity: RequestIdentity,
  accountabilityId: string,
): { accountability: CivicAccountability; events: CivicAccountabilityEvent[] } | null {
  const accountability = getAccountabilityById(accountabilityId);

  if (!accountability) {
    return null;
  }

  try {
    assertCanRecordCivicAccountability(accountability, identity);
  } catch {
    return null;
  }

  return {
    accountability,
    events: listEventsByAccountabilityId(accountabilityId),
  };
}

export function addCivicAccountabilityEvent(
  identity: RequestIdentity,
  accountabilityId: string,
  input: AddCivicAccountabilityEventInput,
): { accountability: CivicAccountability; event: CivicAccountabilityEvent } {
  const accountability = getActiveAccountability(accountabilityId);
  assertCanRecordCivicAccountability(accountability, identity);

  const now = new Date().toISOString();
  const event: CivicAccountabilityEvent = {
    eventId: `civic-accountability-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    accountabilityId,
    eventType: input.eventType,
    title: input.title.trim(),
    summary: input.summary.trim(),
    evidenceReference: input.evidenceReference?.trim(),
    occurredAt: input.occurredAt,
    recordedAt: now,
    recordedByParticipantId: identity.participantId,
  };

  const createdEvent = createEvent(event);
  const updatedAccountability = updateAccountability(accountabilityId, { updatedAt: now });

  if (!updatedAccountability) {
    throw new Error("Civic accountability not found.");
  }

  return {
    accountability: updatedAccountability,
    event: createdEvent,
  };
}

export function closeCivicAccountability(
  identity: RequestIdentity,
  accountabilityId: string,
): CivicAccountability {
  const accountability = getAccountabilityById(accountabilityId);

  if (!accountability) {
    throw new Error("Civic accountability not found.");
  }

  assertCanRecordCivicAccountability(accountability, identity);

  if (!canTransitionCivicAccountabilityStatus(accountability.status, "closed")) {
    throw new Error("Civic accountability cannot be closed.");
  }

  const now = new Date().toISOString();
  const updated = updateAccountability(accountabilityId, {
    status: "closed",
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Civic accountability not found.");
  }

  return updated;
}

export function archiveCivicAccountability(
  identity: RequestIdentity,
  accountabilityId: string,
): CivicAccountability {
  const accountability = getAccountabilityById(accountabilityId);

  if (!accountability) {
    throw new Error("Civic accountability not found.");
  }

  assertCanRecordCivicAccountability(accountability, identity);

  if (!canTransitionCivicAccountabilityStatus(accountability.status, "archived")) {
    throw new Error("Civic accountability cannot be archived.");
  }

  const now = new Date().toISOString();
  const updated = updateAccountability(accountabilityId, {
    status: "archived",
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Civic accountability not found.");
  }

  return updated;
}
