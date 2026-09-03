import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../translation-provider.js";
import { TranslationProviderError } from "../translation.config.js";

/**
 * Offline / test provider. Does not call external networks.
 * Marks output clearly so tests can assert originals were not overwritten.
 * Pack 02F Task 05: records last terminologyContext for assertions.
 */
export class DeterministicTranslationProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;

  private lastRequest: TranslationProviderRequest | null = null;

  getLastRequestForTests(): TranslationProviderRequest | null {
    return this.lastRequest;
  }

  clearLastRequestForTests(): void {
    this.lastRequest = null;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    this.lastRequest = request;

    if (!request.safetyCleared) {
      throw new TranslationProviderError(
        "safety_rejected",
        "Translation refused: content was not marked safety-cleared.",
      );
    }

    if (request.sourceLanguage === request.targetLanguage) {
      return {
        translatedText: request.text,
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }

    if (request.contentType === "structured_json") {
      try {
        const parsed = JSON.parse(request.text) as Record<string, unknown>;
        const translated: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== "string") {
            translated[key] = value;
            continue;
          }
          // Pack 08I.5 — for HTML-looking strings, translate text nodes only; keep tags/attrs.
          if (/<[a-z][\s\S]*>/i.test(value)) {
            translated[key] = value.replace(
              /(^|>)([^<]+)(?=<|$)/g,
              (_match, boundary: string, text: string) => {
                if (!text.trim()) {
                  return `${boundary}${text}`;
                }
                return `${boundary}[${request.targetLanguage}] ${text}`;
              },
            );
          } else {
            translated[key] = `[${request.targetLanguage}] ${value}`;
          }
        }
        return {
          translatedText: JSON.stringify(translated),
          providerId: this.providerId,
          isPlaceholder: false,
        };
      } catch {
        // fall through to plain prefix
      }
    }

    return {
      translatedText: `[${request.targetLanguage}] ${request.text}`,
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}
