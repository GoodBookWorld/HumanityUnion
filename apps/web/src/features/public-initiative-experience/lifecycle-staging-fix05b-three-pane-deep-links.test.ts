/**
 * Lifecycle Staging Fix 05B — three-pane desktop scroll + header-safe deep links.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  COLLABORATION_LIST_DOM_ID,
  DISCUSSION_TITLE_DOM_ID,
  planCollaborationNotificationScroll,
} from "./discussion-comment-deep-link.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readLocal(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Lifecycle Staging Fix 05B — columns scroll + header-safe deep links", () => {
  const layout = readLocal("./components/PublicCivicRecordExperienceLayout.tsx");
  const css = readLocal("./public-initiative-experience.css");
  const discussion = readLocal("./components/PublicDiscussionPanel.tsx");
  const openButton = readWeb(
    "features/humanity-union-assistant/components/HumanityUnionAssistantOpenButton.tsx",
  );

  it("hero remains outside pie-layout__columns", () => {
    const heroIndex = layout.indexOf('className="pie-layout__hero"');
    const columnsIndex = layout.indexOf('className="pie-layout pie-layout__columns"');
    assert.ok(heroIndex >= 0, "hero wrapper missing");
    assert.ok(columnsIndex >= 0, "columns wrapper missing");
    assert.ok(columnsIndex > heroIndex, "hero must precede columns");
    const centerBlock = layout.slice(
      layout.indexOf('className="pie-layout__center"'),
      layout.indexOf("pie-layout__sidebar"),
    );
    assert.doesNotMatch(centerBlock, /pie-layout__hero/);
  });

  it("document scrolling remains enabled (no page lock)", () => {
    assert.doesNotMatch(css, /\.humanity-layout:has\(\.pie-page\)/);
    assert.doesNotMatch(css, /\.pie-page\s*\{[^}]*overflow-y:\s*hidden/s);
  });

  it("desktop columns use viewport-relative height; panes overflow independently", () => {
    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(
      css,
      /\.pie-layout\.pie-layout__columns\s*\{[^}]*height:\s*calc\(100dvh - var\(--humanity-header-offset\)\)/s,
    );
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /overscroll-behavior:\s*contain/);
    assert.match(css, /min-height:\s*0/);
  });

  it("mobile clears pane overflow traps for normal page scroll", () => {
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\.pie-layout\.pie-layout__columns\s*\{[^}]*height:\s*auto/s);
    assert.match(css, /overflow:\s*visible/);
  });

  it("Discussion / Collaboration / comment targets use header scroll-margin", () => {
    assert.match(css, /#pie-discussion-title/);
    assert.match(css, /\.pie-discussion__title/);
    assert.match(css, /#pie-collaboration-list/);
    assert.match(css, /\.pie-discussion__comment-card\s*\{[^}]*scroll-margin-top:\s*var\(--hu-scroll-margin-top\)/s);
    assert.match(css, /scroll-margin-top:\s*var\(--hu-scroll-margin-top\)/);
  });

  it("collaboration notification scroll keeps Discussion title visible then list nearest", () => {
    const plan = planCollaborationNotificationScroll();
    assert.equal(plan.titleDomId, DISCUSSION_TITLE_DOM_ID);
    assert.equal(plan.listDomId, COLLABORATION_LIST_DOM_ID);
    assert.equal(plan.titleBlock, "start");
    assert.equal(plan.listBlock, "nearest");
    assert.match(discussion, /planCollaborationNotificationScroll/);
    assert.match(discussion, /titleBlock/);
    assert.match(discussion, /listBlock/);
  });

  it("Ask Assistant remains horizontal 28x28 intel icon", () => {
    assert.match(openButton, /\/icons\/workspace\/intel\.webp/);
    assert.match(openButton, /width=\{28\}/);
    assert.match(openButton, /height=\{28\}/);
    assert.match(openButton, /hu-assistant-open-button/);
  });
});
