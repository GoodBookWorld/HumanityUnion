/**
 * HU-LC-05C.4C.7B — steward signing and multi-Petition navigation in the
 * Petition stage: the steward opens any published Petition of the
 * Initiative in its normal public (signing) mode, Manage Initiative is
 * reachable from the stage, and Public Preview / PUBLIC_CHOICE / anonymous
 * behaviour is unchanged.
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

import type {
  PublicInitiativeLifecycleStageNavItem,
  PublicPetitionListItem,
} from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { selectLifecycleNavStagesForDisplay } from "../public-initiative-experience/initiative-lifecycle-shell.js";
import { InitiativePetitionSignatureWidget } from "./components/InitiativePetitionSignatureWidget.js";
import {
  InitiativePetitionStewardStageView,
  type InitiativePetitionStewardStageViewProps,
} from "./components/InitiativePetitionStewardStageView.js";
import {
  resolvePetitionViewerSelection,
  resolveStewardPetitionStageView,
  type InitiativePetitionListState,
} from "./petition-viewer-selection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const INITIATIVE = "initiative-a";

function item(
  petitionId: string,
  overrides: Partial<PublicPetitionListItem> = {},
): PublicPetitionListItem {
  return {
    petitionId,
    title: `Title ${petitionId}`,
    lifecycleStatus: "Open",
    supportStatus: "Open for endorsement",
    publishedAt: "2026-03-04T10:00:00.000Z",
    signatureCount: 0,
    ...overrides,
  };
}

const READY: InitiativePetitionListState = {
  status: "ready",
  initiativeId: INITIATIVE,
  petitions: [item("petition-a", { signatureCount: 2 }), item("petition-b", { lifecycleStatus: "Closed" })],
};

async function renderStewardView(
  props: Partial<InitiativePetitionStewardStageViewProps>,
  locale = "en",
): Promise<string> {
  const messages = (await loadUiMessagesForLocale(locale)).messages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(InitiativePetitionStewardStageView, {
        initiativeId: INITIATIVE,
        list: READY,
        selection: { kind: "default" },
        onOpenPetition: () => undefined,
        onReturnToEditing: () => undefined,
        onTogglePreview: () => undefined,
        ...props,
      }),
    ),
  );
}

const STEWARD_VIEW = "features/initiative-petition-lifecycle/components/InitiativePetitionStewardStageView.tsx";
const CENTER = "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx";
const PAGE = "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx";
const SHELL =
  "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx";

describe("HU-LC-05C.4C.7B — steward Petition stage view", () => {
  it("stays the Author Workspace until a validated Petition is selected", () => {
    assert.deepEqual(resolveStewardPetitionStageView({ kind: "default" }), { kind: "editor" });
    assert.deepEqual(resolveStewardPetitionStageView({ kind: "pending" }), { kind: "pending" });
    assert.deepEqual(
      resolveStewardPetitionStageView({ kind: "selected", petitionId: "petition-b" }),
      { kind: "petition", petitionId: "petition-b" },
    );
    const foreign = resolvePetitionViewerSelection({
      initiativeId: INITIATIVE,
      requestedPetitionId: "petition-foreign",
      list: READY,
    });
    assert.deepEqual(resolveStewardPetitionStageView(foreign), { kind: "editor" });
  });

  it("lists every published Petition and opens each one independently", async () => {
    const opened: string[] = [];
    const html = await renderStewardView({
      selection: { kind: "selected", petitionId: "petition-b" },
      onOpenPetition: (petitionId) => opened.push(petitionId),
    });
    assert.match(html, /Title petition-a/);
    assert.match(html, /Title petition-b/);
    assert.match(html, /Open for signatures · 2 signatures/);
    assert.match(html, /Closed · 0 signatures/);
    assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
    assert.match(html, /aria-current="true"><span class="ipl-steward-nav__petition-title" dir="auto">Title petition-b</);
    assert.match(html, /Back to Author Workspace/);
    assert.match(html, /Loading Petition…/, "the opened Petition mounts the public result");

    const source = readWeb(STEWARD_VIEW);
    assert.match(source, /onClick=\{\(\) => onOpenPetition\(petition\.petitionId\)\}/);
    assert.match(source, /<InitiativePetitionPublicResult\s+key=\{view\.petitionId\}\s+petitionId=\{view\.petitionId\}/);
  });

  it("opens the Petition in normal public mode and reuses the shared signing components", () => {
    const source = readWeb(STEWARD_VIEW);
    assert.doesNotMatch(source, /isPreview=|isPreview: true/, "the steward view never forces Preview");
    assert.doesNotMatch(
      source,
      /signPetition|withdrawPetitionSignature|from "\.\.\/api"|from "\.\.\/\.\.\/petition\/api"/,
      "no signing, draft or publication calls of its own",
    );
    const result = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(result, /\{isPreview \? \([\s\S]*?previewSignatureDisabled[\s\S]*?<InitiativePetitionSignatureWidget/);
  });

  it("shows the editor when nothing is selected and a loading note while pending", async () => {
    const editor = await renderStewardView({});
    assert.doesNotMatch(editor, /Back to Author Workspace/);
    assert.doesNotMatch(editor, /aria-current/);

    const pending = await renderStewardView({ selection: { kind: "pending" } });
    assert.match(pending, /Loading Petition…/);
    assert.match(pending, /Back to Author Workspace/);
  });

  it("offers Manage Initiative only when the page allows it", async () => {
    const withManage = await renderStewardView({ onManageInitiative: () => undefined });
    assert.match(withManage, />Manage Initiative</);
    const withoutManage = await renderStewardView({});
    assert.doesNotMatch(withoutManage, /Manage Initiative/);

    const center = readWeb(CENTER);
    assert.match(
      center,
      /onManageInitiative=\{showManageTab \? \(\) => onTabChange\("manage"\) : undefined\}/,
    );
    const page = readWeb(PAGE);
    assert.match(page, /const canShowManage = viewerIsSteward && manageInitiative != null;/);
    assert.match(page, /showManageTab=\{canShowManage\}/);
    assert.match(page, /onTabChange=\{handleTabChange\}/);
  });

  it("covers list loading, failure with Retry, and empty states", async () => {
    assert.match(await renderStewardView({ list: { status: "loading" } }), /Loading Petitions…/);
    const failed = await renderStewardView({
      list: { status: "failed" },
      onRetryList: () => undefined,
    });
    assert.match(failed, /Petitions could not be loaded right now\./);
    assert.match(failed, /class="ipl-steward-nav__retry">Retry</);
    assert.match(
      await renderStewardView({ list: { status: "ready", initiativeId: INITIATIVE, petitions: [] } }),
      /This Initiative has no active Petitions yet\./,
    );
  });

  it("uses catalog labels in other languages (no hardcoded English)", async () => {
    const html = await renderStewardView(
      {
        selection: { kind: "selected", petitionId: "petition-a" },
        onManageInitiative: () => undefined,
      },
      "uk",
    );
    for (const english of ["Manage Initiative", "Back to Author Workspace", "Petitions", "signatures", "Open for signatures"]) {
      assert.doesNotMatch(html, new RegExp(`>${english}<|${english} ·|· [0-9]+ ${english}`), english);
    }
    const uk = (await loadUiMessagesForLocale("uk")).messages as {
      initiativeExperience: { manage: { title: string }; author: { shared: { backToAuthorWorkspace: string } } };
    };
    assert.ok(html.includes(uk.initiativeExperience.manage.title));
    assert.ok(html.includes(uk.initiativeExperience.author.shared.backToAuthorWorkspace));

    const source = readWeb(STEWARD_VIEW);
    const jsxText = source.match(/>\s*[A-Za-z][A-Za-z ]+\s*</g) ?? [];
    assert.deepEqual(jsxText, [], "no literal JSX text");
  });
});

describe("HU-LC-05C.4C.7B — unchanged boundaries", () => {
  it("mounts the steward view only in the steward's Author Workspace, never in Preview", () => {
    const center = readWeb(CENTER);
    assert.match(
      center,
      /activeStage\.stageId === "petition" \? \(\s*isOwnerRoute && petitionList && onSelectPetition && onClearPetitionSelection \? \(\s*<InitiativePetitionStewardStageView/,
    );
    const shell = readWeb(SHELL);
    assert.match(
      shell,
      /if \(isPreviewMode\) \{\s*return \(\s*<InitiativeLifecyclePublicResultPanel[\s\S]*?isPreview\s[\s\S]*?\{authorEditorSlot \?\?/,
      "Preview returns before the author slot is rendered",
    );
    assert.match(
      center,
      /<InitiativePetitionPublicResult\s+key=\{petitionView\.petitionId\}\s+petitionId=\{petitionView\.petitionId\}\s+isPreview=\{isStagePreviewMode\}/,
      "the stage public result still follows Preview",
    );
  });

  it("keeps PUBLIC_CHOICE without a Petition stage or steward navigator", () => {
    const stages = [
      { stageId: "initiative", state: "completed" },
      { stageId: "petition", state: "not_applicable" },
    ] as unknown as PublicInitiativeLifecycleStageNavItem[];
    const nav = selectLifecycleNavStagesForDisplay(stages, "PUBLIC_CHOICE");
    assert.equal(nav.some((stage) => stage.stageId === "petition"), false);

    const page = readWeb(PAGE);
    assert.match(page, /const showPetitionsWidget = petitionNavStage !== null && !readOnly;/);
    assert.match(page, /petitionList=\{showPetitionsWidget \? initiativePetitionList : undefined\}/);
    assert.match(page, /onSelectPetition=\{showPetitionsWidget \? handlePetitionSelect : undefined\}/);
    assert.match(
      page,
      /onClearPetitionSelection=\{\s*showPetitionsWidget \? handlePetitionSelectionClear : undefined\s*\}/,
    );
  });

  it("labels the way back as the Author Workspace in every catalog and packaged copy", () => {
    const repoRoot = path.resolve(webSrc, "../../..");
    for (const locale of ["en", "uk", "zh-Hant", "ar"]) {
      const web = readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8");
      const packaged = readFileSync(
        path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
        "utf8",
      );
      assert.equal(packaged, web, locale);
      const shared = (JSON.parse(web) as {
        initiativeExperience: { author: { shared: Record<string, string> } };
      }).initiativeExperience.author.shared;
      assert.ok(shared.backToAuthorWorkspace?.trim(), locale);
      assert.notEqual(shared.backToAuthorWorkspace, shared.returnToEditing, locale);
    }
    assert.match(readWeb(SHELL), /t\("author\.shared\.returnToEditing"\)/, "Preview toggle unchanged");
  });

  it("clears only ?petition= when returning to editing", () => {
    const page = readWeb(PAGE);
    assert.match(
      page,
      /const handlePetitionSelectionClear = \(\) => \{\s*setRequestedPetitionId\(null\);\s*setPetitionScrollRequestId\(null\);\s*window\.history\.replaceState\(null, "", removePetitionQueryParam\(window\.location\.href\)\);\s*\};/,
    );
  });

  it("still shows only the registration prompt to a viewer who is not signed in", async () => {
    const messages = (await loadUiMessagesForLocale("en")).messages;
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<
          typeof NextIntlClientProvider
        >,
        createElement(InitiativePetitionSignatureWidget, {
          petitionId: "petition-a",
          petitionStatus: "Open",
          viewerHasSigned: false,
          signingAvailable: true,
          onSignatureChange: () => undefined,
        }),
      ),
    );
    assert.match(html, /Sign in or register to sign this Petition\./);
    assert.doesNotMatch(html, /<button/);
  });

  it("leaves the public Petition list widget and publication flow untouched", () => {
    const steward = readWeb(STEWARD_VIEW);
    assert.doesNotMatch(steward, /from "\.\.\/api"|fetch\(|Draft\(/);
    const page = readWeb(PAGE);
    assert.match(page, /<InitiativePetitionsHeroWidget\s+list=\{initiativePetitionList\}/);
  });
});
