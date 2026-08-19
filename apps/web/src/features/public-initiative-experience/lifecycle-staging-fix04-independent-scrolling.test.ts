/**
 * Lifecycle Staging Fix 04 — independent desktop scrolling for canonical Initiative Experience.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

describe("Lifecycle Staging Fix 04 — independent desktop scrolling", () => {
  const css = read("./public-initiative-experience.css");
  const layout = read("./components/PublicCivicRecordExperienceLayout.tsx");
  const page = read("./components/PublicInitiativeExperiencePage.tsx");
  const discussion = read("./components/PublicDiscussionPanel.tsx");

  it("desktop: three panes each have independent vertical overflow", () => {
    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(css, /\.pie-layout__lifecycle,\s*\n\s*\.pie-layout__center,\s*\n\s*\.pie-layout__sidebar/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /overscroll-behavior:\s*contain/);
  });

  it("desktop: center scroll must not rely on sticky-only left sidebar", () => {
    // Left is a peer scroll pane, not the only sticky column.
    assert.match(layout, /pie-layout__lifecycle/);
    assert.match(layout, /pie-layout__center/);
    assert.match(layout, /pie-layout__sidebar/);
    assert.match(layout, /pie-layout__hero/);
    assert.match(css, /\.humanity-layout:has\(\.pie-page\)/);
    assert.match(css, /overflow:\s*hidden/);
  });

  it("mobile: restores single-page scroll and Hero → Lifecycle → Center order", () => {
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\.pie-layout__center\s*\{\s*display:\s*contents/);
    assert.match(css, /\.pie-layout__hero\s*\{[^}]*order:\s*1/s);
    assert.match(css, /\.pie-layout__lifecycle\s*\{[^}]*order:\s*2/s);
    assert.match(css, /\.pie-layout__center-body\s*\{[^}]*order:\s*3/s);
    assert.match(css, /\.pie-layout__sidebar\s*\{[^}]*order:\s*4/s);
    assert.match(css, /overflow:\s*visible/);
    assert.match(css, /max-height:\s*none/);
  });

  it("collaboration + comment deep-link targets remain in the same shell", () => {
    assert.match(discussion, /COLLABORATION_LIST_DOM_ID\s*=\s*"pie-collaboration-list"/);
    assert.match(discussion, /scrollIntoView/);
    assert.match(css, /#pie-collaboration-list/);
    assert.match(page, /filter=collaboration|#discussion|pie-collaboration-list/);
    assert.match(page, /focusDiscussionCommentId/);
  });

  it("does not invent a second Initiative shell or route", () => {
    assert.match(layout, /className="pie-page"/);
    assert.match(layout, /className="pie-layout"/);
    assert.doesNotMatch(layout, /pie-page--alt|SecondShell|duplicate-experience/);
    assert.doesNotMatch(page, /createPortal\(\s*<main/);
  });

  it("preserves Assistantshell mount on the shared page (no layout fork)", () => {
    assert.match(page, /PublicCivicRecordExperienceLayout/);
    assert.match(page, /PublicExperienceSidebarOrChannel/);
  });
});
