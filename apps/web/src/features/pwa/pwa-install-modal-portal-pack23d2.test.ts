/**
 * Pack 23D.2 — PWA install modal portal / viewport containment.
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

describe("Pack 23D.2 — install modal portal / viewport fix", () => {
  it("1–2 — modal portaled outside hu-pwa-install-column; no layout participation", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(guidance, /createPortal/);
    assert.match(guidance, /document\.body/);
    assert.match(guidance, /mounted/);
    assert.match(guidance, /hu-pwa-install-column > \* \{ position: relative \}/);
    // Promotion still mounts the component, but portal escapes the column DOM.
    assert.match(promo, /PwaInstallGuidance/);
    assert.match(promo, /hu-pwa-install-column/);
  });

  it("3–5 — backdrop fixed + covers viewport; dialog centered in viewport", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(
      css,
      /\.hu-pwa-ios-help\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*place-items:\s*center/s,
    );
    assert.match(css, /portaled to document\.body|fixed to viewport/i);
  });

  it("6–8 — width/height viewport-bounded; body scrolls internally", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /width:\s*min\(56rem,\s*calc\(100vw - 2rem\)\)/);
    assert.match(css, /max-width:\s*calc\(100vw - 2rem\)/);
    assert.match(css, /max-height:\s*min\(calc\(100dvh - 2rem\)/);
    assert.match(css, /\.hu-pwa-ios-help__body\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.hu-pwa-ios-help__dialog\s*\{[^}]*overflow:\s*hidden/s);
  });

  it("9–10 — top-right close always present without scrolling content", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /hu-pwa-ios-help__header/);
    assert.match(guidance, /Close installation guide/);
    assert.match(guidance, /hu-pwa-ios-help__close/);
    const css = read("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-ios-help__header\s*\{[^}]*flex-shrink:\s*0/s);
  });

  it("11–17 — backdrop closes from any empty area; inside dialog does not", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /handleOverlayClick|event\.target === event\.currentTarget/);
    assert.match(guidance, /hu-pwa-ios-help__backdrop[\s\S]*onClick=\{onClose\}/);
    assert.match(guidance, /stopDialogClickPropagation|stopPropagation/);
    assert.match(guidance, /hu-pwa-ios-help__card/);
    assert.match(guidance, /Android — Chrome/);
    assert.match(guidance, /iPhone \/ iPad — Safari/);
  });

  it("18–21 — Escape, focus trap, focus return, body scroll lock cleanup", () => {
    const guidance = read("features/pwa/components/PwaInstallGuidance.tsx");
    assert.match(guidance, /Escape/);
    assert.match(guidance, /trapTabKey/);
    assert.match(guidance, /previouslyFocused\.current\?\.focus/);
    assert.match(guidance, /document\.body\.style\.overflow\s*=\s*"hidden"/);
    assert.match(guidance, /previousOverflow/);
    assert.match(guidance, /document\.body\.style\.overflow\s*=\s*previousOverflow/);
  });

  it("22–23 — Home column overflow isolation; no horizontal overflow contract", () => {
    const css = read("features/pwa/pwa.css");
    assert.match(css, /\.hu-pwa-install-column\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.hu-pwa-install-column > \*\s*\{[^}]*position:\s*relative/s);
    assert.match(css, /\.hu-pwa-ios-help__body\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.match(css, /max-width:\s*calc\(100vw - 2rem\)/);
  });

  it("24 — Pack 23D.1 visibility logic unchanged", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /showInstallationGuide = !runningStandalone && !dismissed/);
    assert.match(promo, /showInstallAction = uxState === "install_available"/);
    assert.match(promo, /Installation guide/);
  });

  it("25 — install/launch wiring retained", () => {
    const promo = read("features/pwa/components/PwaInstallPromotion.tsx");
    assert.match(promo, /getDeferredInstallPrompt/);
    assert.match(promo, /Install Humanity Union/);
    const register = read("features/pwa/components/ServiceWorkerRegister.tsx");
    assert.match(register, /beforeinstallprompt/);
  });
});
