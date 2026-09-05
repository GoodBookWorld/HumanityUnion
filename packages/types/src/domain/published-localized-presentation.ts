/**
 * TRANSLATION DELIVERY RESET 02 — Published Localized Presentation domain contract.
 *
 * Localization is a publication concern, not a rendering concern.
 * See ADR-026 / PUBLISHED_LOCALIZATION_DELIVERY_ARCHITECTURE_v1.0.md.
 */

import type { LanguageCode } from "./language.js";
import type { PublicPresentationNode } from "./public-localized-presentation.js";

/** Current localization schema for newly published snapshots. */
export const PUBLISHED_LOCALIZATION_SCHEMA_VERSION = "PLP.1" as const;

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

export type BuildValidationReasonCode =
  | "PARTIAL_AUTO_NODES"
  | "CANONICAL_VERSION_MISMATCH"
  | "SCHEMA_VERSION_MISMATCH"
  | "MISSING_REQUIRED_PROTECTED"
  | "PROVENANCE_PRIORITY_VIOLATION"
  | "EMPTY_PRESENTATION"
  | "INVALID_IDENTITY";

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
