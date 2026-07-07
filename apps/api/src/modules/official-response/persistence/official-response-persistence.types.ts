import type { OfficialResponse, OfficialResponseIdentity } from "@hu/types";

export interface OfficialResponsePersistenceSnapshot {
  version: 1;
  responses: Record<string, OfficialResponse>;
  identities: Record<string, OfficialResponseIdentity>;
  responseSequence: number;
  responseSequenceYear: number;
}

export interface OfficialResponsePersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): OfficialResponsePersistenceSnapshot;
  save(snapshot: OfficialResponsePersistenceSnapshot): void;
}

export function createEmptyOfficialResponsePersistenceSnapshot(): OfficialResponsePersistenceSnapshot {
  const year = new Date().getFullYear();

  return {
    version: 1,
    responses: {},
    identities: {},
    responseSequence: 0,
    responseSequenceYear: year,
  };
}

export function snapshotFromOfficialResponses(
  responses: Map<string, OfficialResponse>,
  identities: Map<string, OfficialResponseIdentity>,
  responseSequence: number,
  responseSequenceYear: number,
): OfficialResponsePersistenceSnapshot {
  const serializedResponses: Record<string, OfficialResponse> = {};
  const serializedIdentities: Record<string, OfficialResponseIdentity> = {};

  for (const [responseId, response] of responses) {
    serializedResponses[responseId] = structuredClone(response);
  }

  for (const [capId, identity] of identities) {
    serializedIdentities[capId] = structuredClone(identity);
  }

  return {
    version: 1,
    responses: serializedResponses,
    identities: serializedIdentities,
    responseSequence,
    responseSequenceYear,
  };
}
