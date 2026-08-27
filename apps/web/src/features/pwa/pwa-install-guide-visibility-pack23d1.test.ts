/**
 * Pack 23D.1 — PWA install guide visibility + modal usability.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolvePwaInstallUxState,
  type BeforeInstallPromptLike,
} from "./install-state.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 23D.1 — install guide visibility + modal usability", () => {
  it("1–3 — guide visible without beforeinstallprompt (Incognito / unsupported)", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /showInstallationGuide/);
    assert.match(promo, /!runningStandalone && !dismissed/);
    assert.match(promo, /Installation guide/);
    assert.match(promo, /beforeinstallprompt is absent|does not depend on beforeinstallprompt|must not depend on beforeinstallprompt/i);

    const noPrompt = resolvePwaInstallUxState({ standalone: false, deferredPrompt: null });
    assert.ok(
      noPrompt === "unsupported" || noPrompt === "browser_mode" || noPrompt === "ios_add_to_home",
      `expected non-prompt browser state, got ${noPrompt}`,
    );
    assert.notEqual(noPrompt, "install_available");
    assert.notEqual(noPrompt, "already_installed");
  });

  it("4–5 — Install button only when prompt exists; guide independent of prompt", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /showInstallAction = uxState === "install_available"/);
    assert.match(
      promo,
      /showInstallationGuide = !runningStandalone && !dismissed/,
    );
    assert.doesNotMatch(
      promo,
      /showInstallationGuide\s*=\s*[^\n]*install_available/,
    );

    const prompt = { prompt: async () => undefined } as BeforeInstallPromptLike;
    assert.equal(
      resolvePwaInstallUxState({ standalone: false, deferredPrompt: prompt }),
      "install_available",
    );
  });

  it("6 — standalone does not show install guide CTAs", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /runningStandalone \? \(/);
    assert.match(promo, /Open Workspace/);
    assert.equal(
      resolvePwaInstallUxState({ standalone: true, deferredPrompt: null }),
      "already_installed",
    );
  });

  it("7–8 — backdrop click closes; inside-content click does not", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /handleOverlayClick|event\.target === event\.currentTarget/);
    assert.match(guidance, /stopDialogClickPropagation|stopPropagation/);
    assert.match(guidance, /hu-pwa-ios-help__backdrop/);
    assert.match(guidance, /onClick=\{onClose\}/);
  });

  it("9–10 — Escape closes; focus returns to opener", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Escape/);
    assert.match(guidance, /trapTabKey/);
    assert.match(guidance, /previouslyFocused\.current\?\.focus/);
  });

  it("11–13 — modal width increased; viewport-bounded; internal scroll", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /width:\s*min\(56rem,\s*calc\(100vw - 2rem\)\)/);
    assert.match(css, /max-width:\s*calc\(100vw - 2rem\)/);
    assert.match(css, /max-height:\s*min\(calc\(100dvh - 2rem\)/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.doesNotMatch(css, /width:\s*min\(40rem/);
  });

  it("14–16 — Android / iOS / badge note preserved", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Android — Chrome/);
    assert.match(guidance, /iPhone \/ iPad — Safari/);
    assert.match(guidance, /Notification and app-icon badge behavior depends on your device/);
    assert.match(guidance, /Close installation guide/);
  });

  it("17–18 — Pack 23D / install regressions retained", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /getDeferredInstallPrompt/);
    assert.match(promo, /Install Humanity Union/);
    assert.match(promo, /Later/);
    assert.match(promo, /PwaInstallGuidance/);
    const preference = read("features/pwa/install-preference.ts");
    assert.match(preference, /catch \{/);
    assert.match(preference, /Private \/ restricted storage/);
  });
});
