/**
 * Version 5.0 — branded language selector visual contract.
 * Placement is physical and direction-aware. It does not use locale offsets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_SELECTOR_VIEWPORT_MARGIN_PX,
  LANGUAGE_SELECTOR_VISIBLE_ROW_LIMIT,
  languageSelectorUsesOverlayPlacement,
  placeLanguageSelectorList,
} from "./place-language-selector-list.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

const ROW = 36;
const CHROME = 10;
const MARGIN = LANGUAGE_SELECTOR_VIEWPORT_MARGIN_PX;

function place(overrides: Partial<Parameters<typeof placeLanguageSelectorList>[0]>) {
  return placeLanguageSelectorList({
    trigger: { left: 20, right: 140, top: 8, bottom: 40 },
    listWidth: 176,
    rowHeight: ROW,
    rowCount: 4,
    listChrome: CHROME,
    viewportWidth: 800,
    viewportHeight: 900,
    direction: "ltr",
    ...overrides,
  });
}

describe("Language selector visual restoration", () => {
  it("1. languages stay Registry-driven — no hardcoded ten-language list", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.match(selector, /listSelectablePublicLanguages/);
    assert.match(selector, /options\.map/);
    assert.doesNotMatch(selector, /placeholder|empty row|Array\(10\)/);
    assert.doesNotMatch(selector, /locale:\s*"uk"[\s\S]{0,80}locale:\s*"ar"/);
  });

  it("2. more than 10 languages: visible cap is ten rows and the list scrolls", () => {
    const css = readWeb("features/language/components/language-selector.css");
    assert.match(css, /--hu-language-selector-visible-rows:\s*10/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /overflow-x:\s*hidden/);
    const placed = place({
      rowCount: 14,
      viewportHeight: 1200,
      trigger: { left: 20, right: 140, top: 8, bottom: 40 },
    });
    assert.equal(
      placed.maxHeight,
      LANGUAGE_SELECTOR_VISIBLE_ROW_LIMIT * ROW + CHROME,
    );
    assert.ok(placed.maxHeight < 14 * ROW + CHROME);
  });

  it("3. fewer than 10 languages does not invent a fixed ten-row height", () => {
    const css = readWeb("features/language/components/language-selector.css");
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.doesNotMatch(
      css,
      /\.hu-language-selector__list\s*\{[^}]*\bmin-height\s*:/s,
    );
    assert.doesNotMatch(selector, /list\.style\.height/);
    const placed = place({ rowCount: 3 });
    assert.equal("height" in placed, false);
    assert.ok(placed.maxHeight >= 3 * ROW);
  });

  it("4. right-edge placement keeps the list inside the viewport", () => {
    const placed = place({
      trigger: { left: 700, right: 790, top: 8, bottom: 40 },
      listWidth: 220,
      viewportWidth: 800,
      direction: "ltr",
      horizontalAlign: "trigger",
    });
    assert.ok(placed.left >= MARGIN);
    assert.ok(placed.left + placed.width <= 800 - MARGIN);
    assert.ok(placed.left < 700);
  });

  it("5. left-edge placement keeps the list inside the viewport", () => {
    const placed = place({
      trigger: { left: 0, right: 40, top: 8, bottom: 40 },
      listWidth: 220,
      viewportWidth: 800,
      direction: "ltr",
      horizontalAlign: "trigger",
    });
    assert.equal(placed.left, MARGIN);
    assert.ok(placed.left + placed.width <= 800 - MARGIN);
  });

  it("6. RTL stays inside the viewport without a locale-specific offset", () => {
    const source = readWeb("features/language/place-language-selector-list.ts");
    assert.doesNotMatch(source, /["']ar["']|["']he["']|zh-Hant/);
    const placed = place({
      trigger: { left: 4, right: 48, top: 8, bottom: 40 },
      listWidth: 220,
      viewportWidth: 800,
      direction: "rtl",
      horizontalAlign: "trigger",
    });
    assert.ok(placed.left >= MARGIN);
    assert.ok(placed.left + placed.width <= 800 - MARGIN);
    const roomy = place({
      trigger: { left: 500, right: 760, top: 8, bottom: 40 },
      listWidth: 180,
      viewportWidth: 800,
      direction: "rtl",
      horizontalAlign: "trigger",
    });
    assert.equal(roomy.left, 760 - 180);
    assert.ok(roomy.left + roomy.width <= 800 - MARGIN);
  });

  it("mobile centers the open list in the viewport without edge clipping", () => {
    const placed = place({
      trigger: { left: 280, right: 360, top: 8, bottom: 40 },
      listWidth: 220,
      viewportWidth: 390,
      direction: "ltr",
    });
    assert.ok(placed.left >= MARGIN);
    assert.ok(placed.left + placed.width <= 390 - MARGIN);
    const expectedLeft = Math.round((390 - placed.width) / 2);
    assert.equal(
      placed.left,
      Math.max(MARGIN, Math.min(expectedLeft, 390 - MARGIN - placed.width)),
    );
    const rtl = place({
      trigger: { left: 10, right: 90, top: 8, bottom: 40 },
      listWidth: 220,
      viewportWidth: 360,
      direction: "rtl",
    });
    assert.ok(rtl.left >= MARGIN);
    assert.ok(rtl.left + rtl.width <= 360 - MARGIN);
  });

  it("desktop trigger anchoring is unchanged above the mobile breakpoint", () => {
    const placed = place({
      trigger: { left: 40, right: 160, top: 8, bottom: 40 },
      listWidth: 176,
      viewportWidth: 1024,
      direction: "ltr",
    });
    assert.equal(placed.left, 40);
  });

  it("short viewport clamps height and still allows vertical scroll", () => {
    const css = readWeb("features/language/components/language-selector.css");
    assert.match(css, /overflow-y:\s*auto/);
    const placed = place({
      rowCount: 12,
      trigger: { left: 20, right: 140, top: 80, bottom: 112 },
      viewportHeight: 220,
      viewportWidth: 800,
      horizontalAlign: "trigger",
    });
    assert.ok(placed.maxHeight < LANGUAGE_SELECTOR_VISIBLE_ROW_LIMIT * ROW);
    assert.ok(placed.maxHeight > 0);
    assert.ok(placed.top + placed.maxHeight <= 220 - MARGIN);
  });

  it("7–9. desktop, mobile menu, and PWA mount the same recessed selector", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const pwa = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    const css = readWeb("features/language/components/language-selector.css");
    assert.match(header, /LanguageSelector/);
    assert.match(header, /hu-language-selector--header/);
    assert.match(mobile, /LanguageSelector/);
    assert.match(mobile, /hu-language-selector--mobile/);
    assert.match(pwa, /LanguageSelector/);
    assert.match(pwa, /hu-language-selector--mobile/);
    assert.doesNotMatch(pwa, /variant="icon"/);
    assert.match(css, /inset 0 1px 2px/);
    assert.equal(languageSelectorUsesOverlayPlacement("hu-language-selector--header"), true);
    assert.equal(languageSelectorUsesOverlayPlacement("hu-language-selector--mobile"), false);
  });

  it("10–11. Guest cookie path and Participant shared patch remain", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.match(selector, /buildParticipantReadingLanguagePatch/);
    assert.match(selector, /readingLanguageControl:\s*true/);
    assert.match(selector, /applyPresentationLocale/);
    assert.match(selector, /syncLanguageSelectorListPlacement/);
  });

  it("mobile header list uses viewport-center CSS contract and body portal", () => {
    const css = readWeb("features/language/components/language-selector.css");
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const placement = readWeb("features/language/place-language-selector-list.ts");
    assert.match(
      css,
      /@media \(max-width:\s*768px\)[\s\S]*?\.hu-language-selector--header \.hu-language-selector__list[\s\S]*?left:\s*50vw[\s\S]*?transform:\s*translateX\(-50%\)/,
    );
    assert.match(css, /max-width:\s*calc\(100vw - 16px\)/);
    assert.match(selector, /createPortal/);
    assert.match(selector, /document\.body/);
    assert.match(placement, /left\s*=\s*"50vw"/);
    assert.match(placement, /translateX\(-50%\)/);
    assert.match(
      placement,
      /hu-language-selector--mobile/,
    );
  });
});
