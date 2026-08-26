/**
 * Pack 22I.2 — inline bootstrap for installed-PWA first paint.
 * Kept as a plain string so RootLayout can inject it before React hydrates.
 *
 * Mirrors session key + display-mode detection used by Pack 22I.1 / 22H.
 * Fail-safe removes the cover if React never takes over (~7s).
 */
export const PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP = `(function(){
  try {
    var KEY = "hu.pwa.launch.v1";
    var CLASS = "hu-pwa-launch-pending";
    if (sessionStorage.getItem(KEY) === "1") return;
    var queries = [
      "(display-mode: standalone)",
      "(display-mode: minimal-ui)",
      "(display-mode: fullscreen)",
      "(display-mode: window-controls-overlay)"
    ];
    var standalone = false;
    for (var i = 0; i < queries.length; i++) {
      try {
        if (window.matchMedia(queries[i]).matches) { standalone = true; break; }
      } catch (e) {}
    }
    if (!standalone && navigator.standalone === true) standalone = true;
    if (!standalone) return;
    document.documentElement.classList.add(CLASS);
    window.setTimeout(function () {
      try { document.documentElement.classList.remove(CLASS); } catch (e) {}
    }, 7000);
  } catch (e) {}
})();`;
