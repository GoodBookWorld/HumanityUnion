/**
 * Production Completion Pack 02C Task 03 — canonicalize locale against enabled catalog.
 */

import {
  buildRuntimeLocaleCatalogIndex,
  resolveEnabledCatalogEntryForCandidate,
  type RuntimeLocaleCatalogEntry,
} from "@hu/types";

/**
 * Resolve requested tag (locale or alias) to an enabled canonical locale.
 * Returns null for disabled/unknown input.
 */
export function canonicalizeEnabledLocale(
  input: string | null | undefined,
  catalog: readonly RuntimeLocaleCatalogEntry[],
): RuntimeLocaleCatalogEntry | null {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const index = buildRuntimeLocaleCatalogIndex(catalog);
  return resolveEnabledCatalogEntryForCandidate(trimmed, index);
}
