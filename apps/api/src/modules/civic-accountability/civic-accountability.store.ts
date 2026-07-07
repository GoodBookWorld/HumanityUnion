import type { CivicAccountability, CivicAccountabilityEvent } from "@hu/types";

import { resolveCivicAccountabilityPersistenceAdapter } from "./persistence/resolve-civic-accountability-persistence.js";
import { snapshotFromCivicAccountabilityData } from "./persistence/civic-accountability-persistence.types.js";

const persistence = resolveCivicAccountabilityPersistenceAdapter();

function loadState(): {
  accountabilities: Map<string, CivicAccountability>;
  events: Map<string, CivicAccountabilityEvent>;
} {
  const snapshot = persistence.load();

  return {
    accountabilities: new Map<string, CivicAccountability>(
      Object.entries(snapshot.accountabilities).map(([accountabilityId, accountability]) => [
        accountabilityId,
        structuredClone(accountability),
      ]),
    ),
    events: new Map<string, CivicAccountabilityEvent>(
      Object.entries(snapshot.events).map(([eventId, event]) => [eventId, structuredClone(event)]),
    ),
  };
}

const state = loadState();

function persistState(): void {
  persistence.save(
    snapshotFromCivicAccountabilityData({
      accountabilities: state.accountabilities,
      events: state.events,
    }),
  );
}

export function getPersistenceMode(): "file" | "memory" {
  return persistence.mode;
}

export function getAccountabilityById(accountabilityId: string): CivicAccountability | null {
  const accountability = state.accountabilities.get(accountabilityId);

  return accountability ? structuredClone(accountability) : null;
}

export function getAccountabilityByCapId(capId: string): CivicAccountability | null {
  const accountability = Array.from(state.accountabilities.values()).find(
    (item) => item.capId === capId,
  );

  return accountability ? structuredClone(accountability) : null;
}

export function listAccountabilities(): CivicAccountability[] {
  return Array.from(state.accountabilities.values(), (accountability) =>
    structuredClone(accountability),
  );
}

export function listAccountabilitiesByInitiative(initiativeId: string): CivicAccountability[] {
  return listAccountabilities()
    .filter((accountability) => accountability.initiativeId === initiativeId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listAccountabilitiesByCapId(capId: string): CivicAccountability[] {
  return listAccountabilities()
    .filter((accountability) => accountability.capId === capId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listAccountabilitiesByResponseId(responseId: string): CivicAccountability[] {
  return listAccountabilities().filter(
    (accountability) => accountability.responseId === responseId,
  );
}

export function createAccountability(accountability: CivicAccountability): CivicAccountability {
  if (state.accountabilities.has(accountability.accountabilityId)) {
    throw new Error("Civic accountability already exists.");
  }

  if (getAccountabilityByCapId(accountability.capId)) {
    throw new Error("Civic accountability already exists for this CAP.");
  }

  state.accountabilities.set(accountability.accountabilityId, structuredClone(accountability));
  persistState();

  return structuredClone(accountability);
}

export function updateAccountability(
  accountabilityId: string,
  update: Partial<CivicAccountability>,
): CivicAccountability | null {
  const existing = state.accountabilities.get(accountabilityId);

  if (!existing) {
    return null;
  }

  const updated: CivicAccountability = {
    ...existing,
    ...update,
  };

  state.accountabilities.set(accountabilityId, updated);
  persistState();

  return structuredClone(updated);
}

export function listEventsByAccountabilityId(accountabilityId: string): CivicAccountabilityEvent[] {
  return Array.from(state.events.values())
    .filter((event) => event.accountabilityId === accountabilityId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function listEvents(): CivicAccountabilityEvent[] {
  return Array.from(state.events.values(), (event) => structuredClone(event));
}

export function createEvent(event: CivicAccountabilityEvent): CivicAccountabilityEvent {
  if (state.events.has(event.eventId)) {
    throw new Error("Accountability event already exists.");
  }

  state.events.set(event.eventId, structuredClone(event));
  persistState();

  return structuredClone(event);
}
