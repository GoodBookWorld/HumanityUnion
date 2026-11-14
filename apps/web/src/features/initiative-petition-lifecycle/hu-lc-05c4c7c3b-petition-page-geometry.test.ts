/**
 * HU-LC-05C.4C.7C.3B — `/petitions/<id>` uses the canonical Workspace shell
 * (`.humanity-workspace-page`, 75rem) and one shared Workspace layout for
 * Petition Status and Editing Petition; Status section links exist only there.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { NextIntlClientProvider } from "next-intl";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  PetitionDocumentWorkspace,
  resolvePetitionDocumentView,
} from "./components/PetitionDocumentViews.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function properties(body: string): string[] {
  return [...body.matchAll(/^\s*([a-z-]+):/gm)].map((match) => match[1]!);
}

const SECTIONS = ["Petition Status", "Petition Subject", "Signature", "Related Links"];

async function renderWorkspace(activeView: "status" | "editing", canEdit: boolean) {
  const messages = (await loadUiMessagesForLocale("en")).messages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(PetitionDocumentWorkspace, {
        title: "Petition",
        subtitle: "Public endorsement after collective decision",
        statusNavItems: SECTIONS,
        workspaceNavigation: createElement("nav", { id: "workspace-nav" }, "WORKSPACE NAV"),
        activeView,
        canEdit,
        onSelect: () => undefined,
        statusPanel: createElement("div", { id: "status-content" }, "STATUS"),
        editingPanel: createElement("div", { id: "editing-content" }, "EDITING"),
      }),
    ),
  );
}

/** Workspace grid, sidebar, main column and header, without the Status section links. */
function chrome(html: string): string {
  return html
    .replace(/<div class="ipl-document-views">[\s\S]*$/, "")
    .replace(/<p class="member-workspace__nav-label">[^<]*<\/p>/, "")
    .replace(/<nav[^>]*aria-label="[^"]*sections[^"]*"[\s\S]*?<\/nav>/i, "");
}

describe("HU-LC-05C.4C.7C.3B — Petition page geometry", () => {
  it("reuses the canonical 75rem Workspace shell for the Petition page", () => {
    const page = readWeb("app/petitions/[petitionId]/page.tsx");
    assert.equal(
      (page.match(/<main className="petition-page humanity-workspace-page">/g) ?? []).length,
      2,
      "the Petition page and its unavailable state",
    );
    assert.doesNotMatch(page, /<main className="petition-page">/);

    const layout = readWeb("design-system/layout.css");
    const shell = ruleBody(layout, ".humanity-workspace-page");
    assert.match(shell, /width: min\(100%, var\(--hu-workspace-max-width\)\);/);
    assert.match(shell, /max-width: min\(100%, var\(--hu-workspace-max-width\)\);/);
    assert.match(shell, /padding-inline: max\(\s*var\(--hu-page-padding-inline\),/);
    assert.match(readWeb("design-system/tokens.css"), /--hu-workspace-max-width: 75rem;/);
  });

  it("the Petition page CSS no longer restates or narrows the outer geometry", () => {
    const css = readWeb("app/petitions/petition-page.css");
    assert.deepEqual(properties(ruleBody(css, ".petition-page")), ["text-align"]);
    assert.doesNotMatch(css, /--hu-page-max-width|overflow/);
  });

  it("Petition Status and Editing Petition share one Workspace layout", async () => {
    const status = await renderWorkspace("status", true);
    const editing = await renderWorkspace("editing", true);
    for (const html of [status, editing]) {
      assert.match(html, /<div class="member-workspace">/);
      assert.match(html, /<aside class="member-workspace__nav"[^>]*><nav id="workspace-nav">WORKSPACE NAV<\/nav>/);
      assert.match(html, /<div class="member-workspace__main"><header class="member-workspace__header"><h1 class="member-workspace__title">Petition<\/h1>/);
    }
    assert.equal(chrome(status), chrome(editing));
    assert.match(chrome(editing), /<\/header>$/);
    assert.match(status, /STATUS/);
    assert.match(editing, /EDITING/);
  });

  it("the sidebar lists Petition Status sections only where they exist", async () => {
    const status = await renderWorkspace("status", true);
    assert.match(status, /href="#section-petition-status"/);
    assert.match(status, /href="#section-related-links"/);

    const editing = await renderWorkspace("editing", true);
    assert.doesNotMatch(editing, /href="#section-/);
    assert.match(editing, /WORKSPACE NAV/, "Workspace navigation stays in the sidebar");

    const visitor = await renderWorkspace("editing", false);
    assert.match(visitor, /href="#section-petition-status"/, "non-stewards always get Status");
    assert.match(visitor, /STATUS/);
    assert.equal(resolvePetitionDocumentView("editing", false), "status");
    assert.equal(resolvePetitionDocumentView("editing", true), "editing");
  });

  it("does not change Preferences or the sibling record pages", () => {
    assert.match(
      readWeb("app/preferences/page.tsx"),
      /<main className="preferences-page humanity-workspace-page">/,
    );
    // HU-UI-07C.4 later removed the Preferences width override (its own task).
    assert.deepEqual(properties(ruleBody(readWeb("app/preferences/preferences-page.css"), ".preferences-page")), [
      "text-align",
      "min-width",
      "box-sizing",
    ]);
    for (const [pagePath, cssPath, className] of [
      ["app/collective-decisions/[decisionId]/page.tsx", "app/collective-decisions/collective-decision-page.css", "collective-decision-page"],
      ["app/implementation-commitments/[commitmentId]/page.tsx", "app/implementation-commitments/commitment-page.css", "commitment-page"],
      ["app/implementations/[implementationId]/page.tsx", "app/implementations/implementation-page.css", "implementation-page"],
      ["app/collaborative-analysis/[analysisId]/page.tsx", "app/collaborative-analysis/collaborative-analysis-page.css", "collaborative-analysis-page"],
    ] as const) {
      assert.match(readWeb(pagePath), new RegExp(`<main className="${className}">`), pagePath);
      assert.match(ruleBody(readWeb(cssPath), `.${className}`), /var\(--hu-page-max-width\)/, cssPath);
    }
  });

  it("keeps existing horizontal scrolling and adds no overflow rules", () => {
    const initiative = readWeb("features/public-initiative-experience/public-initiative-experience.css");
    assert.equal((initiative.match(/overflow-x:\s*auto/g) ?? []).length, 1);
    for (const relative of [
      "components/member/member-workspace.css",
      "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css",
      "app/petitions/petition-page.css",
    ]) {
      assert.doesNotMatch(readWeb(relative), /overflow-x/, relative);
    }
    assert.match(
      readWeb("components/member/member-workspace.css"),
      /@media \(max-width: 1024px\) \{\s*\.member-workspace \{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
      "mobile: the Workspace sidebar still collapses into the drawer",
    );
  });
});
