import type { KnowledgeCategoryId } from "@hu/types";

export interface KnowledgeArticleRecord {
  slug: string;
  categoryId: KnowledgeCategoryId;
  title: string;
  purpose: string;
  overview: string;
  diagramId: string;
  explanation: Array<{ id: string; heading: string; body: string }>;
  keyConcepts: string[];
  relatedConceptSlugs: string[];
  relatedGuideSlugs: string[];
  relatedWorkspaceSection?: string;
  relatedPublicPageHrefs: Array<{ title: string; href: string }>;
  readingTimeMinutes: number;
  version: string;
  updatedAt: string;
  searchTerms: string[];
  assistantTags: string[];
  sortOrder: number;
}

const BASE_UPDATED = "2026-06-27T00:00:00.000Z";

export function article(
  input: Omit<KnowledgeArticleRecord, "version" | "updatedAt"> & {
    version?: string;
    updatedAt?: string;
  },
): KnowledgeArticleRecord {
  return {
    version: input.version ?? "1.0.0",
    updatedAt: input.updatedAt ?? BASE_UPDATED,
    ...input,
  };
}
