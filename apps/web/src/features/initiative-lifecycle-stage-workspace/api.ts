import type { InitiativeLifecycleStageId, InitiativeLifecycleStageProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

/**
 * Initiative Lifecycle — Part A Completion Part 2 (frontend half). Fetches
 * exactly one stage's projection — never the full twelve-stage experience
 * aggregate (`getPublicInitiativeExperience`).
 */
export async function getInitiativeLifecycleStageProjection(
  initiativeId: string,
  stageId: InitiativeLifecycleStageId | string,
): Promise<InitiativeLifecycleStageProjection> {
  return apiRequest<InitiativeLifecycleStageProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/lifecycle-stage/${encodeURIComponent(stageId)}`,
  );
}
