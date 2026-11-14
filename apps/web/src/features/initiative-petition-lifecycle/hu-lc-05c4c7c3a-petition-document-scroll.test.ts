/**
 * HU-LC-05C.4C.7C.3A — choosing a Petition from a Petition list brings its
 * document into view once it has rendered, instead of the top of Stage 5.
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
import { InitiativePetitionPublicResult } from "./components/InitiativePetitionPublicResult.js";
import {
  planPetitionDocumentScroll,
  shouldScrollToPetitionDocument,
} from "./petition-viewer-selection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const PAGE = "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx";
const CENTER = "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx";
const RESULT = "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx";
const STEWARD =
  "features/initiative-petition-lifecycle/components/InitiativePetitionStewardStageView.tsx";
const STAGE_CSS =
  "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css";

describe("HU-LC-05C.4C.7C.3A — scroll to the selected Petition document", () => {
  it("selecting Petition A scrolls to A and selecting B scrolls to B", () => {
    for (const [requested, other] of [
      ["petition-a", "petition-b"],
      ["petition-b", "petition-a"],
    ]) {
      assert.equal(
        shouldScrollToPetitionDocument({
          scrollRequestPetitionId: requested,
          petitionId: requested!,
          isPreview: false,
        }),
        true,
      );
      assert.equal(
        shouldScrollToPetitionDocument({
          scrollRequestPetitionId: requested,
          petitionId: other!,
          isPreview: false,
        }),
        false,
      );
    }
    assert.equal(
      shouldScrollToPetitionDocument({
        scrollRequestPetitionId: null,
        petitionId: "petition-a",
        isPreview: false,
      }),
      false,
    );
  });

  it("never scrolls before the document has rendered; a failed load falls back", () => {
    const plan = (state: Partial<Parameters<typeof planPetitionDocumentScroll>[0]>) =>
      planPetitionDocumentScroll({
        requested: true,
        loaded: false,
        loadFailed: false,
        mounted: false,
        ...state,
      });
    assert.equal(plan({}), "wait", "still loading");
    assert.equal(plan({ loaded: true }), "wait", "data without a mounted document");
    assert.equal(plan({ mounted: true }), "wait", "placeholder only");
    assert.equal(plan({ loaded: true, mounted: true }), "scroll");
    assert.equal(plan({ loadFailed: true }), "fallback");
    assert.equal(plan({ requested: false, loaded: true, mounted: true }), "none");
  });

  it("the loading placeholder is never a scroll target", async () => {
    const messages = (await loadUiMessagesForLocale("en")).messages;
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<
          typeof NextIntlClientProvider
        >,
        createElement(InitiativePetitionPublicResult, {
          petitionId: "petition-a",
          scrollIntoViewOnLoad: true,
        }),
      ),
    );
    assert.match(html, /Loading Petition…/);
    assert.doesNotMatch(html, /data-petition-document/);

    const result = readWeb(RESULT);
    assert.match(
      result,
      /<div\s+ref=\{documentRef\}\s+className="ipl-public-result"\s+data-petition-document=\{petitionId\}/,
    );
    assert.match(result, /loaded: projection !== null,\s*loadFailed,\s*mounted: documentRef\.current !== null,/);
    assert.match(
      result,
      /documentRef\.current\?\.scrollIntoView\(\{ behavior: "smooth", block: "start", inline: "nearest" \}\);\s*onScrollRequestHandled\?\.\("scrolled"\);/,
    );
    assert.match(result, /\}, \[scrollIntoViewOnLoad, projection, loadFailed, onScrollRequestHandled\]\);/);
    assert.equal((result.match(/scrollIntoView\(/g) ?? []).length, 1);
  });

  it("the sticky header does not cover the document", () => {
    const css = readWeb(STAGE_CSS);
    assert.match(
      css,
      /\.ipl-public-result \{[^}]*scroll-margin-top: calc\(var\(--hu-scroll-margin-top\) \+ var\(--hu-space-2\)\);/,
    );
  });

  it("only a Petition chosen from a list requests a document scroll", () => {
    const page = readWeb(PAGE);
    assert.match(
      page,
      /setRequestedPetitionId\(petitionId\);\s*setPetitionScrollRequestId\(petitionId\);[\s\S]*?openStage\(petitionNavStage\.stageId, petitionNavStage\.hash, "petitionDocument"\);/,
    );
    assert.match(
      page,
      /if \(scrollTarget === "content"\) \{\s*setPetitionScrollRequestId\(null\);\s*scrollToContent\(\);\s*\}/,
    );
    assert.match(
      page,
      /setPetitionScrollRequestId\(null\);\s*if \(outcome === "unavailable"\) \{\s*scrollToContent\(\);/,
    );
    assert.match(
      page,
      /const handleTabChange = \(tab: CenterTab\) => \{\s*setActiveTab\(tab\);\s*setShowLifecyclePanel\(false\);\s*setPetitionScrollRequestId\(null\);/,
    );
    assert.match(
      page,
      /if \(invalidPetitionRequest && petitionScrollRequestId === requestedPetitionId\) \{\s*scrollToContent\(\);/,
    );
  });

  it("existing stage navigation still scrolls to the stage", () => {
    const page = readWeb(PAGE);
    assert.match(
      page,
      /const handleStageSelect = \(stageId: string, hash: string\) => \{\s*openStage\(stageId, hash, "content"\);\s*\};/,
    );
    assert.match(page, /onStageSelect=\{handleStageSelect\}/);
    assert.match(page, /onNavigateStage=\{handleStageSelect\}/);
  });

  it("Public Preview never scrolls; the steward's signing view does", () => {
    const center = readWeb(CENTER);
    assert.match(
      center,
      /scrollIntoViewOnLoad=\{shouldScrollToPetitionDocument\(\{\s*scrollRequestPetitionId: petitionScrollRequestId,\s*petitionId: petitionView\.petitionId,\s*isPreview: Boolean\(isStagePreviewMode\),\s*\}\)\}/,
    );
    assert.match(center, /scrollRequestPetitionId=\{petitionScrollRequestId\}/);
    assert.equal(
      shouldScrollToPetitionDocument({
        scrollRequestPetitionId: "petition-a",
        petitionId: "petition-a",
        isPreview: true,
      }),
      false,
    );

    const steward = readWeb(STEWARD);
    assert.match(
      steward,
      /scrollIntoViewOnLoad=\{shouldScrollToPetitionDocument\(\{\s*scrollRequestPetitionId,\s*petitionId: view\.petitionId,\s*isPreview: false,\s*\}\)\}/,
    );
  });

  it("mobile: no horizontal scrolling or overflow rules were introduced", () => {
    const css = readWeb(STAGE_CSS);
    const rule = css.match(/\.ipl-public-result \{([^}]*)\}/)?.[1] ?? "";
    const properties = [...rule.matchAll(/^\s*([a-z-]+):/gm)].map((match) => match[1]);
    assert.deepEqual(properties, [
      "display",
      "flex-direction",
      "gap",
      "min-width",
      "overflow-wrap",
      "scroll-margin-top",
    ]);
    const result = readWeb(RESULT);
    assert.match(result, /inline: "nearest"/, "no horizontal jump of scrollable ancestors");
  });
});
