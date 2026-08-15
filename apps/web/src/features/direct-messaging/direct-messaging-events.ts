/** Part 18 — cross-component refresh signal, mirroring `notification-events.ts`. No realtime transport. */
export const DIRECT_MESSAGES_CHANGED_EVENT = "hu:direct-messages-changed";

export function dispatchDirectMessagesChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(DIRECT_MESSAGES_CHANGED_EVENT));
}
