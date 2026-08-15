import type {
  BlogReactionKind,
  BlogReactionSummary,
  PublicBlogCommentListResponse,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface BlogCommentWriteResult {
  readonly commentId: string;
  readonly status: "visible" | "pending_review" | "removed";
  readonly parentCommentId?: string;
  readonly createdAt: string;
  readonly message?: string;
}

export async function listPublicBlogComments(input: {
  slug: string;
  limit?: number;
  offset?: number;
}): Promise<PublicBlogCommentListResponse> {
  const params = new URLSearchParams();
  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  if (input.offset !== undefined) {
    params.set("offset", String(input.offset));
  }
  const query = params.toString();
  return apiRequest<PublicBlogCommentListResponse>(
    `/api/v1/public/blog/${encodeURIComponent(input.slug)}/comments${query ? `?${query}` : ""}`,
  );
}

export async function createPublicBlogComment(input: {
  slug: string;
  content: string;
  parentCommentId?: string;
}): Promise<BlogCommentWriteResult> {
  return apiRequest<BlogCommentWriteResult>(
    `/api/v1/public/blog/${encodeURIComponent(input.slug)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: input.content,
        parentCommentId: input.parentCommentId,
      }),
    },
  );
}

export async function deletePublicBlogComment(input: {
  slug: string;
  commentId: string;
}): Promise<{ commentId: string; status: string }> {
  return apiRequest<{ commentId: string; status: string }>(
    `/api/v1/public/blog/${encodeURIComponent(input.slug)}/comments/${encodeURIComponent(input.commentId)}`,
    { method: "DELETE" },
  );
}

export async function setBlogPostReaction(input: {
  slug: string;
  reaction: BlogReactionKind | "none";
}): Promise<BlogReactionSummary> {
  return apiRequest<BlogReactionSummary>(
    `/api/v1/public/blog/${encodeURIComponent(input.slug)}/reactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: input.reaction }),
    },
  );
}
