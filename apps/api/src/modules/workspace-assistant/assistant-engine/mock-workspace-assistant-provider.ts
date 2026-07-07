import type { WorkspaceAssistantRequest, WorkspaceAssistantResponse } from "@hu/types";
import { WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS } from "@hu/types";

import type { WorkspaceAssistantProvider } from "./workspace-assistant-provider.js";

export class MockWorkspaceAssistantProvider implements WorkspaceAssistantProvider {
  readonly providerId = "mock-workspace-assistant";

  generateAssistantResponse(request: WorkspaceAssistantRequest): WorkspaceAssistantResponse {
    const { requestedAction, contextSnapshot, currentSection } = request;
    const createdAt = request.timestamp;

    return {
      responseId: `assistant-response-${requestedAction.capability}-${createdAt}`,
      mode: "mock",
      assistantMessage: [
        `Mock assistant received "${requestedAction.label}" (${requestedAction.capability})`,
        `for section "${currentSection}" on initiative "${contextSnapshot.initiativeTitle}".`,
        "No generated civic content is produced in mock mode.",
        "Review all suggestions yourself before taking civic action.",
      ].join(" "),
      confidenceLevel: "not_applicable",
      safetyNotices: [
        {
          code: "advisory_only",
          message:
            "Assistant suggestions are advisory. You remain responsible for all civic actions.",
        },
        {
          code: "mock_provider",
          message:
            "This response comes from the mock assistant engine. No AI provider is connected.",
        },
        {
          code: "uncertainty",
          message: "The assistant cannot verify facts or predict civic outcomes in mock mode.",
        },
      ],
      followUpPrompts: [
        "Review the relevant workspace section before applying any suggestion.",
        "Confirm public/private visibility before sharing draft language.",
      ],
      prohibitedActions: [...WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS],
      createdAt,
    };
  }
}
