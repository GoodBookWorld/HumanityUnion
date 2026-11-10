/**
 * HU-LC-05C.4C.3B — public Petition document presentation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { NextIntlClientProvider } from "next-intl";

import type { InitiativeLifecycleStageProjection, PublicPetitionProjection } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { StageHeader } from "../initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.js";
import { InitiativeLifecyclePublicResultPanel } from "../initiative-lifecycle-stage-workspace/components/InitiativeLifecyclePublicResultPanel.js";
import {
  PublicTranslatedDocumentContent,
  PublicTranslatedFields,
} from "../language/components/PublicTranslatedFields.js";
import { InitiativePetitionPublicDocument } from "./components/InitiativePetitionPublicResult.js";
import {
  petitionDocumentRecipients,
  petitionDocumentRevisionReference,
  petitionDocumentStatusKey,
} from "./petition-public-document.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const PETITION_ID = "petition_internal_9f3c";
const REVISION_ID = "revision_internal_4b21";
const ANALYSIS_ID = "analysis_internal_7d10";
const PROPOSAL_IDS = ["proposal_internal_a1", "proposal_internal_b2"];
const PUBLISHED_AT = "2026-03-04T10:00:00.000Z";
const PUBLISHED_DATE_EN = "March 4, 2026";

const FIELDS = {
  title: "Safe crossings near every school",
  summary: "Residents ask for protected crossings on school routes.",
  requestStatement: "Install signalised crossings at the five listed junctions.",
  expectedOutcome: "Fewer collisions involving children walking to school.",
  supportingContext: "Two collisions were recorded on these routes last year.",
  keyArguments: ["Children walk these routes daily", "Low cost relative to harm prevented"],
};

function petitionProjection(
  overrides: {
    readonly recipients?: readonly string[];
    readonly lifecycleStatus?: PublicPetitionProjection["petitionIdentity"]["lifecycleStatus"];
    readonly traceability?: PublicPetitionProjection["traceability"];
    readonly expectedOutcome?: string;
  } = {},
): PublicPetitionProjection {
  return {
    petitionIdentity: {
      petitionId: PETITION_ID,
      title: FIELDS.title,
      supportStatus: "Open for support",
      lifecycleStatus: overrides.lifecycleStatus ?? "Open",
    },
    petitionSubject: {
      subjectType: "Initiative",
      initiativeId: "initiative_1",
      title: FIELDS.title,
      summary: FIELDS.summary,
      requestStatement: FIELDS.requestStatement,
      expectedOutcome:
        "expectedOutcome" in overrides ? overrides.expectedOutcome : FIELDS.expectedOutcome,
      supportingContext: FIELDS.supportingContext,
      keyArguments: FIELDS.keyArguments,
      ...(overrides.recipients ? { recipients: overrides.recipients } : {}),
    },
    petitionSummary: {
      purpose: "",
      followsApprovedDecisionStatement: "",
      publishedAt: PUBLISHED_AT,
      opensAt: null,
      closesAt: null,
    },
    traceability:
      "traceability" in overrides
        ? (overrides.traceability ?? null)
        : {
            revisionId: REVISION_ID,
            revisionVersion: 3,
            proposalIds: PROPOSAL_IDS,
            analysisId: ANALYSIS_ID,
            analysisVersion: 2,
          },
  } as unknown as PublicPetitionProjection;
}

function stageProjection(
  overrides: {
    readonly presentationMode?: InitiativeLifecycleStageProjection["presentationMode"];
    readonly canViewPublicResult?: boolean;
    readonly hasUnpublishedChanges?: boolean;
    readonly stageId?: string;
    readonly stageLabel?: string;
  } = {},
): InitiativeLifecycleStageProjection {
  const canViewPublicResult = overrides.canViewPublicResult ?? true;
  return {
    initiativeId: "initiative_1",
    initiativeTitle: "Initiative",
    stageId: overrides.stageId ?? "petition",
    stageLabel: overrides.stageLabel ?? "Petition",
    stageOrder: 8,
    stageHash: "#petition",
    viewerRole: "public",
    presentationMode: overrides.presentationMode ?? "public",
    metadata: {
      initiativeId: "initiative_1",
      stageId: overrides.stageId ?? "petition",
      presentationStatus: canViewPublicResult ? "published" : "draft",
      version: 4,
      draftUpdatedAt: null,
      publishedAt: canViewPublicResult ? PUBLISHED_AT : null,
      publishedByParticipantId: null,
      sourceSnapshotCreatedAt: null,
      hasUnpublishedChanges: overrides.hasUnpublishedChanges ?? false,
      canGenerate: false,
      canEdit: false,
      canPreview: false,
      canPublish: false,
      canViewPublicResult,
      publishedRecordId: canViewPublicResult ? PETITION_ID : null,
    },
    previousStage: null,
    nextStage: null,
  } as unknown as InitiativeLifecycleStageProjection;
}

type Messages = React.ComponentProps<typeof NextIntlClientProvider>["messages"];
const messageCache = new Map<string, Messages>();

async function messagesFor(locale: string): Promise<Messages> {
  const cached = messageCache.get(locale);
  if (cached) {
    return cached;
  }
  const messages = (await loadUiMessagesForLocale(locale)).messages as Messages;
  messageCache.set(locale, messages);
  return messages;
}

async function render(node: ReactNode, locale = "en"): Promise<string> {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        messages: await messagesFor(locale),
        timeZone: "UTC",
      } as React.ComponentProps<typeof NextIntlClientProvider>,
      node,
    ),
  );
}

/** Text a sighted reader sees: drops visually hidden / screen-reader-only nodes. */
function visibleText(html: string): string {
  return html
    .replace(
      /<(h2|span)[^>]*class="[^"]*(hu-visually-hidden|hu-public-translated-field__sr)[^"]*"[^>]*>[\s\S]*?<\/\1>/g,
      " ",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function count(haystack: string, needle: string | RegExp): number {
  if (typeof needle === "string") {
    return haystack.split(needle).length - 1;
  }
  return [...haystack.matchAll(new RegExp(needle.source, `${needle.flags.replace("g", "")}g`))]
    .length;
}

/** Public Petition stage exactly as the shell composes it for a visitor. */
async function renderPublicPetitionStage(
  petition: PublicPetitionProjection = petitionProjection(),
  options: { readonly locale?: string } = {},
): Promise<string> {
  const projection = stageProjection();
  return render(
    createElement(
      "section",
      { className: "lsw", "aria-labelledby": "lsw-stage-title-petition" },
      createElement(StageHeader, {
        projection,
        isPreviewMode: false,
        showStageOrdinal: true,
        documentPresentation: true,
      }),
      createElement(InitiativeLifecyclePublicResultPanel, {
        projection,
        presentation: "document",
        publicResultSlot: createElement(InitiativePetitionPublicDocument, {
          petitionId: PETITION_ID,
          projection: petition,
        }),
      }),
    ),
    options.locale,
  );
}

describe("HU-LC-05C.4C.3B — public Petition document presentation", () => {
  it("1. renders exactly one visible document heading — the Petition title", async () => {
    const html = await renderPublicPetitionStage();

    const headings = [...html.matchAll(/<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1>/g)];
    const visibleHeadings = headings.filter(
      ([, , attrs]) => !(attrs ?? "").includes("hu-visually-hidden"),
    );
    assert.equal(visibleHeadings.length, 1);
    assert.equal(visibleHeadings[0]?.[1], "3");
    assert.ok(visibleText(visibleHeadings[0]?.[3] ?? "").includes(FIELDS.title));
    assert.equal(count(visibleText(html), FIELDS.title), 1);
    assert.doesNotMatch(html, /lsw-result__title/);

    const stageHeading = headings.find(([, level]) => level === "2");
    assert.ok(stageHeading, "section keeps its labelled stage heading for assistive technology");
    assert.match(stageHeading[2] ?? "", /id="lsw-stage-title-petition"/);
    assert.match(stageHeading[2] ?? "", /hu-visually-hidden/);
    assert.doesNotMatch(visibleText(html), /\bPetition Title\b/);
  });

  it("2. exposes no internal Petition / Revision / Analysis / Proposal ids", async () => {
    const html = await renderPublicPetitionStage();
    const text = visibleText(html);

    for (const id of [REVISION_ID, ANALYSIS_ID, ...PROPOSAL_IDS]) {
      assert.equal(html.includes(id), false, `${id} must not be rendered`);
    }
    assert.equal(text.includes(PETITION_ID), false);
    assert.doesNotMatch(text, /Supporting (Revision|Analysis|Proposals)/);
  });

  it("3. shows no stage ordinal, mode line, version badge or repeated stage heading", async () => {
    const html = await renderPublicPetitionStage();
    const text = visibleText(html);

    assert.doesNotMatch(text, /Stage \d+ of \d+/i);
    assert.doesNotMatch(text, /Public view/);
    assert.doesNotMatch(text, /Version \d/);
    assert.doesNotMatch(html, /lsw-header__(order|version|mode|timestamp)/);
    assert.doesNotMatch(text, /(^|\s)Petition(\s|$)/);
  });

  it("4. replaces traceability with one plain reference and no empty entries", async () => {
    const text = visibleText(await renderPublicPetitionStage());
    assert.match(text, /Based on version 3 of the published Revision of this Initiative/);
    assert.doesNotMatch(text, /Traceability|none\b/);

    const noProposals = visibleText(
      await renderPublicPetitionStage(
        petitionProjection({
          traceability: {
            revisionId: REVISION_ID,
            revisionVersion: 0,
            proposalIds: [],
            analysisId: null,
            analysisVersion: null,
          },
        }),
      ),
    );
    assert.match(noProposals, /Based on the published Revision of this Initiative/);
    assert.doesNotMatch(noProposals, /version 0|Supporting Proposals|none\b/);

    const noTraceability = await renderPublicPetitionStage(
      petitionProjection({ traceability: null }),
    );
    assert.doesNotMatch(noTraceability, /ipl-document__reference|Based on/);

    assert.deepEqual(petitionDocumentRevisionReference(null), null);
    assert.deepEqual(
      petitionDocumentRevisionReference({
        revisionId: REVISION_ID,
        revisionVersion: 1.5,
        proposalIds: [],
        analysisId: null,
        analysisVersion: null,
      }),
      { key: "basedOnRevision" },
    );
  });

  it("5. shows the publication date exactly once", async () => {
    const text = visibleText(await renderPublicPetitionStage());
    assert.equal(count(text, PUBLISHED_DATE_EN), 1);
    assert.equal(count(text, /Published /), 1);
    assert.doesNotMatch(text, /Mar 4, 2026/);
  });

  it("6. shows recipients when available, trimmed and without blanks", async () => {
    const html = await renderPublicPetitionStage(
      petitionProjection({ recipients: ["  City Council ", "", "   ", "Department of Transport"] }),
    );
    const text = visibleText(html);

    assert.match(text, /Addressed to City Council Department of Transport/);
    assert.equal(count(html, "<li"), 2);
    assert.deepEqual(petitionDocumentRecipients({ recipients: [" A ", "", "B"] } as never), [
      "A",
      "B",
    ]);
  });

  it("7. omits the recipients block gracefully when none are recorded", async () => {
    for (const recipients of [undefined, [], ["  "]]) {
      const html = await renderPublicPetitionStage(
        petitionProjection(recipients ? { recipients } : {}),
      );
      assert.doesNotMatch(html, /ipl-document__recipients|Addressed to/);
    }
  });

  it("8. preserves every Petition field under reader-facing labels and skips empty sections", async () => {
    const text = visibleText(await renderPublicPetitionStage());

    for (const value of [
      FIELDS.title,
      FIELDS.summary,
      FIELDS.requestStatement,
      FIELDS.expectedOutcome,
      FIELDS.supportingContext,
      ...FIELDS.keyArguments,
    ]) {
      assert.ok(text.includes(value), `missing field content: ${value}`);
    }
    for (const label of [
      "Summary",
      "Request",
      "Expected Outcome",
      "Supporting Information",
      "Key Arguments",
    ]) {
      assert.match(text, new RegExp(`\\b${label}\\b`));
    }
    assert.doesNotMatch(text, /Public Summary|Request Statement|Supporting Context/);
    assert.match(text, /Open for signatures/);

    const withoutOutcome = visibleText(
      await renderPublicPetitionStage(petitionProjection({ expectedOutcome: "" })),
    );
    assert.doesNotMatch(withoutOutcome, /Expected Outcome/);

    const resultSource = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(
      resultSource,
      /fieldOrder=\{\[\s*"title",\s*"summary",\s*"requestStatement",\s*"expectedOutcome",\s*"supportingContext",\s*"keyArguments",\s*\]\}/,
      "persisted translation field bag for sourceKind petition is unchanged",
    );
    assert.equal(petitionDocumentStatusKey("Published"), null);
    assert.equal(petitionDocumentStatusKey("Closed"), "statusClosed");
    assert.equal(petitionDocumentStatusKey("Archived"), "statusArchived");
  });

  const ORIGINAL = {
    title: "Safe crossings",
    summary: "Protected crossings.",
    request: "Install them.",
  };
  const UK = {
    title: "Безпечні переходи",
    summary: "Захищені переходи.",
    request: "Встановіть їх.",
  };

  function documentContent(input: {
    readonly prefersOriginal: boolean;
    readonly canViewOriginal?: boolean;
    readonly isStale?: boolean;
  }) {
    return createElement(PublicTranslatedDocumentContent, {
      fieldOrder: ["title", "summary", "request"],
      fieldLabels: { summary: "Summary", request: "Request" },
      headingField: "title",
      fields: UK,
      originalFields: ORIGINAL,
      activeLanguage: "uk",
      originalLanguage: "en",
      canViewOriginal: input.canViewOriginal ?? true,
      isMachineTranslated: true,
      isStale: input.isStale ?? false,
      prefersOriginal: input.prefersOriginal,
      onPrefersOriginalChange: () => undefined,
    });
  }

  it("9. uses one shared translation area for the whole document", async () => {
    const html = await render(documentContent({ prefersOriginal: false }), "uk");

    assert.equal(count(html, 'class="hu-translated-content__meta"'), 1);
    assert.equal(count(html, "hu-translated-content__toggle"), 1);
    assert.equal(count(html, 'lang="uk"'), 3);
    for (const value of Object.values(UK)) {
      assert.ok(html.includes(value));
    }
    for (const value of Object.values(ORIGINAL)) {
      assert.equal(html.includes(value), false);
    }
    const metaIndex = html.indexOf("hu-translated-content__meta");
    assert.ok(html.indexOf("<h3") < metaIndex, "chrome sits below the document heading");
    assert.ok(metaIndex < html.indexOf("<h4"), "chrome sits above the first section");
  });

  it("10. keeps the original language accessible from the shared area", async () => {
    const original = await render(documentContent({ prefersOriginal: true }), "uk");
    assert.equal(count(original, 'lang="en"'), 3);
    for (const value of Object.values(ORIGINAL)) {
      assert.ok(original.includes(value));
    }
    assert.match(original, /aria-pressed="true"/);
    assert.equal(count(original, "hu-translated-content__toggle"), 1);

    const noTranslation = await render(
      documentContent({ prefersOriginal: false, canViewOriginal: false }),
      "en",
    );
    assert.doesNotMatch(noTranslation, /hu-translated-content__toggle/);
    assert.equal(count(noTranslation, 'class="hu-translated-content__meta"'), 1);

    const stale = await render(documentContent({ prefersOriginal: false, isStale: true }), "en");
    assert.equal(count(stale, "hu-translated-content__stale"), 1);

    const source = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.match(source, /originalPreferredFor === activeLanguage/);

    const ssrDocument = await render(
      createElement(PublicTranslatedFields, {
        presentation: "document",
        sourceKind: "petition",
        sourceRecordId: PETITION_ID,
        headingField: "title",
        fieldOrder: ["title", "summary"],
        fieldLabels: { summary: "Summary" },
        fallbackFields: { title: ORIGINAL.title, summary: ORIGINAL.summary },
      }),
    );
    assert.match(ssrDocument, /data-hu-localization-boundary="visible-content"/);
    assert.match(ssrDocument, /data-hu-presentation-layout="document"/);
    assert.equal(count(ssrDocument, 'class="hu-translated-content__meta"'), 1);
  });

  it("10b. leaves the default per-field presentation unchanged for other surfaces", async () => {
    const html = await render(
      createElement(PublicTranslatedFields, {
        sourceKind: "petition",
        sourceRecordId: PETITION_ID,
        fieldOrder: ["title", "summary"],
        fieldLabels: { title: "Title", summary: "Summary" },
        fallbackFields: { title: ORIGINAL.title, summary: ORIGINAL.summary },
      }),
    );
    assert.equal(count(html, 'class="hu-translated-content__meta"'), 2);
    assert.equal(count(html, "<h4>"), 2);
    assert.doesNotMatch(html, /data-hu-presentation-layout/);
  });

  it("11. keeps Author Workspace and Public Preview stage information", async () => {
    const authorHeader = visibleText(
      await render(
        createElement(StageHeader, {
          projection: stageProjection({ presentationMode: "author_workspace" }),
          isPreviewMode: false,
          showStageOrdinal: true,
          documentPresentation: true,
        }),
      ),
    );
    assert.match(authorHeader, /Stage 9 of 12/);
    assert.match(authorHeader, /Author Workspace/);
    assert.match(authorHeader, /Version 4/);

    const previewHeader = visibleText(
      await render(
        createElement(StageHeader, {
          projection: stageProjection({ presentationMode: "author_workspace" }),
          isPreviewMode: true,
          showStageOrdinal: true,
          documentPresentation: true,
        }),
      ),
    );
    assert.match(previewHeader, /Stage 9 of 12/);
    assert.match(previewHeader, /Public Preview/);

    const previewPanel = await render(
      createElement(InitiativeLifecyclePublicResultPanel, {
        projection: stageProjection({ presentationMode: "author_workspace" }),
        isPreview: true,
        presentation: "document",
        publicResultSlot: createElement(InitiativePetitionPublicDocument, {
          petitionId: PETITION_ID,
          projection: petitionProjection(),
        }),
      }),
    );
    assert.doesNotMatch(previewPanel, /lsw-result__title/);
    assert.equal(count(visibleText(previewPanel), PUBLISHED_DATE_EN), 1);

    const draftPreview = visibleText(
      await render(
        createElement(InitiativeLifecyclePublicResultPanel, {
          projection: stageProjection({
            presentationMode: "author_workspace",
            canViewPublicResult: false,
            hasUnpublishedChanges: true,
          }),
          isPreview: true,
          presentation: "document",
          publicResultSlot: createElement("p", null, "draft body"),
        }),
      ),
    );
    assert.match(draftPreview, /Draft preview — not yet published/);

    const workspace = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );
    assert.match(workspace, /isPreview\s+presentation=\{publishedResultPresentation\}/);
    assert.match(workspace, /projection\.presentationMode !== "author_workspace"/);
  });

  it("12. keeps sign / withdraw, counters, share and visitor signal wiring intact", () => {
    const source = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(
      source,
      /<InitiativePetitionPublicDocument petitionId=\{petitionId\} projection=\{projection\} \/>/,
    );
    assert.match(
      source,
      /<InitiativePetitionSignatureWidget\s+petitionId=\{petitionIdentity\.petitionId\}/,
    );
    assert.match(source, /viewerHasSigned=\{projection\.viewerHasSigned\}/);
    assert.match(source, /onSignatureChange=/);
    assert.match(
      source,
      /signingAvailable=\{projection\.participationEntryGuidance\.signingAvailable\}/,
    );
    assert.match(source, /<CivicShareButton/);
    assert.match(source, /supportBreakdown\.participantSignatures/);
    assert.match(source, /supportBreakdown\.memberSignatures/);
    assert.match(source, /supportBreakdown\.visitorSignals/);
    assert.match(
      source,
      /if \(!cancelled && !isPreview\) \{\s+void recordPetitionVisitorSignal\(petitionId\)/,
    );
    assert.match(source, /previewSignatureDisabled/);
  });

  it("13. leaves every other lifecycle stage on the standard stage presentation", async () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.equal(count(center, "publishedResultPresentation="), 1);
    assert.match(
      center,
      /publishedResultPresentation=\{\s*activeStage\.stageId === "petition" \? "document" : "stage"\s*\}/,
    );

    const analysis = stageProjection({ stageId: "analysis", stageLabel: "Analysis" });
    const header = visibleText(
      await render(
        createElement(StageHeader, {
          projection: analysis,
          isPreviewMode: false,
          showStageOrdinal: true,
        }),
      ),
    );
    assert.match(header, /Stage 9 of 12/);
    assert.match(header, /Public view/);

    const panel = await render(
      createElement(InitiativeLifecyclePublicResultPanel, {
        projection: analysis,
        publicResultSlot: createElement("p", null, "analysis body"),
      }),
    );
    assert.match(panel, /lsw-result__title/);
    assert.match(visibleText(panel), /Published March 4, 2026 · Version 4/);
  });

  it("14. localizes the document chrome in every catalog without breaking packaged copies", async () => {
    const catalogs = ["en", "uk", "ar", "zh-Hant"].map((locale) => {
      const messages = JSON.parse(readWeb(`features/i18n/messages/${locale}.json`));
      return { locale, document: messages.initiativeExperience.author.petition.public.document };
    });
    const englishKeys = Object.keys(catalogs[0]!.document).sort();
    assert.equal(englishKeys.length, 11);
    for (const { locale, document } of catalogs) {
      assert.deepEqual(Object.keys(document).sort(), englishKeys, locale);
      for (const [key, value] of Object.entries(document)) {
        assert.equal(typeof value, "string", `${locale}.${key}`);
        assert.ok((value as string).trim().length > 0, `${locale}.${key}`);
      }
      assert.match(document.basedOnRevisionVersion, /\{version\}/, locale);
      assert.doesNotMatch(document.basedOnRevision, /\{/, locale);
    }

    for (const locale of ["en", "uk", "ar", "zh-Hant"]) {
      assert.equal(
        readFileSync(
          path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
          "utf8",
        ),
        readWeb(`features/i18n/messages/${locale}.json`),
        `packaged ${locale} catalog must stay byte-identical`,
      );
    }

    const ukText = visibleText(
      await renderPublicPetitionStage(petitionProjection({ recipients: ["Міська рада"] }), {
        locale: "uk",
      }),
    );
    assert.match(ukText, /Короткий опис/);
    assert.match(ukText, /Адресати Міська рада/);
    assert.match(ukText, /Відкрита для підписання/);
    assert.match(ukText, /На основі версії 3 опублікованої редакції цієї ініціативи/);
    assert.doesNotMatch(ukText, /Stage|Summary|Addressed to/);

    const documentSource = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(documentSource, /sourceKind="petition"/);
    assert.match(documentSource, /sourceRecordId=\{petitionId\}/);
    assert.doesNotMatch(documentSource, /translate="no"/);
  });
});
