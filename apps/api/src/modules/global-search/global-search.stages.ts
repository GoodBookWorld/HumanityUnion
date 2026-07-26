import type { CivicEntityType } from "@hu/types";

export interface InitiativeTimelineStageDefinition {
  stageId: string;
  label: string;
  entityTypes: readonly CivicEntityType[];
}

/** Canonical 12-stage initiative lifecycle order for grouped search. */
export const INITIATIVE_TIMELINE_STAGES: readonly InitiativeTimelineStageDefinition[] = [
  {
    stageId: "initiative",
    label: "Initiative",
    entityTypes: ["initiative"],
  },
  {
    stageId: "analysis",
    label: "Collaborative Analysis",
    entityTypes: ["analysis"],
  },
  {
    stageId: "proposal",
    label: "Improvement Proposals",
    entityTypes: ["improvement_proposal"],
  },
  {
    stageId: "revision",
    label: "Revision",
    entityTypes: ["initiative_revision"],
  },
  {
    stageId: "petition",
    label: "Petition",
    entityTypes: ["petition"],
  },
  {
    stageId: "decision_session",
    label: "Decision Session",
    entityTypes: ["decision_session"],
  },
  {
    stageId: "collective_decision",
    label: "Collective Decision",
    entityTypes: ["collective_decision"],
  },
  {
    stageId: "commitment",
    label: "Implementation Commitments",
    entityTypes: ["implementation_commitment"],
  },
  {
    stageId: "tracking",
    label: "Implementation Tracking",
    entityTypes: ["implementation_tracking"],
  },
  {
    stageId: "official_response",
    label: "Official Responses",
    entityTypes: ["official_response"],
  },
  {
    stageId: "public_impact",
    label: "Public Impact",
    entityTypes: ["public_impact"],
  },
  {
    stageId: "archive",
    label: "Civic Archive",
    entityTypes: ["civic_archive"],
  },
] as const;

const STAGE_BY_ENTITY_TYPE = new Map<CivicEntityType, InitiativeTimelineStageDefinition>();

for (const stage of INITIATIVE_TIMELINE_STAGES) {
  for (const entityType of stage.entityTypes) {
    STAGE_BY_ENTITY_TYPE.set(entityType, stage);
  }
}

export function resolveInitiativeTimelineStage(
  entityType: CivicEntityType,
): InitiativeTimelineStageDefinition | null {
  return STAGE_BY_ENTITY_TYPE.get(entityType) ?? null;
}

export function resolveInitiativeIdFromEntry(input: {
  entityType: CivicEntityType;
  entityId: string;
  initiativeId?: string;
}): string | null {
  if (input.initiativeId) {
    return input.initiativeId;
  }

  if (input.entityType === "initiative") {
    return input.entityId;
  }

  if (input.entityType === "initiative_revision") {
    const [initiativeId] = input.entityId.split("::");
    return initiativeId ?? null;
  }

  return null;
}

export function entityKey(entityType: CivicEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}
