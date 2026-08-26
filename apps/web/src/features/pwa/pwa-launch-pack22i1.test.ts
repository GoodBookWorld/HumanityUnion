/**
 * Pack 22I.1 — HU Matrix Reveal PWA launch sequence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import { buildHuMatrixField, createSeededRandom } from "./hu-matrix-geometry.js";
import {
  attemptPwaLaunchAudio,
  hasPwaLaunchAudioAttempted,
  resetPwaLaunchAudioForTests,
  stopPwaLaunchAudio,
} from "./pwa-launch-audio.js";
import {
  advancePwaLaunchClock,
  nominalLaunchVisualDurationMs,
} from "./pwa-launch-clock.js";
import {
  PWA_LAUNCH_AUDIO_SRC,
  PWA_LAUNCH_BACKDROP,
  PWA_LAUNCH_LOGO_SRC,
  PWA_LAUNCH_MATRIX,
  PWA_LAUNCH_SESSION_KEY,
  PWA_LAUNCH_TIMING,
  PWA_LAUNCH_Z_INDEX,
} from "./pwa-launch-constants.js";
import {
  clearPwaLaunchPlayedThisSessionForTests,
  hasPwaLaunchPlayedThisSession,
  markPwaLaunchPlayedThisSession,
} from "./pwa-launch-session.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
/** `apps/web/src` — same convention as Pack 22B.1 / 22H tests. */
const webSrcRoot = path.resolve(dir, "../..");
const webPublicRoot = path.resolve(webSrcRoot, "../public");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrcRoot, relativePath), "utf8");
}

function readPublic(relativePath: string): string {
  return readFileSync(path.join(webPublicRoot, relativePath), "utf8");
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key() {
      return null;
    },
  };
}

const fastTiming = {
  logoMs: 100,
  revealMs: 200,
  finishingMs: 50,
  failSafeMs: 400,
  reducedMotionMs: 80,
};

describe("Pack 22I.1 — HU Matrix Reveal PWA launch sequence", () => {
  beforeEach(() => {
    resetPwaLaunchAudioForTests();
  });

  it("1 — standalone cold/session launch is wired in PwaShell", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(shell, /PwaLaunchSequence/);
    assert.match(shell, /standalone\s*\?\s*<PwaLaunchSequence/);
  });

  it("2 — browser tab skips sequence (no launch outside standalone branch)", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(shell, /standalone \? <PwaLaunchSequence/);
    assert.doesNotMatch(shell, /<PwaLaunchSequence\s*\/>/);
  });

  it("3 — sessionStorage guard prevents replay", () => {
    const storage = memoryStorage();
    assert.equal(hasPwaLaunchPlayedThisSession(storage), false);
    markPwaLaunchPlayedThisSession(storage);
    assert.equal(storage.getItem(PWA_LAUNCH_SESSION_KEY), "1");
    assert.equal(hasPwaLaunchPlayedThisSession(storage), true);
    clearPwaLaunchPlayedThisSessionForTests(storage);
    assert.equal(hasPwaLaunchPlayedThisSession(storage), false);
  });

  it("4 — internal route navigation does not replay (early claim + session key)", () => {
    const hook = readWeb("features/pwa/use-pwa-launch-sequence.ts");
    assert.match(hook, /markPwaLaunchPlayedThisSession/);
    assert.match(hook, /claimedRef/);
    assert.equal(PWA_LAUNCH_SESSION_KEY, "hu.pwa.launch.v1");
  });

  it("5 — existing HU logo path used", () => {
    assert.equal(PWA_LAUNCH_LOGO_SRC, "/brand/humanity-union-logo.svg");
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.match(overlay, /PWA_LAUNCH_LOGO_SRC/);
    assert.ok(readPublic("brand/humanity-union-logo.svg").length > 0);
  });

  it("6 — existing audio path used", () => {
    assert.equal(PWA_LAUNCH_AUDIO_SRC, "/brand/hu-intro.mp3");
    const audio = readWeb("features/pwa/pwa-launch-audio.ts");
    assert.match(audio, /PWA_LAUNCH_AUDIO_SRC/);
  });

  it("7 — audio playback attempted once", async () => {
    let plays = 0;
    const createAudio = () =>
      ({
        play: async () => {
          plays += 1;
        },
        addEventListener() {},
        pause() {},
        removeAttribute() {},
        load() {},
        paused: true,
        currentTime: 0,
      }) as unknown as HTMLAudioElement;

    await attemptPwaLaunchAudio({ createAudio });
    await attemptPwaLaunchAudio({ createAudio });
    assert.equal(plays, 1);
    assert.equal(hasPwaLaunchAudioAttempted(), true);
  });

  it("8 — autoplay rejection does not block sequence", async () => {
    const createAudio = () =>
      ({
        play: async () => {
          const error = new Error("play blocked");
          error.name = "NotAllowedError";
          throw error;
        },
        addEventListener() {},
        pause() {},
        removeAttribute() {},
        load() {},
        paused: true,
        currentTime: 0,
      }) as unknown as HTMLAudioElement;

    await assert.doesNotReject(() => attemptPwaLaunchAudio({ createAudio }));
    assert.equal(hasPwaLaunchAudioAttempted(), true);

    const tick = advancePwaLaunchClock({
      elapsedMs: 50,
      revealElapsedMs: null,
      appReady: true,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(tick.phase, "logo");
    assert.equal(tick.complete, false);
  });

  it("9 — auth pending prevents premature matrix reveal", () => {
    const afterLogo = advancePwaLaunchClock({
      elapsedMs: fastTiming.logoMs + 10,
      revealElapsedMs: null,
      appReady: false,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(afterLogo.phase, "waiting_ready");
    assert.equal(afterLogo.revealProgress, 0);
    assert.equal(afterLogo.beginReveal, false);
  });

  it("10 — resolved auth allows reveal", () => {
    const ready = advancePwaLaunchClock({
      elapsedMs: fastTiming.logoMs + 10,
      revealElapsedMs: null,
      appReady: true,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(ready.phase, "reveal");
    assert.equal(ready.beginReveal, true);

    const mid = advancePwaLaunchClock({
      elapsedMs: fastTiming.logoMs + 110,
      revealElapsedMs: 100,
      appReady: true,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(mid.phase, "reveal");
    assert.ok(mid.revealProgress > 0 && mid.revealProgress < 1);
  });

  it("11 — fail-safe completes overlay", () => {
    const done = advancePwaLaunchClock({
      elapsedMs: fastTiming.failSafeMs,
      revealElapsedMs: null,
      appReady: false,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(done.complete, true);
    assert.equal(done.phase, "complete");
    assert.equal(done.overlayOpacity, 0);
  });

  it("12 — seeded reveal ordering deterministic", () => {
    const a = buildHuMatrixField({ width: 390, height: 844, seed: 42 });
    const b = buildHuMatrixField({ width: 390, height: 844, seed: 42 });
    assert.deepEqual(
      a.cells.map((c) => c.revealRank),
      b.cells.map((c) => c.revealRank),
    );
    const c = buildHuMatrixField({ width: 390, height: 844, seed: 99 });
    assert.notDeepEqual(
      a.cells.map((c) => c.revealAt),
      c.cells.map((c) => c.revealAt),
    );
    const r1 = createSeededRandom(7);
    const r2 = createSeededRandom(7);
    assert.equal(r1(), r2());
  });

  it("13 — Canvas uses bounded cell count", () => {
    const field = buildHuMatrixField({ width: 1920, height: 1080, seed: 1 });
    assert.ok(field.cells.length <= PWA_LAUNCH_MATRIX.maxCells);
    assert.ok(field.columns >= PWA_LAUNCH_MATRIX.minColumns);
    assert.ok(field.columns <= PWA_LAUNCH_MATRIX.maxColumns);
    assert.ok(field.cells.length >= 400 || field.width < 400);
  });

  it("14 — visual sequence reaches complete state", () => {
    const duration = nominalLaunchVisualDurationMs(fastTiming);
    const done = advancePwaLaunchClock({
      elapsedMs: duration,
      revealElapsedMs: fastTiming.revealMs + fastTiming.finishingMs,
      appReady: true,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(done.complete, true);
    assert.equal(done.phase, "complete");
  });

  it("15 — overlay is removed after completion (component returns null when inactive)", () => {
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.match(overlay, /if \(!launch\.active\) \{\s*return null;/);
  });

  it("16 — pointer-blocking layer is removed with overlay unmount", () => {
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.match(overlay, /pointerEvents:\s*"auto"/);
    assert.match(overlay, /return null/);
    const css = readWeb("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-launch\s*\{/);
  });

  it("17 — app usable before audio duration ends", () => {
    const visual = nominalLaunchVisualDurationMs(PWA_LAUNCH_TIMING);
    assert.ok(visual <= 5_600);
    assert.ok(visual < 8_440);
  });

  it("18 — audio allowed to continue after overlay removal", () => {
    const audio = readWeb("features/pwa/pwa-launch-audio.ts");
    assert.match(audio, /may outlive the visual overlay/);
    const hook = readWeb("features/pwa/use-pwa-launch-sequence.ts");
    assert.doesNotMatch(hook, /stopPwaLaunchAudio/);
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.doesNotMatch(overlay, /stopPwaLaunchAudio/);
  });

  it("19 — audio does not overlap/restart during route remount", async () => {
    let plays = 0;
    const createAudio = () =>
      ({
        play: async () => {
          plays += 1;
        },
        addEventListener() {},
        pause() {},
        removeAttribute() {},
        load() {},
        paused: true,
        currentTime: 0,
      }) as unknown as HTMLAudioElement;
    await attemptPwaLaunchAudio({ createAudio });
    await attemptPwaLaunchAudio({ createAudio });
    assert.equal(plays, 1);
  });

  it("20 — reduced-motion skips matrix", () => {
    const tick = advancePwaLaunchClock({
      elapsedMs: 40,
      revealElapsedMs: null,
      appReady: true,
      reducedMotion: true,
      timing: fastTiming,
    });
    assert.equal(tick.phase, "logo");
    assert.equal(tick.revealProgress, 1);
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.match(overlay, /!launch\.reducedMotion/);
  });

  it("21 — reduced-motion completes quickly", () => {
    const done = advancePwaLaunchClock({
      elapsedMs: fastTiming.reducedMotionMs,
      revealElapsedMs: null,
      appReady: false,
      reducedMotion: true,
      timing: fastTiming,
    });
    assert.equal(done.complete, true);
    assert.ok(fastTiming.reducedMotionMs <= 1_500);
    assert.ok(PWA_LAUNCH_TIMING.reducedMotionMs <= 1_500);
  });

  it("22 — offline/audio failure still completes", async () => {
    const createAudio = () => {
      throw new Error("offline");
    };
    await assert.doesNotReject(() => attemptPwaLaunchAudio({ createAudio }));
    const done = advancePwaLaunchClock({
      elapsedMs: nominalLaunchVisualDurationMs(fastTiming),
      revealElapsedMs: fastTiming.revealMs + fastTiming.finishingMs,
      appReady: true,
      reducedMotion: false,
      timing: fastTiming,
    });
    assert.equal(done.complete, true);
  });

  it("23 — orientation/resize updates canvas safely", () => {
    const canvas = readWeb("features/pwa/hu-matrix-reveal.tsx");
    assert.match(canvas, /orientationchange/);
    assert.match(canvas, /addEventListener\("resize"/);
    assert.match(canvas, /buildHuMatrixField/);
    assert.match(canvas, /devicePixelRatio/);
  });

  it("24 — no normal browser splash", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(shell, /standalone \? <PwaLaunchSequence/);
    assert.equal(PWA_LAUNCH_BACKDROP, "#f4f7fa");
  });

  it("25 — no Service Worker Push changes", () => {
    const sw = readPublic("sw.js");
    assert.doesNotMatch(sw, /hu-intro\.mp3/);
    assert.doesNotMatch(sw, /PwaLaunchSequence/);
    assert.doesNotMatch(sw, /hu\.pwa\.launch/);
  });

  it("26 — Pack 22B.1 regressions (badge + logout clear)", () => {
    const badge = readWeb("features/pwa/pwa-app-badge.ts");
    assert.match(badge, /syncPwaAppBadgeFromUnreadCount/);
    const authApi = readWeb("features/auth/auth-api.ts");
    assert.match(authApi, /clearPwaAppBadge/);
  });

  it("27 — Pack 22H regressions (standalone detection retained)", () => {
    const mode = readWeb("features/pwa/presentation-mode.ts");
    assert.match(mode, /isStandaloneDisplayMode/);
    assert.match(mode, /matchesInstalledDisplayMode/);
  });

  it("28 — PWA install/offline shell wiring retained", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(shell, /ServiceWorkerRegister/);
    assert.match(shell, /PwaBottomNav/);
    assert.match(shell, /PwaAppHeader/);
  });

  it("z-index above modal; logout stops audio; canvas rAF cleanup", () => {
    assert.ok(PWA_LAUNCH_Z_INDEX > 200);
    const authApi = readWeb("features/auth/auth-api.ts");
    assert.match(authApi, /stopPwaLaunchAudio/);
    const canvas = readWeb("features/pwa/hu-matrix-reveal.tsx");
    assert.match(canvas, /aria-hidden/);
    stopPwaLaunchAudio();
  });
});
