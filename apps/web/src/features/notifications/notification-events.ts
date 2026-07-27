export const NOTIFICATIONS_CHANGED_EVENT = "hu:notifications-changed";

export function dispatchNotificationsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}
