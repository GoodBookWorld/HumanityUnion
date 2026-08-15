export type TranslationProviderMode = "deterministic" | "gemini";

export interface TranslationConfig {
  readonly provider: TranslationProviderMode;
  readonly geminiApiKey: string | null;
  readonly geminiModel: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
}

export function resolveTranslationConfig(): TranslationConfig {
  const raw = (process.env.TRANSLATION_PROVIDER?.trim() || "deterministic").toLowerCase();
  const provider: TranslationProviderMode = raw === "gemini" ? "gemini" : "deterministic";

  return {
    provider,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
    geminiModel:
      process.env.TRANSLATION_GEMINI_MODEL?.trim() ||
      process.env.LIFECYCLE_AI_GEMINI_MODEL?.trim() ||
      "gemini-2.0-flash",
    timeoutMs: Number.parseInt(process.env.TRANSLATION_TIMEOUT_MS ?? "25000", 10),
    maxOutputTokens: Number.parseInt(process.env.TRANSLATION_MAX_OUTPUT_TOKENS ?? "4096", 10),
  };
}

export class TranslationProviderError extends Error {
  constructor(
    readonly code:
      | "not_configured"
      | "unavailable"
      | "rate_limited"
      | "timeout"
      | "network_failure"
      | "malformed_response"
      | "safety_rejected"
      | "unsupported_language"
      | "forbidden"
      | "bad_request",
    message: string,
  ) {
    super(message);
    this.name = "TranslationProviderError";
  }
}

export function assertGeminiTranslationConfigured(
  config: TranslationConfig = resolveTranslationConfig(),
): void {
  if (config.provider !== "gemini") {
    return;
  }

  if (!config.geminiApiKey) {
    throw new TranslationProviderError(
      "not_configured",
      "TRANSLATION_PROVIDER=gemini but GEMINI_API_KEY is missing",
    );
  }
}
