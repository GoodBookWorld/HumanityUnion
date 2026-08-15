import { DeterministicTranslationProvider } from "./providers/deterministic-translation-provider.js";
import { GeminiTranslationProvider } from "./providers/gemini-translation-provider.js";
import {
  assertGeminiTranslationConfigured,
  resolveTranslationConfig,
  TranslationProviderError,
} from "./translation.config.js";
import type { TranslationProvider } from "./translation-provider.js";

let overrideProvider: TranslationProvider | null = null;

/**
 * Pack 02 — resolve TranslationProvider from TRANSLATION_PROVIDER.
 * Never silently falls back from gemini → deterministic.
 */
export function resolveTranslationProvider(): TranslationProvider {
  if (overrideProvider) {
    return overrideProvider;
  }

  const config = resolveTranslationConfig();
  if (config.provider === "gemini") {
    assertGeminiTranslationConfigured(config);
    return new GeminiTranslationProvider(config);
  }

  return new DeterministicTranslationProvider();
}

export function setTranslationProviderForTests(provider: TranslationProvider): void {
  overrideProvider = provider;
}

export function resetTranslationProviderForTests(): void {
  overrideProvider = null;
}

export function translationProviderPublicErrorMessage(error: unknown): string {
  if (error instanceof TranslationProviderError) {
    switch (error.code) {
      case "rate_limited":
        return "Translation is temporarily rate limited. Please try again shortly.";
      case "timeout":
        return "Translation timed out. Showing original content.";
      case "not_configured":
        return "Translation is not configured right now. Showing original content.";
      case "safety_rejected":
        return "This content could not be translated safely.";
      case "forbidden":
        return "You are not allowed to translate this content.";
      case "unsupported_language":
        return "That language is not supported for translation yet.";
      default:
        return "Translation is temporarily unavailable. Showing original content.";
    }
  }

  return "Translation is temporarily unavailable. Showing original content.";
}
