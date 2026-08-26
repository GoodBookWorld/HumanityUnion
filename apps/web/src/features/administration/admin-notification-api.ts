/**
 * Pack 22E.2 — Admin Notification Center API client (Admin inbox only).
 */
import type {
  AdminNotificationCountResponse,
  AdminNotificationListResponse,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchAdminNotificationCount(): Promise<AdminNotificationCountResponse> {
  return apiRequest<AdminNotificationCountResponse>("/api/v1/admin/notifications/count");
}

export async function fetchAdminNotifications(input?: {
  limit?: number;
}): Promise<AdminNotificationListResponse> {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  const suffix = params.toString();
  return apiRequest<AdminNotificationListResponse>(
    `/api/v1/admin/notifications${suffix ? `?${suffix}` : ""}`,
  );
}

export async function deleteAdminNotification(
  adminNotificationId: string,
): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    `/api/v1/admin/notifications/${encodeURIComponent(adminNotificationId)}`,
    { method: "DELETE" },
  );
}

/** Pack 22E.3 — Diagnostics refresh evaluates operational health → Admin inbox. */
export async function evaluateAdminOperationalAlerts(): Promise<{
  opened: string[];
  escalated: string[];
  recovered: string[];
  unchanged: string[];
}> {
  return apiRequest("/api/v1/admin/notifications/evaluate-operational-alerts", {
    method: "POST",
  });
}
