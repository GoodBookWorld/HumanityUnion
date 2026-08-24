import type {
  BlogAuthorWorkspacePost,
  BlogAuthorWorkspacePostSummary,
  BlogPost,
  CivicSearchMetadata,
  PublicBlogPostDetail,
  PublicBlogPostListItem,
  PublicCommentAuthor,
} from "@hu/types";

import { getBlogCategoryById } from "./blog-categories.js";
import { resolvePublicBlogPostSeo } from "./blog-seo.js";

export function toBlogAuthorWorkspacePost(post: BlogPost): BlogAuthorWorkspacePost {
  return {
    postId: post.postId,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    categoryId: post.categoryId,
    tags: [...post.tags],
    coverMedia: post.coverMedia ? { ...post.coverMedia } : null,
    status: post.status,
    originalLanguage: post.originalLanguage,
    safetyOutcome: post.safetyOutcome,
    review: { ...post.review },
    publishedVersion: post.publishedVersion,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    submittedAt: post.submittedAt,
    publishedAt: post.publishedAt,
    archivedAt: post.archivedAt,
    ...(post.administrativelyBlocked === true
      ? { administrativelyBlocked: true }
      : {}),
    editorialHistory: post.editorialHistory?.map((entry) => ({ ...entry })),
    ...(post.optimization
      ? {
          optimization: {
            ...post.optimization,
            ...(post.optimization.socialImage !== undefined
              ? {
                  socialImage: post.optimization.socialImage
                    ? { ...post.optimization.socialImage }
                    : null,
                }
              : {}),
            ...(post.optimization.distribution
              ? {
                  distribution: {
                    huSocialShare: post.optimization.distribution.huSocialShare,
                    ...(post.optimization.distribution.huPlatformChannels
                      ? {
                          huPlatformChannels:
                            post.optimization.distribution.huPlatformChannels.map((channel) => ({
                              ...channel,
                            })),
                        }
                      : {}),
                    authorExternalAccounts: (
                      post.optimization.distribution.authorExternalAccounts ?? []
                    ).map((account) => ({
                      ...account,
                    })),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

export function toBlogAuthorWorkspacePostSummary(post: BlogPost): BlogAuthorWorkspacePostSummary {
  const workspace = toBlogAuthorWorkspacePost(post);
  const { content: _content, ...summary } = workspace;
  return summary;
}

/** Preview uses the same normalized content shape as public detail (minus public-only fields). */
export function toBlogPreviewProjection(
  post: BlogPost,
  author: PublicCommentAuthor,
): Omit<PublicBlogPostDetail, "reactionCounts" | "commentCount"> & {
  readonly status: BlogPost["status"];
  readonly reactionCounts: PublicBlogPostDetail["reactionCounts"];
  readonly commentCount: number;
} {
  const category = getBlogCategoryById(post.categoryId);
  if (!category) {
    throw new Error(`Unknown Blog category: ${post.categoryId}`);
  }

  return {
    postId: post.postId,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverMedia ? { ...post.coverMedia } : null,
    author,
    publishedAt: post.publishedAt ?? post.updatedAt,
    updatedAt: post.updatedAt,
    category,
    tags: [...post.tags],
    originalLanguage: post.originalLanguage,
    status: post.status,
    reactionCounts: { helpful: 0, notHelpful: 0 },
    commentCount: 0,
    seo: resolvePublicBlogPostSeo(post),
  };
}

export function toPublicBlogPostListItem(
  post: BlogPost,
  author: PublicCommentAuthor,
  commentCount = 0,
): PublicBlogPostListItem {
  const category = getBlogCategoryById(post.categoryId);
  if (!category) {
    throw new Error(`Unknown Blog category: ${post.categoryId}`);
  }

  return {
    postId: post.postId,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.coverMedia ? { ...post.coverMedia } : null,
    author,
    publishedAt: post.publishedAt ?? post.updatedAt,
    category,
    tags: [...post.tags],
    commentCount,
  };
}

export function toPublicBlogPostDetail(
  post: BlogPost,
  author: PublicCommentAuthor,
  engagement?: {
    readonly helpful: number;
    readonly notHelpful: number;
    readonly commentCount: number;
    readonly currentUserReaction?: "helpful" | "not_helpful" | "none";
  },
): PublicBlogPostDetail {
  const category = getBlogCategoryById(post.categoryId);
  if (!category) {
    throw new Error(`Unknown Blog category: ${post.categoryId}`);
  }

  return {
    postId: post.postId,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverMedia ? { ...post.coverMedia } : null,
    author,
    publishedAt: post.publishedAt ?? post.updatedAt,
    updatedAt: post.updatedAt,
    category,
    tags: [...post.tags],
    originalLanguage: post.originalLanguage,
    reactionCounts: {
      helpful: engagement?.helpful ?? 0,
      notHelpful: engagement?.notHelpful ?? 0,
    },
    currentUserReaction: engagement?.currentUserReaction,
    commentCount: engagement?.commentCount ?? 0,
    seo: resolvePublicBlogPostSeo(post),
  };
}

/** Assert public JSON never includes legacy / internal fields. */
export function assertNoInternalBlogFields(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "legacySourceUrl",
    "legacyPublishedAt",
    "legacyAuthorName",
    "legacyImportedAt",
    '"legacy"',
    "reviewNote",
    "reviewedByParticipantId",
    "safetyOutcome",
    "authorParticipantId",
    "submittedByParticipantId",
    "publishedByParticipantId",
    '"optimization"',
    "huSocialShare",
    "authorExternalAccounts",
    "huPlatformChannels",
  ];

  for (const key of forbidden) {
    if (serialized.includes(key)) {
      throw new Error(`Public Blog projection must not expose ${key}.`);
    }
  }
}

export function blogPostToSearchMetadata(post: BlogPost): CivicSearchMetadata | null {
  if (post.status !== "published") {
    return null;
  }

  const category = getBlogCategoryById(post.categoryId);
  const seo = resolvePublicBlogPostSeo(post);

  return {
    entityType: "blog_post",
    entityId: post.postId,
    title: seo.title,
    summary: seo.description,
    country: "",
    region: "",
    community: "",
    activityArea: category?.name ?? "",
    status: post.status,
    publicUrl: seo.canonicalPath,
    updatedAt: post.updatedAt,
    imageUrl: seo.socialImage?.mediaUrl ?? post.coverMedia?.mediaUrl,
  };
}
