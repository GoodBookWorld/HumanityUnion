/**
 * Lifecycle Staging Fix 05C — center-pane deep-link ownership + footer scroll chaining.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CENTER_SCROLL_CONTAINER_SELECTOR,
  COLLABORATION_LIST_DOM_ID,
  DISCUSSION_TITLE_DOM_ID,
  planCollaborationNotificationScroll,
  resolveDiscussionDeepLinkScrollOwner,
  scrollElementWithinContainer,
} from "./discussion-comment-deep-link.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

describe("Lifecycle Staging Fix 05C — deep-link scroll ownership + footer handoff", () => {
  const css = read("./public-initiative-experience.css");
  const layout = read("./components/PublicCivicRecordExperienceLayout.tsx");
  const page = read("./components/PublicInitiativeExperiencePage.tsx");
  const discussion = read("./components/PublicDiscussionPanel.tsx");
  const deepLink = read("./discussion-comment-deep-link.ts");

  it("desktop collaboration deep-link is owned by pie-layout__center, not the document", () => {
    const desktop = planCollaborationNotificationScroll({ viewportWidth: 1200 });
    assert.equal(desktop.scrollOwner, "center_pane");
    assert.equal(desktop.containerSelector, CENTER_SCROLL_CONTAINER_SELECTOR);
    assert.equal(desktop.titleDomId, DISCUSSION_TITLE_DOM_ID);
    assert.equal(desktop.listDomId, COLLABORATION_LIST_DOM_ID);
    assert.equal(desktop.titleBlock, "start");
    assert.equal(desktop.listBlock, "nearest");
    assert.equal(resolveDiscussionDeepLinkScrollOwner(767), "document");
    assert.equal(resolveDiscussionDeepLinkScrollOwner(768), "center_pane");
  });

  it("collaboration notification applies center-pane scroll helper (not document scrollIntoView on desktop)", () => {
    assert.match(deepLink, /scrollElementWithinContainer/);
    assert.match(deepLink, /applyCollaborationNotificationScroll/);
    assert.match(discussion, /applyCollaborationNotificationScroll/);
    assert.doesNotMatch(
      discussion,
      /planCollaborationNotificationScroll\(\)[\s\S]*scrollIntoView/,
    );
    assert.match(
      page,
      /max-width:\s*767px[\s\S]*scrollToContent|matchMedia\("\(max-width: 767px\)"\)[\s\S]*scrollToContent/,
    );
  });

  it("desktop panes keep overflow-y scrolling without overscroll-behavior contain trap", () => {
    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(
      css,
      /\.pie-layout__lifecycle,\s*\n\s*\.pie-layout__center,\s*\n\s*\.pie-layout__sidebar\s*\{[^}]*overflow-y:\s*auto/s,
    );
    assert.doesNotMatch(css, /overscroll-behavior:\s*contain/);
  });

  it("footer / document remain unlocked for natural chaining", () => {
    assert.doesNotMatch(css, /\.humanity-layout:has\(\.pie-page\)/);
    assert.doesNotMatch(css, /\.pie-page\s*\{[^}]*overflow-y:\s*hidden/s);
    assert.match(css, /Fix 05C[\s\S]*chain to document/i);
  });

  it("hero remains outside columns and full-width", () => {
    assert.match(layout, /className="pie-layout__hero"/);
    assert.match(layout, /className="pie-layout pie-layout__columns"/);
    const heroIndex = layout.indexOf('className="pie-layout__hero"');
    const columnsIndex = layout.indexOf('className="pie-layout pie-layout__columns"');
    assert.ok(heroIndex >= 0 && columnsIndex > heroIndex);
    assert.match(css, /\.pie-layout__hero\s*\{[^}]*width:\s*100%/s);
  });

  it("mobile keeps document scroll owner", () => {
    const mobile = planCollaborationNotificationScroll({ viewportWidth: 500 });
    assert.equal(mobile.scrollOwner, "document");
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /overflow:\s*visible/);
  });

  it("scrollElementWithinContainer adjusts only the container scrollTop", () => {
    let scrollTop = 0;
    const container = {
      get scrollTop() {
        return scrollTop;
      },
      set scrollTop(value: number) {
        scrollTop = value;
      },
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 100 }),
      scrollTo(options: { top: number }) {
        scrollTop = options.top;
      },
    } as unknown as HTMLElement;

    const target = {
      offsetHeight: 40,
      getBoundingClientRect: () => ({ top: 350 }),
    } as unknown as HTMLElement;

    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (() =>
      ({ scrollPaddingTop: "16px" }) as CSSStyleDeclaration) as typeof getComputedStyle;

    try {
      scrollElementWithinContainer(container, target, "start");
      // targetOffset = 350 - 100 + 0 = 250; minus padding 16 → 234
      assert.equal(scrollTop, 234);
    } finally {
      globalThis.getComputedStyle = original;
    }
  });
});
