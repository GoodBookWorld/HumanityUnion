/**
 * HU-NOTIF-02B — alternative notification email destination API client.
 */

import type { MemberPreferences } from "@hu/types";

import { apiRequest } from "../../lib/api-client";
import { MEMBER_PREFERENCES_CHANGED_EVENT } from "./preferences-api";

export interface NotificationEmailDestinationView {
  destinationMode: "account" | "alternative";
  accountEmail: string | null;
  accountEmailVerified: boolean;
  alternativeEmail: string | null;
  alternativeEmailVerifiedAt: string | null;
  pendingAlternativeEmail: string | null;
  pendingMaskedEmail: string | null;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
}

export interface NotificationEmailActionResult {
  preferences: MemberPreferences;
  destination: NotificationEmailDestinationView;
  emailSent?: boolean;
}

function dispatchPreferencesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_PREFERENCES_CHANGED_EVENT));
  }
}

export async function getNotificationEmailDestination(): Promise<NotificationEmailDestinationView> {
  return apiRequest<NotificationEmailDestinationView>("/api/v1/preferences/me/notification-email");
}

export async function requestAlternativeNotificationEmail(
  email: string,
): Promise<NotificationEmailActionResult> {
  const result = await apiRequest<NotificationEmailActionResult>(
    "/api/v1/preferences/me/notification-email/request-alternative",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  dispatchPreferencesChanged();
  return result;
}

export async function confirmAlternativeNotificationEmail(
  code: string,
): Promise<NotificationEmailActionResult> {
  const result = await apiRequest<NotificationEmailActionResult>(
    "/api/v1/preferences/me/notification-email/confirm-alternative",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    },
  );
  dispatchPreferencesChanged();
  return result;
}

export async function useAccountNotificationEmail(): Promise<NotificationEmailActionResult> {
  const result = await apiRequest<NotificationEmailActionResult>(
    "/api/v1/preferences/me/notification-email/use-account",
    { method: "POST" },
  );
  dispatchPreferencesChanged();
  return result;
}

export async function removeAlternativeNotificationEmail(): Promise<NotificationEmailActionResult> {
  const result = await apiRequest<NotificationEmailActionResult>(
    "/api/v1/preferences/me/notification-email/alternative",
    { method: "DELETE" },
  );
  dispatchPreferencesChanged();
  return result;
}
