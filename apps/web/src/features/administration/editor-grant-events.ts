export const EDITOR_GRANT_CHANGED_EVENT = "hu:editor-grant-changed";

/**
 * Pack 12E2 — same-tab optimization only.
 * Server `/me` remains authority across browsers/devices.
 */
export function dispatchEditorGrantChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(EDITOR_GRANT_CHANGED_EVENT));
}
