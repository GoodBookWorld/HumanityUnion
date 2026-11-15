/**
 * HU-LC-05C.4C.7F.7N — Petition Sources Used WEB_UI localization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTranslator, type AbstractIntlMessages } from "next-intl";

import type { InitiativeLifecycleSourceSnapshotItem } from "@hu/types";

import { resolveLifecycleSourceSnapshotItemDisplay } from "./resolve-lifecycle-source-snapshot-display";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(HERE, "../..");
const API_SRC = path.resolve(HERE, "../../../../api/src");
const readWeb = (relative: string) => readFileSync(path.join(WEB_SRC, relative), "utf8");
const readApi = (relative: string) => readFileSync(path.join(API_SRC, relative), "utf8");

function catalog(locale: "en" | "uk") {
  return JSON.parse(
    readWeb(`features/i18n/messages/${locale}.json`),
  ) as AbstractIntlMessages;
}

function translator(locale: "en" | "uk") {
  const messages = catalog(locale);
  const tRoot = createTranslator({ locale, messages, namespace: "initiativeExperience" });
  return tRoot as unknown as Parameters<typeof resolveLifecycleSourceSnapshotItemDisplay>[1];
}

const authoredRevisionSummary = "Авторський підсумок редакції — keep verbatim";
const authoredAnalysisTitle = "Авторська назва аналізу";

function petitionItems(): InitiativeLifecycleSourceSnapshotItem[] {
  return [
    {
      sourceId: "revision-reference",
      kind: "member_contribution",
      label: "Published Revision",
      summary: `Version 3 — ${authoredRevisionSummary}`,
      presentation: {
        code: "petition.revision_reference",
        version: 3,
        authoredSummary: authoredRevisionSummary,
      },
    },
    {
      sourceId: "analysis-reference",
      kind: "member_contribution",
      label: "Published Collaborative Analysis",
      summary: authoredAnalysisTitle,
      presentation: {
        code: "petition.analysis_reference",
        authoredTitle: authoredAnalysisTitle,
      },
    },
    {
      sourceId: "proposal-references",
      kind: "member_contribution",
      label: "Published Improvement Proposals",
      summary: "2 accepted proposal(s) referenced",
      presentation: {
        code: "petition.proposal_references",
        acceptedCount: 2,
      },
    },
    {
      sourceId: "consistency-checks",
      kind: "member_contribution",
      label: "Consistency Checks",
      summary: "1 warning(s) of 4",
      presentation: {
        code: "petition.consistency_checks",
        warningCount: 1,
        totalCount: 4,
      },
    },
  ];
}

describe("HU-LC-05C.4C.7F.7N — Petition Sources Used", () => {
  it("Ukrainian WEB_UI labels and localized generated summaries", () => {
    const t = translator("uk");
    const displays = petitionItems().map((item) =>
      resolveLifecycleSourceSnapshotItemDisplay(item, t),
    );
    const revision = displays[0]!;
    const analysis = displays[1]!;
    const proposals = displays[2]!;
    const consistency = displays[3]!;

    assert.equal(revision.label, "Опублікована редакція");
    assert.equal(revision.versionLabel, "Версія 3");
    assert.equal(revision.authoredText, authoredRevisionSummary);
    assert.equal(revision.summary, null);

    assert.equal(analysis.label, "Опублікований спільний аналіз");
    assert.equal(analysis.authoredText, authoredAnalysisTitle);

    assert.equal(proposals.label, "Опубліковані пропозиції покращень");
    assert.match(proposals.summary ?? "", /2/);
    assert.doesNotMatch(proposals.summary ?? "", /accepted proposal/i);

    assert.equal(consistency.label, "Перевірки узгодженості");
    assert.match(consistency.summary ?? "", /1/);
    assert.match(consistency.summary ?? "", /4/);
    assert.doesNotMatch(consistency.summary ?? "", /warning\(s\)/i);
  });

  it("preserves authored content unchanged and empty-state templates", () => {
    const t = translator("uk");
    const emptyRevision = resolveLifecycleSourceSnapshotItemDisplay(
      {
        sourceId: "revision-reference",
        kind: "member_contribution",
        label: "Published Revision",
        summary: "No published Revision yet",
        presentation: {
          code: "petition.revision_reference",
          version: null,
          authoredSummary: null,
        },
      },
      t,
    );
    assert.equal(emptyRevision.summary, "Опублікованої редакції ще немає.");
    assert.equal(emptyRevision.authoredText, null);

    const zeroProposals = resolveLifecycleSourceSnapshotItemDisplay(
      {
        sourceId: "proposal-references",
        kind: "member_contribution",
        label: "Published Improvement Proposals",
        summary: "0 accepted proposal(s) referenced",
        presentation: {
          code: "petition.proposal_references",
          acceptedCount: 0,
        },
      },
      t,
    );
    assert.equal(zeroProposals.summary, "Прийнятих пропозицій покращень не зазначено.");
  });

  it("non-semantic / other lifecycle stages keep API English prose", () => {
    const t = translator("uk");
    const legacy = resolveLifecycleSourceSnapshotItemDisplay(
      {
        sourceId: "decision-session-reference",
        kind: "member_contribution",
        label: "Published Decision Session",
        summary: "Session title stays English from API",
      },
      t,
    );
    assert.equal(legacy.label, "Published Decision Session");
    assert.equal(legacy.summary, "Session title stays English from API");
  });

  it("adapter emits petition presentation; panel keeps item.label/summary fallback", () => {
    const adapter = readApi("modules/initiatives/initiative-lifecycle-stage-adapter.ts");
    assert.match(adapter, /code:\s*"petition\.revision_reference"/);
    assert.match(adapter, /code:\s*"petition\.analysis_reference"/);
    assert.match(adapter, /code:\s*"petition\.proposal_references"/);
    assert.match(adapter, /code:\s*"petition\.consistency_checks"/);
    assert.match(adapter, /label:\s*"Published Revision"/);

    const panel = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleSourceSnapshotPanel.tsx",
    );
    assert.match(panel, /item\.label/);
    assert.match(panel, /item\.summary/);
    assert.match(panel, /dir="auto"/);
    assert.match(panel, /resolveLifecycleSourceSnapshotItemDisplay/);
  });
});
