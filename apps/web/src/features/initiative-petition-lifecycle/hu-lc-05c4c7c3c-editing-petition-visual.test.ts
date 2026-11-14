/**
 * HU-LC-05C.4C.7C.3C — Editing Petition visual hierarchy: separated sections,
 * a compact three-slot indicator, distinct published (read-only) and draft
 * cards on white surfaces, clear action hierarchy and a document-style editor
 * panel. Styling is token-only; nothing changes behaviour or slot rules.
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
import type { PetitionWorkingDraft } from "./api.js";
import {
  PetitionEditingWorkspacePanel,
  type PetitionEditingWorkspacePanelProps,
} from "./components/PetitionEditingWorkspacePanel.js";
import {
  buildPetitionSlotSegments,
  computePetitionSlotSummary,
} from "./petition-editing-workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const STAGE_CSS = path.join(
  webSrc,
  "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css",
);

const CURRENT = "petition-current";

function draft(index: number, overrides: Partial<PetitionWorkingDraft> = {}): PetitionWorkingDraft {
  return {
    draftId: `initiative-petition-draft-${index}`,
    initiativeId: "initiative-a",
    authorId: "member-steward",
    title: `Draft ${index}`,
    publicSummary: "",
    requestStatement: "",
    expectedOutcome: "",
    supportingContext: "",
    keyArguments: [],
    recipients: [],
    derivedFromPetitionId: null,
    revisionId: null,
    revisionVersion: null,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: "2026-11-11T10:00:00.000Z",
    updatedAt: "2026-11-11T11:00:00.000Z",
    ...overrides,
  };
}

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

async function render(
  overrides: Partial<PetitionEditingWorkspacePanelProps> & {
    drafts?: PetitionWorkingDraft[];
    publishedList?: PublicPetitionRecord[];
  } = {},
  locale = "en",
): Promise<string> {
  const { drafts = [draft(1)], publishedList = [published(CURRENT)], ...rest } = overrides;
  const messages = (await loadUiMessagesForLocale(locale)).messages;
  const props: PetitionEditingWorkspacePanelProps = {
    currentPetitionId: CURRENT,
    state: { status: "ready", drafts, published: publishedList },
    slots: computePetitionSlotSummary({
      draftCount: drafts.length,
      publishedCount: publishedList.length,
    }),
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
    ...rest,
  };
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      createElement(PetitionEditingWorkspacePanel, props),
    ),
  );
}

const segmentsIn = (html: string) => [...html.matchAll(/data-slot="(\w+)"/g)].map((m) => m[1]);

function cards(html: string, kind: "published" | "draft"): string[] {
  return [...html.matchAll(new RegExp(`<li class="ipl-editing__card ipl-editing__card--${kind}"[\\s\\S]*?</li>`, "g"))].map(
    (match) => match[0],
  );
}

describe("HU-LC-05C.4C.7C.3C — slot indicator", () => {
  it("shows 0, 1, 2 and 3 occupied slots, published first, never more than three", () => {
    assert.deepEqual(buildPetitionSlotSegments({ publishedCount: 0, draftCount: 0 }), [
      "available",
      "available",
      "available",
    ]);
    assert.deepEqual(buildPetitionSlotSegments({ publishedCount: 1, draftCount: 0 }), [
      "published",
      "available",
      "available",
    ]);
    assert.deepEqual(buildPetitionSlotSegments({ publishedCount: 1, draftCount: 1 }), [
      "published",
      "draft",
      "available",
    ]);
    assert.deepEqual(buildPetitionSlotSegments({ publishedCount: 2, draftCount: 1 }), [
      "published",
      "published",
      "draft",
    ]);
    assert.deepEqual(buildPetitionSlotSegments({ publishedCount: 0, draftCount: 3 }), [
      "draft",
      "draft",
      "draft",
    ]);
    assert.equal(buildPetitionSlotSegments({ publishedCount: 4, draftCount: 2 }).length, 3);
  });

  it("renders the meter, the existing summary text and a legend", async () => {
    const empty = await render({ drafts: [], publishedList: [] });
    assert.deepEqual(segmentsIn(empty), ["available", "available", "available"]);
    assert.match(empty, /Petition slots: 0 of 3 in use, 3 available\./);

    const two = await render();
    assert.deepEqual(segmentsIn(two), ["published", "draft", "available"]);
    assert.match(two, /<div class="ipl-editing__slot-meter" aria-hidden="true">/);
    assert.match(two, /role="status">Petition slots: 2 of 3 in use, 1 available\./);
    assert.match(two, />Published<\/li><li[^>]*>Draft<\/li><li[^>]*>Available<\/li>/);

    const full = await render({ drafts: [draft(1), draft(2)] });
    assert.deepEqual(segmentsIn(full), ["published", "draft", "draft"]);
    assert.match(full, /All 3 slots are in use\./);
    assert.match(full, /disabled="">New empty draft</);
    assert.match(full, /disabled="">New draft from this Petition</);
  });
});

describe("HU-LC-05C.4C.7C.3C — published and draft cards", () => {
  it("published Petitions are locked, read-only cards; the open one is marked", async () => {
    const html = await render({ publishedList: [published(CURRENT), published("p-closed", "Closed")] });
    const [current, closed] = cards(html, "published");
    assert.ok(current && closed);
    assert.match(current, /aria-current="true"/);
    assert.match(current, /<svg class="ipl-editing__icon"[^>]*aria-hidden="true"/);
    assert.match(current, /workspace-badge--published">Open for signatures</);
    assert.match(current, /<span>Read-only<\/span>/);
    assert.match(current, /ipl-editing__current">Open on this page</);
    // HU-LC-05C.4C.7C.3D — every published Petition, including the open one, can be viewed.
    assert.match(current, /href="\/petitions\/petition-current">View Petition</);
    assert.match(closed, /workspace-badge--closed">Closed</);
    assert.match(closed, /href="\/petitions\/p-closed">View Petition</);
    for (const card of [current, closed]) {
      assert.doesNotMatch(card, /<button|<input|<textarea/, "no editing controls on published documents");
    }
  });

  it("drafts are distinct cards with a Draft badge, Edit and Delete", async () => {
    const html = await render({
      drafts: [draft(1, { derivedFromPetitionId: CURRENT }), draft(2, { title: "" })],
      selectedDraftId: "initiative-petition-draft-1",
    });
    const [selected, untitled] = cards(html, "draft");
    assert.ok(selected && untitled);
    assert.match(selected, /aria-current="true"/);
    assert.match(selected, /ipl-editing__card-icon--draft"><svg class="ipl-editing__icon"/);
    assert.match(selected, /workspace-badge--draft">Working draft</);
    assert.match(selected, /Based on a published Petition/);
    assert.match(selected, /workspace-button--secondary" disabled="">Editing</);
    assert.match(selected, /workspace-button--danger">Delete</);
    assert.match(untitled, />Untitled draft</);
    assert.match(untitled, /workspace-button--secondary">Edit</);
  });

  it("the empty state explains how to start", async () => {
    const html = await render({ drafts: [] });
    assert.match(html, /<div class="ipl-editing__empty">/);
    assert.match(html, /No working drafts yet\./);
    assert.match(html, /Start with an empty draft or from this Petition\. Each draft uses one of the three Petition slots\./);
  });
});

describe("HU-LC-05C.4C.7C.3C — actions and editor panel", () => {
  it("New empty draft leads, the derived draft follows, Refresh stays compact", async () => {
    const html = await render();
    assert.match(
      html,
      /<button type="button" class="workspace-button workspace-button--primary">New empty draft<\/button><button type="button" class="workspace-button workspace-button--secondary">New draft from this Petition<\/button>/,
    );
    assert.match(html, /<button type="button" class="ipl-editing__refresh">Refresh<\/button>/);
  });

  it("the selected draft's editor sits in its own document panel", async () => {
    const withEditor = await render({ editor: createElement("div", { id: "editor" }, "EDITOR") });
    assert.match(withEditor, /<section class="ipl-editing__editor-panel"><div id="editor">EDITOR<\/div><\/section>/);
    assert.doesNotMatch(await render(), /ipl-editing__editor-panel/);
  });

  it("sections are separated and labelled", async () => {
    const html = await render();
    assert.equal((html.match(/<section class="ipl-editing__section/g) ?? []).length, 3);
    assert.match(html, /aria-labelledby="ipl-editing-published"/);
    assert.match(html, /aria-labelledby="ipl-editing-drafts"/);
  });
});

describe("HU-LC-05C.4C.7C.3C — theme and responsive rules", () => {
  const css = readFileSync(STAGE_CSS, "utf8");
  const editingCss = css.slice(css.indexOf(".ipl-editing {"));
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return editingCss.match(new RegExp(`(?:^|\\n)${escaped}[^{]*\\{([^}]*)\\}`))?.[1] ?? "";
  };

  it("cards and the editor panel use the white surface token; sections a subtle one", () => {
    assert.match(rule(".ipl-editing__card,"), /background: var\(--hu-color-surface\);/);
    assert.match(rule(".ipl-editing__editor-panel"), /background: var\(--hu-color-surface\);/);
    assert.match(rule(".ipl-editing__section"), /background: var\(--hu-color-bg-muted\);/);
    const tokens = readFileSync(path.join(webSrc, "design-system/tokens.css"), "utf8");
    assert.match(tokens, /--hu-color-surface: #ffffff;/, "white in the light theme");
  });

  it("colours come only from theme tokens, so a theme override applies everywhere", () => {
    assert.doesNotMatch(editingCss, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    assert.doesNotMatch(editingCss, /var\(--workspace-[a-z-]+, #/);
  });

  it("wraps on narrow screens without new overflow rules", () => {
    assert.doesNotMatch(css, /overflow-x/);
    assert.match(rule(".ipl-editing__card,"), /flex-wrap: wrap;/);
    assert.match(rule(".ipl-editing__card,"), /min-width: 0;/);
    assert.match(
      editingCss,
      /@media \(max-width: 480px\) \{[\s\S]*?\.ipl-editing__item-actions \{\s*width: 100%;/,
    );
    const initiative = readFileSync(
      path.join(webSrc, "features/public-initiative-experience/public-initiative-experience.css"),
      "utf8",
    );
    assert.equal((initiative.match(/overflow-x:\s*auto/g) ?? []).length, 1, "existing horizontal scrolling kept");
  });

  it("renders in Ukrainian with translated legend, badge and hint", async () => {
    const html = await render({ drafts: [] }, "uk");
    assert.match(html, />Опубліковано<\/li>/);
    assert.match(html, />Вільно<\/li>/);
    assert.match(html, /Почніть із порожньої чернетки/);
    assert.doesNotMatch(html, />(Published|Draft|Available|Working draft)</);
  });
});
