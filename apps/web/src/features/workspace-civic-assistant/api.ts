import type { WorkspaceAssistantContextSnapshot, WorkspaceAssistantResponse } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface RequestWorkspaceAssistantResponseInput {
  initiativeId: string;
  currentSection: string;
  requestedAction: {
    capability: string;
    label: string;
  };
  userPrompt?: string;
  contextSnapshot: WorkspaceAssistantContextSnapshot;
}

export async function requestWorkspaceAssistantResponse(
  input: RequestWorkspaceAssistantResponseInput,
): Promise<WorkspaceAssistantResponse> {
  return apiRequest<WorkspaceAssistantResponse>("/api/v1/workspace-assistant/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      timestamp: new Date().toISOString(),
    }),
  });
}
