/**
 * HU-LC-05C.4C.7C.2 — the steward's Editing Petition workspace on
 * `/petitions/<id>`: two submenus, working-draft list and slots, the shared
 * Petition editor bound to independent drafts, explicit confirmations, and
 * the path from the Initiative Petition stage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { NextIntlClientProvider } from "next-intl";

import type { PublicPetitionListItem, PublicPetitionRecord } from "@hu/types";

import { ApiRequestError } from "../../lib/api-client.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  createPetitionWorkingDraft,
  deletePetitionWorkingDraft,
  generatePetitionWorkingDraft,
  listPetitionWorkingDrafts,
  publishPetitionWorkingDraft,
  savePetitionWorkingDraft,
  type PetitionWorkingDraft,
} from "./api.js";
import { InitiativePetitionStewardStageView } from "./components/InitiativePetitionStewardStageView.js";
import { PetitionDocumentViewsTabs } from "./components/PetitionDocumentViews.js";
import {
  PetitionEditingWorkspacePanel,
  type PetitionEditingWorkspacePanelProps,
} from "./components/PetitionEditingWorkspacePanel.js";
import {
  buildPetitionEditingHref,
  buildWorkingDraftSaveInput,
  classifyPetitionDraftError,
  computePetitionSlotSummary,
  petitionDraftErrorRequiresReload,
  presentWorkingDraftForEditor,
  readPetitionDocumentView,
  selectInitiativePublishedPetitions,
  unresolvedPetitionPublishRequirements,
  workingDraftHasContent,
} from "./petition-editing-workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const INITIATIVE = "initiative-a";
const CURRENT = "petition-current";
const TOKEN_TITLE = "Crossings after the {lifecycleStage:analysis}";

function draft(overrides: Partial<PetitionWorkingDraft> = {}): PetitionWorkingDraft {
  return {
    draftId: "initiative-petition-draft-1",
    initiativeId: INITIATIVE,
    authorId: "member-steward",
    title: TOKEN_TITLE,
    publicSummary: "Summary of the {lifecycleStage:proposal}.",
    requestStatement: "Fund safe crossings.",
    expectedOutcome: "Crossings near schools.",
    supportingContext: "",
    keyArguments: ["After the {lifecycleStage:analysis}.", "Children walk daily."],
    recipients: ["City Council"],
    derivedFromPetitionId: CURRENT,
    revisionId: "revision-1",
    revisionVersion: 2,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: "2026-11-11T10:00:00.000Z",
    updatedAt: "2026-11-11T11:00:00.000Z",
    ...overrides,
  };
}

function published(petitionId: string, initiativeId = INITIATIVE, createdAt = "2026-11-10T10:00:00.000Z") {
  return {
    petitionId,
    collectiveDecisionId: `decision-${petitionId}`,
    status: "Open",
    createdAt,
    updatedAt: createdAt,
    subject: { decisionId: `decision-${petitionId}`, initiativeId, title: `Title ${petitionId}`, summary: "" },
  } as unknown as PublicPetitionRecord;
}

async function render(element: React.ReactElement, locale = "en"): Promise<string> {
  const messages = (await loadUiMessagesForLocale(locale)).messages;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages, timeZone: "UTC" } as React.ComponentProps<typeof NextIntlClientProvider>,
      element,
    ),
  );
}

function panel(overrides: Partial<PetitionEditingWorkspacePanelProps> = {}) {
  const props: PetitionEditingWorkspacePanelProps = {
    currentPetitionId: CURRENT,
    state: { status: "ready", drafts: [draft()], published: [published(CURRENT)] },
    slots: computePetitionSlotSummary({ draftCount: 1, publishedCount: 1 }),
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
    ...overrides,
  };
  return createElement(PetitionEditingWorkspacePanel, props);
}

type Captured = { method: string; url: string; body: unknown };
const realFetch = globalThis.fetch;

function stubFetch(data: unknown, status = 200): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({ success: status < 400, data, meta: {}, links: {}, message: "server text" }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("HU-LC-05C.4C.7C.2 — working-draft API client", () => {
  const base = `/api/v1/initiative-petitions/initiative/${INITIATIVE}/drafts`;

  it("lists, creates (empty and derived), saves, generates, publishes and deletes per draft", async () => {
    const calls = stubFetch(draft());
    await listPetitionWorkingDrafts(INITIATIVE);
    await createPetitionWorkingDraft(INITIATIVE);
    await createPetitionWorkingDraft(INITIATIVE, CURRENT);
    await savePetitionWorkingDraft(INITIATIVE, "d-1", { title: "T", recipients: ["Mayor"] });
    await generatePetitionWorkingDraft(INITIATIVE, "d-1", false);
    await generatePetitionWorkingDraft(INITIATIVE, "d-1", true);
    await publishPetitionWorkingDraft(INITIATIVE, "d-1");
    await deletePetitionWorkingDraft(INITIATIVE, "d-1");

    assert.deepEqual(
      calls.map(({ method, url, body }) => [method, url.slice(url.indexOf("/api/")), body]),
      [
        ["GET", base, undefined],
        ["POST", base, {}],
        ["POST", base, { derivedFromPetitionId: CURRENT }],
        ["PATCH", `${base}/d-1`, { title: "T", recipients: ["Mayor"] }],
        ["POST", `${base}/d-1/generate`, { overwrite: false }],
        ["POST", `${base}/d-1/generate`, { overwrite: true }],
        ["POST", `${base}/d-1/publish`, undefined],
        ["DELETE", `${base}/d-1`, undefined],
      ],
    );
  });

  it("surfaces 403 / 409 as ApiRequestError with the HTTP status", async () => {
    for (const status of [403, 409]) {
      stubFetch(null, status);
      await assert.rejects(
        () => createPetitionWorkingDraft(INITIATIVE),
        (error: unknown) => error instanceof ApiRequestError && error.status === status,
      );
    }
  });
});

describe("HU-LC-05C.4C.7C.2 — slots, errors and token-safe editing", () => {
  it("counts published Petitions and drafts against three slots", () => {
    assert.deepEqual(computePetitionSlotSummary({ draftCount: 0, publishedCount: 1 }), {
      limit: 3,
      occupied: 1,
      available: 2,
    });
    assert.deepEqual(computePetitionSlotSummary({ draftCount: 2, publishedCount: 1 }), {
      limit: 3,
      occupied: 3,
      available: 0,
    });
    assert.equal(computePetitionSlotSummary({ draftCount: 3, publishedCount: 2 }).available, 0);
    const mine = selectInitiativePublishedPetitions(
      [
        published("p-late", INITIATIVE, "2026-11-12T00:00:00.000Z"),
        published("p-other", "initiative-b"),
        published("p-early", INITIATIVE, "2026-11-01T00:00:00.000Z"),
      ],
      INITIATIVE,
    );
    assert.deepEqual(mine.map((petition) => petition.petitionId), ["p-early", "p-late"]);
  });

  it("classifies failures by status and operation, never by server wording", () => {
    const err = (status: number) => new ApiRequestError("anything at all", status);
    assert.equal(classifyPetitionDraftError(err(401), { operation: "save" }), "signIn");
    assert.equal(classifyPetitionDraftError(err(403), { operation: "load" }), "forbidden");
    assert.equal(classifyPetitionDraftError(err(404), { operation: "save" }), "notFound");
    assert.equal(classifyPetitionDraftError(err(400), { operation: "save" }), "invalid");
    assert.equal(classifyPetitionDraftError(err(0), { operation: "load" }), "unavailable");
    assert.equal(classifyPetitionDraftError(err(409), { operation: "create" }), "slotLimit");
    assert.equal(
      classifyPetitionDraftError(err(409), { operation: "createDerived", slotsAvailable: 0 }),
      "slotLimit",
    );
    assert.equal(
      classifyPetitionDraftError(err(409), { operation: "createDerived", slotsAvailable: 1 }),
      "sourceUnavailable",
    );
    assert.equal(classifyPetitionDraftError(err(409), { operation: "publish" }), "staleRevision");
    assert.equal(classifyPetitionDraftError(err(409), { operation: "save" }), "beingPublished");
    assert.equal(
      classifyPetitionDraftError(err(409), { operation: "generate", overwrite: false }),
      "overwriteRequired",
    );
    assert.equal(
      classifyPetitionDraftError(err(409), { operation: "generate", overwrite: true }),
      "generateConflict",
    );
    assert.equal(classifyPetitionDraftError(new Error("x"), { operation: "save" }), "unknown");
    for (const kind of ["staleRevision", "slotLimit", "notFound", "beingPublished"] as const) {
      assert.equal(petitionDraftErrorRequiresReload(kind), true, kind);
    }
    assert.equal(petitionDraftErrorRequiresReload("invalid"), false);

    const source = readWeb("features/initiative-petition-lifecycle/petition-editing-workspace.ts");
    assert.doesNotMatch(source, /\.message/);
  });

  it("presents tokens as English labels and saves the canonical tokens back", () => {
    const canonical = draft();
    const presented = presentWorkingDraftForEditor(canonical);
    assert.equal(presented.title, "Crossings after the Collaborative Analysis");
    assert.doesNotMatch(JSON.stringify(presented), /\{lifecycleStage:/);

    assert.deepEqual(buildWorkingDraftSaveInput({ canonical, presented }), {
      title: canonical.title,
      publicSummary: canonical.publicSummary,
      requestStatement: canonical.requestStatement,
      expectedOutcome: canonical.expectedOutcome,
      supportingContext: canonical.supportingContext,
      keyArguments: [...canonical.keyArguments],
      recipients: ["City Council"],
    });

    const edited = buildWorkingDraftSaveInput({
      canonical,
      presented: {
        ...presented,
        title: "Safer crossings after the Collaborative Analysis",
        keyArguments: [...presented.keyArguments, "  "],
        recipients: [" City Council ", "", "Mayor"],
      },
    });
    assert.equal(edited.title, "Safer crossings after the {lifecycleStage:analysis}");
    assert.deepEqual(edited.keyArguments, [...canonical.keyArguments]);
    assert.deepEqual(edited.recipients, ["City Council", "Mayor"]);
  });

  it("asks before replacing content and lists missing publication requirements", () => {
    assert.equal(workingDraftHasContent(draft()), true);
    assert.equal(
      workingDraftHasContent(
        draft({
          title: " ",
          publicSummary: "",
          requestStatement: "",
          expectedOutcome: "",
          keyArguments: [],
        }),
      ),
      false,
    );
    assert.deepEqual(
      unresolvedPetitionPublishRequirements({
        fields: { title: "", publicSummary: "S", requestStatement: "", expectedOutcome: "O" },
        revisionId: null,
        revisionVersion: null,
      }),
      ["title", "requestStatement", "revisionReference"],
    );
  });

  it("the editor generates over content, publishes and saves only through explicit steps", () => {
    const editor = readWeb(
      "features/initiative-petition-lifecycle/components/PetitionWorkingDraftEditor.tsx",
    );
    assert.match(
      editor,
      /if \(workingDraftHasContent\(canonical\) \|\| presentedHasContent\(fields\)\) \{\s*setConfirmation\("generate"\);\s*return;\s*\}/,
    );
    assert.match(editor, /const overwrite = workingDraftHasContent\(canonical\);/);
    assert.equal((editor.match(/generatePetitionWorkingDraft\(/g) ?? []).length, 1);
    assert.match(editor, /isOpen=\{confirmation === "generate"\}[\s\S]*?onConfirm=\{\(\) => void runGenerate\(\)\}/);
    assert.match(editor, /isOpen=\{confirmation === "publish"\}[\s\S]*?onConfirm=\{\(\) => void runPublish\(\)\}/);
    assert.match(
      editor,
      /if \(!\(await handleSave\(\)\)\) \{\s*return;\s*\}\s*try \{\s*const petition = await publishPhase\.runSave\(\(\) =>\s*publishPetitionWorkingDraft/,
    );
    assert.equal((editor.match(/publishPetitionWorkingDraft\(/g) ?? []).length, 1);
    assert.match(editor, /buildWorkingDraftSaveInput\(\{ canonical, presented: fields \}\)/);
    assert.match(editor, /<PetitionEditorFields/);
    assert.doesNotMatch(editor, /TranslateDraftControl|window\.confirm|error\.message|detailFromError/);
  });

  it("both editors share one form", () => {
    const legacy = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    assert.match(legacy, /<PetitionEditorFields/);
    assert.doesNotMatch(legacy, /<textarea|<input/);
    assert.match(legacy, /generateInitiativePetitionDraft/);
    assert.match(legacy, /window\.confirm\(t\("author\.petition\.confirm\.publish"\)\)/);
  });
});

describe("HU-LC-05C.4C.7C.2 — Editing Petition workspace", () => {
  it("lists published Petitions read-only, drafts, and the slot count", async () => {
    const html = await render(panel());
    assert.match(html, /Petition slots: 2 of 3 in use, 1 available\./);
    assert.match(html, /Title petition-current/);
    // HU-LC-05C.4C.7C.3C — status badge, read-only label and current marker.
    assert.match(
      html,
      /<span class="workspace-badge workspace-badge--published">Open for signatures<\/span><span>Read-only<\/span><span class="ipl-editing__current">Open on this page<\/span>/,
    );
    assert.match(html, /Crossings after the Collaborative Analysis/);
    assert.doesNotMatch(html, /\{lifecycleStage:/);
    assert.match(html, /Based on a published Petition/);
    assert.match(html, />Edit</);
    assert.match(html, />Delete</);
    assert.match(html, />New empty draft</);
    assert.match(html, />New draft from this Petition</);
    assert.doesNotMatch(html, /<textarea|<input/, "published Petitions are never editable here");
  });

  it("disables creation when all three slots are used", async () => {
    const html = await render(
      panel({ slots: computePetitionSlotSummary({ draftCount: 2, publishedCount: 1 }) }),
    );
    assert.match(html, /All 3 slots are in use\. Delete a working draft to free a slot\./);
    assert.match(html, /<button type="button" class="workspace-button workspace-button--primary" disabled="">New empty draft<\/button>/);
    assert.match(html, /disabled="">New draft from this Petition<\/button>/);
  });

  it("offers a derived draft only from a published current Petition", async () => {
    const html = await render(
      panel({ state: { status: "ready", drafts: [], published: [published("p-other")] } }),
    );
    assert.doesNotMatch(html, /New draft from this Petition/);
    assert.match(html, /No working drafts yet\./);
  });

  it("explains deletion and the freed slot before deleting", async () => {
    const html = await render(panel({ pendingDelete: draft() }));
    assert.match(html, /role="alertdialog"/);
    assert.match(html, /Delete this working draft\?/);
    assert.match(
      html,
      /“Crossings after the Collaborative Analysis” will be deleted permanently\. Published Petitions are not affected, and the Petition slot becomes available again\./,
    );
    assert.match(html, />Delete draft</);
  });

  it("links a newly published Petition by its own identity", async () => {
    const html = await render(
      panel({
        notice: {
          tone: "success",
          text: "The draft was published as a new Petition.",
          publishedPetitionId: "petition-initiative-petition-draft-9",
        },
      }),
    );
    assert.match(html, /href="\/petitions\/petition-initiative-petition-draft-9"/);
    assert.match(html, />Open the new Petition</);
  });

  it("shows loading and failure states", async () => {
    assert.match(await render(panel({ state: { status: "loading" } })), /Loading Petition drafts…/);
    assert.match(
      await render(panel({ state: { status: "failed", kind: "forbidden" } })),
      /Only the Initiative steward can edit these Petitions\./,
    );
  });

  it("states that publication is immutable and independent", async () => {
    const en = (await loadUiMessagesForLocale("en")).messages as {
      initiativeExperience: { petitionEditing: { confirm: { publish: { description: string } } } };
    };
    const text = en.initiativeExperience.petitionEditing.confirm.publish.description;
    assert.match(text, /cannot be edited afterwards/);
    assert.match(text, /identity, signatures and publication history/);
  });
});

describe("HU-LC-05C.4C.7C.2 — Petition submenus and stage path", () => {
  const tabs = (canEdit: boolean, activeView: "status" | "editing") =>
    createElement(PetitionDocumentViewsTabs, {
      activeView,
      canEdit,
      onSelect: () => undefined,
      statusPanel: createElement("div", { id: "status-content" }, "STATUS"),
      editingPanel: createElement("div", { id: "editing-content" }, "EDITING"),
    });

  it("the steward sees Petition Status and Editing Petition", async () => {
    const html = await render(tabs(true, "editing"));
    assert.match(html, /role="tab"[^>]*>Petition Status</);
    assert.match(html, /aria-selected="true"[^>]*>Editing Petition</);
    assert.match(html, /EDITING/);
    assert.doesNotMatch(html, /STATUS/);
  });

  it("everyone else only gets Petition Status, even with ?view=editing", async () => {
    const html = await render(tabs(false, "editing"));
    assert.match(html, />Petition Status</);
    assert.doesNotMatch(html, /Editing Petition|EDITING/);
    assert.match(html, /STATUS/);
  });

  it("stewardship comes from the API, and the status view keeps the existing workspace", () => {
    const views = readWeb(
      "features/initiative-petition-lifecycle/components/PetitionDocumentViews.tsx",
    );
    assert.match(views, /listPetitionWorkingDrafts\(initiativeId\)\s*\.then\(\(\) => \{\s*if \(!cancelled\) setAccess\("steward"\);/);
    assert.match(views, /canEdit=\{access === "steward"\}/);
    assert.match(views, /if \(authStatus !== "authenticated"\) \{/);

    const page = readWeb("app/petitions/[petitionId]/page.tsx");
    assert.match(page, /<PetitionDocumentViews[\s\S]*?<PetitionWorkspace\s+initialPetition=\{petition\}/);
    assert.equal(readPetitionDocumentView("editing"), "editing");
    assert.equal(readPetitionDocumentView(["editing"]), "editing");
    assert.equal(readPetitionDocumentView("other"), "status");
    assert.equal(readPetitionDocumentView(undefined), "status");
  });

  it("the 7B steward navigator leads to Editing Petition", async () => {
    const item = (petitionId: string): PublicPetitionListItem => ({
      petitionId,
      title: `Title ${petitionId}`,
      lifecycleStatus: "Open",
      supportStatus: "Open for endorsement",
      publishedAt: "2026-03-04T10:00:00.000Z",
      signatureCount: 0,
    });
    const view = (selection: { kind: "default" } | { kind: "selected"; petitionId: string }) =>
      createElement(InitiativePetitionStewardStageView, {
        initiativeId: INITIATIVE,
        list: { status: "ready", initiativeId: INITIATIVE, petitions: [item("p-a"), item("p-b")] },
        selection,
        onOpenPetition: () => undefined,
        onReturnToEditing: () => undefined,
        onTogglePreview: () => undefined,
      });

    assert.equal(buildPetitionEditingHref("p-a"), "/petitions/p-a?view=editing");
    assert.match(await render(view({ kind: "default" })), /href="\/petitions\/p-a\?view=editing"[^>]*>Editing Petition</);
    assert.match(
      await render(view({ kind: "selected", petitionId: "p-b" })),
      /href="\/petitions\/p-b\?view=editing"[^>]*>Editing Petition</,
    );
    const empty = createElement(InitiativePetitionStewardStageView, {
      initiativeId: INITIATIVE,
      list: { status: "ready", initiativeId: INITIATIVE, petitions: [] },
      selection: { kind: "default" },
      onOpenPetition: () => undefined,
      onReturnToEditing: () => undefined,
      onTogglePreview: () => undefined,
    });
    assert.doesNotMatch(await render(empty), /Editing Petition/);
  });

  it("PUBLIC_CHOICE keeps no Petition stage navigator or editing path", () => {
    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    assert.match(page, /petitionList=\{showPetitionsWidget \? initiativePetitionList : undefined\}/);
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.doesNotMatch(center, /buildPetitionEditingHref|PetitionEditingWorkspace/);
  });
});

describe("HU-LC-05C.4C.7C.2 — localization", () => {
  type Tree = Record<string, unknown>;
  const flatten = (tree: Tree, prefix = "", out: Record<string, string> = {}) => {
    for (const [key, value] of Object.entries(tree)) {
      const next = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object") flatten(value as Tree, next, out);
      else out[next] = String(value);
    }
    return out;
  };
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("all four catalogs and their packaged copies carry the same petitionEditing keys", () => {
    const catalogs = Object.fromEntries(
      ["en", "uk", "zh-Hant", "ar"].map((locale) => {
        const web = readWeb(`features/i18n/messages/${locale}.json`);
        const packaged = readFileSync(
          path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
          "utf8",
        );
        assert.equal(packaged, web, `${locale} packaged copy`);
        const tree = JSON.parse(web) as { initiativeExperience: { petitionEditing: Tree } };
        return [locale, flatten(tree.initiativeExperience.petitionEditing)];
      }),
    );
    const enKeys = Object.keys(catalogs.en!).sort();
    assert.ok(enKeys.length >= 50);
    for (const [locale, flat] of Object.entries(catalogs)) {
      assert.deepEqual(Object.keys(flat).sort(), enKeys, locale);
      for (const key of enKeys) {
        assert.ok(flat[key]!.trim(), `${locale}.${key}`);
        assert.deepEqual(placeholders(flat[key]!), placeholders(catalogs.en![key]!), `${locale}.${key}`);
        if (locale !== "en" && !["published.open"].includes(key)) {
          assert.notEqual(flat[key], catalogs.en![key], `${locale}.${key} is translated`);
        }
      }
    }
  });

  it("every error kind has a message", async () => {
    const en = (await loadUiMessagesForLocale("en")).messages as {
      initiativeExperience: { petitionEditing: { errors: Record<string, string> } };
    };
    for (const kind of [
      "signIn",
      "forbidden",
      "notFound",
      "slotLimit",
      "sourceUnavailable",
      "staleRevision",
      "overwriteRequired",
      "generateConflict",
      "beingPublished",
      "invalid",
      "unavailable",
      "unknown",
    ]) {
      assert.ok(en.initiativeExperience.petitionEditing.errors[kind], kind);
    }
  });

  it("renders in Ukrainian without English chrome", async () => {
    const html = await render(panel({ pendingDelete: draft() }), "uk");
    for (const english of [
      "Editing Petition",
      "Published Petitions",
      "Working drafts",
      "New empty draft",
      "Delete this working draft",
      "Read-only",
      "Petition slots",
    ]) {
      assert.doesNotMatch(html, new RegExp(english), english);
    }
    assert.match(html, /Редагування петиції/);
    assert.match(html, /Слоти петицій: зайнято 2 з 3, вільно 1\./);
  });

  it("new components contain no literal JSX text", () => {
    for (const file of [
      "PetitionEditorFields.tsx",
      "PetitionWorkingDraftEditor.tsx",
      "PetitionEditingWorkspacePanel.tsx",
      "PetitionEditingWorkspace.tsx",
      "PetitionDocumentViews.tsx",
    ]) {
      const source = readWeb(`features/initiative-petition-lifecycle/components/${file}`);
      assert.deepEqual(source.match(/>\s*[A-Za-z][A-Za-z ,.']+\s*</g) ?? [], [], file);
    }
  });
});
