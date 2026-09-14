/**
 * Reset 03E.6 — Media localization runtime truth (test/dev authority).
 *
 * Published PLP validity is not runtime localization proof.
 * Normative chain:
 *   OWNERSHIP → LSI.1 → CLI.1 → RESOLVER VALIDITY
 *   → LOCALE PROPAGATION → CONSUMER VALUE LINEAGE
 *   → SSR VALUE → HYDRATED VALUE
 */

import { createHash } from "node:crypto";

export const MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP = "PLP" as const;
export const MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY = "LEGACY" as const;

export type MediaLocalizationRuntimeBranch =
  | typeof MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP
  | typeof MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY;

export const LOCALE_PROPAGATION_GAP = "LOCALE_PROPAGATION_GAP" as const;
export const FEATURE_FLAG_GAP = "FEATURE_FLAG_GAP" as const;
export const ROUTE_BRANCH_GAP = "ROUTE_BRANCH_GAP" as const;
export const CACHE_KEY_GAP = "CACHE_KEY_GAP" as const;
export const SSR_DATA_GAP = "SSR_DATA_GAP" as const;
export const HYDRATION_OVERWRITE = "HYDRATION_OVERWRITE" as const;
export const ENTITY_IDENTITY_GAP = "ENTITY_IDENTITY_GAP" as const;
export const TEST_ARCHITECTURE_FALSE_POSITIVE =
  "TEST_ARCHITECTURE_FALSE_POSITIVE" as const;

/** Opaque control sentinels for 03E.6 editorial lineage (no language detection). */
export const RUNTIME_TRUTH_SENTINELS = {
  overviewSummary: {
    canonical: "__CANONICAL_OVERVIEW_SUMMARY__",
    localized: "__LOCALIZED_OVERVIEW_SUMMARY__",
  },
  faqQ0: {
    canonical: "__CANONICAL_FAQ_Q0__",
    localized: "__LOCALIZED_FAQ_Q0__",
  },
  faqA0: {
    canonical: "__CANONICAL_FAQ_A0__",
    localized: "__LOCALIZED_FAQ_A0__",
  },
} as const;

export function fingerprintSemanticValue(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "empty";
  }
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export type MediaRuntimeTruthRecord = {
  readonly semanticPath: string;
  readonly requestedLocale: string;
  readonly resolvedLocale: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string | null;
  readonly resolverResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "NOT_REACHED";
  readonly runtimeBranch: MediaLocalizationRuntimeBranch;
  readonly resolvedValueFingerprint: string;
  readonly projectedValueFingerprint: string;
  readonly routePropValueFingerprint: string;
  readonly ssrValueFingerprint: string;
  readonly hydratedValueFingerprint: string;
  readonly RESOLVED_LOCALIZED: boolean;
  readonly PROJECTED_LOCALIZED: boolean;
  readonly PROPAGATED_LOCALIZED: boolean;
  readonly SSR_LOCALIZED: boolean;
  readonly HYDRATED_LOCALIZED: boolean;
};

export function evaluateMediaRuntimeTruth(input: {
  readonly semanticPath: string;
  readonly requestedLocale: string;
  readonly resolvedLocale: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string | null;
  readonly resolverResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | "NOT_REACHED";
  readonly runtimeBranch: MediaLocalizationRuntimeBranch;
  readonly resolvedValue: string | null;
  readonly projectedValue: string | null;
  readonly routePropValue: string | null;
  readonly ssrValue: string | null;
  readonly hydratedValue: string | null;
  readonly canonicalValue: string | null;
}): MediaRuntimeTruthRecord {
  const resolvedFp = fingerprintSemanticValue(input.resolvedValue);
  const projectedFp = fingerprintSemanticValue(input.projectedValue);
  const routeFp = fingerprintSemanticValue(input.routePropValue);
  const ssrFp = fingerprintSemanticValue(input.ssrValue);
  const hydratedFp = fingerprintSemanticValue(input.hydratedValue);
  const canonicalFp = fingerprintSemanticValue(input.canonicalValue);

  const localeOk =
    input.requestedLocale.trim() !== "" &&
    input.requestedLocale === input.resolvedLocale;
  const resolvedLocalized =
    input.resolverResult === "PUBLISHED_LOCALIZED" &&
    resolvedFp !== "empty" &&
    resolvedFp !== canonicalFp;
  const projectedLocalized =
    resolvedLocalized && projectedFp === resolvedFp;
  const propagatedLocalized =
    projectedLocalized && routeFp === resolvedFp;
  const ssrLocalized = propagatedLocalized && ssrFp === resolvedFp;
  const hydratedLocalized = ssrLocalized && hydratedFp === resolvedFp;

  return {
    semanticPath: input.semanticPath,
    requestedLocale: input.requestedLocale,
    resolvedLocale: input.resolvedLocale,
    entityType: input.entityType,
    entityId: input.entityId,
    canonicalVersion: input.canonicalVersion,
    resolverResult: input.resolverResult,
    runtimeBranch: input.runtimeBranch,
    resolvedValueFingerprint: resolvedFp,
    projectedValueFingerprint: projectedFp,
    routePropValueFingerprint: routeFp,
    ssrValueFingerprint: ssrFp,
    hydratedValueFingerprint: hydratedFp,
    RESOLVED_LOCALIZED: resolvedLocalized && localeOk,
    PROJECTED_LOCALIZED: projectedLocalized && localeOk,
    PROPAGATED_LOCALIZED: propagatedLocalized && localeOk,
    SSR_LOCALIZED: ssrLocalized && localeOk,
    HYDRATED_LOCALIZED: hydratedLocalized && localeOk,
  };
}

/**
 * API PUBLISHED_LOCALIZED + Web LEGACY branch while claiming runtime localization
 * success is the 03E.6 false-positive class.
 */
export function classifyRuntimeContradiction(input: {
  readonly runtimeBranch: MediaLocalizationRuntimeBranch;
  readonly apiResolverMode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | null;
  readonly htmlLang: string;
  readonly batchLocale: string | null;
  readonly ssrContainsCanonical: boolean;
  readonly ssrContainsLocalized: boolean;
}): string | null {
  if (input.htmlLang && input.batchLocale && input.htmlLang !== input.batchLocale) {
    return LOCALE_PROPAGATION_GAP;
  }
  if (
    input.apiResolverMode === "PUBLISHED_LOCALIZED" &&
    input.runtimeBranch === MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY
  ) {
    return ROUTE_BRANCH_GAP;
  }
  if (
    input.apiResolverMode === "PUBLISHED_LOCALIZED" &&
    input.ssrContainsCanonical &&
    !input.ssrContainsLocalized
  ) {
    return SSR_DATA_GAP;
  }
  return null;
}
