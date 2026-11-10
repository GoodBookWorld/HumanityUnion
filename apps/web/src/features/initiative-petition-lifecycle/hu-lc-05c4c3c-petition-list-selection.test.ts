/**
 * HU-LC-05C.4C.3C — hero Petitions widget and central viewer selection.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { NextIntlClientProvider } from "next-intl";

import type { PublicInitiativeLifecycleStageNavItem, PublicPetitionListItem } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { PublicExperienceHero } from "../public-initiative-experience/components/PublicExperienceHero.js";
import { selectLifecycleNavStagesForDisplay } from "../public-initiative-experience/initiative-lifecycle-shell.js";
import {
  InitiativePetitionsHeroWidget,
  PETITION_WIDGET_ICON,
} from "./components/InitiativePetitionsHeroWidget.js";
import {
  buildPetitionSelectionHref,
  petitionListForInitiative,
  readRequestedPetitionId,
  resolveCentralPetitionView,
  resolvePetitionViewerSelection,
  type InitiativePetitionListState,
} from "./petition-viewer-selection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const INITIATIVE = "initiative-a";
const DEFAULT_PETITION = "petition-b";

function item(petitionId: string, title: string, signatureCount = 0): PublicPetitionListItem {
  return {
    petitionId,
    title,
    lifecycleStatus: "Open",
    supportStatus: "Open for endorsement",
    publishedAt: "2026-03-04T10:00:00.000Z",
    signatureCount,
  };
}

const A = item("petition-a", "Safe crossings near every school", 1);
const B = item(DEFAULT_PETITION, "Longer library opening hours", 12);

function ready(petitions: readonly PublicPetitionListItem[], initiativeId = INITIATIVE) {
  return {
    status: "ready",
    initiativeId,
    petitions,
  } as const satisfies InitiativePetitionListState;
}

type Messages = React.ComponentProps<typeof NextIntlClientProvider>["messages"];
const messageCache = new Map<string, Messages>();

async function render(node: ReactNode, locale = "en"): Promise<string> {
  let messages = messageCache.get(locale);
  if (!messages) {
    messages = (await loadUiMessagesForLocale(locale)).messages as Messages;
    messageCache.set(locale, messages);
  }
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      node,
    ),
  );
}

function widget(
  list: InitiativePetitionListState,
  options: { readonly expanded?: boolean; readonly selected?: string | null } = {},
) {
  return createElement(InitiativePetitionsHeroWidget, {
    list,
    selectedPetitionId: options.selected ?? null,
    stageHash: "petition",
    onSelectPetition: () => undefined,
    defaultExpanded: options.expanded ?? false,
  });
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("HU-LC-05C.4C.3C — hero Petitions widget and central viewer selection", () => {
  it("5. renders the widget as the last element inside pie-hero__content", async () => {
    const html = await render(
      createElement(PublicExperienceHero, {
        title: "Initiative",
        meta: [{ label: "Status", value: "Active", column: "a" }],
        contentFooter: widget(ready([A, B])),
      }),
    );

    const contentStart = html.indexOf('class="pie-hero__content"');
    const metaGrid = html.indexOf('class="pie-hero__meta-grid"');
    const widgetStart = html.indexOf('class="pie-hero-petitions"');
    assert.ok(contentStart >= 0 && metaGrid > contentStart && widgetStart > metaGrid);
    const widgetEnd = html.indexOf("</section>", widgetStart) + "</section>".length;
    assert.equal(
      html.slice(widgetEnd, widgetEnd + "</div></div>".length),
      "</div></div>",
      "widget closes pie-hero__content and pie-hero__top immediately",
    );

    const without = await render(
      createElement(PublicExperienceHero, { title: "Initiative", meta: [] }),
    );
    assert.doesNotMatch(without, /pie-hero-petitions/);

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(
      page,
      /contentFooter=\{\s*showPetitionsWidget && petitionNavStage \? \(\s*<InitiativePetitionsHeroWidget/,
    );
  });

  it("6. uses the existing petition workspace icon", async () => {
    assert.equal(PETITION_WIDGET_ICON, "/icons/workspace/petition.png");
    assert.ok(existsSync(path.join(webRoot, "public/icons/workspace/petition.png")));
    const html = decodeURIComponent(await render(widget(ready([A]))));
    assert.match(html, /\/icons\/workspace\/petition\.png/);
    assert.match(html, /<img[^>]*alt=""/);
  });

  it("7. is a keyboard-accessible disclosure: Petitions heading, count, collapsed by default", async () => {
    const collapsed = await render(widget(ready([A, B])));
    const toggle = collapsed.match(/<button[^>]*>/)?.[0] ?? "";
    assert.match(collapsed, /<h2 class="pie-hero-petitions__heading"><button/);
    assert.match(toggle, /type="button"/);
    assert.match(toggle, /aria-expanded="false"/);
    const controls = toggle.match(/aria-controls="([^"]+)"/)?.[1];
    assert.ok(controls);
    assert.match(
      collapsed,
      new RegExp(`<div id="${controls}" class="pie-hero-petitions__panel" hidden="">`),
    );
    assert.match(text(collapsed), /^Petitions 2 2 active Petitions/);

    const expanded = await render(widget(ready([A, B]), { expanded: true }));
    assert.match(expanded, /aria-expanded="true"/);
    assert.doesNotMatch(expanded, /hidden=""/);
    assert.match(text(expanded), /Safe crossings near every school 1 signature/);
    assert.match(text(expanded), /Longer library opening hours 12 signatures/);

    const source = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionsHeroWidget.tsx",
    );
    assert.match(source, /onClick=\{\(\) => setExpanded\(\(current\) => !current\)\}/);
    assert.doesNotMatch(source, /role="dialog"|createPortal|Modal/);

    const empty = text(await render(widget(ready([]))));
    assert.match(empty, /Petitions 0 No active Petitions/);
    const emptyOpen = text(await render(widget(ready([]), { expanded: true })));
    assert.match(emptyOpen, /This Initiative has no active Petitions yet\./);
    assert.match(
      text(await render(widget({ status: "loading" }, { expanded: true }))),
      /Loading Petitions…/,
    );
    assert.match(
      text(await render(widget({ status: "failed" }, { expanded: true }))),
      /Petitions could not be loaded right now\./,
    );
  });

  it("8–9. selecting A shows A and selecting B shows B in the central viewer", async () => {
    for (const chosen of [A, B]) {
      const selection = resolvePetitionViewerSelection({
        initiativeId: INITIATIVE,
        requestedPetitionId: chosen.petitionId,
        list: ready([A, B]),
      });
      assert.deepEqual(selection, { kind: "selected", petitionId: chosen.petitionId });
      assert.deepEqual(
        resolveCentralPetitionView({ publishedRecordId: DEFAULT_PETITION, selection }),
        { kind: "petition", petitionId: chosen.petitionId },
      );
    }

    const html = await render(widget(ready([A, B]), { expanded: true, selected: A.petitionId }));
    assert.match(html, /href="\?petition=petition-a#petition" aria-current="true"/);
    assert.match(html, /href="\?petition=petition-b#petition"(?! aria-current)/);

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /setRequestedPetitionId\(petitionId\);/);
    assert.match(
      page,
      /buildPetitionSelectionHref\(window\.location\.href, petitionId, petitionNavStage\.hash\)/,
    );
    assert.match(page, /handleStageSelect\(petitionNavStage\.stageId, petitionNavStage\.hash\);/);
    const source = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionsHeroWidget.tsx",
    );
    assert.match(source, /event\.preventDefault\(\);\s+onSelectPetition\(petition\.petitionId\);/);
  });

  it("10. keeps signature state Petition-specific by remounting the viewer per Petition", () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(
      center,
      /<InitiativePetitionPublicResult\s+key=\{petitionView\.petitionId\}\s+petitionId=\{petitionView\.petitionId\}/,
    );
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(result, /getPublicPetition\(petitionId\)/);
    assert.match(
      result,
      /<InitiativePetitionSignatureWidget\s+petitionId=\{petitionIdentity\.petitionId\}/,
    );
    assert.match(result, /viewerHasSigned=\{projection\.viewerHasSigned\}/);
  });

  it("11. the ?petition= query survives reload and direct links, alongside other params", () => {
    const href = buildPetitionSelectionHref(
      "https://hu.example/initiatives/initiative-a?filter=collaboration#overview",
      A.petitionId,
      "petition",
    );
    assert.equal(
      href,
      "/initiatives/initiative-a?filter=collaboration&petition=petition-a#petition",
    );
    assert.equal(
      readRequestedPetitionId(new URL(`https://hu.example${href}`).search),
      A.petitionId,
    );
    assert.equal(
      buildPetitionSelectionHref(
        "https://hu.example/initiatives/x?petition=p#petition",
        null,
        "petition",
      ),
      "/initiatives/x#petition",
    );

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /setRequestedPetitionId\(readRequestedPetitionId\(search\)\);/);
    assert.match(page, /applyQueryParams\(window\.location\.search\);/);
    assert.match(page, /window\.history\.replaceState\(null, "", `#\$\{hash\}`\);/);
  });

  it("12. invalid, foreign, malformed or unavailable ids fall back safely", () => {
    const base = { initiativeId: INITIATIVE, list: ready([A, B]) };
    assert.deepEqual(
      resolvePetitionViewerSelection({ ...base, requestedPetitionId: "petition-from-elsewhere" }),
      { kind: "default" },
    );
    assert.deepEqual(
      resolvePetitionViewerSelection({
        initiativeId: INITIATIVE,
        requestedPetitionId: A.petitionId,
        list: ready([A], "initiative-other"),
      }),
      { kind: "pending" },
      "a list loaded for another Initiative never validates a selection",
    );
    assert.deepEqual(
      resolvePetitionViewerSelection({
        ...base,
        requestedPetitionId: A.petitionId,
        list: { status: "failed" },
      }),
      { kind: "default" },
    );
    assert.deepEqual(
      resolvePetitionViewerSelection({
        ...base,
        requestedPetitionId: A.petitionId,
        list: { status: "loading" },
      }),
      { kind: "pending" },
    );
    assert.deepEqual(
      resolveCentralPetitionView({
        publishedRecordId: DEFAULT_PETITION,
        selection: { kind: "pending" },
      }),
      { kind: "pending" },
      "the default Petition does not flash while a request is validated",
    );
    assert.deepEqual(
      resolveCentralPetitionView({
        publishedRecordId: null,
        selection: { kind: "selected", petitionId: A.petitionId },
      }),
      { kind: "none" },
      "a selection never replaces the stage's draft preview / upcoming state",
    );
    for (const raw of [
      "?petition=",
      "?petition=%3Cscript%3E",
      `?petition=${"x".repeat(201)}`,
      "?petition=../a",
      "?other=1",
    ]) {
      assert.equal(readRequestedPetitionId(raw), null, raw);
    }
    assert.equal(readRequestedPetitionId("?petition=%20petition-a%20"), "petition-a");
    assert.deepEqual(petitionListForInitiative(ready([A], "initiative-other"), INITIATIVE), {
      status: "loading",
    });
  });

  it("13. leaves other Lifecycle stages, PUBLIC_CHOICE and read-only views unchanged", () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.equal((center.match(/resolveCentralPetitionView\(/g) ?? []).length, 1);
    for (const stage of [
      "InitiativeCollaborativeAnalysisPublicResult",
      "InitiativeDecisionSessionPublicResult",
      "InitiativeCollectiveDecisionPublicResult",
    ]) {
      assert.match(
        center,
        new RegExp(`<${stage}\\s+\\w+=\\{projection\\.metadata\\.publishedRecordId\\}`),
      );
    }

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /navStages\.find\(\(stage\) => stage\.stageId === "petition"\)/);
    assert.match(page, /const showPetitionsWidget = petitionNavStage !== null && !readOnly;/);
    assert.match(page, /: \{ kind: "default" \};/);

    const stages = [
      { stageId: "initiative", hash: "initiative", state: "completed" },
      { stageId: "petition", hash: "petition", state: "not_applicable" },
      { stageId: "collective_decision", hash: "collective-decision", state: "current" },
    ] as unknown as PublicInitiativeLifecycleStageNavItem[];
    assert.equal(
      selectLifecycleNavStagesForDisplay(stages, "PUBLIC_CHOICE").some(
        (stage) => stage.stageId === "petition",
      ),
      false,
    );
  });

  it("14. a single-Petition Initiative keeps its default Petition", async () => {
    const selection = resolvePetitionViewerSelection({
      initiativeId: INITIATIVE,
      requestedPetitionId: null,
      list: ready([B]),
    });
    assert.deepEqual(selection, { kind: "default" });
    assert.deepEqual(
      resolveCentralPetitionView({ publishedRecordId: DEFAULT_PETITION, selection }),
      {
        kind: "petition",
        petitionId: DEFAULT_PETITION,
      },
    );
    assert.deepEqual(
      resolveCentralPetitionView({
        publishedRecordId: DEFAULT_PETITION,
        selection: { kind: "default" },
      }),
      { kind: "petition", petitionId: DEFAULT_PETITION },
    );
    const html = text(await render(widget(ready([B]), { expanded: true })));
    assert.match(html, /Petitions 1 1 active Petition Longer library opening hours 12 signatures/);
  });

  it("15. localizes the widget in every catalog and keeps packaged copies identical", async () => {
    const keys = (locale: string) =>
      Object.keys(
        JSON.parse(readWeb(`features/i18n/messages/${locale}.json`)).initiativeExperience
          .petitionsWidget,
      ).sort();
    for (const locale of ["uk", "ar", "zh-Hant"]) {
      assert.deepEqual(keys(locale), keys("en"), locale);
    }
    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      assert.equal(
        readFileSync(
          path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
          "utf8",
        ),
        readWeb(`features/i18n/messages/${locale}.json`),
        locale,
      );
    }

    const uk = text(
      await render(widget(ready([A, B, item("petition-c", "Третя", 3)]), { expanded: true }), "uk"),
    );
    assert.match(uk, /^Петиції 3 3 активні петиції/);
    assert.match(uk, /1 підпис/);
    assert.match(uk, /3 підписи/);
    assert.match(uk, /12 підписів/);

    const ar = text(await render(widget(ready([A, B]), { expanded: true }), "ar"));
    assert.match(ar, /العرائض/);
    assert.match(ar, /عريضتان نشطتان/);

    const zh = text(await render(widget(ready([A]), { expanded: true }), "zh-Hant"));
    assert.match(zh, /請願 1 1 項進行中的請願/);
    assert.match(zh, /1 個簽署/);
  });
});
