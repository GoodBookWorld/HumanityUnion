import type {
  KnowledgeArticleAssistantReference,
  KnowledgeArticlePublic,
  KnowledgeArticleReference,
  KnowledgeArticleSummary,
  KnowledgeCenterListing,
} from "@hu/types";

import { KNOWLEDGE_CATEGORIES } from "./content/categories.js";
import { ALL_KNOWLEDGE_ARTICLES } from "./content/index.js";
import type { KnowledgeArticleRecord } from "./content/article-factory.js";
import { getKnowledgeDiagram } from "./content/diagrams.js";
import {
  KNOWLEDGE_ASSISTANT_CAPABILITY_MAP,
  KNOWLEDGE_SECTION_TAG_MAP,
} from "./knowledge-center.projection.js";

function hrefForSlug(slug: string): string {
  return `/knowledge/${slug}`;
}

function toReference(record: KnowledgeArticleRecord): KnowledgeArticleReference {
  return {
    slug: record.slug,
    title: record.title,
    href: hrefForSlug(record.slug),
  };
}

function resolveArticleRecord(slug: string): KnowledgeArticleRecord | null {
  return ALL_KNOWLEDGE_ARTICLES.find((article) => article.slug === slug) ?? null;
}

function orderedArticlesForCategory(categoryId: string): KnowledgeArticleRecord[] {
  return ALL_KNOWLEDGE_ARTICLES.filter((article) => article.categoryId === categoryId).sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

function toSummary(record: KnowledgeArticleRecord): KnowledgeArticleSummary {
  return {
    slug: record.slug,
    categoryId: record.categoryId,
    title: record.title,
    purpose: record.purpose,
    readingTimeMinutes: record.readingTimeMinutes,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

export function listKnowledgeCategories(): KnowledgeCenterListing {
  const categories = KNOWLEDGE_CATEGORIES.map((category) => ({
    ...category,
    articles: orderedArticlesForCategory(category.id).map(toSummary),
  }));

  return {
    categories,
    totalArticles: ALL_KNOWLEDGE_ARTICLES.length,
  };
}

export function listAllKnowledgeArticles(): KnowledgeArticleSummary[] {
  return [...ALL_KNOWLEDGE_ARTICLES]
    .sort((left, right) => left.title.localeCompare(right.title))
    .map(toSummary);
}

export function getKnowledgeArticleBySlug(slug: string): KnowledgeArticlePublic | null {
  const record = resolveArticleRecord(slug);

  if (!record) {
    return null;
  }

  const categoryArticles = orderedArticlesForCategory(record.categoryId);
  const index = categoryArticles.findIndex((article) => article.slug === slug);
  const previous = index > 0 ? categoryArticles[index - 1] : undefined;
  const next =
    index >= 0 && index < categoryArticles.length - 1 ? categoryArticles[index + 1] : undefined;

  return {
    slug: record.slug,
    categoryId: record.categoryId,
    title: record.title,
    purpose: record.purpose,
    overview: record.overview,
    diagramId: record.diagramId,
    diagramSvg: getKnowledgeDiagram(record.diagramId),
    explanation: record.explanation,
    keyConcepts: record.keyConcepts,
    relatedConcepts: record.relatedConceptSlugs
      .map((relatedSlug) => resolveArticleRecord(relatedSlug))
      .filter((item): item is KnowledgeArticleRecord => item !== null)
      .map(toReference),
    relatedGuides: record.relatedGuideSlugs
      .map((relatedSlug) => resolveArticleRecord(relatedSlug))
      .filter((item): item is KnowledgeArticleRecord => item !== null)
      .map(toReference),
    relatedWorkspaceSection: record.relatedWorkspaceSection,
    relatedPublicPages: record.relatedPublicPageHrefs.map((page) => ({
      slug: page.href,
      title: page.title,
      href: page.href,
    })),
    readingTimeMinutes: record.readingTimeMinutes,
    version: record.version,
    updatedAt: record.updatedAt,
    previousSlug: previous?.slug,
    nextSlug: next?.slug,
  };
}

export function getKnowledgeDiagramSvg(diagramId: string): string {
  return getKnowledgeDiagram(diagramId);
}

export function getKnowledgeArticleRecordsForSearch(): readonly KnowledgeArticleRecord[] {
  return ALL_KNOWLEDGE_ARTICLES;
}

export function searchKnowledgeArticlesByTerm(
  term: string,
  limit = 8,
): KnowledgeArticleAssistantReference[] {
  const normalized = term.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const matches = ALL_KNOWLEDGE_ARTICLES.filter((article) => {
    const haystack = [
      article.title,
      article.purpose,
      article.overview,
      ...article.keyConcepts,
      ...article.searchTerms,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });

  return matches.slice(0, limit).map((article) => ({
    slug: article.slug,
    title: article.title,
    purpose: article.purpose,
    href: hrefForSlug(article.slug),
    categoryId: article.categoryId,
  }));
}

export function resolveKnowledgeArticlesForAssistant(input: {
  capability: string;
  currentSection?: string;
  userPrompt?: string;
}): KnowledgeArticleAssistantReference[] {
  const slugSet = new Set<string>();

  for (const slug of KNOWLEDGE_ASSISTANT_CAPABILITY_MAP[input.capability] ?? []) {
    slugSet.add(slug);
  }

  if (input.currentSection) {
    for (const slug of KNOWLEDGE_SECTION_TAG_MAP[input.currentSection] ?? []) {
      slugSet.add(slug);
    }
  }

  if (input.userPrompt) {
    for (const match of searchKnowledgeArticlesByTerm(input.userPrompt, 3)) {
      slugSet.add(match.slug);
    }
  }

  const references: KnowledgeArticleAssistantReference[] = [];

  for (const slug of slugSet) {
    const record = resolveArticleRecord(slug);

    if (!record) {
      continue;
    }

    references.push({
      slug: record.slug,
      title: record.title,
      purpose: record.purpose,
      href: hrefForSlug(record.slug),
      categoryId: record.categoryId,
    });
  }

  return references.slice(0, 5);
}
