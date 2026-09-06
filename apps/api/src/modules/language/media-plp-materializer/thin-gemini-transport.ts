/**
 * Reset 03B.2 — thin Gemini HTTP transport for Media PLP materializer only.
 *
 * Native fetch → Generative Language API. No registry barrel, no API
 * bootstrap, no Google SDK package. Credentials from resolveTranslationConfig;
 * never logged. Max one request; no retries; no streaming; no session objects.
 */

import {
  assertGeminiTranslationConfigured,
  resolveTranslationConfig,
  TranslationProviderError,
  type TranslationConfig,
} from "../translation.config.js";
import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../translation-provider.js";
import { buildThinGeminiMediaPlpSystemInstruction } from "./thin-gemini-prompt.js";

/** Safe non-secret transport identifier for operator reports. */
export const MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID =
  "gemini_generativelanguage_http" as const;

export const MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID = "fake_local" as const;

export const MEDIA_PLP_DETERMINISTIC_TRANSPORT_ID = "deterministic_local" as const;

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
}

function classifyGeminiHttpFailure(
  status: number,
  body: GeminiGenerateContentResponse,
): TranslationProviderError {
  if (status === 401 || status === 403) {
    return new TranslationProviderError("not_configured", `Gemini HTTP ${status}`);
  }
  if (status === 429) {
    return new TranslationProviderError("rate_limited", `Gemini HTTP ${status}`);
  }
  if (status >= 500) {
    return new TranslationProviderError("unavailable", `Gemini HTTP ${status}`);
  }
  const vendorMessage = body.error?.message ?? "";
  if (/API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(vendorMessage)) {
    return new TranslationProviderError("not_configured", "Gemini rejected credentials");
  }
  return new TranslationProviderError("unavailable", `Gemini HTTP ${status}`);
}

export type ThinGeminiFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * One-request-max Gemini transport for the Media PLP operator.
 */
export class ThinGeminiMediaPlpTransport implements TranslationProvider {
  readonly providerId = "gemini" as const;
  readonly transportId = MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID;

  private requestCount = 0;

  constructor(
    private readonly config: TranslationConfig = resolveTranslationConfig(),
    private readonly fetchImpl: ThinGeminiFetch = fetch,
  ) {}

  getRequestCountForTests(): number {
    return this.requestCount;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }

    assertGeminiTranslationConfigured(this.config);

    if (this.requestCount >= 1) {
      throw new TranslationProviderError(
        "bad_request",
        "Thin Gemini transport hard-capped at one request.",
      );
    }

    if (request.sourceLanguage === request.targetLanguage) {
      this.requestCount += 1;
      return {
        translatedText: request.text,
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }

    this.requestCount += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const model = encodeURIComponent(this.config.geminiModel);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.geminiApiKey!,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: buildThinGeminiMediaPlpSystemInstruction({
                    sourceLanguage: request.sourceLanguage,
                    targetLanguage: request.targetLanguage,
                    terminologyContext: request.terminologyContext,
                    contentType: request.contentType,
                  }),
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: request.text }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: this.config.maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new TranslationProviderError("timeout", "Gemini translation timed out");
        }
        throw new TranslationProviderError(
          "network_failure",
          error instanceof Error ? error.message : "Gemini network failure",
        );
      }

      let body: GeminiGenerateContentResponse;
      try {
        body = (await response.json()) as GeminiGenerateContentResponse;
      } catch {
        throw new TranslationProviderError("malformed_response", "Gemini response was not JSON");
      }

      if (!response.ok) {
        throw classifyGeminiHttpFailure(response.status, body);
      }

      if (body.promptFeedback?.blockReason) {
        throw new TranslationProviderError(
          "safety_rejected",
          "Gemini blocked the translation request",
        );
      }

      const text =
        body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      const trimmed = text.trim();
      if (!trimmed) {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini returned empty translation",
        );
      }

      const cleaned = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      return {
        translatedText: cleaned,
        providerId: this.providerId,
        isPlaceholder: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Deterministic local fake for unit tests / memory probe — never calls Gemini.
 */
export class FakeLocalMediaPlpTransport implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  readonly transportId = MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID;

  private requestCount = 0;

  constructor(
    private readonly behavior: {
      readonly delayMs?: number;
      readonly timeoutMs?: number;
      readonly responseText?: string | ((request: TranslationProviderRequest) => string);
      readonly failWith?: Error;
    } = {},
  ) {}

  getRequestCountForTests(): number {
    return this.requestCount;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }

    if (this.requestCount >= 1) {
      throw new TranslationProviderError(
        "bad_request",
        "Fake local transport hard-capped at one request.",
      );
    }
    this.requestCount += 1;

    if (this.behavior.failWith) {
      throw this.behavior.failWith;
    }

    const delayMs = this.behavior.delayMs ?? 0;
    const timeoutMs = this.behavior.timeoutMs;
    if (timeoutMs !== undefined && delayMs >= timeoutMs) {
      throw new TranslationProviderError("timeout", "Fake local transport timed out");
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    let translatedText: string;
    if (typeof this.behavior.responseText === "function") {
      translatedText = this.behavior.responseText(request);
    } else if (typeof this.behavior.responseText === "string") {
      translatedText = this.behavior.responseText;
    } else {
      const parsed = JSON.parse(request.text) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        out[k] = `[${request.targetLanguage}] ${v}`;
      }
      translatedText = JSON.stringify(out);
    }

    return {
      translatedText,
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}

export async function createThinMediaPlpProviderFromConfig(
  config: TranslationConfig = resolveTranslationConfig(),
): Promise<{
  readonly provider: TranslationProvider;
  readonly PROVIDER_TRANSPORT: string;
}> {
  if (config.provider === "gemini") {
    assertGeminiTranslationConfigured(config);
    const provider = new ThinGeminiMediaPlpTransport(config);
    return {
      provider,
      PROVIDER_TRANSPORT: provider.transportId,
    };
  }

  const { DeterministicTranslationProvider } = await import(
    "../providers/deterministic-translation-provider.js"
  );
  return {
    provider: new DeterministicTranslationProvider(),
    PROVIDER_TRANSPORT: MEDIA_PLP_DETERMINISTIC_TRANSPORT_ID,
  };
}
