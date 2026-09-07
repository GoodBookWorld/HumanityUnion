/**
 * RESET 04 — Universal PLP publication contract (domain-neutral).
 *
 * Localization is a publication concern, not a rendering concern:
 * Canonical Content → Localization Build → Atomic PLP → API/SSR → React
 *
 * See ADR-027 / ADR-026.
 */

import type { LanguageCode } from "./language.js";
import type { PlpFieldOwnershipClass } from "./plp-field-ownership.js";
import type { PublicPresentationNode } from "./public-localized-presentation.js";
import type {
  PublishedLocalizationProvenanceSource,
  PublishedLocalizationSchemaVersion,
  PublishedLocalizedPresentationSeo,
} from "./published-localized-presentation.js";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "./published-localized-presentation.js";

/** Stable key for coalesce/dedupe of build work. */
export type PlpBuildWorkKey = string;

export function plpBuildWorkKey(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): PlpBuildWorkKey {
  return `${input.entityType}\0${input.entityId}\0${String(input.locale).toLowerCase()}`;
}

/**
 * Why localization build work was requested.
 * Dynamic RSS uses CONSUMER_VISIBLE_COLLECTION_REFRESH / DYNAMIC_SOURCE_REFRESH.
 */
export type PlpPublicationTriggerKind =
  | "CANONICAL_ENTITY_PUBLISHED"
  | "CANONICAL_CONTENT_UPDATED"
  | "REGISTRY_LOCALE_ENABLED"
  | "MANUAL_OR_AUTHOR_LOCALIZATION_UPDATED"
  | "TERMINOLOGY_OR_CONTROLLED_VOCAB_CHANGED"
  | "ADMIN_REBUILD"
  | "DYNAMIC_SOURCE_REFRESH"
  | "CONSUMER_VISIBLE_COLLECTION_REFRESH";

export type PlpPublicationTrigger = {
  readonly kind: PlpPublicationTriggerKind;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale?: string;
  readonly canonicalVersion?: string;
  readonly contentRevision?: number;
  readonly requestedAt: string;
  readonly reason?: string;
};

export type PlpFieldPolicyMap = Readonly<Record<string, PlpFieldOwnershipClass>>;

/**
 * Domain-neutral description of one localizable published entity instance.
 * Adapters produce this; the PLP core never invents Media/RSS specifics.
 */
export type PlpLocalizableEntityContract = {
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string;
  readonly localizationSchemaVersion: PublishedLocalizationSchemaVersion;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly fieldPolicy: PlpFieldPolicyMap;
  readonly targetLocale: LanguageCode | string;
  readonly contentRevision: number;
  readonly seo?: PublishedLocalizedPresentationSeo;
};

export type PlpBuildRequestStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SUPERSEDED"
  | "SKIPPED_USABLE"
  | "REJECTED_PARTIAL";

export type PlpBuildRequest = {
  readonly workKey: PlpBuildWorkKey;
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly trigger: PlpPublicationTriggerKind;
  readonly enqueuedAt: string;
  readonly status: PlpBuildRequestStatus;
};

/** Default schema for new universal builds — unchanged from Media PLP.2. */
export const PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION =
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION;

/**
 * Authority composition for published localization (highest → lowest).
 * Aligns with PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY; ownership classes
 * map into provenance sources at build time.
 */
export const PLP_FIELD_AUTHORITY_ORDER = [
  "PROTECTED_CANONICAL",
  "LEGAL",
  "BRAND",
  "MANUAL_OR_AUTHOR_APPROVED",
  "CONTROLLED_VOCABULARY",
  "UI_DICTIONARY",
  "MACHINE_CONTENT",
  "NON_LOCALIZABLE_DATA",
] as const satisfies readonly PlpFieldOwnershipClass[];

/** Map ownership → PLP provenance source used in snapshot layers. */
export const PLP_OWNERSHIP_TO_PROVENANCE: Readonly<
  Record<PlpFieldOwnershipClass, PublishedLocalizationProvenanceSource>
> = {
  PROTECTED_CANONICAL: "PROTECTED_CANONICAL",
  LEGAL: "LEGAL_LOCALIZATION",
  BRAND: "BRAND_LOCALIZATION",
  MANUAL_OR_AUTHOR_APPROVED: "MANUAL_APPROVED",
  CONTROLLED_VOCABULARY: "CONTROLLED_TERMINOLOGY",
  UI_DICTIONARY: "CONTROLLED_TERMINOLOGY",
  MACHINE_CONTENT: "MACHINE",
  NON_LOCALIZABLE_DATA: "PROTECTED_CANONICAL",
};

export type PlpSearchSeoInvalidationHookInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly snapshotId: string;
  readonly publishedAt: string;
};

export type PlpWorkerSafetyDefaults = {
  readonly PROVIDER_CONCURRENCY: 1;
  readonly MAX_IN_FLIGHT_BUILDS: 1;
  readonly PROVIDER_TIMEOUT_MS: number;
  readonly MAX_RSS_MB: number | null;
  readonly ALLOW_PROVIDER_FANOUT: false;
  readonly ALLOW_BUILD_ON_READ: false;
};
