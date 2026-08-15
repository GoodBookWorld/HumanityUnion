import { resolveLifecycleAiConfig } from "./lifecycle-ai.config.js";
import type { LifecycleAiProvider } from "./lifecycle-ai-provider.js";
import { DeterministicLifecycleAiProvider } from "./providers/deterministic-lifecycle-ai-provider.js";
import { GeminiLifecycleAiProvider } from "./providers/gemini-lifecycle-ai-provider.js";

let activeProvider: LifecycleAiProvider | null = null;

/**
 * Resolves the configured Lifecycle AI provider.
 *
 * Product policy: there is NO silent fallback from Gemini → deterministic.
 * If `LIFECYCLE_AI_PROVIDER=gemini`, callers always receive
 * `GeminiLifecycleAiProvider` (which fails with a calm LifecycleAiError when
 * unavailable). Deterministic mode is selected only by explicit configuration.
 */
export function resolveLifecycleAiProvider(): LifecycleAiProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const config = resolveLifecycleAiConfig();

  if (config.provider === "gemini") {
    return new GeminiLifecycleAiProvider(config);
  }

  return new DeterministicLifecycleAiProvider();
}

export function setLifecycleAiProviderForTests(provider: LifecycleAiProvider): void {
  activeProvider = provider;
}

export function resetLifecycleAiProviderForTests(): void {
  activeProvider = null;
}
