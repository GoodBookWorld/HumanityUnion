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
 * Vertical-slice + Pack 02G civic/public source kinds.
 * Task 03 adds explicit lifecycle kinds — do not overload lifecycle_stage.
 */
export type ContentTranslationSourceKind =
  | "initiative"
  | "collaborative_analysis"
  | "petition"
  | "lifecycle_stage"
  | "blog_post"
  | "discussion_comment"
  | "improvement_proposal"
  | "initiative_revision"
  | "decision_session"
  | "collective_decision"
  | "implementation_commitment"
  | "implementation_tracking"
  | "official_response"
  | "public_impact"
  | "civic_archive"
  | "civic_media"
  | "public_news";

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

/**
 * Pack 02G — how translation generation was requested.
 * Same engine/loader/provider/persistence; different locale eligibility gates.
 *
 * - `on_demand`: explicit/manual/user-triggered (enabled locale sufficient)
 * - `automatic_warm`: background warming (requires contentTranslationEnabled)
 */
export type ContentTranslationIntent = "on_demand" | "automatic_warm";

/**
 * Canonical work identity for persistence uniqueness + future warm-job dedupe.
 * Matches Mongo unique index: sourceKind + sourceRecordId + sourceVersion + targetLanguage.
 */
export interface ContentTranslationWorkIdentity {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: LanguageCode;
}

/**
 * Durable warm-request command (source-level).
 * Distinct from catalogue result events TranslationPublished / TranslationCorrected.
 *
 * Consumer reloads authoritative source + Registry targets at execution.
 * Do not embed translated text, provider prompts, private fields, or locale snapshots.
 */
export const CONTENT_TRANSLATION_WARM_REQUESTED = "ContentTranslationWarmRequested" as const;

export type ContentTranslationWarmRequestedCommandName =
  typeof CONTENT_TRANSLATION_WARM_REQUESTED;

/** Why a source-level warm was requested (observability only). */
export type ContentTranslationWarmReason =
  | "public_mutation"
  | "public_update"
  | "operator_manual"
  | "operator_backfill"
  /** Pack 08K.2.2 — gated residual retry of ready identities only. */
  | "operator_residual_retry";

export interface ContentTranslationWarmRequestedCommand {
  readonly commandName: ContentTranslationWarmRequestedCommandName;
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly requestedAt: string;
  readonly reason: ContentTranslationWarmReason;
  /**
   * Optional locale constraint (Pack 08K.2.2 residual retry).
   * When set, consumer intersects with Registry automatic targets and processes
   * ONLY these locales — never unrelated CURRENT/blocked identities.
   * Omit for normal mutation/backfill full Registry fan-out.
   */
  readonly targetLocales?: readonly LanguageCode[];
  /**
   * Pack 08K.2.6 — optional architecture retry basis recorded on the attempt
   * (e.g. EXACT_FAILURE_REASON_PROPAGATION_08K25). Observability / idempotency only.
   */
  readonly architectureRetryBasis?: string;
}
