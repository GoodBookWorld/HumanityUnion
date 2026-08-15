import type {
  BlogAuthorWorkspacePost,
  BlogEditorialQueueResponse,
  BlogEditorialReviewDetail,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";
import { previewBlogPost, type BlogPreviewProjection } from "./publishing-api";

export type { BlogPreviewProjection };

export async function listEditorialReviewQueue(input?: {
  limit?: number;
  offset?: number;
}): Promise<BlogEditorialQueueResponse> {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  if (input?.offset !== undefined) {
    params.set("offset", String(input.offset));
  }
  const query = params.toString();
  return apiRequest<BlogEditorialQueueResponse>(
    `/api/v1/blog/editorial/queue${query ? `?${query}` : ""}`,
  );
}

export async function fetchEditorialReviewDetail(
  postId: string,
): Promise<BlogEditorialReviewDetail> {
  return apiRequest<BlogEditorialReviewDetail>(
    `/api/v1/blog/editorial/posts/${encodeURIComponent(postId)}`,
  );
}

export async function previewEditorialPost(postId: string): Promise<BlogPreviewProjection> {
  return previewBlogPost(postId);
}

export async function requestEditorialChanges(input: {
  postId: string;
  reviewNote: string;
  expectedUpdatedAt: string;
}): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(input.postId)}/request-changes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewNote: input.reviewNote,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    },
  );
}

export async function approveAndPublishEditorialPost(input: {
  postId: string;
  expectedUpdatedAt: string;
  reviewNote?: string;
}): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(input.postId)}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedUpdatedAt: input.expectedUpdatedAt,
        reviewNote: input.reviewNote,
      }),
    },
  );
}

export async function publishAfterSafetyReview(input: {
  postId: string;
  reviewNote: string;
  expectedUpdatedAt: string;
}): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(input.postId)}/publish-after-safety-review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewNote: input.reviewNote,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    },
  );
}

export async function declineEditorialPost(input: {
  postId: string;
  reviewNote: string;
  expectedUpdatedAt: string;
}): Promise<BlogAuthorWorkspacePost> {
  return apiRequest<BlogAuthorWorkspacePost>(
    `/api/v1/blog/posts/${encodeURIComponent(input.postId)}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewNote: input.reviewNote,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    },
  );
}
