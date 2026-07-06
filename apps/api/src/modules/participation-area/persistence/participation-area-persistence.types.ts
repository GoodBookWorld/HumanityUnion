import type { ParticipationArea, ParticipationAreaTransition } from "@hu/types";

export interface ParticipationAreaPersistenceSnapshot {
  version: 1;
  areas: Record<string, ParticipationArea>;
  transitions: Record<string, ParticipationAreaTransition>;
}

export interface ParticipationAreaPersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): ParticipationAreaPersistenceSnapshot;
  save(snapshot: ParticipationAreaPersistenceSnapshot): void;
}

export function createEmptyParticipationAreaPersistenceSnapshot(): ParticipationAreaPersistenceSnapshot {
  return {
    version: 1,
    areas: {},
    transitions: {},
  };
}

export function snapshotFromParticipationAreaStores(
  areas: Map<string, ParticipationArea>,
  transitions: Map<string, ParticipationAreaTransition>,
): ParticipationAreaPersistenceSnapshot {
  const areaRecord: Record<string, ParticipationArea> = {};
  const transitionRecord: Record<string, ParticipationAreaTransition> = {};

  for (const [participationAreaId, area] of areas) {
    areaRecord[participationAreaId] = structuredClone(area);
  }

  for (const [transitionId, transition] of transitions) {
    transitionRecord[transitionId] = structuredClone(transition);
  }

  return {
    version: 1,
    areas: areaRecord,
    transitions: transitionRecord,
  };
}
