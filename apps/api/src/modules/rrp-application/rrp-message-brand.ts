/**
 * HU-RRP-MSG-01B — published Terminology Glossary brand for RRP messages.
 * Reads humanity_union only. Brand Localization siteName is a different store.
 * Lookup failure returns the canonical English term and does not block delivery.
 */

import type { TerminologyConcept } from "@hu/types";

import { listPublishedProviderTerminologyLines } from "../language/terminology-glossary/terminology-glossary.provider-context.js";
import { listTerminologyConcepts } from "../language/terminology-glossary/terminology-glossary.repository.js";

export const RRP_CANONICAL_BRAND_NAME = "Humanity Union";
export const RRP_BRAND_CONCEPT_ID = "humanity_union";

const UNSAFE_BRAND_TERM = /[<>{}\u0000-\u001F\u007F]/;
const MAX_BRAND_TERM_LENGTH = 120;

export function isSafeRrpBrandTerm(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || [...trimmed].length > MAX_BRAND_TERM_LENGTH) {
    return false;
  }
  return !UNSAFE_BRAND_TERM.test(trimmed);
}

/** Canonical English when the supplied term is missing or unsafe. */
export function resolveRrpBrandSiteName(value: string | null | undefined): string {
  return isSafeRrpBrandTerm(value) ? value.trim() : RRP_CANONICAL_BRAND_NAME;
}

/**
 * Published preferred term for humanity_union.
 * Draft, retired, missing, and English-fallback lines stay on the canonical term.
 */
export function selectPublishedHumanityUnionBrandTerm(
  concepts: readonly TerminologyConcept[],
  locale: string,
): string {
  const line = listPublishedProviderTerminologyLines(concepts, locale).find(
    (item) => item.conceptId === RRP_BRAND_CONCEPT_ID,
  );
  if (!line || line.usedEnglishFallback) {
    return RRP_CANONICAL_BRAND_NAME;
  }
  return resolveRrpBrandSiteName(line.preferredTerm);
}

export async function resolveRrpMessageBrandSiteName(
  locale: string,
  loadConcepts: () => Promise<readonly TerminologyConcept[]> = listTerminologyConcepts,
): Promise<string> {
  try {
    const concepts = await loadConcepts();
    return selectPublishedHumanityUnionBrandTerm(concepts, locale);
  } catch {
    return RRP_CANONICAL_BRAND_NAME;
  }
}

/** Substitute only the controlled {siteName} placeholder. */
export function applyRrpBrandSiteName(
  template: string,
  siteName?: string | null,
): string {
  return template.split("{siteName}").join(resolveRrpBrandSiteName(siteName));
}
