import type { CivicEntityType, CivicSearchResult } from "@hu/types";

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

export interface InitiativeTimelineGroupModel {
  initiativeId: string;
  title: string;
  summary: string;
  imageUrl?: string;
  activityArea?: string;
  locationLabel: string;
  statusLabel: string;
  updatedAt: string;
  stages: Array<{
    stage: InitiativeTimelineStageDefinition;
    records: CivicSearchResult[];
  }>;
}

export interface GroupedSearchResults {
  initiativeGroups: InitiativeTimelineGroupModel[];
  standaloneResults: CivicSearchResult[];
}

function resolveInitiativeId(result: CivicSearchResult): string | null {
  if (result.initiativeId) {
    return result.initiativeId;
  }

  if (result.entityType === "initiative") {
    return result.entityId;
  }

  if (result.entityType === "initiative_revision") {
    const [initiativeId] = result.entityId.split("::");
    return initiativeId ?? null;
  }

  return null;
}

export function groupSearchResultsByInitiative(
  results: CivicSearchResult[],
  formatLocation: (result: CivicSearchResult) => string,
): GroupedSearchResults {
  const groupMap = new Map<string, InitiativeTimelineGroupModel>();
  const standaloneResults: CivicSearchResult[] = [];

  for (const result of results) {
    const initiativeId = resolveInitiativeId(result);
    const stage = resolveInitiativeTimelineStage(result.entityType);

    if (!initiativeId || !stage) {
      standaloneResults.push(result);
      continue;
    }

    let group = groupMap.get(initiativeId);

    if (!group) {
      group = {
        initiativeId,
        title: result.title,
        summary: result.summary,
        imageUrl: result.imageUrl,
        activityArea: result.activityArea,
        locationLabel: formatLocation(result),
        statusLabel: result.status,
        updatedAt: result.updatedAt,
        stages: [],
      };
      groupMap.set(initiativeId, group);
    }

    if (result.entityType === "initiative") {
      group.title = result.title;
      group.summary = result.summary;
      group.imageUrl = result.imageUrl ?? group.imageUrl;
      group.activityArea = result.activityArea ?? group.activityArea;
      group.locationLabel = formatLocation(result);
      group.statusLabel = result.status;
      group.updatedAt = result.updatedAt;
    }

    let stageBucket = group.stages.find((entry) => entry.stage.stageId === stage.stageId);

    if (!stageBucket) {
      stageBucket = { stage, records: [] };
      group.stages.push(stageBucket);
    }

    stageBucket.records.push(result);
  }

  for (const group of groupMap.values()) {
    group.stages.sort(
      (left, right) =>
        INITIATIVE_TIMELINE_STAGES.findIndex((stage) => stage.stageId === left.stage.stageId) -
        INITIATIVE_TIMELINE_STAGES.findIndex((stage) => stage.stageId === right.stage.stageId),
    );
  }

  return {
    initiativeGroups: [...groupMap.values()],
    standaloneResults,
  };
}
