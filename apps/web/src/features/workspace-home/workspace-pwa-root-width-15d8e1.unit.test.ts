/**
 * Step 15D.8E.1 — PWA / Workspace Home root width shrink-safe contract.
 *
 * Root cause: shared shell geometry (layout + member-workspace grid +
 * post-hydration-only standalone body class), not per-card text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Workspace PWA root width (15D.8E.1)", () => {
  it("1 — root layout chain is shrink-safe", () => {
    const layout = read("design-system/layout.css");
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?width:\s*100%/);
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?box-sizing:\s*border-box/);
    assert.match(layout, /\.humanity-layout__main\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(layout, /\.humanity-layout__main\s*\{[\s\S]*?max-width:\s*100%/);
  });

  it("2 — workspace page width/max-width/min-width contract is unified", () => {
    const layout = read("design-system/layout.css");
    const page = read("app/workspace/workspace-page.css");
    for (const css of [layout, page]) {
      assert.match(
        css,
        /\.(?:humanity-)?workspace-page\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--hu-workspace-max-width\)\)/,
      );
      assert.match(
        css,
        /\.(?:humanity-)?workspace-page\s*\{[\s\S]*?max-width:\s*min\(100%,\s*var\(--hu-workspace-max-width\)\)/,
      );
      assert.match(css, /\.(?:humanity-)?workspace-page\s*\{[\s\S]*?min-width:\s*0/);
      assert.match(css, /\.(?:humanity-)?workspace-page\s*\{[\s\S]*?box-sizing:\s*border-box/);
    }
    assert.match(page, /\.workspace-page\s*\{[\s\S]*?padding-inline:\s*max\(/);
    assert.match(layout, /\.humanity-workspace-page\s*\{[\s\S]*?padding-inline:\s*max\(/);
    assert.match(page, /safe-area-inset-left/);
    assert.match(layout, /safe-area-inset-right/);
  });

  it("3 — member-workspace base grid uses shrink-safe sidebar track", () => {
    const css = read("components/member/member-workspace.css");
    assert.match(
      css,
      /\.member-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*var\(--hu-sidebar-width\)\)\s+minmax\(0,\s*1fr\)/,
    );
    assert.doesNotMatch(
      css,
      /\.member-workspace\s*\{[^}]*grid-template-columns:\s*var\(--hu-sidebar-width\)\s+minmax/s,
    );
  });

  it("4 — assistant/content-grid cannot establish excess document min-width", () => {
    const css = read("components/member/member-workspace.css");
    assert.match(
      css,
      /\.member-workspace__content-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*var\(--hu-initiative-sidebar-width\)\)/,
    );
    assert.doesNotMatch(css, /minmax\(260px,\s*var\(--hu-initiative-sidebar-width\)\)/);
    assert.match(
      css,
      /\.member-workspace__header--with-assistant\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*22rem\)/,
    );
    assert.doesNotMatch(css, /minmax\(14rem,\s*22rem\)/);
  });

  it("5 — standalone critical geometry via display-mode (not useEffect-only)", () => {
    const safe = read("features/pwa/pwa-safe-area.css");
    const shell = read("features/pwa/components/PwaShell.tsx");
    assert.match(safe, /@media\s*\(display-mode:\s*standalone\)/);
    assert.match(safe, /display-mode:\s*minimal-ui/);
    assert.match(safe, /display-mode:\s*window-controls-overlay/);
    assert.match(
      safe,
      /@media\s*\(display-mode:\s*standalone\)[\s\S]*?\.member-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    assert.match(
      safe,
      /@media\s*\(display-mode:\s*standalone\)[\s\S]*?\.member-workspace__content-grid\s*\{[\s\S]*?minmax\(0,\s*1fr\)/,
    );
    // Body class still present for legacy iOS navigator.standalone after hydration.
    assert.match(shell, /humanity-app--pwa-standalone/);
    assert.match(shell, /useEffect/);
    assert.match(safe, /\.humanity-app--pwa-standalone \.member-workspace/);
  });

  it("6 — no blanket html/body overflow-x hiding", () => {
    const files = [
      "design-system/layout.css",
      "app/workspace/workspace-page.css",
      "components/member/member-workspace.css",
      "features/pwa/pwa-safe-area.css",
      "app/globals.css",
    ];
    for (const rel of files) {
      const css = read(rel);
      assert.doesNotMatch(css, /^(html|body)\s*\{[^}]*overflow-x:\s*hidden/m);
      assert.doesNotMatch(css, /\bhtml\s*,\s*body\s*\{[^}]*overflow-x:\s*hidden/s);
      assert.doesNotMatch(css, /\bhtml\s*\{[^}]*overflow-x:\s*hidden/s);
      assert.doesNotMatch(css, /\bbody\s*\{[^}]*overflow-x:\s*hidden/s);
    }
  });

  it("7–8 — 320px / 390px contracts rely on mobile + standalone single-column tracks", () => {
    const member = read("components/member/member-workspace.css");
    const safe = read("features/pwa/pwa-safe-area.css");
    assert.match(
      member,
      /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.member-workspace\s*\{[\s\S]*?minmax\(0,\s*1fr\)/,
    );
    assert.match(
      safe,
      /@media\s*\(display-mode:\s*standalone\)[\s\S]*?\.member-workspace\s*\{[\s\S]*?minmax\(0,\s*1fr\)/,
    );
    // No language-specific or reload/resize/timeout geometry hacks.
    for (const css of [member, safe]) {
      assert.doesNotMatch(css, /setTimeout|location\.reload|window\.resize/);
      assert.doesNotMatch(css, /\[lang=/);
      assert.doesNotMatch(css, /:lang\(/);
    }
  });

  it("9–11 — English / long content / RTL share the same physical shrink contract", () => {
    const member = read("components/member/member-workspace.css");
    const layout = read("design-system/layout.css");
    const page = read("app/workspace/workspace-page.css");
    const section = read("components/member/profile-section.css");
    for (const css of [member, layout, page, section]) {
      assert.doesNotMatch(css, /\[lang=["'](?:uk|ka|ar|he|zh)/);
      assert.doesNotMatch(css, /:lang\(/);
      assert.doesNotMatch(css, /\[dir=["']rtl["']\][^{]*\{[^}]*(?:width|margin-left|left):/s);
    }
    assert.match(member, /overflow-wrap:\s*anywhere/);
    assert.match(section, /min-width:\s*0/);
    assert.match(section, /max-width:\s*100%/);
    assert.match(section, /overflow-wrap:\s*anywhere/);
  });

  it("12–14 — Workspace Home card surfaces remain shrink-bounded (not clipped)", () => {
    const welcome = read("features/workspace-home/components/workspace-welcome-banner.css");
    const personal = read("features/workspace-home/components/workspace-personal-header.css");
    const section = read("components/member/profile-section.css");
    // Cards inherit shell width; profile-section is the shared card chrome.
    assert.match(section, /\.profile-section\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(section, /\.profile-section\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(welcome, /\.workspace-welcome-banner__body\s*\{[\s\S]*?min-width:\s*0/);
    // No card-level overflow-x clipping as a width "fix".
    assert.doesNotMatch(section, /\.profile-section\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.doesNotMatch(personal, /\.workspace-personal-header\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.doesNotMatch(welcome, /\.workspace-welcome-banner\s*\{[^}]*overflow-x:\s*hidden/s);
  });

  it("15–17 — does not regress /member, language selector, or civic-activity contracts", () => {
    const memberOverflow = read("features/member-profile/member-profile-responsive-overflow.test.ts");
    const langVisual = read(
      "features/language/language-selector-visual-restoration.unit.test.ts",
    );
    const civic = read("features/civic-activity/civic-activity-visual-statistics-15d8c.unit.test.ts");
    assert.match(memberOverflow, /15D\.8A\.1/);
    assert.match(langVisual, /describe\(/);
    assert.match(civic, /15D\.8C/);
    // This change must not introduce card-by-card clipping.
    const changed = [
      read("design-system/layout.css"),
      read("app/workspace/workspace-page.css"),
      read("components/member/member-workspace.css"),
      read("features/pwa/pwa-safe-area.css"),
    ].join("\n");
    assert.doesNotMatch(changed, /\.profile-section\s*\{[^}]*overflow-x:\s*hidden/s);
    assert.doesNotMatch(changed, /\.workspace-welcome-banner\s*\{[^}]*overflow-x:\s*hidden/s);
  });
});
