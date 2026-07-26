import type {
  WorkspaceAssistantCapability,
  WorkspaceAssistantRequest,
  WorkspaceAssistantResponse,
} from "@hu/types";
import { WORKSPACE_ASSISTANT_ALLOWED_CAPABILITIES } from "@hu/types";

import { AiWorkspaceAssistantProvider } from "./ai-workspace-assistant-provider.js";
import { assertAiAssistantConfigured } from "./ai-assistant.config.js";
import { MockWorkspaceAssistantProvider } from "./mock-workspace-assistant-provider.js";

export interface WorkspaceAssistantProvider {
  readonly providerId: string;
  generateAssistantResponse(
    request: WorkspaceAssistantRequest,
  ): Promise<WorkspaceAssistantResponse>;
}

export function isWorkspaceAssistantCapability(
  value: string,
): value is WorkspaceAssistantCapability {
  return WORKSPACE_ASSISTANT_ALLOWED_CAPABILITIES.includes(value as WorkspaceAssistantCapability);
}

export function resolveWorkspaceAssistantProvider(): WorkspaceAssistantProvider {
  const mode = process.env.WORKSPACE_ASSISTANT_PROVIDER ?? "mock";

  switch (mode) {
    case "ai_assisted":
      assertAiAssistantConfigured();
      return new AiWorkspaceAssistantProvider();
    case "mock":
    default:
      return new MockWorkspaceAssistantProvider();
  }
}

export function assertAllowedWorkspaceAssistantCapability(
  capability: string,
): asserts capability is WorkspaceAssistantCapability {
  if (!isWorkspaceAssistantCapability(capability)) {
    throw new Error("Unknown assistant capability.");
  }

  if (!WORKSPACE_ASSISTANT_ALLOWED_CAPABILITIES.includes(capability)) {
    throw new Error("Assistant capability is not allowed.");
  }
}
