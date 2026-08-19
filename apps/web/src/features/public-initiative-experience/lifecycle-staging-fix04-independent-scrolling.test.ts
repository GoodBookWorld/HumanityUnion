/**
 * Lifecycle Staging Fix 04 — independent desktop scrolling regressions,
 * updated by Fix 05: natural page/footer flow; hero above columns.
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

  it("desktop: does not lock document scroll via :has(.pie-page) viewport box", () => {
    assert.doesNotMatch(css, /\.humanity-layout:has\(\.pie-page\)/);
    assert.doesNotMatch(css, /height:\s*100dvh/);
    assert.doesNotMatch(css, /\.pie-page\s*\{[^}]*overflow-y:\s*hidden/s);
  });

  it("desktop: left Lifecycle may stick under header without trapping center/right panes", () => {
    assert.match(layout, /pie-layout__lifecycle/);
    assert.match(layout, /pie-layout__center/);
    assert.match(layout, /pie-layout__sidebar/);
    assert.match(css, /\.pie-layout__lifecycle\s*\{[^}]*position:\s*sticky/s);
    assert.doesNotMatch(
      css,
      /\.pie-layout__lifecycle,\s*\n\s*\.pie-layout__center,\s*\n\s*\.pie-layout__sidebar\s*\{[^}]*overflow-y:\s*auto/s,
    );
  });

  it("mobile: single-page scroll; no independent three-pane overflow traps", () => {
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /max-height:\s*none/);
    assert.match(css, /overflow:\s*visible/);
    assert.match(css, /\.pie-layout__lifecycle\s*\{[^}]*position:\s*static/s);
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
    assert.match(layout, /pie-layout/);
    assert.doesNotMatch(layout, /pie-page--alt|SecondShell|duplicate-experience/);
    assert.doesNotMatch(page, /createPortal\(\s*<main/);
  });

  it("preserves Assistantshell mount on the shared page (no layout fork)", () => {
    assert.match(page, /PublicCivicRecordExperienceLayout/);
    assert.match(page, /PublicExperienceSidebarOrChannel/);
  });
});
