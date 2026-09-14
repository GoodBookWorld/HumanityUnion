"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SAVE_BUTTON_SUCCESS_HOLD_MS } from "./save-button-timing";

/**
 * Profile UX Pack 02 Part 3 — the one reusable Save-button feedback
 * behavior applied to every profile save button (Profile, Skills,
 * Professional links, Privacy) and every Lifecycle stage editor
 * (Lifecycle UX Completion Pack 02 Part 4):
 *
 *  - "idle"    -> the normal action label ("Save profile", ...).
 *  - "saving"  -> the request is in flight (no artificial delay is ever
 *                 added before this; the API call fires immediately).
 *  - "success" -> the request just completed. Held for `holdMs`
 *                 (default {@link SAVE_BUTTON_SUCCESS_HOLD_MS}) so
 *                 the confirmation is actually perceivable, then reverts
 *                 to "idle" on its own.
 *
 * On failure, callers should call `markIdle()` (via `runSave`'s automatic
 * handling below) so the button never gets stuck showing a stale state.
 */
export type SaveButtonPhase = "idle" | "saving" | "success";

export interface SaveButtonPhaseControls {
  phase: SaveButtonPhase;
  isSaving: boolean;
  /** Convenience: true while the button should be non-interactive (saving or showing success). */
  isBusy: boolean;
  /** Runs `action`, transitioning idle -> saving -> success (held) -> idle, or idle on failure. */
  runSave: <T>(action: () => Promise<T>) => Promise<T>;
}

export function useSaveButtonPhase(holdMs = SAVE_BUTTON_SUCCESS_HOLD_MS): SaveButtonPhaseControls {
  const [phase, setPhase] = useState<SaveButtonPhase>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const runSave = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setPhase("saving");

      try {
        const result = await action();
        setPhase("success");
        timeoutRef.current = setTimeout(() => {
          setPhase("idle");
          timeoutRef.current = null;
        }, holdMs);
        return result;
      } catch (error) {
        setPhase("idle");
        throw error;
      }
    },
    [holdMs],
  );

  return {
    phase,
    isSaving: phase === "saving",
    isBusy: phase !== "idle",
    runSave,
  };
}

/** Resolves the button label for a given phase, falling back to `idleLabel`. */
export function resolveSaveButtonLabel(
  phase: SaveButtonPhase,
  idleLabel: string,
  phaseLabels?: { readonly saving?: string; readonly success?: string },
): string {
  switch (phase) {
    case "saving":
      return phaseLabels?.saving ?? "Saving…";
    case "success":
      return phaseLabels?.success ?? "Saved";
    default:
      return idleLabel;
  }
}
