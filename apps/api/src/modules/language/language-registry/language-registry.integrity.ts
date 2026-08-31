/**
 * Pack 02B Task 02 — Language Registry locale/alias integrity.
 * Fail closed on any cross-record or intra-record ambiguity.
 */

import type { LanguageRegistryRecord } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { LanguageRegistryConflictError } from "./language-registry.errors.js";
import { normalizeAliasList } from "./language-registry.mongo-document.js";

export interface LanguageRegistryLocaleCandidate {
  readonly languageId: string;
  readonly locale: string;
  readonly aliases: readonly string[];
}

/**
 * Enforce uniqueness of locale/alias keys across the registry for one candidate.
 */
export function assertLanguageRegistryLocaleIntegrity(
  records: readonly LanguageRegistryRecord[],
  candidate: LanguageRegistryLocaleCandidate,
): void {
  const localeKey = normalizeLanguageRegistryLocaleKey(candidate.locale);
  if (!localeKey) {
    throw new LanguageRegistryConflictError("Canonical locale is required.");
  }

  const aliases = normalizeAliasList(candidate.aliases);
  const aliasKeys = aliases.map((alias) => normalizeLanguageRegistryLocaleKey(alias));

  // Own locale cannot also be its alias.
  if (aliasKeys.includes(localeKey)) {
    throw new LanguageRegistryConflictError(
      `Alias list must not include the canonical locale "${candidate.locale}".`,
    );
  }

  // Duplicate aliases within one record are normalized away; reject if raw input
  // still produced a duplicate key after trim (normalizeAliasList already unique).
  if (aliasKeys.length !== new Set(aliasKeys).size) {
    throw new LanguageRegistryConflictError("Aliases must be unique within a language record.");
  }

  const claimed = new Map<string, { languageId: string; kind: "locale" | "alias" }>();
  for (const record of records) {
    if (record.languageId === candidate.languageId) {
      continue;
    }
    claimed.set(normalizeLanguageRegistryLocaleKey(record.locale), {
      languageId: record.languageId,
      kind: "locale",
    });
    for (const alias of record.aliases) {
      claimed.set(normalizeLanguageRegistryLocaleKey(alias), {
        languageId: record.languageId,
        kind: "alias",
      });
    }
  }

  const localeClaim = claimed.get(localeKey);
  if (localeClaim) {
    throw new LanguageRegistryConflictError(
      localeClaim.kind === "alias"
        ? `Canonical locale "${candidate.locale}" collides with an alias on languageId=${localeClaim.languageId}.`
        : `Canonical locale "${candidate.locale}" collides with another canonical locale (languageId=${localeClaim.languageId}).`,
    );
  }

  for (const alias of aliases) {
    const key = normalizeLanguageRegistryLocaleKey(alias);
    const claim = claimed.get(key);
    if (!claim) {
      continue;
    }
    throw new LanguageRegistryConflictError(
      claim.kind === "locale"
        ? `Alias "${alias}" collides with canonical locale on languageId=${claim.languageId}.`
        : `Alias "${alias}" collides with another alias on languageId=${claim.languageId}.`,
    );
  }
}

export function sortLanguageRegistryRecords(
  records: readonly LanguageRegistryRecord[],
): LanguageRegistryRecord[] {
  return [...records].sort((left, right) => {
    const byLocale = left.locale.localeCompare(right.locale, "en");
    if (byLocale !== 0) {
      return byLocale;
    }
    return left.languageId.localeCompare(right.languageId, "en");
  });
}
