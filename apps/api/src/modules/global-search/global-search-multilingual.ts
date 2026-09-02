/**
 * Pack 02H — multilingual enrichment for the existing Global Search in-memory index.
 *
 * One document per canonical entity. Indexes canonical text + eligible current
 * translations + terminology glossary aliases. Does not create a second search engine
 * or locale-prefixed public URLs.
 */

import type {
  CivicEntityType,
  CivicSearchMetadata,
  CivicSearchTerminologyAlias,
  CivicSearchTranslatedField,
  ContentTranslationSourceKind,
  LanguageRegistryRecord,
  TerminologyConcept,
  TranslatedContentRecord,
} from "@hu/types";

import { listContentTranslationsForSource } from "../language/persistence/content-translation.repository.js";
import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "../language/language-registry/language-registry.repository.js";
import { listTerminologyConcepts } from "../language/terminology-glossary/terminology-glossary.repository.js";

/** EntityType → ContentTranslationSourceKind. Skip kinds without a translation allowlist. */
export const GLOBAL_SEARCH_ENTITY_TRANSLATION_SOURCE_KIND: Partial<
  Record<CivicEntityType, ContentTranslationSourceKind>
> = {
  initiative: "initiative",
  analysis: "collaborative_analysis",
  improvement_proposal: "improvement_proposal",
  initiative_revision: "initiative_revision",
  petition: "petition",
  decision_session: "decision_session",
  collective_decision: "collective_decision",
  implementation_commitment: "implementation_commitment",
  implementation_tracking: "implementation_tracking",
  official_response: "official_response",
  public_impact: "public_impact",
  civic_archive: "civic_archive",
  knowledge_media: "civic_media",
  blog_post: "blog_post",
};

export interface GlobalSearchMultilingualDeps {
  readonly listSearchEnabledLanguages?: () => Promise<readonly LanguageRegistryRecord[]>;
  readonly resolveLocale?: (localeOrAlias: string) => Promise<LanguageRegistryRecord | null>;
  readonly listTranslationsForSource?: (input: {
    sourceKind: ContentTranslationSourceKind;
    sourceRecordId: string;
  }) => Promise<readonly TranslatedContentRecord[]>;
  readonly listTerminologyConcepts?: () => Promise<readonly TerminologyConcept[]>;
}

function normalizeLanguageCode(value: string): string {
  return value.trim();
}

function isSearchEnabledRecord(record: LanguageRegistryRecord): boolean {
  return record.enabled === true && record.searchEnabled === true;
}

async function defaultListSearchEnabledLanguages(): Promise<readonly LanguageRegistryRecord[]> {
  const records = await listLanguageRegistry();
  return records.filter(isSearchEnabledRecord);
}

function firstNonEmptyString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return undefined;
}

/**
 * Extract searchable title/summary from allowlisted translation field bags.
 * Maps kind-specific public fields (description, excerpt, subject, …) onto
 * the narrow search document title/summary slots — never indexes private bags.
 */
function extractTitleSummary(translatedContent: TranslatedContentRecord["translatedContent"]): {
  title?: string;
  summary?: string;
} | null {
  if (typeof translatedContent === "string") {
    return null;
  }

  if (!translatedContent || typeof translatedContent !== "object" || Array.isArray(translatedContent)) {
    return null;
  }

  const record = translatedContent as Record<string, unknown>;
  const title = firstNonEmptyString(record, ["title", "subject", "question"]);
  const summary = firstNonEmptyString(record, [
    "summary",
    "description",
    "excerpt",
    "revisionSummary",
    "outcomeSummary",
  ]);

  if (!title && !summary) {
    return null;
  }

  return { title, summary };
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function compareTranslatedFields(
  left: CivicSearchTranslatedField,
  right: CivicSearchTranslatedField,
): number {
  const languageCmp = left.language.localeCompare(right.language);
  if (languageCmp !== 0) {
    return languageCmp;
  }
  // Prefer newer sourceVersion first so language dedupe keeps the latest row.
  return (right.sourceVersion ?? "").localeCompare(left.sourceVersion ?? "");
}

function compareTerminologyAliases(
  left: CivicSearchTerminologyAlias,
  right: CivicSearchTerminologyAlias,
): number {
  const languageCmp = left.language.localeCompare(right.language);
  if (languageCmp !== 0) {
    return languageCmp;
  }
  const termCmp = left.term.localeCompare(right.term);
  if (termCmp !== 0) {
    return termCmp;
  }
  return (left.conceptId ?? "").localeCompare(right.conceptId ?? "");
}

function terminologyAliasKey(alias: CivicSearchTerminologyAlias): string {
  return `${alias.language}::${alias.term}::${alias.conceptId ?? ""}`;
}

function buildTerminologyAliasesForEntry(input: {
  readonly entityType: CivicEntityType;
  readonly concepts: readonly TerminologyConcept[];
  readonly searchEnabledLocales: ReadonlySet<string>;
}): readonly CivicSearchTerminologyAlias[] {
  const aliases: CivicSearchTerminologyAlias[] = [];
  const seen = new Set<string>();

  for (const concept of input.concepts) {
    if (concept.status !== "published") {
      continue;
    }

    const linkedEntityType = concept.linkedRefs?.civicEntityType;
    if (linkedEntityType && linkedEntityType !== input.entityType) {
      continue;
    }

    for (const [locale, translation] of Object.entries(concept.translations)) {
      const language = normalizeLanguageCode(locale);
      if (!input.searchEnabledLocales.has(language)) {
        continue;
      }

      const terms = [
        translation.preferredTerm,
        ...(translation.aliases ?? []),
      ]
        .map((term) => term.trim())
        .filter(Boolean);

      for (const term of terms) {
        const alias: CivicSearchTerminologyAlias = {
          language,
          term,
          conceptId: concept.conceptId,
        };
        const key = terminologyAliasKey(alias);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        aliases.push(alias);
      }
    }
  }

  return aliases.sort(compareTerminologyAliases);
}

/**
 * Enrich a canonical search metadata entry with Pack 02H multilingual fields.
 * Idempotent: building twice yields the same shape (sorted unique lists).
 */
export async function enrichSearchEntryWithMultilingual(
  entry: CivicSearchMetadata,
  deps: GlobalSearchMultilingualDeps = {},
): Promise<CivicSearchMetadata> {
  const listSearchEnabledLanguages =
    deps.listSearchEnabledLanguages ?? defaultListSearchEnabledLanguages;
  const resolveLocale = deps.resolveLocale ?? resolveLanguageRegistryLocale;
  const listTranslations =
    deps.listTranslationsForSource ?? listContentTranslationsForSource;
  const listConcepts = deps.listTerminologyConcepts ?? listTerminologyConcepts;

  const searchEnabledRecords = await listSearchEnabledLanguages();
  const searchEnabledLocales = new Set(
    searchEnabledRecords.map((record) => normalizeLanguageCode(record.locale)),
  );

  const sourceKind = GLOBAL_SEARCH_ENTITY_TRANSLATION_SOURCE_KIND[entry.entityType];
  const translatedFields: CivicSearchTranslatedField[] = [];
  let sourceLanguage = entry.sourceLanguage?.trim() || undefined;

  if (sourceKind) {
    const translations = await listTranslations({
      sourceKind,
      sourceRecordId: entry.entityId,
    });

    for (const translation of translations) {
      if (translation.freshness !== "current" || translation.stale === true) {
        continue;
      }

      const resolvedTarget = await resolveLocale(translation.targetLanguage);
      if (!resolvedTarget || !isSearchEnabledRecord(resolvedTarget)) {
        continue;
      }

      const extracted = extractTitleSummary(translation.translatedContent);
      if (!extracted) {
        continue;
      }

      if (!sourceLanguage && translation.sourceLanguage) {
        sourceLanguage = normalizeLanguageCode(translation.sourceLanguage);
      }

      translatedFields.push({
        language: normalizeLanguageCode(resolvedTarget.locale),
        title: extracted.title,
        summary: extracted.summary,
        freshness: "current",
        sourceVersion: translation.sourceVersion,
      });
    }
  }

  translatedFields.sort(compareTranslatedFields);

  // Deduplicate by language (keep first after stable sort by language+sourceVersion).
  const dedupedTranslated: CivicSearchTranslatedField[] = [];
  const seenLanguages = new Set<string>();
  for (const field of translatedFields) {
    if (seenLanguages.has(field.language)) {
      continue;
    }
    seenLanguages.add(field.language);
    dedupedTranslated.push(field);
  }

  const concepts = await listConcepts();
  const terminologyAliases = buildTerminologyAliasesForEntry({
    entityType: entry.entityType,
    concepts,
    searchEnabledLocales,
  });

  const resolvedSourceLanguage = sourceLanguage || "en";
  const searchableLanguageCodes = uniqueSorted([
    resolvedSourceLanguage,
    ...dedupedTranslated.map((field) => field.language),
  ]);

  return {
    ...entry,
    sourceLanguage: resolvedSourceLanguage,
    translatedFields: dedupedTranslated.length > 0 ? dedupedTranslated : undefined,
    terminologyAliases: terminologyAliases.length > 0 ? terminologyAliases : undefined,
    searchableLanguageCodes,
    aliases: entry.aliases,
  };
}
