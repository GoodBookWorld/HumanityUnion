/**
 * Step 15D.8A.1 — /member shrink-safe responsive contract.
 * Bare `1fr` grid tracks (= minmax(auto, 1fr)) let min-content children
 * widen document.scrollWidth past the PWA viewport on first open.
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

describe("Member profile responsive overflow (15D.8A.1)", () => {
  it("member-workspace mobile tracks use minmax(0, 1fr), not bare 1fr", () => {
    const css = read("components/member/member-workspace.css");
    assert.match(
      css,
      /@media \(max-width:\s*1024px\)[\s\S]*?\.member-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    assert.match(
      css,
      /\.member-workspace__content-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    assert.doesNotMatch(
      css,
      /@media \(max-width:\s*1024px\)[\s\S]*?\.member-workspace\s*\{[^}]*grid-template-columns:\s*1fr\s*;/,
    );
  });

  it("workspace page + layout main are shrink-safe", () => {
    const layout = read("design-system/layout.css");
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(layout, /\.humanity-layout\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(layout, /\.humanity-layout__main\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(layout, /\.humanity-layout__main\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(
      layout,
      /\.humanity-workspace-page\s*\{[\s\S]*?max-width:\s*min\(100%,\s*var\(--hu-workspace-max-width\)\)/,
    );
    assert.match(layout, /\.humanity-workspace-page\s*\{[\s\S]*?min-width:\s*0/);
  });

  it("member profile workspace and profile-section keep max-width/min-width contract", () => {
    const profile = read("features/member-profile/components/member-profile-workspace.css");
    const section = read("components/member/profile-section.css");
    assert.match(profile, /\.member-profile-workspace\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(profile, /\.member-profile-workspace\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(section, /\.profile-section\s*\{[\s\S]*?min-width:\s*0/);
    assert.match(section, /\.profile-section\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(
      profile,
      /\.humanity-app--pwa-standalone \.member-profile-workspace/,
    );
  });

  it("does not rely on blanket html/body overflow-x hiding", () => {
    const layout = read("design-system/layout.css");
    const member = read("components/member/member-workspace.css");
    const profile = read("features/member-profile/components/member-profile-workspace.css");
    for (const css of [layout, member, profile]) {
      assert.doesNotMatch(css, /^(html|body)\s*\{[^}]*overflow-x:\s*hidden/m);
      assert.doesNotMatch(css, /\bhtml\s*,\s*body\s*\{[^}]*overflow-x:\s*hidden/s);
    }
  });

  it("assistant launcher wraps multilingual labels instead of widening the page", () => {
    const assistant = read("features/humanity-union-assistant/humanity-union-assistant.css");
    assert.match(
      assistant,
      /\.hu-assistant-open-button__label[\s\S]*?white-space:\s*normal/,
    );
    assert.match(
      assistant,
      /\.hu-assistant-open-button__label[\s\S]*?overflow-wrap:\s*anywhere/,
    );
    assert.match(assistant, /\.hu-assistant-open-button\s*\{[\s\S]*?max-width:\s*100%/);
    assert.match(assistant, /\.hu-assistant-surface-entry\s*\{[\s\S]*?min-width:\s*0/);
    assert.doesNotMatch(
      assistant,
      /\.hu-assistant-open-button__label\s*\{[^}]*white-space:\s*nowrap/s,
    );
  });

  it("multilingual /member shrink contract has no locale-specific width branches", () => {
    const profile = read("features/member-profile/components/member-profile-workspace.css");
    const member = read("components/member/member-workspace.css");
    const assistant = read("features/humanity-union-assistant/humanity-union-assistant.css");
    for (const css of [profile, member, assistant]) {
      assert.doesNotMatch(css, /\[lang=["'](?:uk|ka|ar|he|zh)/);
      assert.doesNotMatch(css, /:lang\(/);
      assert.doesNotMatch(css, /dir=["']rtl["'][^{]*\{[^}]*width/s);
    }
    assert.match(member, /\.member-workspace__title[\s\S]*?overflow-wrap:\s*anywhere/);
    assert.match(profile, /\.member-profile-workspace__checkbox[\s\S]*?min-width:\s*0/);
  });

  it("RTL member profile reuses the same physical shrink contract", () => {
    const profile = read("features/member-profile/components/member-profile-workspace.css");
    const section = read("components/member/profile-section.css");
    assert.match(profile, /max-width:\s*100%/);
    assert.match(section, /box-sizing:\s*border-box/);
    // Logical geometry only — no physical left/right width hacks for RTL locales.
    assert.doesNotMatch(profile, /\[dir=["']rtl["']\][^{]*\{[^}]*(?:width|margin-left|left):/s);
  });
});
