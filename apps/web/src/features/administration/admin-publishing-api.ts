import type {
  AdminAuthorApplicationReconcileResult,
  AdminAuthorDirectoryResponse,
  AdminAuthorDirectoryStatusFilter,
  AdminAuthorTrustedPublishingCommandResult,
  AdminBlogCategoryItem,
  AdminBlogCategoryListResponse,
  AdminBlogSubscriberDirectoryResponse,
  AdminBlogSubscriberImportMode,
  AdminBlogSubscriberManualAddResponse,
  AdminBlogSubscriberMessageQueueResponse,
  AdminBlogSubscriberRemoveResponse,
  AdminBlogSubscriberStatusFilter,
  AdminPendingAuthorApplicationListResponse,
  AdminPendingPublicationReviewListResponse,
  AdminPublicationDirectoryResponse,
  AdminPublicationDirectoryStatusFilter,
  AdminPublicationReviewReconcileResult,
  AdminPublishingBlockCommandResult,
  BlogAuthorApplication,
  BlogSubscriptionSettingsResponse,
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

/** Pack 20C — persist canonical category display priority. */
export async function reorderAdminBlogCategories(input: {
  orderedCategoryIds: readonly string[];
}): Promise<AdminBlogCategoryListResponse> {
  return apiRequest<AdminBlogCategoryListResponse>(
    "/api/v1/admin/publishing/categories/reorder",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/** Pack 21B — Blog subscription Welcome Message settings */
export async function fetchAdminBlogSubscriptionSettings(): Promise<BlogSubscriptionSettingsResponse> {
  return apiRequest<BlogSubscriptionSettingsResponse>(
    "/api/v1/admin/publishing/subscription-settings",
  );
}

export async function updateAdminBlogSubscriptionSettings(input: {
  welcomeMessage: string;
}): Promise<BlogSubscriptionSettingsResponse> {
  return apiRequest<BlogSubscriptionSettingsResponse>(
    "/api/v1/admin/publishing/subscription-settings",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/** Pack 21C — Admin Blog subscriber directory */
export async function listAdminBlogSubscribers(query: {
  q?: string;
  status?: AdminBlogSubscriberStatusFilter;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminBlogSubscriberDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.status && query.status !== "all") {
    params.set("status", query.status);
  } else if (query.status === "all") {
    params.set("status", "all");
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminBlogSubscriberDirectoryResponse>(
    `/api/v1/admin/publishing/subscribers${suffix ? `?${suffix}` : ""}`,
  );
}

export async function removeAdminBlogSubscriber(
  subscriberId: string,
): Promise<AdminBlogSubscriberRemoveResponse> {
  return apiRequest<AdminBlogSubscriberRemoveResponse>(
    `/api/v1/admin/publishing/subscribers/${encodeURIComponent(subscriberId)}`,
    { method: "DELETE" },
  );
}

/** Pack 21G — Admin manual subscriber add / historical import. */
export async function addAdminBlogSubscriber(input: {
  email: string;
  displayName?: string;
  importMode: AdminBlogSubscriberImportMode;
  restoreUnsubscribed?: boolean;
}): Promise<AdminBlogSubscriberManualAddResponse> {
  return apiRequest<AdminBlogSubscriberManualAddResponse>(
    "/api/v1/admin/publishing/subscribers",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        importMode: input.importMode,
        ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
        ...(input.restoreUnsubscribed ? { restoreUnsubscribed: true } : {}),
      }),
    },
  );
}

/** Pack 21E — queue Admin selected-subscriber message (durable fan-out). */
export async function queueAdminBlogSubscriberMessage(input: {
  subject: string;
  message: string;
  subscriberIds: readonly string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): Promise<AdminBlogSubscriberMessageQueueResponse> {
  return apiRequest<AdminBlogSubscriberMessageQueueResponse>(
    "/api/v1/admin/publishing/subscribers/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
