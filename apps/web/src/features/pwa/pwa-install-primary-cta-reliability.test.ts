/**
 * Persistent primary Install CTA + Installation guide (no Later / dismiss).
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

describe("PWA install — persistent primary Install CTA", () => {
  it("non-installed + BIP available → Install + guide; native prompt used", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /showInstallAction = !runningStandalone && !isIos/);
    assert.match(promo, /showInstallationGuide = !runningStandalone/);
    assert.match(promo, /handlePrimaryInstallCta/);
    assert.match(promo, /prompt\.prompt\(\)/);
    assert.match(promo, /install\.installCta/);
    assert.match(promo, /install\.installationGuide/);
    assert.doesNotMatch(promo, /install\.later/);
    assert.doesNotMatch(promo, /handleDismiss|dismissed|dismissInstallPromotion/);

    const prompt = { prompt: async () => undefined } as BeforeInstallPromptLike;
    assert.equal(
      resolvePwaInstallUxState({ standalone: false, deferredPrompt: prompt }),
      "install_available",
    );
  });

  it("non-installed + BIP unavailable → Install + guide; Install opens guidance", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(
      promo,
      /if \(prompt\) \{[\s\S]*prompt\.prompt\(\)[\s\S]*return;[\s\S]*\}[\s\S]*openDefaultGuide\(\)/s,
    );
    assert.match(promo, /onClick=\{openDefaultGuide\}/);
    assert.doesNotMatch(promo, /wasInstallPromotionDismissedRecently/);

    const noPrompt = resolvePwaInstallUxState({ standalone: false, deferredPrompt: null });
    assert.notEqual(noPrompt, "install_available");
    assert.notEqual(noPrompt, "already_installed");
  });

  it("Installation guide independently opens guidance; no Later action", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /install\.installationGuide/);
    assert.match(promo, /onClick=\{openDefaultGuide\}/);
    assert.doesNotMatch(promo, /install\.later/);
    assert.doesNotMatch(promo, /install\.hiddenStatus|install\.showOptions/);
  });

  it("old temporary dismissal does not hide the promotion", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.doesNotMatch(promo, /install-preference/);
    assert.doesNotMatch(promo, /dismissInstallPromotion|wasInstallPromotionDismissedRecently/);
    assert.doesNotMatch(promo, /setDismissed|dismissed/);
  });

  it("standalone → Install not offered; Open Workspace preserved", () => {
    assert.equal(
      resolvePwaInstallUxState({ standalone: true, deferredPrompt: null }),
      "already_installed",
    );
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /runningStandalone/);
    assert.match(promo, /install\.alreadyInstalled/);
    assert.match(promo, /install\.openWorkspace/);
    assert.match(promo, /showInstallAction = !runningStandalone && !isIos/);
    assert.match(promo, /showInstallationGuide = !runningStandalone/);
  });

  it("iOS fallback remains Add to Home Screen primary", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /showIosAction = isIos/);
    assert.match(promo, /install\.addToHomeScreen/);
    assert.match(promo, /openGuidance\("ios"\)/);
    assert.match(promo, /isIos = uxState === "ios_add_to_home"/);
    const installState = read("features/pwa/install-state.ts");
    assert.match(installState, /ios_add_to_home/);
    assert.match(installState, /isIosLikeDevice/);
  });
});
