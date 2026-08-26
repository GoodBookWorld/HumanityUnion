/**
 * Pack 22I.1 — pure launch clock (injectable timings; no DOM).
 */

import type { PwaLaunchPhase } from "./pwa-launch-constants";

export interface PwaLaunchTimingConfig {
  readonly logoMs: number;
  readonly revealMs: number;
  readonly finishingMs: number;
  readonly failSafeMs: number;
  readonly reducedMotionMs: number;
}

export interface LaunchClockInput {
  readonly elapsedMs: number;
  readonly revealElapsedMs: number | null;
  readonly appReady: boolean;
  readonly reducedMotion: boolean;
  readonly timing: PwaLaunchTimingConfig;
}

export interface LaunchClockOutput {
  readonly phase: PwaLaunchPhase;
  readonly revealProgress: number;
  readonly logoOpacity: number;
  readonly logoScale: number;
  readonly overlayOpacity: number;
  readonly complete: boolean;
  /** When non-null, caller should latch reveal start to this absolute offset from sequence start. */
  readonly beginReveal: boolean;
}

/**
 * Advance the visual launch state for a single tick.
 * `revealElapsedMs` is null until auth is ready and logo phase has finished.
 */
export function advancePwaLaunchClock(input: LaunchClockInput): LaunchClockOutput {
  const { elapsedMs, timing, reducedMotion, appReady } = input;

  if (reducedMotion) {
    const t = Math.min(1, elapsedMs / timing.reducedMotionMs);
    const logoIn = Math.min(1, t / 0.4);
    return {
      phase: t >= 1 ? "complete" : "logo",
      revealProgress: 1,
      logoOpacity: t < 0.45 ? logoIn : Math.max(0, 1 - (t - 0.45) / 0.55),
      logoScale: 0.96 + 0.04 * logoIn,
      overlayOpacity: 1 - t,
      complete: t >= 1,
      beginReveal: false,
    };
  }

  if (elapsedMs >= timing.failSafeMs) {
    return {
      phase: "complete",
      revealProgress: 1,
      logoOpacity: 0,
      logoScale: 1,
      overlayOpacity: 0,
      complete: true,
      beginReveal: false,
    };
  }

  if (elapsedMs < timing.logoMs) {
    const t = elapsedMs / timing.logoMs;
    return {
      phase: "logo",
      revealProgress: 0,
      logoOpacity: Math.min(1, t * 1.15),
      logoScale: 0.92 + 0.08 * t,
      overlayOpacity: 1,
      complete: false,
      beginReveal: false,
    };
  }

  if (!appReady) {
    return {
      phase: "waiting_ready",
      revealProgress: 0,
      logoOpacity: 1,
      logoScale: 1,
      overlayOpacity: 1,
      complete: false,
      beginReveal: false,
    };
  }

  const revealElapsed =
    input.revealElapsedMs === null ? 0 : input.revealElapsedMs;
  const beginReveal = input.revealElapsedMs === null;

  if (revealElapsed < timing.revealMs) {
    const t = revealElapsed / timing.revealMs;
    return {
      phase: "reveal",
      revealProgress: t,
      logoOpacity: 1,
      logoScale: 1,
      overlayOpacity: 1,
      complete: false,
      beginReveal,
    };
  }

  const finishElapsed = revealElapsed - timing.revealMs;
  if (finishElapsed < timing.finishingMs) {
    const t = finishElapsed / timing.finishingMs;
    return {
      phase: "finishing",
      revealProgress: 1,
      logoOpacity: 1 - t,
      logoScale: 1 - 0.04 * t,
      overlayOpacity: 1 - t,
      complete: false,
      beginReveal: false,
    };
  }

  return {
    phase: "complete",
    revealProgress: 1,
    logoOpacity: 0,
    logoScale: 0.96,
    overlayOpacity: 0,
    complete: true,
    beginReveal: false,
  };
}

/** Nominal interactive time (logo + reveal + finishing) when auth is ready immediately. */
export function nominalLaunchVisualDurationMs(
  timing: PwaLaunchTimingConfig,
): number {
  return timing.logoMs + timing.revealMs + timing.finishingMs;
}
