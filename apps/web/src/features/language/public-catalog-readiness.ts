/**
 * Localization Authority Closure 06 — reusable WEB_UI catalog readiness check.
 *
 * Locale set comes from caller input (Registry / test fixture) — never a
 * hardcoded production language allowlist.
 *
 * Reports missing required keys, empty translations, and English-identical
 * values for required public chrome (fallback-to-English usage).
 */

import type { AbstractIntlMessages } from "next-intl";

import { collectStringMessagePaths } from "../i18n/catalog-parity.js";

export type PublicCatalogReadinessIssueKind =
  | "missing"
  | "empty"
  | "fallback_to_english"
  | "invalid_shape";

export type PublicCatalogReadinessIssue = {
  readonly locale: string;
  readonly path: string;
  readonly kind: PublicCatalogReadinessIssueKind;
  readonly detail: string;
};

export type PublicCatalogReadinessReport = {
  readonly ok: boolean;
  readonly localesChecked: readonly string[];
  readonly requiredKeyCount: number;
  readonly issues: readonly PublicCatalogReadinessIssue[];
};

function readPathValue(messages: AbstractIntlMessages, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Default required public chrome namespaces for approved public surfaces.
 * Callers may pass a narrower requiredPaths list for focused checks.
 */
export const PUBLIC_SURFACE_WEB_UI_NAMESPACE_PREFIXES = [
  "common.",
  "navigation.",
  "actuc.",
  "membershipPublic.",
  "institutionsPublic.",
  "publicHome.",
  "blogPublic.",
  "knowledgePublic.",
  "civicMediaPublic.",
  "volunteerPublic.",
  "contactPublic.",
  "legalPublic.",
  "initiativeExperience.",
] as const;

export function collectRequiredPublicChromePaths(
  englishCatalog: AbstractIntlMessages,
  namespacePrefixes: readonly string[] = PUBLIC_SURFACE_WEB_UI_NAMESPACE_PREFIXES,
): readonly string[] {
  return collectStringMessagePaths(englishCatalog).filter((path) =>
    namespacePrefixes.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix)),
  );
}

/**
 * Check catalog readiness for required public chrome keys across locales.
 *
 * @param locales - Registry/fixture-driven locale codes (must not hardcode production set)
 * @param catalogsByLocale - message packs keyed by locale; English used as foundation
 * @param requiredPaths - optional explicit key list; defaults to public chrome namespaces
 */
export function checkPublicCatalogReadiness(input: {
  readonly locales: readonly string[];
  readonly catalogsByLocale: Readonly<Record<string, AbstractIntlMessages>>;
  readonly englishLocale?: string;
  readonly requiredPaths?: readonly string[];
  /**
   * When true, identical non-empty English string counts as fallback-to-English
   * for required chrome (useful for detecting untranslated chrome).
   */
  readonly flagEnglishIdenticalAsFallback?: boolean;
}): PublicCatalogReadinessReport {
  const englishLocale = input.englishLocale ?? "en";
  const english = input.catalogsByLocale[englishLocale];
  if (!english) {
    return {
      ok: false,
      localesChecked: [...input.locales],
      requiredKeyCount: 0,
      issues: [
        {
          locale: englishLocale,
          path: "",
          kind: "missing",
          detail: `English foundation catalog "${englishLocale}" is required.`,
        },
      ],
    };
  }

  const requiredPaths =
    input.requiredPaths ?? collectRequiredPublicChromePaths(english);
  const flagIdentical = input.flagEnglishIdenticalAsFallback ?? true;
  const issues: PublicCatalogReadinessIssue[] = [];

  for (const locale of input.locales) {
    if (locale === englishLocale) {
      continue;
    }
    const catalog = input.catalogsByLocale[locale];
    if (!catalog) {
      issues.push({
        locale,
        path: "",
        kind: "missing",
        detail: `Catalog for locale "${locale}" is missing.`,
      });
      continue;
    }

    for (const path of requiredPaths) {
      const englishValue = readPathValue(english, path);
      const value = readPathValue(catalog, path);

      if (value === undefined) {
        issues.push({
          locale,
          path,
          kind: "missing",
          detail: `Missing required key "${path}" for locale "${locale}".`,
        });
        continue;
      }
      if (typeof value !== "string") {
        issues.push({
          locale,
          path,
          kind: "invalid_shape",
          detail: `Expected string at "${path}" for locale "${locale}".`,
        });
        continue;
      }
      if (value.trim().length === 0) {
        issues.push({
          locale,
          path,
          kind: "empty",
          detail: `Empty translation at "${path}" for locale "${locale}".`,
        });
        continue;
      }
      if (
        flagIdentical &&
        typeof englishValue === "string" &&
        englishValue.trim().length > 0 &&
        value === englishValue
      ) {
        issues.push({
          locale,
          path,
          kind: "fallback_to_english",
          detail: `Required chrome "${path}" is identical to English for locale "${locale}".`,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    localesChecked: [...input.locales],
    requiredKeyCount: requiredPaths.length,
    issues,
  };
}
