/**
 * HU-LC-05C.4C.7C.3D — published Petition cards in Editing Petition: titles
 * and a consistent "View Petition" action link to each Petition's own Status
 * view; the Petition already open switches in place; status stays text.
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

import type { PublicPetitionRecord } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  PetitionEditingWorkspacePanel,
  type PetitionEditingWorkspacePanelProps,
} from "./components/PetitionEditingWorkspacePanel.js";
import { resolvePetitionDocumentView } from "./components/PetitionDocumentViews.js";
import {
  buildPetitionStatusHref,
  computePetitionSlotSummary,
  readPetitionDocumentView,
  shouldShowPetitionStatusInPlace,
} from "./petition-editing-workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const read = (relative: string) => readFileSync(path.join(webSrc, relative), "utf8");

const CURRENT = "petition-current";
const OTHER = "petition-other";

function published(petitionId: string, status = "Open"): PublicPetitionRecord {
  return {
    petitionId,
    collectiveDecisionId: `decision-${petitionId}`,
    status,
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    subject: {
      decisionId: `decision-${petitionId}`,
      initiativeId: "initiative-a",
      title: `Title ${petitionId}`,
      summary: "",
    },
  } as unknown as PublicPetitionRecord;
}

async function render(locale = "en"): Promise<string> {
  const messages = (await loadUiMessagesForLocale(locale)).messages;
  const publishedList = [published(CURRENT), published(OTHER, "Closed")];
  const props: PetitionEditingWorkspacePanelProps = {
    currentPetitionId: CURRENT,
    state: { status: "ready", drafts: [], published: publishedList },
    slots: computePetitionSlotSummary({ draftCount: 0, publishedCount: publishedList.length }),
    busy: false,
    notice: null,
    selectedDraftId: null,
    pendingDelete: null,
    editor: null,
    onCreateEmpty: () => undefined,
    onCreateFromCurrent: () => undefined,
    onRefresh: () => undefined,
    onSelectDraft: () => undefined,
    onRequestDelete: () => undefined,
    onCancelDelete: () => undefined,
    onConfirmDelete: () => undefined,
    onShowPetitionStatus: () => undefined,
  };
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(PetitionEditingWorkspacePanel, props),
    ),
  );
}

function publishedCards(html: string): string[] {
  return [
    ...html.matchAll(/<li class="ipl-editing__card ipl-editing__card--published"[\s\S]*?<\/li>/g),
  ].map((match) => match[0]);
}

const click = (overrides: Partial<Parameters<typeof shouldShowPetitionStatusInPlace>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe("HU-LC-05C.4C.7C.3D — published Petition navigation", () => {
  it("every published title is a link to that Petition's own Status view", async () => {
    const [current, other] = publishedCards(await render());
    assert.ok(current && other);
    assert.match(
      current,
      /<a class="ipl-editing__item-title ipl-editing__title-link" href="\/petitions\/petition-current">Title petition-current<\/a>/,
    );
    assert.match(
      other,
      /<a class="ipl-editing__item-title ipl-editing__title-link" href="\/petitions\/petition-other">Title petition-other<\/a>/,
    );
    assert.equal(buildPetitionStatusHref("p/1 a"), "/petitions/p%2F1%20a");
    assert.equal(readPetitionDocumentView(undefined), "status", "no ?view opens Petition Status");
  });

  it("every published Petition, including the open one, has View Petition", async () => {
    const cards = publishedCards(await render());
    assert.equal(cards.length, 2);
    for (const [card, id] of [
      [cards[0]!, CURRENT],
      [cards[1]!, OTHER],
    ] as const) {
      assert.match(card, new RegExp(`<a class="ipl-editing__item-link" href="/petitions/${id}">View Petition</a>`));
    }
    const uk = publishedCards(await render("uk"));
    assert.match(uk[0]!, />Переглянути петицію<\/a>/, "existing manage.links.viewPetition key");
  });

  it("status, read-only and current markers stay informational", async () => {
    const [current, other] = publishedCards(await render());
    assert.match(current!, /<span class="workspace-badge workspace-badge--published">Open for signatures<\/span>/);
    assert.match(current!, /<span>Read-only<\/span>/);
    assert.match(current!, /<span class="ipl-editing__current">Open on this page<\/span>/);
    assert.match(other!, /<span class="workspace-badge workspace-badge--closed">Closed<\/span>/);
    for (const card of [current!, other!]) {
      assert.equal((card.match(/<a /g) ?? []).length, 2, "only the title and View Petition are links");
      assert.doesNotMatch(card, /<button|<input|<textarea|tabindex|role="(button|link)"/);
    }
  });

  it("the open Petition switches to Status in place; other clicks follow the link", () => {
    assert.equal(shouldShowPetitionStatusInPlace(click(), true), true);
    assert.equal(shouldShowPetitionStatusInPlace(click(), false), false, "another Petition navigates");
    for (const modified of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      assert.equal(shouldShowPetitionStatusInPlace(click(modified), true), false, JSON.stringify(modified));
    }

    const panel = read("features/initiative-petition-lifecycle/components/PetitionEditingWorkspacePanel.tsx");
    assert.match(
      panel,
      /if \(onShowPetitionStatus && shouldShowPetitionStatusInPlace\(event, isCurrent\)\) \{\s*event\.preventDefault\(\);\s*onShowPetitionStatus\(\);/,
    );
    assert.equal((panel.match(/onClick=\{\(event\) => openPublishedPetition\(event, isCurrent\)\}/g) ?? []).length, 2);

    const views = read("features/initiative-petition-lifecycle/components/PetitionDocumentViews.tsx");
    assert.match(
      views,
      /function showPetitionStatus\(\) \{\s*selectView\("status"\);\s*window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\);/,
    );
    assert.match(views, /onShowPetitionStatus=\{showPetitionStatus\}/);
    assert.match(views, /url\.searchParams\.delete\(PETITION_VIEW_QUERY_PARAM\);/, "?view=editing is cleared");
    assert.match(
      read("features/initiative-petition-lifecycle/components/PetitionEditingWorkspace.tsx"),
      /onShowPetitionStatus=\{onShowPetitionStatus\}/,
    );
  });

  it("navigation never touches signatures, drafts or editing rights", () => {
    const panel = read("features/initiative-petition-lifecycle/components/PetitionEditingWorkspacePanel.tsx");
    assert.match(panel, /^import type \{ PetitionWorkingDraft \} from "\.\.\/api";$/m);
    assert.doesNotMatch(panel, /apiRequest|fetch\(|signPetition|withdraw|deletePetition|publishPetition/);
    assert.equal(resolvePetitionDocumentView("editing", false), "status", "non-stewards never edit");
  });

  it("links look like links, badges like labels, with no overflow rules", () => {
    const css = read("features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css");
    assert.match(css, /\.ipl-editing__item-link \{[^}]*text-decoration: underline;/);
    assert.match(css, /\.ipl-editing__title-link:hover,\s*\.ipl-editing__title-link:focus-visible \{[^}]*text-decoration: underline;/);
    assert.match(css, /\.ipl-editing \.workspace-badge \{\s*text-transform: none;\s*cursor: default;\s*\}/);
    assert.match(css, /\.ipl-editing \.workspace-badge--published \{[^}]*background: var\(--hu-color-primary-soft\);/);
    assert.doesNotMatch(css, /overflow-x/);
    assert.match(css, /\.ipl-editing__card,\s*\.ipl-editing__empty \{[^}]*flex-wrap: wrap;/, "cards still wrap on mobile");
  });
});
