export interface AiAssistantConfig {
  provider: string;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

export function resolveAiAssistantConfig(): AiAssistantConfig {
  return {
    provider: process.env.AI_PROVIDER?.trim() || "openai",
    apiKey: process.env.AI_API_KEY?.trim() || null,
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
    timeoutMs: Number.parseInt(process.env.AI_TIMEOUT_MS ?? "20000", 10),
    maxTokens: Number.parseInt(process.env.AI_MAX_TOKENS ?? "800", 10),
  };
}

export function assertAiAssistantConfigured(): void {
  const config = resolveAiAssistantConfig();

  if (!config.apiKey) {
    throw new Error(
      "AI_API_KEY is required when WORKSPACE_ASSISTANT_PROVIDER=ai_assisted. Configure AI provider credentials or use mock mode.",
    );
  }
}
