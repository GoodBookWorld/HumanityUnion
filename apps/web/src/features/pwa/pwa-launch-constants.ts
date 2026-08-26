/**
 * Pack 22I.1 — PWA launch sequence constants (injectable for tests).
 */

export const PWA_LAUNCH_SESSION_KEY = "hu.pwa.launch.v1";

export const PWA_LAUNCH_LOGO_SRC = "/brand/humanity-union-logo.svg";
export const PWA_LAUNCH_AUDIO_SRC = "/brand/hu-intro.mp3";

export const PWA_LAUNCH_BACKDROP = "#f4f7fa";

/** Above --hu-z-modal (200). */
export const PWA_LAUNCH_Z_INDEX = 300;

export const PWA_LAUNCH_TIMING = {
  logoMs: 1_200,
  revealMs: 3_300,
  finishingMs: 1_000,
  /** Absolute fail-safe from sequence start. */
  failSafeMs: 7_000,
  reducedMotionMs: 1_200,
} as const;

export const PWA_LAUNCH_MATRIX = {
  minColumns: 20,
  maxColumns: 32,
  /** Soft cap on total cells (rows × cols). */
  maxCells: 900,
} as const;

export type PwaLaunchPhase =
  | "idle"
  | "logo"
  | "waiting_ready"
  | "reveal"
  | "finishing"
  | "complete";
