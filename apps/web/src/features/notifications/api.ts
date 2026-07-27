import { apiRequest } from "../../lib/api-client";

export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationPriority = "critical" | "important" | "normal" | "informational";

export interface MemberNotificationView {
  notificationId: string;
  eventType: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
}

export interface MemberNotificationListResponse {
  notifications: MemberNotificationView[];
  total: number;
  unreadCount: number;
}

export type NotificationFilter = "all" | NotificationStatus;

export async function fetchMyNotifications(input?: {
  status?: NotificationFilter;
  limit?: number;
  offset?: number;
}): Promise<MemberNotificationListResponse> {
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
  return apiRequest<MemberNotificationListResponse>(
    `/api/v1/notifications/mine${query ? `?${query}` : ""}`,
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await apiRequest<{ unreadCount: number }>("/api/v1/notifications/unread-count");
  return response.unreadCount;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<MemberNotificationView> {
  return apiRequest<MemberNotificationView>(`/api/v1/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  return apiRequest<{ updatedCount: number }>("/api/v1/notifications/read-all", {
    method: "POST",
  });
}

export async function archiveNotification(notificationId: string): Promise<MemberNotificationView> {
  return apiRequest<MemberNotificationView>(`/api/v1/notifications/${notificationId}/archive`, {
    method: "POST",
  });
}

export function priorityLabel(priority: NotificationPriority): string {
  switch (priority) {
    case "critical":
      return "Critical";
    case "important":
      return "Important";
    case "normal":
      return "Normal";
    case "informational":
      return "Informational";
    default:
      return priority;
  }
}
