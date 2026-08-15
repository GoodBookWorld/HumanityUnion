import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { LifecycleAiConfig } from "../../../src/modules/lifecycle-ai/lifecycle-ai.config.js";
import { LifecycleAiError } from "../../../src/modules/lifecycle-ai/lifecycle-ai.errors.js";
import type { LifecycleAiProviderRequest } from "../../../src/modules/lifecycle-ai/lifecycle-ai-provider.js";
import { GeminiLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/gemini-lifecycle-ai-provider.js";

const originalFetch = globalThis.fetch;

function testConfig(overrides: Partial<LifecycleAiConfig> = {}): LifecycleAiConfig {
  return {
    provider: "gemini",
    geminiApiKey: "test-key",
    geminiModel: "gemini-2.0-flash",
    timeoutMs: 1000,
    maxOutputTokens: 256,
    diagnosticsEnabled: false,
    maxRetries: 0,
    maxPromptChars: 24_000,
    maxConversationHistoryTurns: 8,
    maxConversationTurnChars: 800,
    maxDraftExcerptChars: 4_000,
    maxSourceContextChars: 6_000,
    maxRequestsPerMinute: 10,
    maxRequestsPerDay: 200,
    duplicateRequestWindowMs: 4_000,
    ...overrides,
  };
}

function buildRequest(): LifecycleAiProviderRequest {
  return {
    initiativeId: "initiative-1",
    stageId: "analysis",
    stageLabel: "Collaborative Analysis",
    operation: "explain",
    participantDisplayName: "Alex Author",
    initiativeTitle: "Garden Initiative",
    presentationMode: "author_workspace",
    availableSourceLabels: ["Discussion comments (2)"],
    sourceContextSummary: "Comments: 2.",
    prompt: {
      systemPrompt: "You are the Lifecycle AI Assistant.",
      userPrompt: "Explain this stage.",
    },
  };
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

describe("GeminiLifecycleAiProvider — failure behavior", () => {
  afterEach(() => {
    restoreFetch();
  });

  it("fails when API key is missing without silent deterministic fallback", async () => {
    const provider = new GeminiLifecycleAiProvider(
      testConfig({ geminiApiKey: null }),
    );

    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) =>
        error instanceof LifecycleAiError &&
        error.code === "not_configured" &&
        error.publicMessage === "The AI Assistant is not configured for this environment.",
    );
  });

  it("maps invalid API key / unauthorized responses to calm not_configured errors", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
        status: 401,
      })) as typeof fetch;

    const provider = new GeminiLifecycleAiProvider(
      testConfig({ geminiApiKey: "test-invalid-key" }),
    );

    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "not_configured",
    );
  });

  it("maps rate limits, timeouts, network failures, malformed bodies, and safety refusals", async () => {
    const provider = new GeminiLifecycleAiProvider(testConfig({ timeoutMs: 50, maxRetries: 0 }));

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })) as typeof fetch;
    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "rate_limited",
    );

    globalThis.fetch = (async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch;
    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "timeout",
    );

    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "network_failure",
    );

    globalThis.fetch = (async () =>
      new Response("not-json", { status: 200 })) as typeof fetch;
    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) => error instanceof LifecycleAiError && error.code === "malformed_response",
    );

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), {
        status: 200,
      })) as typeof fetch;
    await assert.rejects(
      () => provider.assist(buildRequest()),
      (error: unknown) =>
        error instanceof LifecycleAiError &&
        error.code === "safety_refusal" &&
        error.publicMessage === "This request could not be processed safely.",
    );
  });

  it("never puts the API key in the request URL", async () => {
    let seenUrl = "";
    let seenHeaders: Headers | null = null;

    globalThis.fetch = (async (input, init) => {
      seenUrl = String(input);
      seenHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Section: assistant\nHello civic author." }] } }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const provider = new GeminiLifecycleAiProvider(
      testConfig({ geminiApiKey: "super-secret-test-key" }),
    );

    const result = await provider.assist(buildRequest());
    assert.equal(result.suggestions.length > 0, true);
    assert.equal(seenUrl.includes("key="), false);
    assert.equal(seenUrl.includes("super-secret-test-key"), false);
    assert.equal(seenHeaders?.get("x-goog-api-key"), "super-secret-test-key");
  });
});
