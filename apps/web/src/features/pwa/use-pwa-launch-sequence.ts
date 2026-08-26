/**
 * Pack 22I.1 — PWA launch sequence state machine.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ClientAuthStatus } from "../auth/use-client-auth-status";
import {
  attemptPwaLaunchAudio,
  getPwaLaunchAudioStatus,
  subscribePwaLaunchAudioStatus,
  type PwaLaunchAudioStatus,
} from "./pwa-launch-audio";
import {
  advancePwaLaunchClock,
  type PwaLaunchTimingConfig,
} from "./pwa-launch-clock";
import {
  PWA_LAUNCH_TIMING,
  type PwaLaunchPhase,
} from "./pwa-launch-constants";
import { clearPwaLaunchFirstPaintPending } from "./pwa-launch-first-paint";
import {
  hasPwaLaunchPlayedThisSession,
  markPwaLaunchPlayedThisSession,
  type LaunchSessionStorage,
} from "./pwa-launch-session";
import { isStandaloneDisplayMode } from "./presentation-mode";

export type { PwaLaunchTimingConfig };

export interface UsePwaLaunchSequenceInput {
  readonly authStatus: ClientAuthStatus;
  readonly standalone?: boolean;
  readonly prefersReducedMotion?: boolean;
  readonly timing?: Partial<PwaLaunchTimingConfig>;
  readonly storage?: LaunchSessionStorage | null;
  readonly nowMs?: () => number;
  /** Skip audio in tests when false. */
  readonly enableAudio?: boolean;
  readonly matrixSeed?: number;
}

export interface UsePwaLaunchSequenceResult {
  readonly active: boolean;
  readonly phase: PwaLaunchPhase;
  readonly revealProgress: number;
  readonly logoOpacity: number;
  readonly logoScale: number;
  readonly overlayOpacity: number;
  readonly reducedMotion: boolean;
  readonly matrixSeed: number;
  readonly appReady: boolean;
  readonly audioStatus: PwaLaunchAudioStatus;
}

function resolveReducedMotion(flag?: boolean): boolean {
  if (typeof flag === "boolean") {
    return flag;
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function isAppReady(authStatus: ClientAuthStatus): boolean {
  return authStatus === "authenticated" || authStatus === "unauthenticated";
}

export function usePwaLaunchSequence(
  input: UsePwaLaunchSequenceInput,
): UsePwaLaunchSequenceResult {
  const timingRef = useRef<PwaLaunchTimingConfig>({
    ...PWA_LAUNCH_TIMING,
    ...input.timing,
  });
  const authReady = isAppReady(input.authStatus);
  const authReadyRef = useRef(authReady);

  useEffect(() => {
    timingRef.current = {
      ...PWA_LAUNCH_TIMING,
      ...input.timing,
    };
  }, [input.timing]);

  useEffect(() => {
    authReadyRef.current = authReady;
  }, [authReady]);

  const standalone =
    input.standalone ?? (typeof window !== "undefined" ? isStandaloneDisplayMode() : false);
  const reducedMotion = resolveReducedMotion(input.prefersReducedMotion);
  const enableAudio = input.enableAudio !== false;
  const matrixSeed = input.matrixSeed ?? 0x4855_4d31;
  const nowMs = input.nowMs ?? (() => performance.now());

  const shouldOffer = useMemo(() => {
    if (!standalone) {
      return false;
    }
    return !hasPwaLaunchPlayedThisSession(input.storage);
  }, [standalone, input.storage]);

  const [phase, setPhase] = useState<PwaLaunchPhase>(() => (shouldOffer ? "logo" : "complete"));
  const [revealProgress, setRevealProgress] = useState(0);
  const [logoOpacity, setLogoOpacity] = useState(0);
  const [logoScale, setLogoScale] = useState(0.92);
  const [overlayOpacity, setOverlayOpacity] = useState(shouldOffer ? 1 : 0);
  const [active, setActive] = useState(shouldOffer);
  const [audioStatus, setAudioStatus] = useState<PwaLaunchAudioStatus>(() =>
    getPwaLaunchAudioStatus(),
  );

  const startRef = useRef<number | null>(null);
  const revealStartedAtRef = useRef<number | null>(null);
  const claimedRef = useRef(false);
  const audioStartedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const finishedRef = useRef(!shouldOffer);

  useEffect(() => subscribePwaLaunchAudioStatus(setAudioStatus), []);

  useEffect(() => {
    if (!shouldOffer || claimedRef.current) {
      return;
    }
    claimedRef.current = true;
    markPwaLaunchPlayedThisSession(input.storage);
    // React overlay now owns the surface — drop the pre-hydrate cover.
    clearPwaLaunchFirstPaintPending();
    if (enableAudio && !audioStartedRef.current) {
      audioStartedRef.current = true;
      void attemptPwaLaunchAudio().then(setAudioStatus);
    }
  }, [shouldOffer, input.storage, enableAudio]);

  useEffect(() => {
    if (!active || phase === "complete") {
      return;
    }
    // Keep cover cleared while the branded overlay is visible.
    clearPwaLaunchFirstPaintPending();
  }, [active, phase]);

  useEffect(() => {
    if (phase === "complete" || !active) {
      clearPwaLaunchFirstPaintPending();
    }
  }, [phase, active]);

  useEffect(() => {
    if (!shouldOffer || finishedRef.current) {
      return;
    }

    startRef.current = nowMs();
    revealStartedAtRef.current = null;

    const finish = () => {
      finishedRef.current = true;
      setPhase("complete");
      setRevealProgress(1);
      setLogoOpacity(0);
      setOverlayOpacity(0);
      setActive(false);
      clearPwaLaunchFirstPaintPending();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const tick = () => {
      if (finishedRef.current) {
        return;
      }
      const timing = timingRef.current;
      const start = startRef.current ?? nowMs();
      const elapsed = nowMs() - start;
      const revealElapsed =
        revealStartedAtRef.current === null
          ? null
          : nowMs() - revealStartedAtRef.current;

      const next = advancePwaLaunchClock({
        elapsedMs: elapsed,
        revealElapsedMs: revealElapsed,
        appReady: authReadyRef.current,
        reducedMotion,
        timing,
      });

      if (next.beginReveal && revealStartedAtRef.current === null) {
        revealStartedAtRef.current = nowMs();
      }

      setPhase(next.phase);
      setRevealProgress(next.revealProgress);
      setLogoOpacity(next.logoOpacity);
      setLogoScale(next.logoScale);
      setOverlayOpacity(next.overlayOpacity);

      if (next.complete) {
        finish();
        return;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // Intentionally mount-once for a given offer; auth readiness is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Pack 22I.1 launch clock must not reset
  }, [shouldOffer, reducedMotion]);

  return {
    active: active && phase !== "complete",
    phase,
    revealProgress,
    logoOpacity,
    logoScale,
    overlayOpacity,
    reducedMotion,
    matrixSeed,
    appReady: authReady,
    audioStatus,
  };
}
