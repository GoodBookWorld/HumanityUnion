export const AUTH_STATE_CHANGED_EVENT = "hu:auth-state-changed";

export function dispatchAuthStateChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT));
}
