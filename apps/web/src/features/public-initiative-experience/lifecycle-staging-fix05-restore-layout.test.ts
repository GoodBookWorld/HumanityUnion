/**
 * Lifecycle Staging Fix 05 — restore canonical Initiative page layout.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readLocal(relativePath: string): string {
  return readFileSync(path.resolve(dir, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Lifecycle Staging Fix 05 — restore canonical Initiative layout", () => {
  const layout = readLocal("./components/PublicCivicRecordExperienceLayout.tsx");
  const css = readLocal("./public-initiative-experience.css");
  const openButton = readWeb(
    "features/humanity-union-assistant/components/HumanityUnionAssistantOpenButton.tsx",
  );
  const openButtonCss = readWeb("features/humanity-union-assistant/humanity-union-assistant.css");
  const page = readLocal("./components/PublicInitiativeExperiencePage.tsx");
  const discussion = readLocal("./components/PublicDiscussionPanel.tsx");

  it("pie-layout__hero is outside pie-layout__center and above columns", () => {
    assert.match(layout, /className="pie-layout__hero"/);
    assert.match(layout, /pie-layout pie-layout__columns|pie-layout__columns/);
    const heroIndex = layout.indexOf('className="pie-layout__hero"');
    const columnsIndex = layout.indexOf("pie-layout__columns");
    const centerIndex = layout.indexOf('className="pie-layout__center"');
    assert.ok(heroIndex > 0 && columnsIndex > heroIndex, "hero must precede columns");
    assert.ok(centerIndex > columnsIndex, "center must be inside columns after hero");
    // Hero must not be nested inside the center opening tag block before columns.
    const centerBlock = layout.slice(centerIndex, layout.indexOf("pie-layout__sidebar"));
    assert.doesNotMatch(centerBlock, /pie-layout__hero/);
  });

  it("pie-layout__center contains only center-stage body content", () => {
    assert.match(layout, /pie-layout__center-body/);
    const centerStart = layout.indexOf('<div className="pie-layout__center">');
    const centerEnd = layout.indexOf("</div>", layout.indexOf("pie-layout__center-body"));
    const centerJsx = layout.slice(centerStart, centerEnd + 6);
    assert.match(centerJsx, /pie-layout__center-body/);
    assert.doesNotMatch(centerJsx, /pie-layout__hero/);
  });

  it("hero spans full Initiative page width above sidebars", () => {
    assert.match(css, /\.pie-layout__hero\s*\{[^}]*width:\s*100%/s);
    assert.match(layout, /pie-layout__hero[\s\S]*pie-layout__columns|pie-layout__hero[\s\S]*pie-layout /);
  });

  it("footer / document are not clipped by a header-to-footer viewport box", () => {
    assert.doesNotMatch(css, /\.humanity-layout:has\(\.pie-page\)/);
    assert.doesNotMatch(css, /height:\s*100dvh/);
    assert.doesNotMatch(css, /\.pie-page\s*\{[^}]*overflow-y:\s*hidden/s);
    assert.doesNotMatch(
      css,
      /\.pie-layout__lifecycle,\s*\n\s*\.pie-layout__center,\s*\n\s*\.pie-layout__sidebar\s*\{[^}]*overflow-y:\s*auto/s,
    );
  });

  it("Ask Assistant icon + label render on one horizontal row at 28x28", () => {
    assert.match(openButton, /\/icons\/workspace\/intel\.webp/);
    assert.match(openButton, /width=\{28\}/);
    assert.match(openButton, /height=\{28\}/);
    assert.match(openButton, /Ask Assistant/);
    assert.match(openButton, /hu-assistant-open-button/);
    assert.match(openButton, /\["hu-assistant-open-button", className\]/);
    assert.match(openButtonCss, /\.hu-assistant-open-button\s*\{[^}]*flex-direction:\s*row/s);
    assert.match(openButtonCss, /\.hu-assistant-open-button\s*\{[^}]*flex-wrap:\s*nowrap/s);
    assert.match(openButtonCss, /\.hu-assistant-open-button__icon\s*\{[^}]*width:\s*28px/s);
    assert.match(openButtonCss, /\.hu-assistant-open-button__icon\s*\{[^}]*height:\s*28px/s);
    assert.match(openButtonCss, /\.hu-assistant-open-button__label\s*\{[^}]*white-space:\s*nowrap/s);
  });

  it("collaboration and comment deep-links still target the same shell", () => {
    assert.match(discussion, /pie-collaboration-list/);
    assert.match(discussion, /scrollIntoView/);
    assert.match(page, /focusDiscussionCommentId/);
    assert.match(page, /filter/);
  });

  it("mobile remains normal single-page responsive flow", () => {
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /position:\s*static/);
    assert.match(css, /overflow:\s*visible/);
  });
});
