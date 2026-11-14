/**
 * HU-LC-05C.4C.7E.4 — published Petition reading views use the existing V5
 * Content Translation hook; editing keeps canonical text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PetitionState, PublicPetitionRecord } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { InitiativePetitionsHeroWidget } from "../initiative-petition-lifecycle/components/InitiativePetitionsHeroWidget";
import { buildWorkingDraftSaveInput } from "../initiative-petition-lifecycle/petition-editing-workspace";
import type { PetitionWorkingDraft } from "../initiative-petition-lifecycle/api";
import { resolveTranslatedContent } from "../language/translation-api";
import { PetitionReadingTitle } from "./components/PetitionReadingTitle";
import { PetitionWorkspace } from "./components/PetitionWorkspace";
import {
  petitionTranslationSourceId,
  selectPetitionReadingText,
} from "./use-petition-reading-text";

(globalThis as { React?: typeof React }).React = React;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const read = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");

let messages: AbstractIntlMessages = {};
before(async () => {
  messages = (await loadUiMessagesForLocale("en")).messages;
});

function render(element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "en", messages, timeZone: "UTC" } as React.ComponentProps<
        typeof NextIntlClientProvider
      >,
      element,
    ),
  );
}

const CANONICAL = { title: "Safer School Crossings", summary: "Protected crossings." };

describe("HU-LC-05C.4C.7E.4 — reading-text selection", () => {
  it("English / browser-native reading shows the canonical text", () => {
    const text = selectPetitionReadingText(
      { owner: "browser-native", presentationMode: "original", fields: CANONICAL, activeLanguage: "en" },
      CANONICAL,
    );
    assert.deepEqual(text, { ...CANONICAL, lang: undefined });
  });

  it("an available complete translation replaces title and summary and carries its language", () => {
    const text = selectPetitionReadingText(
      {
        owner: "hu-persisted",
        presentationMode: "localized",
        fields: { title: "Безпечні переходи", summary: "Захищені переходи." },
        activeLanguage: "uk",
      },
      CANONICAL,
    );
    assert.deepEqual(text, { title: "Безпечні переходи", summary: "Захищені переходи.", lang: "uk" });
  });

  it("missing or stale translations (hook presents the original) fall back to canonical text", () => {
    const text = selectPetitionReadingText(
      {
        owner: "hu-persisted",
        presentationMode: "original",
        fields: { title: "Stale translated title", summary: "Stale" },
        activeLanguage: "uk",
      },
      CANONICAL,
    );
    assert.deepEqual(text, { ...CANONICAL, lang: undefined });
  });

  it("never produces an empty title or summary", () => {
    const text = selectPetitionReadingText(
      { owner: "hu-persisted", presentationMode: "localized", fields: { title: " ", summary: "" }, activeLanguage: "ar" },
      CANONICAL,
    );
    assert.equal(text.title, CANONICAL.title);
    assert.equal(text.summary, CANONICAL.summary);
  });

  it("requests translations only for publicly readable Petition statuses", () => {
    for (const status of ["Published", "Open", "Closed", "Archived"] as PetitionState[]) {
      assert.equal(petitionTranslationSourceId("petition-a", status), "petition-a", status);
    }
    for (const status of ["Draft", "Ready"] as PetitionState[]) {
      assert.equal(petitionTranslationSourceId("petition-a", status), "", status);
    }
    assert.equal(petitionTranslationSourceId("petition-a"), "petition-a");
  });
});

describe("HU-LC-05C.4C.7E.4 — request deduplication", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("shares identical concurrent lookups and keeps Petitions and languages separate", async () => {
    const urls: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = (async (url: string | URL) => {
      urls.push(String(url));
      await gate;
      return new Response(
        JSON.stringify({ success: true, data: { content: {}, presentationMode: "original" }, meta: {}, links: {}, message: "" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const a1 = resolveTranslatedContent({ sourceKind: "petition", sourceRecordId: "petition-a", language: "uk" });
    const a2 = resolveTranslatedContent({ sourceKind: "petition", sourceRecordId: "petition-a", language: "uk" });
    const b = resolveTranslatedContent({ sourceKind: "petition", sourceRecordId: "petition-b", language: "uk" });
    const aAr = resolveTranslatedContent({ sourceKind: "petition", sourceRecordId: "petition-a", language: "ar" });
    release();
    await Promise.all([a1, a2, b, aAr]);
    assert.equal(urls.length, 3, urls.join("\n"));
    assert.equal(urls.filter((url) => url.includes("/resolve/petition/petition-a?language=uk")).length, 1);
    assert.ok(urls.some((url) => url.includes("/resolve/petition/petition-b?language=uk")));
    assert.ok(urls.some((url) => url.includes("/resolve/petition/petition-a?language=ar")));

    await resolveTranslatedContent({ sourceKind: "petition", sourceRecordId: "petition-a", language: "uk" });
    assert.equal(urls.length, 4, "settled lookups are not cached");
  });
});

describe("HU-LC-05C.4C.7E.4 — reading views", () => {
  it("the Initiative widget keeps petitionId navigation and canonical fallback text", () => {
    const html = render(
      createElement(InitiativePetitionsHeroWidget, {
        list: {
          status: "ready",
          initiativeId: "initiative-1",
          petitions: [
            { petitionId: "petition-a", title: "Petition A title", signatureCount: 3 },
            { petitionId: "petition-b", title: "Petition B title", signatureCount: 2 },
          ],
        } as never,
        selectedPetitionId: "petition-a",
        stageHash: "petition",
        onSelectPetition: () => undefined,
        defaultExpanded: true,
      }),
    );
    assert.match(html, /href="\?petition=petition-a#petition"[^>]*><span dir="auto">Petition A title<\/span><\/a>/);
    assert.match(html, /href="\?petition=petition-b#petition"[^>]*><span dir="auto">Petition B title<\/span><\/a>/);
  });

  it("a reading title renders canonical text with no extra markup while untranslated", () => {
    assert.equal(
      render(createElement(PetitionReadingTitle, { petitionId: "petition-a", title: "Title A" })),
      '<span dir="auto">Title A</span>',
    );
    assert.equal(
      render(
        createElement(PetitionReadingTitle, {
          petitionId: "petition-a",
          title: "Title A",
          className: "ipl-steward-nav__petition-title",
        }),
      ),
      '<span class="ipl-steward-nav__petition-title" dir="auto">Title A</span>',
    );
  });

  it("Petition Status shows canonical title/summary and keeps signing and anchors", () => {
    const petition = {
      petitionId: "petition-a",
      collectiveDecisionId: "decision-a",
      status: "Open",
      createdAt: "2026-11-08T00:00:00.000Z",
      updatedAt: "2026-11-08T00:00:00.000Z",
      subject: {
        decisionId: "decision-a",
        initiativeId: "initiative-1",
        title: CANONICAL.title,
        summary: CANONICAL.summary,
      },
      policy: {
        endorsementPeriod: { opensAt: null, closesAt: null },
        withdrawalPolicy: { withdrawalPermitted: false, withdrawalPolicyDescription: null },
      },
      shareLink: null,
      supportMetrics: {
        totalSignatures: 3,
        participantSignatures: 3,
        dailyActivity: [],
        supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 3, thresholdCount: null },
      },
      outcome: null,
    } as unknown as PublicPetitionRecord;
    const html = render(
      createElement(PetitionWorkspace, {
        initialPetition: petition,
        collectiveDecision: null,
        initiative: null,
        collaborativeAnalysis: null,
      }),
    );
    assert.ok(html.includes(CANONICAL.title));
    assert.ok(html.includes(CANONICAL.summary));
    assert.match(html, /id="section-petition-status"/);
    assert.match(html, /id="section-signature"/);
    const workspace = read("features/petition/components/PetitionWorkspace.tsx");
    assert.match(workspace, /<SignatureSection\s+petition=\{petition\}/);
    assert.match(read("features/petition/components/SignatureSection.tsx"), /signPetitionAsCurrentParticipant\(petition\.petitionId, "Community"\)/);
  });
});

describe("HU-LC-05C.4C.7E.4 — steward editing stays canonical", () => {
  it("editing, draft and publication code never touches translated reading text", () => {
    for (const file of [
      "features/initiative-petition-lifecycle/components/PetitionEditingWorkspace.tsx",
      "features/initiative-petition-lifecycle/components/PetitionEditingWorkspacePanel.tsx",
      "features/initiative-petition-lifecycle/components/PetitionWorkingDraftEditor.tsx",
      "features/initiative-petition-lifecycle/components/PetitionEditorFields.tsx",
      "features/initiative-petition-lifecycle/petition-editing-workspace.ts",
      "features/initiative-petition-lifecycle/api.ts",
    ]) {
      const source = read(file);
      assert.doesNotMatch(
        source,
        /use-petition-reading-text|PetitionReadingTitle|useHuPersistedOrdinaryFields|PublicTranslatedFields|resolveTranslatedContent/,
        file,
      );
    }
  });

  it("the draft save payload carries the canonical source text", () => {
    const canonical = {
      draftId: "draft-1",
      initiativeId: "initiative-1",
      title: CANONICAL.title,
      publicSummary: CANONICAL.summary,
      requestStatement: "Request",
      expectedOutcome: "Outcome",
      supportingContext: "Context",
      keyArguments: ["One"],
      recipients: ["City Council"],
    } as unknown as PetitionWorkingDraft;
    const payload = buildWorkingDraftSaveInput({
      canonical,
      presented: {
        title: CANONICAL.title,
        publicSummary: CANONICAL.summary,
        requestStatement: "Request",
        expectedOutcome: "Outcome",
        supportingContext: "Context",
        keyArguments: ["One"],
        recipients: ["City Council"],
      } as never,
    });
    assert.equal(payload.title, CANONICAL.title);
    assert.equal(payload.publicSummary, CANONICAL.summary);
  });
});
