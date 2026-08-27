/**
 * Pack 23D — PWA install help modal for Android + iPhone/iPad.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 23D — PWA install help modal (Android + iOS)", () => {
  it("1 — modal title updated", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Install Humanity Union App/);
    assert.match(
      guidance,
      /Add Humanity Union to your Home Screen for faster access and an app-like experience/,
    );
  });

  it("2 — modal supports Android instructions", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Android — Chrome/);
    assert.match(guidance, /titleId\}-android/);
  });

  it("3 — modal supports iOS/iPadOS instructions", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /iPhone \/ iPad — Safari/);
    assert.match(guidance, /titleId\}-ios/);
  });

  it("4 — Android Chrome steps present", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Open Humanity Union in Chrome/);
    assert.match(guidance, /browser menu \(⋮\)/);
    assert.match(guidance, /Install app/);
    assert.match(guidance, /Add to Home screen/);
    assert.match(guidance, /Confirm installation/);
  });

  it("5 — iOS Safari Share → Add to Home Screen steps present", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Open Humanity Union in Safari/);
    assert.match(guidance, /Share button/);
    assert.match(guidance, /Add to Home Screen/);
    assert.match(guidance, /must be done from Safari/);
  });

  it("6 — notification/badge limitation note present", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(
      guidance,
      /Notification and app-icon badge behavior depends on your device/,
    );
    assert.match(guidance, /Allow notifications when prompted/);
  });

  it("7 — no numeric badge guarantee", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.doesNotMatch(guidance, /numeric badge|always shows a badge|guarantees? a badge/i);
    assert.doesNotMatch(guidance, /Web Push|PushManager|VAPID/);
  });

  it("8 — already-installed state behaves correctly", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /alreadyInstalled/);
    assert.match(guidance, /already installed on this device/);
    assert.match(guidance, /Open Workspace/);
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /already installed on this device/);
    assert.match(promo, /href="\/workspace"/);
  });

  it("9 — beforeinstallprompt flow preserved", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /getDeferredInstallPrompt/);
    assert.match(promo, /prompt\.prompt\(\)/);
    assert.match(promo, /Install Humanity Union/);
    const register = read("features/pwa/components/ServiceWorkerRegister.tsx");
    assert.match(register, /beforeinstallprompt/);
  });

  it("10 — fallback manual instructions work", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /How to install|Installation guide/);
    assert.match(promo, /openGuidance\("browser"\)|openGuidance\("android"\)|openGuidance\("ios"\)/);
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /hu-pwa-ios-help__platforms/);
  });

  it("11 — modal size/scroll contract", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-ios-help__dialog\s*\{[^}]*width:\s*min\(56rem/s);
    assert.match(css, /\.hu-pwa-ios-help__dialog\s*\{[^}]*max-height:\s*min\(calc\(100dvh/s);
    assert.match(css, /\.hu-pwa-ios-help__body\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it("12 — responsive stacking", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(
      css,
      /\.hu-pwa-ios-help__platforms\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );
    assert.match(
      css,
      /@media \(min-width:\s*720px\)[\s\S]*\.hu-pwa-ios-help__platforms\s*\{[^}]*grid-template-columns:\s*repeat\(2/s,
    );
  });

  it("13 — dialog accessibility", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /role="dialog"/);
    assert.match(guidance, /aria-modal="true"/);
    assert.match(guidance, /aria-labelledby=\{titleId\}/);
    assert.match(guidance, /Escape/);
    assert.match(guidance, /trapTabKey/);
    assert.match(guidance, /<ol>/);
    assert.match(guidance, /Close installation guide/);
  });

  it("14 — no manifest/SW/Push changes", () => {
    const manifest = read("app/manifest.ts");
    assert.match(manifest, /display:\s*"standalone"/);
    assert.doesNotMatch(manifest, /PushManager|VAPID/);
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.doesNotMatch(guidance, /service worker|manifest\.webmanifest/i);
  });

  it("15 — existing PWA install regressions remain green", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /resolvePwaInstallUxState/);
    assert.match(promo, /Later/);
    assert.match(promo, /PwaInstallGuidance/);
    assert.match(promo, /hu-pwa-install-column/);
  });
});
