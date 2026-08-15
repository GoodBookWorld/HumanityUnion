/**
 * Home Visual Pack 01 / 01.1 / Refinement 02 — Humanity Unity visual panel.
 *
 * Continent strategy (Pack 01.1):
 * Abstract CanvasTexture land ellipses were not recognizable as Earth continents.
 * Continents removed; globe emphasizes wireframe + amber communication arcs.
 *
 * Quote (Refinement 02): three semantic lines, translation-safe wrapping,
 * sequential CSS reveal (not single-line width typewriter).
 */

export const HUMANITY_UNITY_QUOTE_LINES = [
  "Over time,",
  "love and responsibility",
  "forge humanity",
] as const;

/** Full accessible phrase (single string for screen readers / translations). */
export const HUMANITY_UNITY_QUOTE = HUMANITY_UNITY_QUOTE_LINES.join(" ");

export const HUMANITY_UNITY_BACKGROUND_SRC = "/illustrations/unity-globe.webp";

/** Platform primary — matches `--hu-color-primary`. */
export const HUMANITY_UNITY_BLUE = "#0174b0";
export const HUMANITY_UNITY_BLUE_HEX = 0x0174b0;

/**
 * Arc/pulse amber. Design tokens do not define an amber accent today;
 * this matches the Pack 01 reference (#FFD250) as a local visual constant.
 */
export const HUMANITY_UNITY_AMBER = "#ffd250";
export const HUMANITY_UNITY_AMBER_HEX = 0xffd250;

export const HUMANITY_UNITY_ARC_COUNT = 10;

/** Full quote cycle (line reveals → hold → dissolve → pause). */
export const HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS = 12;

/** Pack 01.1 — ~15% smaller than Pack 01 radius 28. */
export const HUMANITY_UNITY_GLOBE_RADIUS = 23.8;

export const HUMANITY_GLOBE_INTERACTION = {
  /** Auto-rotation only — no OrbitControls / wheel capture. */
  autoRotate: true,
  enableZoom: false,
  enablePan: false,
  enableOrbitControls: false,
  /** Wheel / trackpad / touch vertical gestures must scroll the page. */
  captureWheel: false,
} as const;

/** Visual panel (and WebGL) only above this breakpoint. */
export const HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX = 769;
