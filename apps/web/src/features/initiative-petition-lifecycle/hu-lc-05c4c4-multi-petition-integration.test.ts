/**
 * HU-LC-05C.4C.4 — multi-Petition integration: list refresh after Sign /
 * Withdraw, invalid-id URL cleanup, network-failure resilience, and the
 * 3A / 3B / 3C pieces composed on one public result.
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

import type { PublicPetitionListItem } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { InitiativePetitionsHeroWidget } from "./components/InitiativePetitionsHeroWidget.js";
import {
  hasMalformedPetitionQuery,
  isDefinitivelyInvalidPetitionRequest,
  petitionListAfterFetchFailure,
  removePetitionQueryParam,
  resolveCentralPetitionView,
  resolvePetitionViewerSelection,
  type InitiativePetitionListState,
} from "./petition-viewer-selection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const INITIATIVE = "initiative-a";

function item(petitionId: string): PublicPetitionListItem {
  return {
    petitionId,
    title: `Title ${petitionId}`,
    lifecycleStatus: "Open",
    supportStatus: "Open for endorsement",
    publishedAt: "2026-03-04T10:00:00.000Z",
    signatureCount: 0,
  };
}

const READY: InitiativePetitionListState = {
  status: "ready",
  initiativeId: INITIATIVE,
  petitions: [item("petition-a"), item("petition-b")],
};

describe("HU-LC-05C.4C.4 — multi-Petition integration", () => {
  it("refreshes the hero list after a successful Sign / Withdraw", () => {
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(
      result,
      /void signatureRefresher\.afterSignatureChange\([\s\S]*?\);\s*onSignatureChange\?\.\(petitionIdentity\.petitionId, viewerHasSigned\);/,
    );

    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /onSignatureChange=\{onPetitionSignatureChange\}/);

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(
      page,
      /onPetitionSignatureChange=\{showPetitionsWidget \? refreshPetitionList : undefined\}/,
    );
    assert.match(page, /setPetitionListRevision\(\(current\) => current \+ 1\)/);
    assert.match(
      page,
      /\}, \[experience\.initiativeId, showPetitionsWidget, petitionListRevision\]\);/,
      "the list effect re-runs on every revision",
    );
  });

  it("treats only a loaded list without the id as definitively invalid", () => {
    const base = { initiativeId: INITIATIVE, list: READY };
    assert.equal(
      isDefinitivelyInvalidPetitionRequest({ ...base, requestedPetitionId: "petition-x" }),
      true,
    );
    assert.equal(
      isDefinitivelyInvalidPetitionRequest({ ...base, requestedPetitionId: "petition-a" }),
      false,
    );
    assert.equal(
      isDefinitivelyInvalidPetitionRequest({ ...base, requestedPetitionId: null }),
      false,
    );
    for (const list of [
      { status: "loading" },
      { status: "failed" },
      { ...READY, initiativeId: "initiative-other" },
    ] as InitiativePetitionListState[]) {
      assert.equal(
        isDefinitivelyInvalidPetitionRequest({
          initiativeId: INITIATIVE,
          requestedPetitionId: "petition-x",
          list,
        }),
        false,
        JSON.stringify(list),
      );
    }
  });

  it("removes only ?petition= and keeps other query values and the stage hash", () => {
    assert.equal(
      removePetitionQueryParam(
        "https://hu.example/initiatives/a?filter=collaboration&petition=petition-x&tab=2#petition",
      ),
      "/initiatives/a?filter=collaboration&tab=2#petition",
    );
    assert.equal(
      removePetitionQueryParam("https://hu.example/initiatives/a?petition=petition-x"),
      "/initiatives/a",
    );
    assert.equal(hasMalformedPetitionQuery("?petition=%3Cscript%3E"), true);
    assert.equal(hasMalformedPetitionQuery("?petition="), true);
    assert.equal(hasMalformedPetitionQuery("?petition=petition-a"), false);
    assert.equal(hasMalformedPetitionQuery("?filter=collaboration"), false);

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(
      page,
      /invalidPetitionRequest &&\s*readRequestedPetitionId\(window\.location\.search\) === requestedPetitionId[\s\S]*?removePetitionQueryParam\(window\.location\.href\)/,
    );
    assert.match(
      page,
      /if \(hasMalformedPetitionQuery\(search\)\) \{\s*window\.history\.replaceState\(null, "", removePetitionQueryParam\(window\.location\.href\)\);/,
    );
  });

  it("keeps a valid selection through a temporary list-fetch failure", () => {
    const afterRefreshFailure = petitionListAfterFetchFailure(READY, INITIATIVE);
    assert.equal(afterRefreshFailure, READY);
    assert.deepEqual(
      resolvePetitionViewerSelection({
        initiativeId: INITIATIVE,
        requestedPetitionId: "petition-a",
        list: afterRefreshFailure,
      }),
      { kind: "selected", petitionId: "petition-a" },
    );

    const firstLoadFailure = petitionListAfterFetchFailure({ status: "loading" }, INITIATIVE);
    assert.deepEqual(firstLoadFailure, { status: "failed" });
    assert.equal(
      isDefinitivelyInvalidPetitionRequest({
        initiativeId: INITIATIVE,
        requestedPetitionId: "petition-a",
        list: firstLoadFailure,
      }),
      false,
      "the request (and its URL) is kept for a retry",
    );
    assert.deepEqual(
      petitionListAfterFetchFailure({ ...READY, initiativeId: "initiative-other" }, INITIATIVE),
      { status: "failed" },
    );

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.equal(
      (page.match(/petitionListAfterFetchFailure\(current, initiativeId\)/g) ?? []).length,
      2,
      "both a network error and a mismatched response keep the last good list",
    );
    assert.doesNotMatch(page, /setPetitionList\(\{ status: "failed" \}\)/);
  });

  it("offers Retry after a failed load", async () => {
    const messages = (await loadUiMessagesForLocale("en")).messages;
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<
          typeof NextIntlClientProvider
        >,
        createElement(InitiativePetitionsHeroWidget, {
          list: { status: "failed" },
          selectedPetitionId: null,
          stageHash: "petition",
          onSelectPetition: () => undefined,
          onRetry: () => undefined,
          defaultExpanded: true,
        }),
      ),
    );
    assert.match(html, /<button type="button" class="pie-hero-petitions__retry">Retry<\/button>/);

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /onRetry=\{refreshPetitionList\}/);
  });

  it("composes 3A refresh, 3B document and 3C selection on one Petition viewer", () => {
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(result, /createPetitionSignatureRefresher\(/);
    assert.match(
      result,
      /<InitiativePetitionPublicDocument petitionId=\{petitionId\} projection=\{projection\} \/>/,
    );
    assert.match(result, /petitionDocumentRecipients\(petitionSubject\)/);
    assert.match(
      result,
      /<InitiativePetitionSignatureWidget\s+petitionId=\{petitionIdentity\.petitionId\}/,
    );

    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(
      center,
      /publishedResultPresentation=\{\s*activeStage\.stageId === "petition" \? "document" : "stage"\s*\}/,
    );
    assert.match(center, /key=\{petitionView\.petitionId\}/);
    assert.deepEqual(
      resolveCentralPetitionView({
        publishedRecordId: "petition-b",
        selection: { kind: "selected", petitionId: "petition-a" },
      }),
      { kind: "petition", petitionId: "petition-a" },
    );
  });
});
