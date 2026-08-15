import type { InitiativeLifecycleAiAssistSuggestion } from "@hu/types";

import { parseSectionedSuggestions } from "../build-lifecycle-ai-prompt.js";
import {
  assertGeminiLifecycleAiConfigured,
  resolveLifecycleAiConfig,
  type LifecycleAiConfig,
} from "../lifecycle-ai.config.js";
import { LifecycleAiError } from "../lifecycle-ai.errors.js";
import type { LifecycleAiProvider, LifecycleAiProviderRequest } from "../lifecycle-ai-provider.js";

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

export interface GeminiAssistExecutionResult {
  readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
  readonly isPlaceholder: boolean;
  readonly retryCount: number;
}

function classifyGeminiHttpFailure(status: number, body: GeminiGenerateContentResponse): LifecycleAiError {
  if (status === 401 || status === 403) {
    return new LifecycleAiError("not_configured", `Gemini HTTP ${status}`);
  }

  if (status === 429) {
    return new LifecycleAiError("rate_limited", `Gemini HTTP ${status}`);
  }

  if (status >= 500) {
    return new LifecycleAiError("unavailable", `Gemini HTTP ${status}`);
  }

  const vendorMessage = body.error?.message ?? "";
  if (/API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(vendorMessage)) {
    return new LifecycleAiError("not_configured", "Gemini rejected credentials");
  }

  return new LifecycleAiError("unavailable", `Gemini HTTP ${status}`);
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof LifecycleAiError)) {
    return false;
  }
  return (
    error.code === "timeout" ||
    error.code === "network_failure" ||
    error.code === "unavailable" ||
    error.code === "rate_limited"
  );
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LifecycleAiError("timeout", "Gemini request cancelled"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LifecycleAiError("timeout", "Gemini request cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * First real Lifecycle AI provider. Gemini HTTP/auth details stay in this file only.
 * Never logs or returns the API key. Never silently falls back to deterministic.
 * Production Hardening Pack 01: timeout + max two retries + cancellation support.
 */
export class GeminiLifecycleAiProvider implements LifecycleAiProvider {
  readonly providerId = "gemini" as const;

  constructor(private readonly config: LifecycleAiConfig = resolveLifecycleAiConfig()) {}

  async assist(request: LifecycleAiProviderRequest): Promise<{
    readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
    readonly isPlaceholder: boolean;
  }> {
    const result = await this.assistWithRetries(request);
    return {
      suggestions: result.suggestions,
      isPlaceholder: result.isPlaceholder,
    };
  }

  async assistWithRetries(
    request: LifecycleAiProviderRequest,
    externalSignal?: AbortSignal,
  ): Promise<GeminiAssistExecutionResult> {
    assertGeminiLifecycleAiConfigured(this.config);

    const configuredRetries = Number.isFinite(this.config.maxRetries)
      ? Math.max(0, Math.min(2, this.config.maxRetries))
      : 2;
    const maxAttempts = 1 + configuredRetries;
    let lastError: unknown;
    let retryCount = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (externalSignal?.aborted) {
        throw new LifecycleAiError("timeout", "Gemini request cancelled");
      }

      try {
        const suggestions = await this.executeOnce(request, externalSignal);
        return { suggestions, isPlaceholder: false, retryCount };
      } catch (error) {
        lastError = error;
        const canRetry = attempt < maxAttempts && isRetryableError(error);
        if (!canRetry) {
          throw error;
        }
        retryCount += 1;
        await sleep(250 * attempt, externalSignal);
      }
    }

    if (lastError instanceof LifecycleAiError) {
      throw lastError;
    }
    throw new LifecycleAiError("unavailable", "Gemini retries exhausted");
  }

  private async executeOnce(
    request: LifecycleAiProviderRequest,
    externalSignal?: AbortSignal,
  ): Promise<readonly InitiativeLifecycleAiAssistSuggestion[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);

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
              parts: [{ text: request.prompt.systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: request.prompt.userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: this.config.maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new LifecycleAiError("timeout", "Gemini request aborted by timeout");
        }

        throw new LifecycleAiError(
          "network_failure",
          error instanceof Error ? error.message : "Gemini network failure",
        );
      }

      let body: GeminiGenerateContentResponse;
      try {
        body = (await response.json()) as GeminiGenerateContentResponse;
      } catch {
        throw new LifecycleAiError("malformed_response", "Gemini response was not JSON");
      }

      if (!response.ok) {
        throw classifyGeminiHttpFailure(response.status, body);
      }

      if (body.promptFeedback?.blockReason) {
        throw new LifecycleAiError(
          "safety_refusal",
          `Gemini promptFeedback.blockReason=${body.promptFeedback.blockReason}`,
        );
      }

      const finishReason = body.candidates?.[0]?.finishReason;
      if (finishReason && /SAFETY|BLOCK|RECITATION|PROHIBITED/i.test(finishReason)) {
        throw new LifecycleAiError("safety_refusal", `Gemini finishReason=${finishReason}`);
      }

      const content = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!content) {
        throw new LifecycleAiError("malformed_response", "Gemini returned empty content");
      }

      return parseSectionedSuggestions(
        content,
        request.operation,
        request.stageId,
        `Gemini suggestion for ${request.stageLabel} (${request.operation}). Review and edit before Save.`,
      );
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
