import type {
  CommunicationReminderListResponse,
  CommunicationReminderStatus,
  CommunicationReminderView,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type { CommunicationReminderView, CommunicationReminderStatus } from "@hu/types";

/**
 * Lifecycle UX Correction Pack 01 Part 6/7 — now a real, persisted Reminder
 * backend (`apps/api/src/modules/reminders`) instead of the Communication
 * UX Pack 03.4 stub that always returned an empty array. The Notification
 * Center, the shared card, and the summary count were already built
 * against this exact shape, so this swap is the only change needed to
 * light up the Reminders section end to end.
 */
export type ReminderFilter = "all" | CommunicationReminderStatus;

export async function fetchMyReminders(input?: {
  status?: ReminderFilter;
  limit?: number;
}): Promise<CommunicationReminderListResponse> {
  const params = new URLSearchParams();

  if (input?.status) {
    params.set("status", input.status);
  }

  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  const query = params.toString();
  return apiRequest<CommunicationReminderListResponse>(
    `/api/v1/reminders/mine${query ? `?${query}` : ""}`,
  );
}

/** Part 6 — marks the Reminder completed and moves it into Archive in one step. */
export async function completeReminder(reminderId: string): Promise<CommunicationReminderView> {
  return apiRequest<CommunicationReminderView>(`/api/v1/reminders/${reminderId}/complete`, {
    method: "POST",
  });
}

/** Part 4/9 — only ever offered in the UI for an already-archived Reminder. Removes only that one record. */
export async function deleteReminder(reminderId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/v1/reminders/${reminderId}`, {
    method: "DELETE",
  });
}
