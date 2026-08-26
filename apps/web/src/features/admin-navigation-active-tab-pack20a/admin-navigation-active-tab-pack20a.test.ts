/**
 * Pack 20A — Admin navigation active tab visibility & scroll persistence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveAdminPanelSectionId,
} from "../administration/admin-panel-sections";
import { computeAdminPanelNavCenteredScrollLeft } from "../administration/admin-panel-navigation-scroll";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 20A — Admin navigation active item visibility", () => {
  it("detects active Admin section from deep routes", () => {
    assert.equal(resolveAdminPanelSectionId("/admin/diagnostics"), "diagnostics");
    assert.equal(resolveAdminPanelSectionId("/admin/seo"), "seo");
    assert.equal(resolveAdminPanelSectionId("/admin/views/insights"), "views");
    assert.equal(resolveAdminPanelSectionId("/admin/views/subscribers"), "views");
    assert.equal(resolveAdminPanelSectionId("/admin/initiatives/init-1"), "initiatives");
  });

  it("centers the active item in the horizontal scroller when possible", () => {
    const scrollLeft = computeAdminPanelNavCenteredScrollLeft({
      scrollerScrollLeft: 0,
      scrollerClientWidth: 400,
      scrollerScrollWidth: 1200,
      itemLeftInViewport: 700,
      scrollerLeftInViewport: 0,
      itemWidth: 100,
    });
    // Item center at 750 → target scroll 550
    assert.equal(scrollLeft, 550);
  });

  it("clamps scroll so navigation does not reset past bounds or require first item", () => {
    const nearStart = computeAdminPanelNavCenteredScrollLeft({
      scrollerScrollLeft: 200,
      scrollerClientWidth: 400,
      scrollerScrollWidth: 1200,
      itemLeftInViewport: -120,
      scrollerLeftInViewport: 0,
      itemWidth: 80,
    });
    assert.equal(nearStart, 0);

    const nearEnd = computeAdminPanelNavCenteredScrollLeft({
      scrollerScrollLeft: 0,
      scrollerClientWidth: 400,
      scrollerScrollWidth: 500,
      itemLeftInViewport: 420,
      scrollerLeftInViewport: 0,
      itemWidth: 80,
    });
    assert.equal(nearEnd, 100);
  });

  it("wires scroll-into-view on activeId without forcing document scroll", () => {
    const nav = read("features/administration/components/AdminPanelNavigation.tsx");
    const scroll = read("features/administration/admin-panel-navigation-scroll.ts");
    assert.match(nav, /scrollAdminPanelNavItemIntoView/);
    assert.match(nav, /useEffect/);
    assert.match(nav, /activeId/);
    assert.match(nav, /listRef/);
    assert.match(nav, /activeLinkRef/);
    assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
    assert.match(scroll, /computeAdminPanelNavCenteredScrollLeft/);
    assert.match(scroll, /scroller\.scrollLeft\s*=/);
    assert.doesNotMatch(nav, /scrollIntoView/);
    assert.doesNotMatch(scroll, /scrollIntoView/);
    assert.doesNotMatch(nav, /window\.scroll|document\.documentElement\.scroll/);
    assert.doesNotMatch(scroll, /window\.scroll|document\.documentElement\.scroll/);
    assert.doesNotMatch(nav, /scrollLeft\s*=\s*0/);
    assert.doesNotMatch(scroll, /scrollLeft\s*=\s*0/);
  });

  it("repositions only via activeId effect (mount and route change)", () => {
    const nav = read("features/administration/components/AdminPanelNavigation.tsx");
    assert.match(nav, /useEffect\(\(\) => \{\s*scrollAdminPanelNavItemIntoView\(listRef\.current, activeLinkRef\.current\);\s*\}, \[activeId\]\)/s);
  });

  it("keeps horizontal overflow manually scrollable", () => {
    const css = read("features/administration/components/admin-panel-navigation.css");
    assert.match(css, /overflow-x:\s*auto/);
    assert.match(css, /flex-wrap:\s*nowrap/);
  });

  it("preserves Admin navigation foundation expectations", () => {
    const foundation = read("features/administration/admin-panel-foundation.test.ts");
    assert.match(foundation, /admin-panel-navigation/);
    assert.match(foundation, /overflow-x:\\s\*auto/);
    assert.match(foundation, /resolveAdminPanelSectionId/);
  });
});
