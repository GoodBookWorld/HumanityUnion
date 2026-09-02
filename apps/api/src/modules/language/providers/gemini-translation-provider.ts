import { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "../hu-terminology-glossary.js";
import { resolveLanguageRegistryLocale } from "../language-registry/index.js";
import {
  assertGeminiTranslationConfigured,
  resolveTranslationConfig,
  TranslationProviderError,
  type TranslationConfig,
} from "../translation.config.js";
import type {
  TranslationContentType,
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

/**
 * Pack 02G Task 07C — Registry englishName when available; otherwise locale code.
 * Never fails translation setup on missing metadata.
 */
export async function resolveTranslationLanguageEnglishName(
  locale: string,
): Promise<string> {
  const trimmed = locale.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const record = await resolveLanguageRegistryLocale(trimmed);
    const name = record?.englishName?.trim();
    return name || trimmed;
  } catch {
    return trimmed;
  }
}

export function buildGeminiTranslationSystemInstruction(input: {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly sourceLanguageName: string;
  readonly targetLanguageName: string;
  readonly terminologyContext?: string;
  readonly contentType?: TranslationContentType;
}): string {
  const terminology =
    input.terminologyContext?.trim() || HUMANITY_UNION_TRANSLATION_TERMINOLOGY;
  const sourceLabel = input.sourceLanguageName.trim() || input.sourceLanguage;
  const targetLabel = input.targetLanguageName.trim() || input.targetLanguage;
  const structured =
    input.contentType === "structured_json"
      ? [
          "The user message is a JSON object.",
          "Translate every human-readable translatable string value into the target language.",
          "Preserve JSON keys and structure exactly.",
          "Do not invent keys or fields.",
          "Return valid JSON only — no markdown fences.",
        ].join(" ")
      : "Return only the translated text in the target language — no preface, no markdown fences.";

  return [
    "You are a professional translator for the Humanity Union civic platform.",
    `Translate from ${sourceLabel} (${input.sourceLanguage}) into ${targetLabel} (${input.targetLanguage}).`,
    "Translate every human-readable translatable string value into the target language.",
    "Do not summarize, omit, invent, rewrite for style, or add information.",
    "Preserve paragraph structure, lists, links, URLs, numeric/statistical values, IDs, enum tokens, routes, and JSON keys.",
    // Pack 02G Task 07D — civic titles vs genuine invariants vs glossary tokens
    "Civic content titles and human-readable headings (including JSON fields such as `title`, `subject`, `question`, `overviewTitle`, and `initiativeFlowTitle`) are translatable content — translate them into the target language normally.",
    "For cross-language structured requests, designated civic title/heading field values must not remain identical to the source.",
    "Do not preserve a civic artifact title merely because it resembles a proper name, campaign name, alliance name, or capitalized phrase.",
    "Preserve genuine registered organization names, person names, established product/brand names, URLs, IDs, routes, enum tokens, acronyms, and similar invariant identifiers where appropriate; still translate surrounding prose into the target language.",
    "Do not alter voting or signature counts.",
    "Do not remove uncertainty markers.",
    "For Humanity Union canonical concepts listed below, use the preferred target-language term when those concepts appear.",
    "Keep Participant, Member, and Membership semantically distinct.",
    "Treat Humanity Union as constrained brand terminology; follow glossary guidance when provided.",
    "Glossary fallback-to-English applies only to the specific canonical terminology concept or preferred term/token when a target term is missing — never to the surrounding title, heading, sentence, or field prose.",
    "A missing target glossary term must never be interpreted as permission to leave the whole title, heading, sentence, or field in the source language.",
    "Glossary (canonical English (conceptId) => preferred target term):",
    terminology,
    structured,
  ].join("\n");
}

/** @deprecated Pack 02F compatibility — prefer buildGeminiTranslationSystemInstruction. */
export function buildGeminiTranslationSystemInstructionForTests(
  request: TranslationProviderRequest & {
    readonly sourceLanguageName?: string;
    readonly targetLanguageName?: string;
  },
): string {
  return buildGeminiTranslationSystemInstruction({
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    sourceLanguageName: request.sourceLanguageName ?? request.sourceLanguage,
    targetLanguageName: request.targetLanguageName ?? request.targetLanguage,
    terminologyContext: request.terminologyContext,
    contentType: request.contentType,
  });
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

    const [sourceLanguageName, targetLanguageName] = await Promise.all([
      resolveTranslationLanguageEnglishName(request.sourceLanguage),
      resolveTranslationLanguageEnglishName(request.targetLanguage),
    ]);

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
              parts: [
                {
                  text: buildGeminiTranslationSystemInstruction({
                    sourceLanguage: request.sourceLanguage,
                    targetLanguage: request.targetLanguage,
                    sourceLanguageName,
                    targetLanguageName,
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
