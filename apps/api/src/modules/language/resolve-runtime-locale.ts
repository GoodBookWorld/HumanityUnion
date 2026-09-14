/**
 * Production Completion Pack 02C — canonical runtime locale resolver.
 *
 * Single server-side contract for anonymous + authenticated interface locale.
 * Precedence logic lives in `@hu/types` `resolveRuntimeLocaleFromCatalog`;
 * this module loads ENABLED Language Registry rows and applies that contract.
 *
 * Interface language only — reading/writing languages stay separate.
 */

import {
  expandLocaleLookupCandidates,
  resolveRuntimeLocaleFromCatalog,
  type LanguageRegistryRecord,
  type ResolvedRuntimeLocale,
  type ResolveRuntimeLocaleInput,
  type RuntimeLocaleCatalogEntry,
} from "@hu/types";

import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "./language-registry/index.js";

export type { ResolveRuntimeLocaleInput };

function toCatalogEntry(record: LanguageRegistryRecord): RuntimeLocaleCatalogEntry {
  return {
    languageId: record.languageId,
    locale: record.locale,
    textDirection: record.textDirection,
    aliases: [...record.aliases],
  };
}

/**
 * Enabled Registry rows as a runtime catalog (locale, aliases, textDirection).
 */
export async function loadEnabledRuntimeLocaleCatalog(): Promise<
  readonly RuntimeLocaleCatalogEntry[]
> {
  const records = await listLanguageRegistry();
  return records.filter((row) => row.enabled === true).map(toCatalogEntry);
}

/**
 * Resolve an input tag (locale, alias, or regional variant) to an ENABLED
 * registry record. Tries exact/alias first, then progressive subtag truncation.
 */
export async function resolveEnabledRegistryRecordForCandidate(
  input: string | null | undefined,
): Promise<LanguageRegistryRecord | null> {
  if (typeof input !== "string") {
    return null;
  }

  for (const candidate of expandLocaleLookupCandidates(input)) {
    const record = await resolveLanguageRegistryLocale(candidate);
    if (record && record.enabled === true) {
      return record;
    }
  }

  return null;
}

/**
 * Canonical locale resolution for layout / runtime use.
 */
export async function resolveRuntimeLocale(
  input: ResolveRuntimeLocaleInput = {},
): Promise<ResolvedRuntimeLocale> {
  const catalog = await loadEnabledRuntimeLocaleCatalog();
  return resolveRuntimeLocaleFromCatalog(input, catalog);
}
