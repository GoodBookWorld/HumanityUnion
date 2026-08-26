/**
 * Pack 22I.2 — early first-paint cover helpers (html class bridge).
 *
 * A blocking body script may set `html.hu-pwa-launch-pending` before React
 * hydrates so the installed-PWA cold launch never flashes Workspace chrome.
 */

export const PWA_LAUNCH_PENDING_HTML_CLASS = "hu-pwa-launch-pending";

/** Remove the pre-React #f4f7fa cover once the launch overlay owns the surface. */
export function clearPwaLaunchFirstPaintPending(): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    document.documentElement.classList.remove(PWA_LAUNCH_PENDING_HTML_CLASS);
  } catch {
    // ignore
  }
}

/** Test/source seam — class name used by inline bootstrap + CSS. */
export function getPwaLaunchPendingHtmlClass(): string {
  return PWA_LAUNCH_PENDING_HTML_CLASS;
}
