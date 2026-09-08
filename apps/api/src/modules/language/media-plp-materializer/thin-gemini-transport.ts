/**
 * Reset 03B.2 / RESET 05E / 05E.2 — thin Gemini HTTP transport for Media PLP.
 *
 * RESET 05E.2 — safe HTTP/transport forensics on every failure path
 * (status/class/errorClass/Retry-After/Gemini structural tokens). Never secrets.
 */

import {
  assertGeminiTranslationConfigured,
  resolveTranslationConfig,
  TranslationProviderError,
  type TranslationConfig,
  type TranslationProviderTransportMeta,
} from "../translation.config.js";
import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../translation-provider.js";
import { buildThinGeminiMediaPlpSystemInstruction } from "./thin-gemini-prompt.js";
import {
  classifyFinishReasonSubtype,
  classifyHttpTransportErrorClass,
  classifyNetworkTransportErrorClass,
  extractJsonObjectText,
  httpStatusClass,
  parseRetryAfterSeconds,
  PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA,
  PLP_PROVIDER_FAILURE_SUBTYPE,
  sanitizeGeminiErrorToken,
} from "./provider-response-contract.js";

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
    code?: number | string;
    details?: unknown;
  };
}

function geminiTransportMeta(
  status: number,
  body: GeminiGenerateContentResponse,
  retryAfterSeconds: number | null,
): TranslationProviderTransportMeta {
  const errorClass = classifyHttpTransportErrorClass(status);
  const geminiStatus = sanitizeGeminiErrorToken(body.error?.status);
  const geminiCode = sanitizeGeminiErrorToken(body.error?.code);
  // Prefer status token; never persist free-form error.message prose.
  const geminiReason = geminiStatus ?? geminiCode;
  return {
    httpStatus: status,
    httpClass: httpStatusClass(status),
    errorClass,
    errorCode: geminiCode,
    retryAfterSeconds,
    geminiErrorStatus: geminiStatus,
    geminiErrorReason: geminiReason,
  };
}

/**
 * Every non-2xx Gemini HTTP response → HTTP_FAILURE subtype + safe transport meta.
 * Origins of PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE for HTTP responses.
 */
function classifyGeminiHttpFailure(
  status: number,
  body: GeminiGenerateContentResponse,
  retryAfterSeconds: number | null,
): TranslationProviderError {
  const transport = geminiTransportMeta(status, body, retryAfterSeconds);
  if (status === 401 || status === 403) {
    return new TranslationProviderError(
      "not_configured",
      `Gemini HTTP ${status}`,
      PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
      transport,
    );
  }
  if (status === 429) {
    return new TranslationProviderError(
      "rate_limited",
      `Gemini HTTP ${status}`,
      PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
      transport,
    );
  }
  if (status >= 500) {
    return new TranslationProviderError(
      "unavailable",
      `Gemini HTTP ${status}`,
      PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
      transport,
    );
  }
  // 400 / 404 / other 4xx — often invalid request/schema/model.
  return new TranslationProviderError(
    "unavailable",
    `Gemini HTTP ${status}`,
    PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
    transport,
  );
}

function classifyFetchException(error: unknown): TranslationProviderError {
  const errorClass = classifyNetworkTransportErrorClass(error);
  if (errorClass === "ABORT" || errorClass === "TIMEOUT") {
    return new TranslationProviderError(
      "timeout",
      errorClass === "ABORT"
        ? "Gemini translation aborted"
        : "Gemini translation timed out",
      PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT,
      {
        httpStatus: null,
        httpClass: null,
        errorClass,
        errorCode: null,
        retryAfterSeconds: null,
        geminiErrorStatus: null,
        geminiErrorReason: null,
      },
    );
  }
  // Network/DNS/TLS/SOCKET — historically collapsed to HTTP_FAILURE with null HTTP_CLASS.
  return new TranslationProviderError(
    "network_failure",
    "Gemini network/transport failure",
    PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
    {
      httpStatus: null,
      httpClass: null,
      errorClass,
      errorCode: null,
      retryAfterSeconds: null,
      geminiErrorStatus: null,
      geminiErrorReason: null,
    },
  );
}

export type ThinGeminiFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type MediaPlpBatchableTransport = TranslationProvider & {
  setMaxRequestsForBatching?(maxRequests: number): void;
  getRequestCountForTests?(): number;
};

/**
 * Gemini transport for the Media PLP operator.
 * RESET 05E — maxRequests allows sequential batch hops (still concurrency=1).
 */
export class ThinGeminiMediaPlpTransport implements TranslationProvider {
  readonly providerId = "gemini" as const;
  readonly transportId = MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID;

  private requestCount = 0;
  private maxRequests: number;

  constructor(
    private readonly config: TranslationConfig = resolveTranslationConfig(),
    private readonly fetchImpl: ThinGeminiFetch = fetch,
    options?: { readonly maxRequests?: number },
  ) {
    this.maxRequests = Math.max(1, Math.trunc(options?.maxRequests ?? 1));
  }

  getRequestCountForTests(): number {
    return this.requestCount;
  }

  setMaxRequestsForBatching(maxRequests: number): void {
    this.maxRequests = Math.max(1, Math.trunc(maxRequests));
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
        PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED,
      );
    }

    assertGeminiTranslationConfigured(this.config);

    if (this.requestCount >= this.maxRequests) {
      throw new TranslationProviderError(
        "bad_request",
        `Thin Gemini transport hard-capped at ${this.maxRequests} request(s).`,
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
      // API key is header-only — never embed in URL (avoids secret leakage in logs).
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
              responseMimeType: "application/json",
              // OpenAPI-subset schema (lowercase types accepted by gemini-2.0-flash REST).
              responseSchema: PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA,
            },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        throw classifyFetchException(error);
      }

      let body: GeminiGenerateContentResponse;
      try {
        body = (await response.json()) as GeminiGenerateContentResponse;
      } catch {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini response was not JSON",
          PLP_PROVIDER_FAILURE_SUBTYPE.GEMINI_ENVELOPE_MISSING,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: classifyHttpTransportErrorClass(response.status) ?? "UNKNOWN_TRANSPORT",
            errorCode: null,
            retryAfterSeconds: parseRetryAfterSeconds(
              response.headers.get("retry-after"),
            ),
            geminiErrorStatus: null,
            geminiErrorReason: null,
          },
        );
      }

      if (!response.ok) {
        throw classifyGeminiHttpFailure(
          response.status,
          body,
          parseRetryAfterSeconds(response.headers.get("retry-after")),
        );
      }

      if (body.promptFeedback?.blockReason) {
        throw new TranslationProviderError(
          "safety_rejected",
          "Gemini blocked the translation request",
          PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: "SAFETY_BLOCKED",
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(
              body.promptFeedback.blockReason,
            ),
            geminiErrorReason: sanitizeGeminiErrorToken(
              body.promptFeedback.blockReason,
            ),
          },
        );
      }

      const candidates = body.candidates ?? [];
      if (candidates.length === 0) {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini returned no candidates",
          PLP_PROVIDER_FAILURE_SUBTYPE.CANDIDATE_MISSING,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: null,
            geminiErrorReason: null,
          },
        );
      }

      const candidate = candidates[0]!;
      const finishReason = candidate.finishReason ?? null;
      const finishSubtype = classifyFinishReasonSubtype(finishReason);
      if (finishSubtype === PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED) {
        throw new TranslationProviderError(
          "safety_rejected",
          "Gemini finishReason safety block",
          finishSubtype,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: "SAFETY_BLOCKED",
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(finishReason),
            geminiErrorReason: sanitizeGeminiErrorToken(finishReason),
          },
        );
      }

      const parts = candidate.content?.parts ?? [];
      const textPartCount = parts.filter((p) => typeof p.text === "string").length;
      if (parts.length === 0 || textPartCount === 0) {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini candidate missing text parts",
          PLP_PROVIDER_FAILURE_SUBTYPE.TEXT_PART_MISSING,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(finishReason),
            geminiErrorReason: null,
          },
        );
      }

      const text = parts.map((part) => part.text ?? "").join("");
      const trimmed = text.trim();
      if (!trimmed) {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini returned empty translation",
          PLP_PROVIDER_FAILURE_SUBTYPE.EMPTY_RESPONSE,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(finishReason),
            geminiErrorReason: null,
          },
        );
      }

      if (
        finishSubtype === PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON ||
        finishSubtype === PLP_PROVIDER_FAILURE_SUBTYPE.TRUNCATED_RESPONSE
      ) {
        throw new TranslationProviderError(
          "malformed_response",
          finishSubtype === PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON
            ? "Gemini truncated output (MAX_TOKENS)"
            : `Gemini truncated/incomplete finishReason=${finishReason}`,
          finishSubtype,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(finishReason),
            geminiErrorReason: sanitizeGeminiErrorToken(finishReason),
          },
        );
      }

      const extracted = extractJsonObjectText(trimmed);
      if (!extracted.ok) {
        throw new TranslationProviderError(
          "malformed_response",
          "Gemini JSON extraction failed",
          extracted.subtype,
          {
            httpStatus: response.status,
            httpClass: httpStatusClass(response.status),
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: sanitizeGeminiErrorToken(finishReason),
            geminiErrorReason: null,
          },
        );
      }

      return {
        translatedText: extracted.text,
        providerId: this.providerId,
        isPlaceholder: false,
        envelope: {
          httpStatus: response.status,
          finishReason,
          candidateCount: candidates.length,
          textPartCount,
          extractedLength: extracted.text.length,
          failureSubtype: null,
          errorClass: null,
          errorCode: null,
          retryAfterSeconds: null,
          geminiErrorStatus: null,
          geminiErrorReason: null,
        },
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
  private maxRequests: number;

  constructor(
    private readonly behavior: {
      readonly delayMs?: number;
      readonly timeoutMs?: number;
      readonly responseText?: string | ((request: TranslationProviderRequest) => string);
      readonly failWith?: Error;
      readonly maxRequests?: number;
      readonly finishReason?: string;
    } = {},
  ) {
    this.maxRequests = Math.max(1, Math.trunc(behavior.maxRequests ?? 1));
  }

  getRequestCountForTests(): number {
    return this.requestCount;
  }

  setMaxRequestsForBatching(maxRequests: number): void {
    this.maxRequests = Math.max(1, Math.trunc(maxRequests));
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
        PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED,
      );
    }

    if (this.requestCount >= this.maxRequests) {
      throw new TranslationProviderError(
        "bad_request",
        `Fake local transport hard-capped at ${this.maxRequests} request(s).`,
      );
    }
    this.requestCount += 1;

    if (this.behavior.failWith) {
      throw this.behavior.failWith;
    }

    const delayMs = this.behavior.delayMs ?? 0;
    const timeoutMs = this.behavior.timeoutMs;
    if (timeoutMs !== undefined && delayMs >= timeoutMs) {
      throw new TranslationProviderError(
        "timeout",
        "Fake local transport timed out",
        PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_TIMEOUT,
        {
          httpStatus: null,
          httpClass: null,
          errorClass: "TIMEOUT",
          errorCode: null,
          retryAfterSeconds: null,
          geminiErrorStatus: null,
          geminiErrorReason: null,
        },
      );
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (this.behavior.finishReason) {
      const subtype = classifyFinishReasonSubtype(this.behavior.finishReason);
      if (subtype) {
        throw new TranslationProviderError(
          subtype === PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED
            ? "safety_rejected"
            : "malformed_response",
          `Fake finishReason=${this.behavior.finishReason}`,
          subtype,
        );
      }
    }

    let translatedText: string;
    if (typeof this.behavior.responseText === "function") {
      translatedText = this.behavior.responseText(request);
    } else if (typeof this.behavior.responseText === "string") {
      translatedText = this.behavior.responseText;
    } else {
      const parsed = JSON.parse(request.text) as {
        translations?: Array<{ key: string; value: string }>;
      } & Record<string, string>;
      if (Array.isArray(parsed.translations)) {
        translatedText = JSON.stringify({
          translations: parsed.translations.map((row) => ({
            key: row.key,
            value: `[${request.targetLanguage}] ${row.value}`,
          })),
        });
      } else {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string") {
            out[k] = `[${request.targetLanguage}] ${v}`;
          }
        }
        translatedText = JSON.stringify({
          translations: Object.keys(out)
            .sort()
            .map((key) => ({ key, value: out[key]! })),
        });
      }
    }

    return {
      translatedText,
      providerId: this.providerId,
      isPlaceholder: false,
      envelope: {
        httpStatus: 200,
        finishReason: "STOP",
        candidateCount: 1,
        textPartCount: 1,
        extractedLength: translatedText.length,
        failureSubtype: null,
      },
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
