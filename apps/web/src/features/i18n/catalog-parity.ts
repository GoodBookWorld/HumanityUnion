/**
 * Production Completion Pack 02D Task 03 — bundled verification catalog parity.
 *
 * English bundled catalog is the canonical foundation key set. Verification
 * locales (uk / zh-Hant / ar) must ship the same string leaf paths so Task 02/03
 * chrome does not rely on merge for required foundation keys.
 *
 * Remote / Admin packs are intentionally excluded — completeness there is future work.
 */

import type { AbstractIntlMessages } from "next-intl";

import {
  BUNDLED_UI_MESSAGE_LOCALES,
  loadBundledUiMessagePack,
  UI_I18N_ENGLISH_FALLBACK_LOCALE,
  type BundledUiMessageLocale,
} from "./load-ui-messages.js";

/** Bundled locales that must mirror English foundation keys (excludes English itself). */
export const BUNDLED_VERIFICATION_LOCALES = BUNDLED_UI_MESSAGE_LOCALES.filter(
  (locale) => locale !== UI_I18N_ENGLISH_FALLBACK_LOCALE,
);

export type BundledVerificationLocale = (typeof BUNDLED_VERIFICATION_LOCALES)[number];

export interface CatalogParityIssue {
  readonly path: string;
  readonly kind: "missing" | "invalid_shape";
  readonly detail: string;
}

export interface CatalogParityReport {
  readonly locale: string;
  readonly ok: boolean;
  readonly issues: readonly CatalogParityIssue[];
}

/** Collect dotted paths to string leaves (e.g. `common.language`). */
export function collectStringMessagePaths(
  messages: AbstractIntlMessages,
  prefix = "",
): readonly string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(messages as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(path);
      continue;
    }
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...collectStringMessagePaths(value as AbstractIntlMessages, path));
    }
  }

  return paths.sort();
}

function readPathValue(
  messages: AbstractIntlMessages,
  dottedPath: string,
): unknown {
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
 * Compare a candidate catalog against canonical English foundation paths.
 * Candidate must define every English string leaf as a non-empty string.
 */
export function compareCatalogParityToEnglish(
  english: AbstractIntlMessages,
  candidate: AbstractIntlMessages,
  locale: string,
): CatalogParityReport {
  const issues: CatalogParityIssue[] = [];
  const requiredPaths = collectStringMessagePaths(english);

  for (const path of requiredPaths) {
    const value = readPathValue(candidate, path);
    if (value === undefined) {
      issues.push({
        path,
        kind: "missing",
        detail: `Missing foundation key "${path}" in locale "${locale}".`,
      });
      continue;
    }
    if (typeof value !== "string") {
      issues.push({
        path,
        kind: "invalid_shape",
        detail: `Expected string at "${path}" in locale "${locale}", got ${Array.isArray(value) ? "array" : typeof value}.`,
      });
      continue;
    }
    if (value.trim().length === 0) {
      issues.push({
        path,
        kind: "invalid_shape",
        detail: `Empty string at "${path}" in locale "${locale}".`,
      });
    }
  }

  return {
    locale,
    ok: issues.length === 0,
    issues,
  };
}

/** Load bundled English + verification catalogs and report parity (raw packs, not merged). */
export async function verifyBundledVerificationCatalogParity(
  locales: readonly BundledUiMessageLocale[] = BUNDLED_VERIFICATION_LOCALES,
): Promise<{
  readonly ok: boolean;
  readonly reports: readonly CatalogParityReport[];
}> {
  const englishPack = await loadBundledUiMessagePack(UI_I18N_ENGLISH_FALLBACK_LOCALE);
  if (!englishPack) {
    throw new Error("Bundled English UI message catalog is required for parity.");
  }

  const reports: CatalogParityReport[] = [];
  for (const locale of locales) {
    if (locale === UI_I18N_ENGLISH_FALLBACK_LOCALE) {
      continue;
    }
    const pack = await loadBundledUiMessagePack(locale);
    if (!pack) {
      reports.push({
        locale,
        ok: false,
        issues: [
          {
            path: "",
            kind: "missing",
            detail: `Bundled catalog for locale "${locale}" is missing.`,
          },
        ],
      });
      continue;
    }
    reports.push(compareCatalogParityToEnglish(englishPack.messages, pack.messages, locale));
  }

  return {
    ok: reports.every((report) => report.ok),
    reports,
  };
}
