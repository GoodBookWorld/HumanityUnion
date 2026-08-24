import type {
  BlogAuthorWorkspacePost,
  BlogAuthorWorkspacePostListResponse,
  BlogCategoryId,
  BlogCoverMedia,
  BlogPublicationOptimization,
  PublicBlogPostDetail,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type BlogPreviewProjection = Omit<PublicBlogPostDetail, "reactionCounts" | "commentCount"> & {
  readonly status: BlogAuthorWorkspacePost["status"];
  readonly reactionCounts: PublicBlogPostDetail["reactionCounts"];
  readonly commentCount: number;
};

export interface BlogPostWriteInput {
  title: string;
  categoryId: BlogCategoryId;
  excerpt?: string;
  content?: string;
  tags?: readonly string[];
  coverMedia?: BlogCoverMedia | null;
  originalLanguage?: string;
  /** Pack 13C — YYYY-MM-DD canonical publication calendar date. */
  publicationDate?: string;
  /** Pack 16C — SEO / social / distribution on the canonical post. */
  optimization?: BlogPublicationOptimization;
}

export async function listOwnBlogPosts(input?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<BlogAuthorWorkspacePostListResponse> {
  const params = new URLSearchParams();
  if (input?.status) {
    params.set("status", input.status);
  }
  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  if (input?.offset !== undefined) {
    params.set("offset", String(input.offset));
  }
  const query = params.toString();
  return apiRequest<BlogAuthorWorkspacePostListResponse>(
    `/api/v1/blog/posts${query ? `?${query}` : ""}`,
  );
}

export async function createBlogDraft(input: BlogPostWriteInput): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>("/api/v1/blog/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchBlogWorkspacePost(postId: string): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(`/api/v1/blog/posts/${encodeURIComponent(postId)}`);
}

export async function updateBlogDraft(
  postId: string,
  input: Partial<BlogPostWriteInput>,
): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(`/api/v1/blog/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function previewBlogPost(postId: string): Promise<BlogPreviewProjection> {
  return apiRequest<BlogPreviewProjection>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/preview`,
  );
}

export async function submitBlogPostForReview(postId: string): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/submit`,
    { method: "POST" },
  );
}

export async function publishBlogPost(
  postId: string,
  input?: { publicationDate?: string },
): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
}

/** Pack 13C — cancel a future schedule (returns to draft). */
export async function cancelScheduledBlogPublication(
  postId: string,
): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/cancel-schedule`,
    { method: "POST" },
  );
}

/** Pack 16A — soft-delete / remove from public via canonical archive lifecycle. */
export async function archiveBlogPost(postId: string): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/archive`,
    { method: "POST" },
  );
}

/**
 * Pack 16A — Standard Author correction: published → draft (same postId/slug).
 * Trusted Authors correct in place via updateBlogDraft instead.
 */
export async function startPublishedCorrection(
  postId: string,
): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(postId)}/start-correction`,
    { method: "POST" },
  );
}

/** Client-side slug preview only — server allocates the canonical slug. */
export function previewBlogSlugFromTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return normalized || "post";
}
