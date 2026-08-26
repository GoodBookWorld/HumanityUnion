/**
 * Pack 22I.1 — module-level intro audio (may outlive the visual overlay).
 */

import { PWA_LAUNCH_AUDIO_SRC } from "./pwa-launch-constants";

let activeAudio: HTMLAudioElement | null = null;
let playAttempted = false;

export function hasPwaLaunchAudioAttempted(): boolean {
  return playAttempted;
}

export interface AttemptPwaLaunchAudioOptions {
  readonly createAudio?: (src: string) => HTMLAudioElement;
}

/** Attempt once; never throws; never blocks UI. */
export function attemptPwaLaunchAudio(
  options?: AttemptPwaLaunchAudioOptions,
): void {
  if (playAttempted || activeAudio) {
    return;
  }

  const createAudio = options?.createAudio;
  if (!createAudio && typeof window === "undefined") {
    return;
  }

  playAttempted = true;

  try {
    const factory =
      createAudio ?? ((src: string) => new Audio(src));
    const audio = factory(PWA_LAUNCH_AUDIO_SRC);
    activeAudio = audio;
    const clearIfCurrent = () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
    };
    audio.addEventListener("ended", clearIfCurrent);
    audio.addEventListener("error", clearIfCurrent);
    void audio.play().catch(() => {
      clearIfCurrent();
    });
  } catch {
    activeAudio = null;
  }
}

export function stopPwaLaunchAudio(): void {
  if (!activeAudio) {
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
}

/** Test seam — reset module state between unit tests. */
export function resetPwaLaunchAudioForTests(): void {
  stopPwaLaunchAudio();
  playAttempted = false;
}
