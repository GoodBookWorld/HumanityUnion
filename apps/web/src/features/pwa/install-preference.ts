/**
 * Lightweight UI preference — not authentication state and not OS install proof.
 * Suppresses install CTA nagging within a short browser session window.
 *
 * PWA UX Correction Pack 02 — dismissal ≠ installed. Never treat a local
 * boolean as authoritative that the OS still has the app shortcut.
 */

const DISMISS_KEY = "hu_pwa_install_dismissed_at";
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Obsolete keys from earlier install UX that must not permanently suppress recovery. */
const OBSOLETE_KEYS = [
  "pwaInstalled",
  "pwa_installed",
  "hu_pwa_installed",
  "hu_pwaInstalled",
  "hu_pwa_install_dismissed",
  "hu-pwa-installed",
  "humanity_pwa_installed",
] as const;

export function clearObsoleteInstallPreferenceKeys(): void {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of OBSOLETE_KEYS) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage may be unavailable; ignore.
    }
  }
}

export function wasInstallPromotionDismissedRecently(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.sessionStorage.getItem(DISMISS_KEY);
  if (!raw) {
    return false;
  }

  const at = Number.parseInt(raw, 10);
  if (!Number.isFinite(at)) {
    window.sessionStorage.removeItem(DISMISS_KEY);
    return false;
  }

  if (Date.now() - at >= DISMISS_TTL_MS) {
    window.sessionStorage.removeItem(DISMISS_KEY);
    return false;
  }

  return true;
}

export function dismissInstallPromotion(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
}
