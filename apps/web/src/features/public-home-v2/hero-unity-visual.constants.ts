/**
 * Home Visual Pack — Humanity Unity visual panel.
 *
 * Earth GIF + SVG/CSS orbital communication layer (no WebGL).
 * Quote: three semantic lines, translation-safe wrapping, sequential CSS reveal.
 */

export const HUMANITY_UNITY_QUOTE_LINES = [
  "Over time,",
  "love and responsibility",
  "forge humanity",
] as const;

/** Full accessible phrase (single string for screen readers / translations). */
export const HUMANITY_UNITY_QUOTE = HUMANITY_UNITY_QUOTE_LINES.join(" ");

/** Central Earth animation — native GIF playback. */
export const HUMANITY_UNITY_EARTH_SRC = "/illustrations/earth.gif";

/** Platform primary — matches `--hu-color-primary`. */
export const HUMANITY_UNITY_BLUE = "#0174b0";

/**
 * Signal / orbit amber. Design tokens do not define an amber accent today;
 * matches the Pack 01 reference (#FFD250) as a local visual constant.
 */
export const HUMANITY_UNITY_AMBER = "#ffd250";

/** Desktop orbital path count (tablet/mobile CSS may hide some). */
export const HUMANITY_UNITY_ORBIT_COUNT = 4;

/** Full quote cycle (line reveals → hold → dissolve → pause). */
export const HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS = 12;

/**
 * Decorative interaction contract — page scroll must never be captured.
 * Orbits use CSS animation only (no OrbitControls / wheel handlers).
 */
export const HUMANITY_GLOBE_INTERACTION = {
  autoRotate: true,
  enableZoom: false,
  enablePan: false,
  enableOrbitControls: false,
  captureWheel: false,
} as const;

/** Visual panel only above this breakpoint. */
export const HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX = 769;
