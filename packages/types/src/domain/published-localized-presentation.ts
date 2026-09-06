/**
 * TRANSLATION DELIVERY RESET 02 — Published Localized Presentation domain contract.
 *
 * Localization is a publication concern, not a rendering concern.
 * See ADR-026 / PUBLISHED_LOCALIZATION_DELIVERY_ARCHITECTURE_v1.0.md.
 */

import type { LanguageCode } from "./language.js";
import type { PublicPresentationNode } from "./public-localized-presentation.js";

/** Current localization schema for newly published snapshots. */
export const PUBLISHED_LOCALIZATION_SCHEMA_VERSION = "PLP.2" as const;

export type PublishedLocalizationSchemaVersion =
  | typeof PUBLISHED_LOCALIZATION_SCHEMA_VERSION
  | (string & {});

export type PublishedLocalizedPresentationState =
  | "BUILDING"
  | "PUBLISHED"
  | "FAILED"
  | "SUPERSEDED";

/**
 * Provenance priority for a localized node (highest first in
 * PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY).
 */
export type PublishedLocalizationProvenanceSource =
  | "PROTECTED_CANONICAL"
  | "LEGAL_LOCALIZATION"
  | "BRAND_LOCALIZATION"
  | "MANUAL_APPROVED"
  | "CONTROLLED_TERMINOLOGY"
  | "GEOGRAPHY"
  | "MACHINE"
  | "CANONICAL_FALLBACK";

/** Deterministic precedence — machine must never overwrite higher layers. */
export const PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY = [
  "PROTECTED_CANONICAL",
  "LEGAL_LOCALIZATION",
  "BRAND_LOCALIZATION",
  "MANUAL_APPROVED",
  "CONTROLLED_TERMINOLOGY",
  "GEOGRAPHY",
  "MACHINE",
  "CANONICAL_FALLBACK",
] as const satisfies readonly PublishedLocalizationProvenanceSource[];

export type PublishedLocalizedPresentationIdentity = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: LanguageCode | string;
  readonly canonicalVersion: string;
  readonly localizationSchemaVersion: PublishedLocalizationSchemaVersion;
};

export type LocalizedNodeProvenance = {
  readonly path: string;
  readonly source: PublishedLocalizationProvenanceSource;
  readonly appliedAt: string;
  /** Optional provider id when source === MACHINE (build metadata only). */
  readonly provider?: string;
};

/**
 * SEO-capable structured fields for future locale-addressable routes.
 * HREFLANG remains DEFERRED — these fields do not imply hreflang emission.
 */
export type PublishedLocalizedPresentationSeo = {
  readonly title?: string;
  readonly description?: string;
  readonly openGraph?: Readonly<Record<string, string>>;
  readonly twitter?: Readonly<Record<string, string>>;
  readonly jsonLdFields?: Readonly<Record<string, unknown>>;
};

/**
 * Reset 03E.2 — semantic localization content integrity (CLI.1).
 * Counts only — never participant prose. Required for non-English PUBLISHED_LOCALIZED.
 */
export type LocalizationContentIntegrityStatus =
  | "PASSED"
  | "FAILED"
  | "NOT_APPLICABLE_EN"
  | "UNKNOWN_LEGACY";

export type LocalizationContentIntegritySubreason =
  | "CANONICAL_IDENTICAL_TRANSLATABLE_VALUE"
  | "MISSING_TRANSLATED_VALUE"
  | "STRUCTURAL_TRANSLATION_MISMATCH";

export type LocalizationContentIntegrityReport = {
  readonly version: "CLI.1";
  readonly status: LocalizationContentIntegrityStatus;
  readonly TRANSLATABLE_NODE_COUNT: number;
  readonly LOCALIZED_VALUE_NODE_COUNT: number;
  readonly CANONICAL_IDENTICAL_NODE_COUNT: number;
  readonly EMPTY_OR_MISSING_NODE_COUNT: number;
  readonly PROTECTED_CANONICAL_NODE_COUNT: number;
  readonly reasonCodes: readonly LocalizationContentIntegritySubreason[];
  readonly evaluatedAt: string;
};

/**
 * Reset 03E.3 — localization structural integrity (LSI.1).
 * Proves required entity AUTO paths exist in the localized presentation shape.
 * Render-authority parity (rendered path ↔ source ↔ build ↔ apply) lives in
 * web test/dev; persisted LSI.1 is the build/read contract.
 */
export type LocalizationStructuralIntegrityStatus =
  | "PASSED"
  | "FAILED"
  | "NOT_APPLICABLE_EN"
  | "UNKNOWN_LEGACY";

export type LocalizationStructuralIntegritySubreason =
  | "RENDERED_PATH_NOT_IN_CANONICAL_LOCALIZATION_SOURCE"
  | "RENDERED_PATH_NOT_IN_BUILD_INPUT"
  | "BUILD_PATH_NOT_IN_PRESENTATION_SCHEMA"
  | "PRESENTATION_PATH_NOT_APPLIED"
  | "RENDERER_CANONICAL_BYPASS"
  | "LOCALIZED_PRESENTATION_CONSUMER_BYPASS"
  | "UI_DICTIONARY_KEY_MISSING"
  | "UI_DICTIONARY_LOCALE_FALLBACK"
  | "UNOWNED_RENDERED_SEMANTIC_NODE"
  | "SOURCE_WITHOUT_BUILD"
  | "BUILD_WITHOUT_OUTPUT"
  | "OUTPUT_WITHOUT_APPLY"
  | "APPLY_WITHOUT_RENDER";

export type LocalizationStructuralIntegrityReport = {
  readonly version: "LSI.1";
  readonly status: LocalizationStructuralIntegrityStatus;
  readonly CANONICAL_SOURCE_PATHS: number;
  readonly BUILD_INPUT_PATHS: number;
  readonly LOCALIZED_OUTPUT_PATHS: number;
  readonly STRUCTURAL_MISMATCH_COUNT: number;
  readonly reasonCodes: readonly LocalizationStructuralIntegritySubreason[];
  readonly evaluatedAt: string;
};

/**
 * Persisted / in-memory snapshot record.
 * Only state=PUBLISHED is eligible for normal public reads (with version match).
 */
export type PublishedLocalizedPresentationRecord = {
  readonly snapshotId: string;
  readonly identity: PublishedLocalizedPresentationIdentity;
  readonly state: PublishedLocalizedPresentationState;
  /**
   * Monotonic per entityType+entityId+locale.
   * Higher revision wins; older revision cannot replace a newer PUBLISHED.
   */
  readonly contentRevision: number;
  readonly presentation: PublicPresentationNode;
  readonly provenance: readonly LocalizedNodeProvenance[];
  readonly seo?: PublishedLocalizedPresentationSeo;
  /**
   * Reset 03E.2 — content-integrity attestation. Missing on legacy PLP.2 ⇒
   * read path fail-closed to CANONICAL_FALLBACK for locale != en.
   */
  readonly contentIntegrity?: LocalizationContentIntegrityReport;
  /**
   * Reset 03E.3 — structural-integrity attestation (LSI.1).
   * Missing/failed ⇒ fail-closed with content integrity for locale != en.
   */
  readonly structuralIntegrity?: LocalizationStructuralIntegrityReport;
  readonly publishedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Structural failure codes when state === FAILED (no participant prose). */
  readonly failureReasonCodes?: readonly string[];
};

export type ResolvePublishedPresentationMode =
  | "PUBLISHED_LOCALIZED"
  | "CANONICAL_FALLBACK";

export type ResolvePublishedPresentationInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: LanguageCode | string;
  /** Live canonical semantic fingerprint / version for the entity. */
  readonly liveCanonicalVersion: string;
  /** Expected schema for current readers; mismatch → CANONICAL_FALLBACK. */
  readonly liveLocalizationSchemaVersion?: PublishedLocalizationSchemaVersion;
  /** Coherent canonical presentation when falling back (required for fallback mode). */
  readonly canonicalPresentation: PublicPresentationNode;
  readonly canonicalSeo?: PublishedLocalizedPresentationSeo;
};

export type ResolvePublishedPresentationResult = {
  readonly mode: ResolvePublishedPresentationMode;
  readonly presentation: PublicPresentationNode;
  readonly seo?: PublishedLocalizedPresentationSeo;
  readonly identity?: PublishedLocalizedPresentationIdentity;
  readonly snapshotId?: string;
  readonly reasonCode?: string;
};

/**
 * Reset 03E.4 — shared published-presentation usability contract.
 * Read eligibility and rebuild eligibility are complements of the same classifier.
 */
export type LocalizedPresentationUsability =
  | "USABLE_LOCALIZED"
  | "REBUILD_REQUIRED";

export type LocalizedPresentationUsabilityReason =
  | "OK"
  | "NO_SNAPSHOT"
  | "STATE_NOT_PUBLISHED"
  | "CANONICAL_VERSION_MISMATCH"
  | "SCHEMA_VERSION_MISMATCH"
  | "CONTENT_INTEGRITY_MISSING"
  | "CONTENT_INTEGRITY_FAILED"
  | "STRUCTURAL_INTEGRITY_MISSING"
  | "STRUCTURAL_INTEGRITY_FAILED"
  | "PRESENTATION_OR_CANONICAL_MISSING";

export type BuildValidationReasonCode =
  | "PARTIAL_AUTO_NODES"
  | "CANONICAL_VERSION_MISMATCH"
  | "SCHEMA_VERSION_MISMATCH"
  | "MISSING_REQUIRED_PROTECTED"
  | "PROVENANCE_PRIORITY_VIOLATION"
  | "EMPTY_PRESENTATION"
  | "INVALID_IDENTITY"
  | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
  | "CANONICAL_IDENTICAL_TRANSLATABLE_VALUE"
  | "MISSING_TRANSLATED_VALUE"
  | "STRUCTURAL_TRANSLATION_MISMATCH"
  | "LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED"
  | "BUILD_PATH_NOT_IN_PRESENTATION_SCHEMA"
  | "SOURCE_WITHOUT_BUILD"
  | "BUILD_WITHOUT_OUTPUT";

export type BuildValidationResult =
  | {
      readonly status: "READY_TO_PUBLISH";
      readonly missingPaths: readonly string[];
      readonly reasonCodes: readonly BuildValidationReasonCode[];
    }
  | {
      readonly status: "NOT_READY";
      readonly missingPaths: readonly string[];
      readonly reasonCodes: readonly BuildValidationReasonCode[];
    };

export type PublishAtomicResult =
  | {
      readonly ok: true;
      readonly outcome: "PUBLISHED" | "IDEMPOTENT";
      readonly record: PublishedLocalizedPresentationRecord;
      readonly supersededSnapshotId?: string;
    }
  | {
      readonly ok: false;
      readonly outcome:
        | "NOT_READY"
        | "STALE_REVISION"
        | "PERSISTENCE_ERROR"
        | "BLOCKED_ATOMICITY";
      readonly reasonCodes: readonly string[];
      readonly missingPaths?: readonly string[];
    };
