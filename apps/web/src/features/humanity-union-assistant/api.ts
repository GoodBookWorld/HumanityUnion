import type {
  HumanityUnionAssistantAssistRequest,
  HumanityUnionAssistantAssistResult,
  HumanityUnionAssistantSessionContext,
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getHumanityUnionAssistantSessionContext(input: {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
}): Promise<HumanityUnionAssistantSessionContext> {
  const params = new URLSearchParams({ surfaceId: input.surfaceId });
  if (input.initiativeId) {
    params.set("initiativeId", input.initiativeId);
  }
  if (input.stageId) {
    params.set("stageId", input.stageId);
  }
  if (input.pagePath) {
    params.set("pagePath", input.pagePath);
  }

  return apiRequest<HumanityUnionAssistantSessionContext>(
    `/api/v1/assistant/session-context?${params.toString()}`,
  );
}

export async function requestHumanityUnionAssistantAssist(
  body: HumanityUnionAssistantAssistRequest,
): Promise<HumanityUnionAssistantAssistResult> {
  return apiRequest<HumanityUnionAssistantAssistResult>("/api/v1/assistant/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
