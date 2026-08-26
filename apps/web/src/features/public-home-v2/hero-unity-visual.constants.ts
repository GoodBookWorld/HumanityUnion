/**
 * Home Visual Pack — Humanity Unity visual panel.
 *
 * Quote underlay + honeycomb mask + foreground signal points (no WebGL).
 * Quote lines stay visually stable; the 12s cycle coordinates mask phases only.
 */

export const HUMANITY_UNITY_QUOTE_LINES = [
  "Over time,",
  "love and responsibility",
  "forge humanity",
] as const;

/** Full accessible phrase (single string for screen readers / translations). */
export const HUMANITY_UNITY_QUOTE = HUMANITY_UNITY_QUOTE_LINES.join(" ");

/** Platform primary — matches `--hu-color-primary`. */
export const HUMANITY_UNITY_BLUE = "#0174b0";

/**
 * Signal amber. Design tokens do not define an amber accent today;
 * matches the Pack 01 reference (#FFD250) as a local visual constant.
 */
export const HUMANITY_UNITY_AMBER = "#ffd250";

/** Desktop/tablet signal point count (tablet CSS/JS may use fewer). */
export const HUMANITY_UNITY_SIGNAL_COUNT = 6;

/**
 * Quote / mask cycle length (seconds).
 * Content stays stable; honeycomb phases open → hold → close on this clock.
 */
export const HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS = 12;

/**
 * Decorative interaction contract — page scroll must never be captured.
 * Motion uses Canvas/SVG animation only (no OrbitControls / wheel handlers).
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
