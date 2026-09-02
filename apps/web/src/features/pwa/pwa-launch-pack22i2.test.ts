/**
 * Pack 22I.2 — first-paint fix + interactive logo audio + expanded emoji.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BLOG_EMOJI_CATEGORIES,
  BLOG_EMOJI_CATEGORY_COUNT,
} from "../blog/blog-emoji-palette.js";
import {
  attemptPwaLaunchAudio,
  getPwaLaunchAudioStatus,
  playPwaLaunchAudioFromUserGesture,
  resetPwaLaunchAudioForTests,
  stopPwaLaunchAudio,
} from "./pwa-launch-audio.js";
import { advancePwaLaunchClock } from "./pwa-launch-clock.js";
import { PWA_LAUNCH_TIMING } from "./pwa-launch-constants.js";
import { PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP } from "./pwa-launch-first-paint-bootstrap.js";
import {
  clearPwaLaunchFirstPaintPending,
  getPwaLaunchPendingHtmlClass,
} from "./pwa-launch-first-paint.js";
import { PWA_LAUNCH_SESSION_KEY } from "./pwa-launch-constants.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrcRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrcRoot, relativePath), "utf8");
}

function notAllowedAudio() {
  return {
    play: async () => {
      const error = new Error("blocked");
      error.name = "NotAllowedError";
      throw error;
    },
    addEventListener() {},
    pause() {},
    removeAttribute() {},
    load() {},
    paused: true,
    currentTime: 0,
  } as unknown as HTMLAudioElement;
}

describe("Pack 22I.2 — first paint + interactive logo audio + emoji", () => {
  beforeEach(() => {
    resetPwaLaunchAudioForTests();
  });

  it("installed PWA cold launch covers app before launch surface (bootstrap + sync shell)", () => {
    const layout = readWeb("app/layout.tsx");
    const globals = readWeb("app/globals.css");
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(layout, /PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP/);
    assert.match(globals, /hu-pwa-launch-pending/);
    assert.match(globals, /#f4f7fa/);
    assert.match(shell, /useState<HuPresentationMode>\(\(\) => resolvePresentationMode\(\)\)/);
    assert.match(PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP, /hu\.pwa\.launch\.v1/);
    assert.match(PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP, /hu-pwa-launch-pending/);
    assert.match(PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP, /7000/);
    assert.equal(getPwaLaunchPendingHtmlClass(), "hu-pwa-launch-pending");
    assert.equal(typeof clearPwaLaunchFirstPaintPending, "function");
  });

  it("browser tab does not receive the launch cover bootstrap class without standalone", () => {
    assert.match(PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP, /display-mode: standalone/);
    assert.match(PWA_LAUNCH_FIRST_PAINT_BOOTSTRAP, /if \(!standalone\) return/);
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(shell, /standalone \? <PwaLaunchSequence/);
  });

  it("session guard + no client navigation replay remain valid", () => {
    assert.equal(PWA_LAUNCH_SESSION_KEY, "hu.pwa.launch.v1");
    const hook = readWeb("features/pwa/use-pwa-launch-sequence.ts");
    assert.match(hook, /markPwaLaunchPlayedThisSession/);
    assert.match(hook, /claimedRef/);
  });

  it("fail-safe still removes overlay", () => {
    const done = advancePwaLaunchClock({
      elapsedMs: PWA_LAUNCH_TIMING.failSafeMs,
      revealElapsedMs: null,
      appReady: false,
      reducedMotion: false,
      timing: { ...PWA_LAUNCH_TIMING },
    });
    assert.equal(done.complete, true);
    assert.equal(done.overlayOpacity, 0);
  });

  it("autoplay success → logo remains decorative (no Sound fallback)", async () => {
    await attemptPwaLaunchAudio({
      createAudio: () =>
        ({
          play: async () => undefined,
          addEventListener() {},
          pause() {},
          removeAttribute() {},
          load() {},
          paused: false,
          currentTime: 0,
        }) as unknown as HTMLAudioElement,
    });
    assert.equal(getPwaLaunchAudioStatus(), "playing");
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    assert.match(overlay, /gesture_required/);
    assert.match(overlay, /playIntroSound/);
  });

  it("autoplay rejection → gesture_required status for interactive logo", async () => {
    const status = await attemptPwaLaunchAudio({ createAudio: notAllowedAudio });
    assert.equal(status, "gesture_required");
    assert.equal(getPwaLaunchAudioStatus(), "gesture_required");
  });

  it("interactive logo has accessible Sound semantics in overlay", () => {
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    const css = readWeb("features/pwa/pwa.css");
    assert.match(overlay, /playIntroSound/);
    assert.match(overlay, /hu-pwa-launch__logo-sound/);
    assert.match(overlay, /type="button"/);
    assert.match(css, /hu-pwa-launch__logo-sound:focus-visible/);
    assert.match(css, /min-width:\s*44px/);
  });

  it("tap retries same audio instance; success clears gesture state; no duplicates", async () => {
    let instances = 0;
    let plays = 0;
    let allowPlay = false;
    const createAudio = () => {
      instances += 1;
      return {
        play: async () => {
          plays += 1;
          if (!allowPlay) {
            const error = new Error("blocked");
            error.name = "NotAllowedError";
            throw error;
          }
        },
        addEventListener() {},
        pause() {},
        removeAttribute() {},
        load() {},
        paused: true,
        currentTime: 0,
      } as unknown as HTMLAudioElement;
    };

    await attemptPwaLaunchAudio({ createAudio });
    assert.equal(getPwaLaunchAudioStatus(), "gesture_required");
    assert.equal(instances, 1);
    assert.equal(plays, 1);

    allowPlay = true;
    const ok = await playPwaLaunchAudioFromUserGesture();
    assert.equal(ok, true);
    assert.equal(getPwaLaunchAudioStatus(), "playing");
    assert.equal(instances, 1);
    assert.equal(plays, 2);

    await playPwaLaunchAudioFromUserGesture();
    assert.equal(plays, 2);
  });

  it("audio failure never blocks launch clock", async () => {
    await attemptPwaLaunchAudio({ createAudio: notAllowedAudio });
    const mid = advancePwaLaunchClock({
      elapsedMs: 2000,
      revealElapsedMs: 500,
      appReady: true,
      reducedMotion: false,
      timing: { ...PWA_LAUNCH_TIMING },
    });
    assert.equal(mid.phase, "reveal");
    assert.equal(mid.complete, false);
  });

  it("overlay disappearance removes unused Sound opportunity (no Workspace control)", () => {
    const overlay = readWeb("features/pwa/components/PwaLaunchSequence.tsx");
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    assert.match(overlay, /if \(!launch\.active\) \{\s*return null;/);
    assert.doesNotMatch(shell, /playIntroSound|hu-pwa-launch__logo-sound/);
  });

  it("logout cleanup remains wired", () => {
    const authApi = readWeb("features/auth/auth-api.ts");
    assert.match(authApi, /stopPwaLaunchAudio/);
    stopPwaLaunchAudio();
  });

  it("expanded emoji categories exist with curated multi-codepoint entries", () => {
    assert.equal(BLOG_EMOJI_CATEGORY_COUNT, 10);
    assert.equal(BLOG_EMOJI_CATEGORIES.length, 10);
    const ids = BLOG_EMOJI_CATEGORIES.map((c) => c.id);
    for (const id of [
      "smileys",
      "gestures",
      "hearts",
      "nature",
      "food",
      "activities",
      "travel",
      "objects",
      "civic",
      "flags",
    ]) {
      assert.ok(ids.includes(id), id);
    }
    const all = BLOG_EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    assert.ok(all.includes("😀"));
    assert.ok(all.includes("🗳️"));
    assert.ok(all.includes("🇺🇳"));
    assert.ok(all.includes("🏳️‍🌈"));
    assert.ok(all.includes("🧑‍🤝‍🧑"));
    assert.ok(all.includes("🖥️"));
    // Insertion path remains writer.insertText of full palette strings.
    const plugin = readWeb("features/blog/blog-emoji-plugin.ts");
    assert.match(plugin, /writer\.insertText\(emoji/);
    assert.match(plugin, /button\.dataset\.emoji = emoji/);
  });

  it("emoji panel remains scrollable / mobile-usable without giant modal", () => {
    const css = readWeb("features/blog/publishing.css");
    assert.match(css, /\.blog-ck-emoji-panel__grid/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /max-height:\s*min\(/);
    assert.match(css, /min-height:\s*2rem/);
  });

  it("Unicode palette expansion does not require sanitizer changes", () => {
    // Source contract: sanitizer still escapes text nodes; palette is plain Unicode only.
    const sanitize = readFileSync(
      path.resolve(webSrcRoot, "../../api/src/modules/blog/blog-content-sanitize.ts"),
      "utf8",
    );
    assert.doesNotMatch(sanitize, /blog-emoji-palette|BLOG_EMOJI/);
    assert.match(sanitize, /escapeText|normalizeBlogNbspArtifacts/);
  });
});
