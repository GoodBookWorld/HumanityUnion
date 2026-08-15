/**
 * PWA Experience Pack 01 — single presentation-mode helper.
 * Prefer this over scattered matchMedia / navigator checks.
 */

export type HuPresentationMode = "browser" | "standalone";

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const displayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return displayStandalone || iosStandalone;
}

export function resolvePresentationMode(): HuPresentationMode {
  return isStandaloneDisplayMode() ? "standalone" : "browser";
}

export function subscribePresentationMode(listener: (mode: HuPresentationMode) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const media = window.matchMedia("(display-mode: standalone)");

  const notify = () => {
    listener(resolvePresentationMode());
  };

  notify();
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
