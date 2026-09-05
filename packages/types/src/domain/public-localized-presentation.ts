/**
 * Pack 08K — PublicLocalizedPresentation contract.
 *
 * Participant-facing semantic text is AUTO_TRANSLATABLE by default.
 * Protection is an explicit, closed exception set — never inferred from
 * property names alone.
 */

import type { LanguageCode } from "./language.js";

/** Presentation schema version for persistence identity. */
export const PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION = "08K.1" as const;

export type PublicLocalizationProtectionCategory =
  | "identity"
  | "technical"
  | "private"
  | "manual"
  | "ui_dictionary"
  | "controlled_terminology";

export type PublicLocalizationCoverageStatus =
  | "COMPLETE"
  | "FALLBACK_CANONICAL"
  | "STALE"
  | "MANUAL"
  | "SOURCE_LANGUAGE";

export const PUBLIC_LOCALIZATION_PROTECTED_BRAND = "__huPublicProtected" as const;

export interface PublicProtectedValue<T extends string = string> {
  readonly [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true;
  readonly category: PublicLocalizationProtectionCategory;
  readonly value: T;
}

/**
 * Recursive sanitized participant-facing presentation tree.
 * Plain strings are AUTO_TRANSLATABLE. Only explicit protected wrappers bypass.
 */
export type PublicPresentationNode =
  | string
  | null
  | undefined
  | PublicProtectedValue
  | readonly PublicPresentationNode[]
  | { readonly [key: string]: PublicPresentationNode };

export interface PublicPresentationIdentity {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly presentationSchemaVersion: typeof PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION | string;
}

export interface PublicLocalizedPresentationCoverage {
  readonly status: PublicLocalizationCoverageStatus;
  readonly semanticNodeCount: number;
  readonly localizedNodeCount: number;
  readonly canonicalFallbackNodeCount: number;
  readonly protectedNodeCount: number;
  readonly staleNodeCount: number;
  /** Dot paths of AUTO_TRANSLATABLE nodes that fell back to canonical. */
  readonly canonicalFallbackPaths: readonly string[];
}

export interface PublicLocalizedPresentation<T extends PublicPresentationNode = PublicPresentationNode> {
  readonly identity: PublicPresentationIdentity;
  readonly sourceLanguage: LanguageCode | string;
  readonly targetLanguage: LanguageCode | string;
  readonly sourceVersion: string;
  /** Localized (or fallback) presentation tree — same shape as input. */
  readonly presentation: T;
  readonly coverage: PublicLocalizedPresentationCoverage;
  readonly isMachineTranslated: boolean;
  readonly canViewOriginal: boolean;
}

export function protectedIdentity(value: string): PublicProtectedValue {
  return { [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true, category: "identity", value };
}

export function protectedTechnical(value: string): PublicProtectedValue {
  return { [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true, category: "technical", value };
}

export function protectedPrivate(value: string): PublicProtectedValue {
  return { [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true, category: "private", value };
}

export function manualLocalizedValue(value: string): PublicProtectedValue {
  return { [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true, category: "manual", value };
}

export function uiDictionaryValue(value: string): PublicProtectedValue {
  return { [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true, category: "ui_dictionary", value };
}

export function controlledTerminologyValue(value: string): PublicProtectedValue {
  return {
    [PUBLIC_LOCALIZATION_PROTECTED_BRAND]: true,
    category: "controlled_terminology",
    value,
  };
}

export function isPublicProtectedValue(value: unknown): value is PublicProtectedValue {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as PublicProtectedValue)[PUBLIC_LOCALIZATION_PROTECTED_BRAND] === true &&
    typeof (value as PublicProtectedValue).category === "string" &&
    typeof (value as PublicProtectedValue).value === "string"
  );
}

export function unwrapPublicPresentationValue(value: PublicPresentationNode): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (isPublicProtectedValue(value)) {
    return value.value;
  }
  return null;
}
