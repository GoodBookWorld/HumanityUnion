import type {
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleAiAssistResult,
  InitiativeLifecycleStageId,
  LifecycleAiAssistantSessionContext,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface LifecycleAiAssistRequestBody {
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly instructions?: string;
  readonly targetSectionId?: string;
  readonly currentDraftExcerpt?: string;
}

export async function getLifecycleAiSessionContext(
  initiativeId: string,
  stageId: InitiativeLifecycleStageId,
): Promise<LifecycleAiAssistantSessionContext> {
  const params = new URLSearchParams({
    initiativeId,
    stageId,
  });

  return apiRequest<LifecycleAiAssistantSessionContext>(
    `/api/v1/lifecycle-ai/session-context?${params.toString()}`,
  );
}

export async function requestLifecycleAiAssist(
  body: LifecycleAiAssistRequestBody,
): Promise<InitiativeLifecycleAiAssistResult> {
  return apiRequest<InitiativeLifecycleAiAssistResult>("/api/v1/lifecycle-ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
