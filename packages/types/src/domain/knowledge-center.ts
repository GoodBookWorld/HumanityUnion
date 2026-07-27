/** Knowledge Center category identifiers. */
export type KnowledgeCategoryId =
  | "getting-started"
  | "explanations"
  | "institutions-experience"
  | "guides"
  | "constitution"
  | "glossary"
  | "faq";

export interface KnowledgeCategory {
  id: KnowledgeCategoryId;
  title: string;
  description: string;
  sortOrder: number;
}

export interface KnowledgeArticleSummary {
  slug: string;
  categoryId: KnowledgeCategoryId;
  title: string;
  purpose: string;
  readingTimeMinutes: number;
  version: string;
  updatedAt: string;
}

export interface KnowledgeArticleSection {
  id: string;
  heading: string;
  body: string;
}

export interface KnowledgeArticlePublic {
  slug: string;
  categoryId: KnowledgeCategoryId;
  title: string;
  purpose: string;
  overview: string;
  diagramId: string;
  diagramSvg: string;
  explanation: KnowledgeArticleSection[];
  keyConcepts: string[];
  relatedConcepts: KnowledgeArticleReference[];
  relatedGuides: KnowledgeArticleReference[];
  relatedWorkspaceSection?: string;
  relatedPublicPages: KnowledgeArticleReference[];
  readingTimeMinutes: number;
  version: string;
  updatedAt: string;
  previousSlug?: string;
  nextSlug?: string;
}

export interface KnowledgeArticleReference {
  slug: string;
  title: string;
  href: string;
}

/** Assistant-safe knowledge article reference. */
export interface KnowledgeArticleAssistantReference {
  slug: string;
  title: string;
  purpose: string;
  href: string;
  categoryId: KnowledgeCategoryId;
}

export interface KnowledgeCenterListing {
  categories: Array<
    KnowledgeCategory & {
      articles: KnowledgeArticleSummary[];
    }
  >;
  totalArticles: number;
}
