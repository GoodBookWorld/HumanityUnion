/**
 * Pack 22I.1 / 22I.2 — module-level intro audio (may outlive the visual overlay).
 *
 * Pack 22I.2 — distinguish autoplay success vs gesture-required rejection;
 * keep a single Audio instance for user-gesture retry via the HU logo.
 */

import { PWA_LAUNCH_AUDIO_SRC } from "./pwa-launch-constants";

export type PwaLaunchAudioStatus =
  | "idle"
  | "playing"
  | "gesture_required"
  | "failed"
  | "ended";

let activeAudio: HTMLAudioElement | null = null;
let playAttempted = false;
let status: PwaLaunchAudioStatus = "idle";
const listeners = new Set<(next: PwaLaunchAudioStatus) => void>();

function setStatus(next: PwaLaunchAudioStatus): void {
  status = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch {
      // ignore listener errors
    }
  }
}

function isGestureRequiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "NotAllowedError";
}

function bindLifecycle(audio: HTMLAudioElement): void {
  const clearIfCurrent = () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
    if (status === "playing") {
      setStatus("ended");
    }
  };
  audio.addEventListener("ended", clearIfCurrent);
  audio.addEventListener("error", () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
    if (status !== "gesture_required") {
      setStatus("failed");
    }
  });
}

function ensureAudio(
  createAudio?: (src: string) => HTMLAudioElement,
): HTMLAudioElement | null {
  if (activeAudio) {
    return activeAudio;
  }
  if (!createAudio && typeof window === "undefined") {
    return null;
  }
  try {
    const factory = createAudio ?? ((src: string) => new Audio(src));
    const audio = factory(PWA_LAUNCH_AUDIO_SRC);
    activeAudio = audio;
    bindLifecycle(audio);
    return audio;
  } catch {
    return null;
  }
}

export function getPwaLaunchAudioStatus(): PwaLaunchAudioStatus {
  return status;
}

export function hasPwaLaunchAudioAttempted(): boolean {
  return playAttempted;
}

export function subscribePwaLaunchAudioStatus(
  listener: (next: PwaLaunchAudioStatus) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface AttemptPwaLaunchAudioOptions {
  readonly createAudio?: (src: string) => HTMLAudioElement;
}

/**
 * Attempt autoplay once. Never throws. Never blocks UI.
 * On gesture-required rejection, keeps the Audio instance for logo retry.
 */
export async function attemptPwaLaunchAudio(
  options?: AttemptPwaLaunchAudioOptions,
): Promise<PwaLaunchAudioStatus> {
  if (playAttempted) {
    return status;
  }
  if (!options?.createAudio && typeof window === "undefined") {
    return status;
  }

  playAttempted = true;
  const audio = ensureAudio(options?.createAudio);
  if (!audio) {
    setStatus("failed");
    return status;
  }

  try {
    await audio.play();
    setStatus("playing");
    return status;
  } catch (error) {
    if (isGestureRequiredError(error)) {
      // Keep activeAudio for the interactive logo gesture.
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      setStatus("gesture_required");
      return status;
    }
    activeAudio = null;
    setStatus("failed");
    return status;
  }
}

/**
 * User-gesture retry from the interactive HU logo.
 * Reuses the same Audio instance; never overlaps a second player.
 */
export async function playPwaLaunchAudioFromUserGesture(): Promise<boolean> {
  if (status === "playing") {
    return true;
  }
  if (status !== "gesture_required" && status !== "failed" && status !== "idle") {
    // ended / unknown — do not advertise sound after natural completion mid-overlay
    if (status === "ended") {
      return false;
    }
  }

  const audio = ensureAudio();
  if (!audio) {
    setStatus("failed");
    return false;
  }

  try {
    if (!audio.paused && audio.currentTime > 0) {
      setStatus("playing");
      return true;
    }
    audio.currentTime = 0;
    await audio.play();
    setStatus("playing");
    return true;
  } catch {
    setStatus("gesture_required");
    return false;
  }
}

export function stopPwaLaunchAudio(): void {
  if (!activeAudio) {
    playAttempted = true;
    if (status !== "idle") {
      setStatus("ended");
    }
    return;
  }
  try {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
  } catch {
    // ignore
  }
  activeAudio = null;
  setStatus("ended");
}

/** Test seam — reset module state between unit tests. */
export function resetPwaLaunchAudioForTests(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.removeAttribute("src");
      activeAudio.load();
    } catch {
      // ignore
    }
  }
  activeAudio = null;
  playAttempted = false;
  setStatus("idle");
  listeners.clear();
}
