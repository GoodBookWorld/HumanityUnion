/**
 * SEO Pack 04 — JSON-LD / schema.org node types (plain objects).
 */

export type JsonLdNode = Record<string, unknown>;

export interface BreadcrumbItemInput {
  name: string;
  /** Public path beginning with `/`. */
  path: string;
}

export interface WebPageJsonLdInput {
  name: string;
  description?: string | null;
  canonicalPath: string;
  imageUrl?: string | null;
  breadcrumbs?: readonly BreadcrumbItemInput[];
}

export interface BlogPostingJsonLdInput {
  headline: string;
  description?: string | null;
  canonicalPath: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  author: {
    name: string;
    profilePathOrUrl?: string | null;
    avatarUrl?: string | null;
  };
}

export interface ProfilePageJsonLdInput {
  name: string;
  description?: string | null;
  canonicalPath: string;
  imageUrl?: string | null;
  organization?: string | null;
  /** Already-public social/professional URLs only. */
  sameAs?: readonly string[];
}
