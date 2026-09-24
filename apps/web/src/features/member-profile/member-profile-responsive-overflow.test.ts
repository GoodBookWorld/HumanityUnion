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
});
