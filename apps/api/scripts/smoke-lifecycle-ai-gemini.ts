/**
 * Real Gemini smoke test for Lifecycle AI Verification Pack 01.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/smoke-lifecycle-ai-gemini.ts
 *
 * Reads apps/api/.env (LIFECYCLE_AI_PROVIDER=gemini, GEMINI_API_KEY=...).
 * Never prints the API key, system prompt, or raw vendor payload.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import type { LifecycleAiProviderRequest } from "../src/modules/lifecycle-ai/lifecycle-ai-provider.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../.env") });
dotenv.config({ path: path.resolve(scriptDir, "../../../.env") });

const { buildLifecycleAiPrompt } = await import("../src/modules/lifecycle-ai/build-lifecycle-ai-prompt.js");
const { resolveLifecycleAiConfig } = await import("../src/modules/lifecycle-ai/lifecycle-ai.config.js");
const { DeterministicLifecycleAiProvider } = await import(
  "../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js"
);
const { GeminiLifecycleAiProvider } = await import(
  "../src/modules/lifecycle-ai/providers/gemini-lifecycle-ai-provider.js"
);

const OPERATIONS = [
  "explain",
  "summarize_source_themes",
  "identify_missing_information",
  "improve_wording",
  "answer_question",
] as const;

function buildRequest(
  operation: (typeof OPERATIONS)[number],
): LifecycleAiProviderRequest {
  const base = {
    initiativeId: "smoke-initiative",
    stageId: "analysis" as const,
    stageLabel: "Collaborative Analysis",
    operation,
    participantDisplayName: "Smoke Tester",
    initiativeTitle: "Neighborhood Climate Resilience",
    presentationMode: "author_workspace",
    availableSourceLabels: [
      "Discussion comments (2)",
      "Helpful (1)",
      "Not Helpful (0)",
      "Active Allies (1)",
    ],
    sourceContextSummary:
      "Comments: 2. Top arguments: community gardens improve food security. Open questions: who maintains plots?",
    instructions:
      operation === "answer_question"
        ? "In Humanity Union terminology, what is Tracking?"
        : undefined,
    currentDraftExcerpt:
      operation === "improve_wording"
        ? "This analysis kinda looks at garden risks and stuff."
        : undefined,
  };

  return {
    ...base,
    prompt: buildLifecycleAiPrompt(base),
  };
}

async function main(): Promise<void> {
  const config = resolveLifecycleAiConfig();

  if (config.provider !== "gemini") {
    throw new Error("Set LIFECYCLE_AI_PROVIDER=gemini for this smoke test.");
  }

  if (!config.geminiApiKey) {
    throw new Error("Set GEMINI_API_KEY for this smoke test (server-side only).");
  }

  const gemini = new GeminiLifecycleAiProvider(config);
  const deterministic = new DeterministicLifecycleAiProvider();

  console.log("Lifecycle AI Gemini smoke");
  console.log(`configuredProvider=${config.provider}`);
  console.log(`activeProviderId=${gemini.providerId}`);
  console.log(`model=${config.geminiModel}`);
  console.log("keyPresent=true");

  const { LifecycleAiError } = await import("../src/modules/lifecycle-ai/lifecycle-ai.errors.js");

  for (const [index, operation] of OPERATIONS.entries()) {
    if (index > 0) {
      // Free-tier Gemini quotas are tight; space calls to avoid false 429 failures.
      await new Promise((resolve) => setTimeout(resolve, 12_000));
    }

    const request = buildRequest(operation);
    let result;
    try {
      result = await gemini.assist(request);
    } catch (error) {
      if (error instanceof LifecycleAiError && error.code === "rate_limited") {
        await new Promise((resolve) => setTimeout(resolve, 20_000));
        result = await gemini.assist(request);
      } else {
        throw error;
      }
    }

    const baseline = await deterministic.assist(request);
    const text = result.suggestions.map((item) => item.suggestedText).join("\n");
    const baselineText = baseline.suggestions.map((item) => item.suggestedText).join("\n");

    if (result.isPlaceholder) {
      throw new Error(`${operation}: received placeholder response`);
    }

    if (!text.trim()) {
      throw new Error(`${operation}: empty Gemini suggestion`);
    }

    if (text.trim() === baselineText.trim()) {
      throw new Error(`${operation}: response matched deterministic provider exactly`);
    }

    if (!result.suggestions.every((item) => /Gemini suggestion/i.test(item.provenanceNote))) {
      throw new Error(`${operation}: provenance did not identify Gemini`);
    }

    console.log(
      `OK ${operation} suggestions=${result.suggestions.length} chars=${text.length} provider=${gemini.providerId}`,
    );
  }

  console.log("Gemini smoke passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Smoke test failed.";
  console.error(message.replace(/AIza[^\s]+/g, "[redacted]").replace(/key=[^\s&]+/gi, "key=[redacted]"));
  process.exitCode = 1;
});
