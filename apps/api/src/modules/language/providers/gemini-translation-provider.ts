import { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "../hu-terminology-glossary.js";
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

function buildSystemInstruction(request: TranslationProviderRequest): string {
  const terminology =
    request.terminologyContext?.trim() || HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
  const structured =
    request.contentType === "structured_json"
      ? [
          "The user message is a JSON object.",
          "Translate only string values.",
          "Preserve JSON keys exactly.",
          "Return valid JSON only — no markdown fences.",
        ].join(" ")
      : "Return only the translated text — no preface, no markdown fences.";

  return [
    "You are a professional translator for the Humanity Union civic platform.",
    "Translate normal content accurately and naturally. Do not summarize, rewrite for style, improve, or add information.",
    "Preserve paragraph structure, lists, links, public names, and numeric/statistical values.",
    "Do not alter voting or signature counts.",
    "Do not remove uncertainty markers.",
    "Do not alter machine identifiers, IDs, enum tokens, routes, JSON keys, or code-like values.",
    "For Humanity Union canonical concepts listed below, use the preferred target-language term when those concepts appear.",
    "Keep Participant, Member, and Membership semantically distinct.",
    "Treat Humanity Union as constrained brand terminology; follow glossary guidance when provided.",
    "When a preferred target term is missing, keep the canonical English term.",
    "Glossary (canonical English (conceptId) => preferred target term):",
    terminology,
    `Source language: ${request.sourceLanguage}. Target language: ${request.targetLanguage}.`,
    structured,
  ].join("\n");
}

/** Exported for Pack 02F Task 05 prompt-contract tests. */
export function buildGeminiTranslationSystemInstructionForTests(
  request: TranslationProviderRequest,
): string {
  return buildSystemInstruction(request);
}

/**
 * Pack 02 — first real TranslationProvider.
 * Gemini HTTP/auth details stay in this file only.
 * Never logs or returns the API key. Never silently falls back to deterministic.
 */
export class GeminiTranslationProvider implements TranslationProvider {
  readonly providerId = "gemini" as const;

  constructor(private readonly config: TranslationConfig = resolveTranslationConfig()) {}

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }

    assertGeminiTranslationConfigured(this.config);

    if (request.sourceLanguage === request.targetLanguage) {
      return {
        translatedText: request.text,
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const model = encodeURIComponent(this.config.geminiModel);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.geminiApiKey!,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: buildSystemInstruction(request) }],
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

      const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      const trimmed = text.trim();
      if (!trimmed) {
        throw new TranslationProviderError("malformed_response", "Gemini returned empty translation");
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
