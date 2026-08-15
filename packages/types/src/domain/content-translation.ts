import type { LanguageCode } from "./language.js";

/**
 * Language Architecture Pack 01 — translated-content model.
 *
 * Original Content → preserved permanently.
 * Translation → separate representation.
 * Never overwrite the original with a machine translation.
 */

export type TranslationKind = "machine" | "human" | "author-approved";

export type TranslationFreshness = "current" | "stale" | "regenerating";

export type TranslationProviderId =
  | "deterministic"
  | "gemini"
  | "google_cloud"
  | "deepl"
  | (string & {});

/**
 * Vertical-slice source kinds (Pack 02).
 * Later Lifecycle stages reuse the same adapter with additional kinds.
 */
export type ContentTranslationSourceKind =
  | "initiative"
  | "collaborative_analysis"
  | "petition"
  | "lifecycle_stage"
  | "blog_post";

/**
 * Reusable translated-content record.
 * Storage strategy may vary by domain (embedded, side collection, projection),
 * but the logical shape remains stable.
 */
export interface TranslatedContentRecord {
  readonly translationId: string;
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  /** Version / revision / content hash of the source at translation time. */
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
  /** Structured or plain translated payload — never mutates the source record. */
  readonly translatedContent: Record<string, unknown> | string;
  readonly translationProvider: TranslationProviderId;
  readonly translationKind: TranslationKind;
  readonly createdAt: string;
  readonly updatedAt?: string;
  /** True when sourceVersion no longer matches the live original. */
  readonly stale: boolean;
  readonly freshness: TranslationFreshness;
}

/**
 * Display resolution for public reading — never empty solely because translation is missing.
 */
export type ResolvedContentPresentationMode =
  | "preferred_translation"
  | "fallback_translation"
  | "original";

export interface ResolvedTranslatedDisplay<TContent = string> {
  readonly presentationMode: ResolvedContentPresentationMode;
  readonly content: TContent;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly originalContent: TContent;
  readonly translation: TranslatedContentRecord | null;
  readonly isMachineTranslated: boolean;
  readonly isStale: boolean;
  /** When true, UI should offer View Original. */
  readonly canViewOriginal: boolean;
  /**
   * When true (e.g. translationPreference = ask), UI may offer switching
   * to a current translation while still defaulting to original.
   */
  readonly canViewTranslation: boolean;
}

/**
 * Explicit Author draft translation assistance request.
 * Must never silently replace controlled form values.
 */
export interface TranslateDraftRequest {
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
  readonly draftContent: Record<string, unknown> | string;
  readonly initiativeId?: string;
  readonly sourceKind?: ContentTranslationSourceKind;
}

export interface TranslateDraftResult {
  readonly workingTranslation: TranslatedContentRecord;
  /** Original draft payload unchanged. */
  readonly originalDraftContent: Record<string, unknown> | string;
  readonly originalLanguage: LanguageCode;
}
