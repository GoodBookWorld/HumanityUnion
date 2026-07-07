import type { OfficialResponse, OfficialResponseIdentity } from "@hu/types";

import { resolveOfficialResponsePersistenceAdapter } from "./persistence/resolve-official-response-persistence.js";
import { snapshotFromOfficialResponses } from "./persistence/official-response-persistence.types.js";

const persistence = resolveOfficialResponsePersistenceAdapter();

function loadState(): {
  responses: Map<string, OfficialResponse>;
  identities: Map<string, OfficialResponseIdentity>;
  responseSequence: number;
  responseSequenceYear: number;
} {
  const snapshot = persistence.load();

  return {
    responses: new Map<string, OfficialResponse>(
      Object.entries(snapshot.responses).map(([responseId, response]) => [
        responseId,
        structuredClone(response),
      ]),
    ),
    identities: new Map<string, OfficialResponseIdentity>(
      Object.entries(snapshot.identities).map(([capId, identity]) => [
        capId,
        structuredClone(identity),
      ]),
    ),
    responseSequence: snapshot.responseSequence,
    responseSequenceYear: snapshot.responseSequenceYear,
  };
}

const state = loadState();

function persistState(): void {
  persistence.save(
    snapshotFromOfficialResponses(
      state.responses,
      state.identities,
      state.responseSequence,
      state.responseSequenceYear,
    ),
  );
}

export function getPersistenceMode(): "file" | "memory" {
  return persistence.mode;
}

export function getNextResponseNumber(): string {
  const currentYear = new Date().getFullYear();

  if (state.responseSequenceYear !== currentYear) {
    state.responseSequenceYear = currentYear;
    state.responseSequence = 0;
  }

  state.responseSequence += 1;
  persistState();

  return `RESP-${currentYear}-${String(state.responseSequence).padStart(6, "0")}`;
}

export function getResponseById(responseId: string): OfficialResponse | null {
  const response = state.responses.get(responseId);

  return response ? structuredClone(response) : null;
}

export function listResponses(): OfficialResponse[] {
  return Array.from(state.responses.values(), (response) => structuredClone(response));
}

export function listResponsesByCapId(capId: string): OfficialResponse[] {
  return listResponses()
    .filter((response) => response.capId === capId)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

export function listResponsesByInitiative(initiativeId: string): OfficialResponse[] {
  return listResponses()
    .filter((response) => response.initiativeId === initiativeId)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

export function listResponsesByRecorder(recordedByParticipantId: string): OfficialResponse[] {
  return listResponses()
    .filter((response) => response.recordedByParticipantId === recordedByParticipantId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createResponse(response: OfficialResponse): OfficialResponse {
  if (state.responses.has(response.responseId)) {
    throw new Error("Official response already exists.");
  }

  state.responses.set(response.responseId, structuredClone(response));
  persistState();

  return structuredClone(response);
}

export function updateResponse(
  responseId: string,
  update: Partial<OfficialResponse>,
): OfficialResponse | null {
  const existing = state.responses.get(responseId);

  if (!existing) {
    return null;
  }

  const updated: OfficialResponse = {
    ...existing,
    ...update,
  };

  state.responses.set(responseId, updated);
  persistState();

  return structuredClone(updated);
}

export function getResponseIdentityForCap(capId: string): OfficialResponseIdentity | null {
  const identity = state.identities.get(capId);

  return identity ? structuredClone(identity) : null;
}

export function saveResponseIdentity(identity: OfficialResponseIdentity): OfficialResponseIdentity {
  state.identities.set(identity.capId, structuredClone(identity));
  persistState();

  return structuredClone(identity);
}
