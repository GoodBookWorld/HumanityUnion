/**
 * Blog post fields the content-translation warm loader sends to the planner.
 * Shared by the translation service and the read-only chunk-plan diagnostic.
 * No provider, worker, or persistence imports.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  normalizeLanguageCode,
  type LanguageCode,
} from "@hu/types";

import { sanitizeBlogHtml } from "../blog/blog-content-sanitize.js";
import { buildContentTranslationSourceVersion } from "./content-translation-version.js";

export interface BlogPostContentTranslationLoadInput {
  readonly postId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly content: string;
  readonly updatedAt: string;
  readonly publishedVersion: number;
  readonly originalLanguage: unknown;
  readonly authorParticipantId: string | null;
  readonly status: string;
}

export interface BlogPostContentTranslationSource {
  readonly sourceKind: "blog_post";
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceLanguage: LanguageCode;
  readonly fields: Record<string, string>;
  readonly authorParticipantId: string | null;
  readonly isPublished: boolean;
}

export function buildBlogPostTranslatableSource(
  post: BlogPostContentTranslationLoadInput,
): BlogPostContentTranslationSource {
  const fields = {
    title: post.title,
    excerpt: post.excerpt,
    content: sanitizeBlogHtml(post.content),
  };
  return {
    sourceKind: "blog_post",
    sourceRecordId: post.postId,
    sourceVersion: buildContentTranslationSourceVersion({
      fields,
      versionStamp: post.updatedAt,
      publishedVersion: post.publishedVersion,
    }),
    sourceLanguage: normalizeLanguageCode(post.originalLanguage, DEFAULT_PLATFORM_LANGUAGE),
    fields,
    authorParticipantId: post.authorParticipantId,
    isPublished: post.status === "published",
  };
}
