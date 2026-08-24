import type {
  AdminAuthorApplicationReconcileResult,
  AdminAuthorDirectoryResponse,
  AdminAuthorDirectoryStatusFilter,
  AdminAuthorTrustedPublishingCommandResult,
  AdminBlogCategoryItem,
  AdminBlogCategoryListResponse,
  AdminPendingAuthorApplicationListResponse,
  AdminPendingPublicationReviewListResponse,
  AdminPublicationDirectoryResponse,
  AdminPublicationDirectoryStatusFilter,
  AdminPublicationReviewReconcileResult,
  AdminPublishingBlockCommandResult,
  BlogAuthorApplication,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function listAdminPendingAuthorApplications(query: {
  limit?: number;
  offset?: number;
} = {}): Promise<AdminPendingAuthorApplicationListResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminPendingAuthorApplicationListResponse>(
    `/api/v1/admin/publishing/author-applications/pending${suffix ? `?${suffix}` : ""}`,
  );
}

export async function reconcileAdminPendingAuthorApplications(): Promise<AdminAuthorApplicationReconcileResult> {
  return apiRequest<AdminAuthorApplicationReconcileResult>(
    "/api/v1/admin/publishing/author-applications/reconcile",
    { method: "POST" },
  );
}

export async function recoveryResetAdminAuthorApplication(
  applicationId: string,
  reason?: string,
): Promise<BlogAuthorApplication> {
  return apiRequest<BlogAuthorApplication>(
    `/api/v1/admin/publishing/author-applications/${encodeURIComponent(applicationId)}/recovery-reset`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function listAdminPendingPublicationReviews(query: {
  limit?: number;
  offset?: number;
} = {}): Promise<AdminPendingPublicationReviewListResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminPendingPublicationReviewListResponse>(
    `/api/v1/admin/publishing/publications/pending-review${suffix ? `?${suffix}` : ""}`,
  );
}

export async function reconcileAdminPendingPublicationReviews(): Promise<AdminPublicationReviewReconcileResult> {
  return apiRequest<AdminPublicationReviewReconcileResult>(
    "/api/v1/admin/publishing/publications/reconcile-review-notifications",
    { method: "POST" },
  );
}

export async function listAdminPublishingAuthors(query: {
  status?: AdminAuthorDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminAuthorDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminAuthorDirectoryResponse>(
    `/api/v1/admin/publishing/authors${suffix ? `?${suffix}` : ""}`,
  );
}

export async function blockAdminPublishingAuthor(
  participantId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/authors/${encodeURIComponent(participantId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function unblockAdminPublishingAuthor(
  participantId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/authors/${encodeURIComponent(participantId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

/** Pack 16G — Admin Trusted Publishing (publish without manual review). */
export async function setAdminAuthorTrustedPublishing(
  participantId: string,
  publishWithoutManualReview: boolean,
): Promise<AdminAuthorTrustedPublishingCommandResult> {
  return apiRequest<AdminAuthorTrustedPublishingCommandResult>(
    `/api/v1/admin/publishing/authors/${encodeURIComponent(participantId)}/trusted-publishing`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishWithoutManualReview }),
    },
  );
}

export async function listAdminPublishingPublications(query: {
  status?: AdminPublicationDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminPublicationDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminPublicationDirectoryResponse>(
    `/api/v1/admin/publishing/publications${suffix ? `?${suffix}` : ""}`,
  );
}

export async function blockAdminPublishingPublication(
  postId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/publications/${encodeURIComponent(postId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function unblockAdminPublishingPublication(
  postId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/publications/${encodeURIComponent(postId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

/** Pack 16F — Publication Categories */
export async function listAdminBlogCategories(): Promise<AdminBlogCategoryListResponse> {
  return apiRequest<AdminBlogCategoryListResponse>("/api/v1/admin/publishing/categories");
}

export async function createAdminBlogCategory(input: {
  name: string;
  slug?: string;
  description?: string;
  categoryId?: string;
}): Promise<AdminBlogCategoryItem> {
  return apiRequest<AdminBlogCategoryItem>("/api/v1/admin/publishing/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAdminBlogCategory(
  categoryId: string,
  input: { name?: string; slug?: string; description?: string },
): Promise<AdminBlogCategoryItem> {
  return apiRequest<AdminBlogCategoryItem>(
    `/api/v1/admin/publishing/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function activateAdminBlogCategory(
  categoryId: string,
): Promise<AdminBlogCategoryItem> {
  return apiRequest<AdminBlogCategoryItem>(
    `/api/v1/admin/publishing/categories/${encodeURIComponent(categoryId)}/activate`,
    { method: "POST" },
  );
}

export async function deactivateAdminBlogCategory(
  categoryId: string,
): Promise<AdminBlogCategoryItem> {
  return apiRequest<AdminBlogCategoryItem>(
    `/api/v1/admin/publishing/categories/${encodeURIComponent(categoryId)}/deactivate`,
    { method: "POST" },
  );
}

export async function deleteAdminBlogCategory(
  categoryId: string,
  input?: { reassignToCategoryId?: string },
): Promise<{ deleted: true; reassignedCount: number }> {
  return apiRequest<{ deleted: true; reassignedCount: number }>(
    `/api/v1/admin/publishing/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
}
