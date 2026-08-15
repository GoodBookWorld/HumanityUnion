import { LifecycleAiError } from "./lifecycle-ai.errors.js";

export type LifecycleAiProviderMode = "deterministic" | "gemini";

export interface LifecycleAiConfig {
  readonly provider: LifecycleAiProviderMode;
  readonly geminiApiKey: string | null;
  readonly geminiModel: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  /** When true, session/assist responses may include safe provider diagnostics. */
  readonly diagnosticsEnabled: boolean;
  /** Production Hardening Pack 01 — cost / reliability controls. */
  readonly maxRetries: number;
  readonly maxPromptChars: number;
  readonly maxConversationHistoryTurns: number;
  readonly maxConversationTurnChars: number;
  readonly maxDraftExcerptChars: number;
  readonly maxSourceContextChars: number;
  readonly maxRequestsPerMinute: number;
  readonly maxRequestsPerDay: number;
  readonly duplicateRequestWindowMs: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveLifecycleAiConfig(): LifecycleAiConfig {
  const raw = (process.env.LIFECYCLE_AI_PROVIDER?.trim() || "deterministic").toLowerCase();
  const provider: LifecycleAiProviderMode = raw === "gemini" ? "gemini" : "deterministic";
  const diagnosticsFlag = (process.env.LIFECYCLE_AI_DIAGNOSTICS?.trim() || "").toLowerCase();

  return {
    provider,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
    geminiModel: process.env.LIFECYCLE_AI_GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    timeoutMs: parsePositiveInt(process.env.LIFECYCLE_AI_TIMEOUT_MS, 25_000),
    maxOutputTokens: parsePositiveInt(process.env.LIFECYCLE_AI_MAX_OUTPUT_TOKENS, 2048),
    diagnosticsEnabled:
      diagnosticsFlag === "1" ||
      diagnosticsFlag === "true" ||
      process.env.NODE_ENV === "development",
    maxRetries: Math.min(2, parsePositiveInt(process.env.LIFECYCLE_AI_MAX_RETRIES, 2)),
    maxPromptChars: parsePositiveInt(process.env.LIFECYCLE_AI_MAX_PROMPT_CHARS, 24_000),
    maxConversationHistoryTurns: parsePositiveInt(
      process.env.LIFECYCLE_AI_MAX_HISTORY_TURNS,
      8,
    ),
    maxConversationTurnChars: parsePositiveInt(
      process.env.LIFECYCLE_AI_MAX_HISTORY_TURN_CHARS,
      800,
    ),
    maxDraftExcerptChars: parsePositiveInt(process.env.LIFECYCLE_AI_MAX_DRAFT_EXCERPT_CHARS, 4_000),
    maxSourceContextChars: parsePositiveInt(
      process.env.LIFECYCLE_AI_MAX_SOURCE_CONTEXT_CHARS,
      6_000,
    ),
    maxRequestsPerMinute: parsePositiveInt(process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_MINUTE, 10),
    maxRequestsPerDay: parsePositiveInt(process.env.LIFECYCLE_AI_MAX_REQUESTS_PER_DAY, 200),
    duplicateRequestWindowMs: parsePositiveInt(
      process.env.LIFECYCLE_AI_DUPLICATE_WINDOW_MS,
      4_000,
    ),
  };
}

export function assertGeminiLifecycleAiConfigured(
  config: LifecycleAiConfig = resolveLifecycleAiConfig(),
): void {
  if (config.provider !== "gemini") {
    return;
  }

  if (!config.geminiApiKey) {
    throw new LifecycleAiError(
      "not_configured",
      "LIFECYCLE_AI_PROVIDER=gemini but GEMINI_API_KEY is missing",
    );
  }
}
