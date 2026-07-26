import type { WorkspaceAssistantRequest, WorkspaceAssistantResponse } from "@hu/types";
import { WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS } from "@hu/types";

import { assertAiAssistantConfigured, resolveAiAssistantConfig } from "./ai-assistant.config.js";
import { buildAiAssistantPrompt } from "./build-ai-assistant-prompt.js";
import type { WorkspaceAssistantProvider } from "./workspace-assistant-provider.js";

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function splitAssistantContent(content: string): {
  assistantMessage: string;
  suggestedDraft?: string;
} {
  const draftMarker = "Draft:";
  const draftIndex = content.indexOf(draftMarker);

  if (draftIndex === -1) {
    return { assistantMessage: content.trim() };
  }

  return {
    assistantMessage: content.slice(0, draftIndex).trim(),
    suggestedDraft: content.slice(draftIndex + draftMarker.length).trim(),
  };
}

export class AiWorkspaceAssistantProvider implements WorkspaceAssistantProvider {
  readonly providerId = "ai-workspace-assistant";

  async generateAssistantResponse(
    request: WorkspaceAssistantRequest,
  ): Promise<WorkspaceAssistantResponse> {
    assertAiAssistantConfigured();

    const config = resolveAiAssistantConfig();
    const prompt = buildAiAssistantPrompt(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      if (config.provider !== "openai") {
        throw new Error(`Unsupported AI_PROVIDER "${config.provider}". Use "openai" for now.`);
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: 0.3,
          messages: [
            { role: "system", content: prompt.systemPrompt },
            { role: "user", content: prompt.userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI provider request failed with status ${response.status}.`);
      }

      const body = (await response.json()) as OpenAiChatResponse;
      const content = body.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("AI provider returned an empty response.");
      }

      const parsed = splitAssistantContent(content);

      return {
        responseId: `assistant-response-${request.requestedAction.capability}-${request.timestamp}`,
        mode: "ai_assisted",
        assistantMessage: parsed.assistantMessage,
        suggestedDraft: parsed.suggestedDraft,
        confidenceLevel: "medium",
        safetyNotices: [
          {
            code: "advisory_only",
            message:
              "Assistant suggestions are advisory. You remain responsible for all civic actions.",
          },
          {
            code: "review_before_use",
            message: "Review all generated text before using it in civic records.",
          },
          {
            code: "ai_assisted",
            message: "This response was generated with AI assistance and may contain uncertainty.",
          },
        ],
        followUpPrompts: [
          "Compare this draft against the deterministic recommendation above.",
          "Confirm visibility and accuracy before saving any civic record.",
        ],
        prohibitedActions: [...WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS],
        createdAt: request.timestamp,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
