/**
 * PWA Experience Pack 01 — single presentation-mode helper.
 * Pack 22H — broader installed-display-mode detection (not UA sniffing).
 * Prefer this over scattered matchMedia / navigator checks.
 */

export type HuPresentationMode = "browser" | "standalone";

/**
 * Installed / Home Screen presentation modes recognized as standalone for
 * App Badge and PWA chrome. Standards-based `display-mode` media queries plus
 * legacy iOS `navigator.standalone`.
 */
const INSTALLED_DISPLAY_MODE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: minimal-ui)",
  "(display-mode: fullscreen)",
  "(display-mode: window-controls-overlay)",
] as const;

export function matchesInstalledDisplayMode(
  matchMedia: ((query: string) => { matches: boolean }) | undefined =
    typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined,
): boolean {
  if (!matchMedia) {
    return false;
  }
  return INSTALLED_DISPLAY_MODE_QUERIES.some((query) => {
    try {
      return matchMedia(query).matches;
    } catch {
      return false;
    }
  });
}

export function isIosStandaloneNavigator(
  nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): boolean {
  if (!nav) {
    return false;
  }
  return "standalone" in nav && Boolean((nav as Navigator & { standalone?: boolean }).standalone);
}

export function isStandaloneDisplayMode(input?: {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: Navigator;
}): boolean {
  if (typeof window === "undefined" && !input?.matchMedia && !input?.navigator) {
    return false;
  }

  const displayInstalled = matchesInstalledDisplayMode(
    input?.matchMedia ??
      (typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined),
  );
  const iosStandalone = isIosStandaloneNavigator(
    input?.navigator ?? (typeof navigator !== "undefined" ? navigator : undefined),
  );

  return displayInstalled || iosStandalone;
}

export function resolvePresentationMode(input?: {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: Navigator;
}): HuPresentationMode {
  return isStandaloneDisplayMode(input) ? "standalone" : "browser";
}

export function subscribePresentationMode(listener: (mode: HuPresentationMode) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaLists = INSTALLED_DISPLAY_MODE_QUERIES.map((query) => window.matchMedia(query));

  const notify = () => {
    listener(resolvePresentationMode());
  };

  notify();
  for (const media of mediaLists) {
    media.addEventListener("change", notify);
  }
  return () => {
    for (const media of mediaLists) {
      media.removeEventListener("change", notify);
    }
  };
}
