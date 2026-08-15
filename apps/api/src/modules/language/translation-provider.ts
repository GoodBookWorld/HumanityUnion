import type { LanguageCode, TranslationProviderId } from "@hu/types";

/**
 * Provider-independent translation seam (Language Architecture Pack 01).
 * Domains must not import Gemini / Google Cloud / DeepL SDKs directly.
 */

export type TranslationContentType = "plain" | "structured_json";

export interface TranslationProviderRequest {
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
  readonly text: string;
  readonly contentType?: TranslationContentType;
  readonly sourceRecordId?: string;
  readonly sourceVersion?: string;
  /** Bounded terminology hints — never full Initiative history or private data. */
  readonly terminologyContext?: string;
  /**
   * When true, the caller asserts content is already Safety-cleared for translation.
   * Private Direct Messages must not be sent through this seam.
   */
  readonly safetyCleared: boolean;
}

export interface TranslationProviderResult {
  readonly translatedText: string;
  readonly providerId: TranslationProviderId;
  readonly isPlaceholder: boolean;
}

export interface TranslationProvider {
  readonly providerId: TranslationProviderId;
  translate(request: TranslationProviderRequest): Promise<TranslationProviderResult>;
}
