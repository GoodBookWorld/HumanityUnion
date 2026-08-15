import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SAVE_BUTTON_SUCCESS_HOLD_MS } from "../features/member-profile/save-button-timing.js";
import { assistantWidgetCopy } from "../features/humanity-union-assistant/resolve-assistant-surface.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Design System UX Pack 01 — foundations", () => {
  it("defines layout, typography, shadow, radius, and button tokens", () => {
    const tokens = read("tokens.css");
    assert.match(tokens, /--hu-page-max-width/);
    assert.match(tokens, /--hu-page-padding-inline/);
    assert.match(tokens, /--hu-section-gap/);
    assert.match(tokens, /--hu-shadow-subtle/);
    assert.match(tokens, /--hu-shadow-card/);
    assert.match(tokens, /--hu-shadow-control/);
    assert.match(tokens, /--hu-shadow-floating/);
    assert.match(tokens, /--hu-radius-control/);
    assert.match(tokens, /--hu-radius-card/);
    assert.match(tokens, /--hu-button-radius/);
    assert.match(tokens, /--hu-color-accent:\s*#df9815/);
    assert.match(tokens, /--hu-font-family:\s*system-ui/);
  });

  it("keeps primary and secondary button families with shared geometry", () => {
    const css = read("components.css");
    assert.match(css, /\.hu-button--primary/);
    assert.match(css, /\.hu-button--secondary/);
    assert.match(css, /border-radius:\s*var\(--hu-button-radius\)/);
    assert.match(css, /box-shadow:\s*var\(--hu-shadow-control\)/);
    assert.match(css, /:active:not\(:disabled\)/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.doesNotMatch(css, /animation-name:\s*button/);
  });

  it("standardizes async success hold around two seconds", () => {
    assert.ok(SAVE_BUTTON_SUCCESS_HOLD_MS >= 1800);
    assert.ok(SAVE_BUTTON_SUCCESS_HOLD_MS <= 2200);
  });

  it("uses canonical widget title typography for Assistant surfaces", () => {
    const assistantCss = read("../features/humanity-union-assistant/humanity-union-assistant.css");
    const typography = read("typography.css");
    assert.match(typography, /\.hu-widget-title/);
    assert.match(assistantCss, /\.hu-assistant-widget__title\s*\{[^}]*font-family:\s*var\(--hu-font-family\)/s);
    assert.match(assistantCss, /\.hu-assistant-modal__title\s*\{[^}]*font-family:\s*var\(--hu-font-family\)/s);
    assert.doesNotMatch(assistantCss, /Iowan Old Style/);
  });

  it("keeps Assistant modal footer/composer visible via body/footer split", () => {
    const modal = read(
      "../features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    const css = read("../features/humanity-union-assistant/humanity-union-assistant.css");
    assert.match(modal, /hu-assistant-modal__body/);
    assert.match(modal, /hu-assistant-modal__footer/);
    assert.match(css, /\.hu-assistant-modal__body\s*\{[^}]*min-height:\s*0/s);
    assert.match(css, /\.hu-assistant-modal__body\s*\{[^}]*overflow:\s*auto/s);
    assert.match(css, /\.hu-assistant-modal__footer\s*\{[^}]*flex-shrink:\s*0/s);
  });

  it("places the Notifications Assistant widget in the page header", () => {
    const page = read(
      "../features/notifications/components/NotificationCenterPageContent.tsx",
    );
    const css = read("../features/notifications/notifications-page.css");
    assert.match(page, /HumanityUnionAssistantWidget/);
    assert.match(page, /surfaceId="notifications"/);
    assert.doesNotMatch(page, /SurfaceAssistantEntry/);
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*3fr\)\s*minmax\(0,\s*2fr\)/);
    assert.equal(
      assistantWidgetCopy("notifications"),
      "Ask Humanity Union Assistant about Notifications",
    );
  });

  it("does not regress Home hero / unity visual hide rule", () => {
    const homeCss = read("../features/public-home-v2/components/hero-unity-visual.css");
    const headerCss = read("layout.css");
    assert.match(homeCss, /@media \(max-width: 768px\)/);
    assert.match(homeCss, /\.hero-unity-visual\s*\{[^}]*display:\s*none/s);
    assert.match(headerCss, /--hu-radius-capsule|--hu-shadow-capsule|humanity-header__nav--desktop/);
  });
});
