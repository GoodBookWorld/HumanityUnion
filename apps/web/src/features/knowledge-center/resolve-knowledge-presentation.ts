/**
 * Pack 08I.7 — Knowledge taxonomy / article presentation from UI catalogs.
 *
 * `knowledge_article` is not a ContentTranslationSourceKind — article bodies are
 * DOCUMENT_LAYER_DEBT for the content_translations pipeline. Finite category labels
 * and article titles resolve through `knowledgePublic` taxonomy catalogs.
 * A small finite educational subset also has catalog detail fields; missing keys
 * fall back to the API English string (`EXPECTED_TRANSLATION_FALLBACK`).
 */

export const EXPECTED_TRANSLATION_FALLBACK = "expected_translation_fallback" as const;

export type KnowledgePresentationSource =
  | "catalog"
  | typeof EXPECTED_TRANSLATION_FALLBACK;

/** next-intl translator scoped to `knowledgePublic` (or a compatible shape). */
export type KnowledgePublicTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has: (key: string) => boolean;
};

export interface KnowledgeCategoryPresentation {
  title: string;
  description: string;
  source: KnowledgePresentationSource;
}

export interface KnowledgeArticleFieldPresentation {
  value: string;
  source: KnowledgePresentationSource;
}

export interface KnowledgeExplanationPresentation {
  id: string;
  heading: string;
  body: string;
  source: KnowledgePresentationSource;
}

/**
 * Resolve category title + description for listing / sidebar chrome.
 * Falls back to API strings when catalog keys are absent.
 */
export function resolveKnowledgeCategoryPresentation(
  id: string,
  t: KnowledgePublicTranslator,
  fallback?: { title?: string; description?: string },
  values?: Record<string, string | number | Date>,
): KnowledgeCategoryPresentation {
  const titleKey = `categories.${id}.title`;
  const descriptionKey = `categories.${id}.description`;
  const hasTitle = t.has(titleKey);
  const hasDescription = t.has(descriptionKey);

  return {
    title: hasTitle ? t(titleKey, values) : (fallback?.title ?? id),
    description: hasDescription
      ? t(descriptionKey, values)
      : (fallback?.description ?? ""),
    source: hasTitle || hasDescription ? "catalog" : EXPECTED_TRANSLATION_FALLBACK,
  };
}

/**
 * Resolve a localized article title for listing, sidebar, search, and detail H1.
 */
export function resolveKnowledgeArticleTitle(
  slug: string,
  fallback: string,
  t: KnowledgePublicTranslator,
  values?: Record<string, string | number | Date>,
): string {
  const key = `articles.${slug}.title`;
  if (t.has(key)) {
    return t(key, values);
  }
  return fallback;
}

export function resolveKnowledgeArticleField(
  slug: string,
  field: "purpose" | "overview",
  fallback: string,
  t: KnowledgePublicTranslator,
  values?: Record<string, string | number | Date>,
): KnowledgeArticleFieldPresentation {
  const key = `articles.${slug}.${field}`;
  if (t.has(key)) {
    return { value: t(key, values), source: "catalog" };
  }
  return { value: fallback, source: EXPECTED_TRANSLATION_FALLBACK };
}

export function resolveKnowledgeExplanationSection(
  slug: string,
  section: { id: string; heading: string; body: string },
  t: KnowledgePublicTranslator,
  values?: Record<string, string | number | Date>,
): KnowledgeExplanationPresentation {
  const headingKey = `articles.${slug}.explanation.${section.id}.heading`;
  const bodyKey = `articles.${slug}.explanation.${section.id}.body`;
  const hasHeading = t.has(headingKey);
  const hasBody = t.has(bodyKey);

  return {
    id: section.id,
    heading: hasHeading ? t(headingKey, values) : section.heading,
    body: hasBody ? t(bodyKey, values) : section.body,
    source: hasHeading || hasBody ? "catalog" : EXPECTED_TRANSLATION_FALLBACK,
  };
}

export function resolveKnowledgeKeyConcepts(
  slug: string,
  fallback: readonly string[],
  t: KnowledgePublicTranslator,
  values?: Record<string, string | number | Date>,
): { concepts: string[]; source: KnowledgePresentationSource } {
  const concepts: string[] = [];
  let anyCatalog = false;

  for (let index = 0; index < fallback.length; index += 1) {
    const key = `articles.${slug}.keyConcepts.${index}`;
    if (t.has(key)) {
      concepts.push(t(key, values));
      anyCatalog = true;
    } else {
      concepts.push(fallback[index]!);
    }
  }

  return {
    concepts,
    source: anyCatalog ? "catalog" : EXPECTED_TRANSLATION_FALLBACK,
  };
}

/**
 * Extract a knowledge article slug from a search hit when available.
 * Search metadata uses entityId = slug and publicUrl `/knowledge/{slug}`.
 * When only a bare title string is present, return null (EXPECTED_TRANSLATION_FALLBACK).
 */
export function resolveKnowledgeSlugFromSearchHit(hit: {
  entityId?: string;
  publicUrl?: string;
}): string | null {
  if (hit.entityId && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(hit.entityId)) {
    return hit.entityId;
  }
  const match = hit.publicUrl?.match(/\/knowledge\/([a-z0-9-]+)\/?$/i);
  return match?.[1] ?? null;
}
