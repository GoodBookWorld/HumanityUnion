/**
 * Pack 02G Task 08D.8 — Commitment + Tracking author workspace i18n.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  resolveCommitmentCandidateStatusDisplayLabel,
  resolveCommitmentViewStateDisplayLabel,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function authorKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `author.${key}`);
  assert.ok(value, `missing author.${key}`);
  return value;
}

describe("Pack 02G Task 08D.8 — Commitment + Tracking author i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes commitment and tracking", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "commitment.generateCommitmentsDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "commitment.viewStates.accepted"), "string");
      assert.equal(typeof authorKey(loaded.messages, "tracking.generateTrackingDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "tracking.fields.progress"), "string");
    }
  });

  it("Ukrainian Commitment headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "commitment.fields.title"), "Заголовок");
    assert.equal(
      authorKey(uk.messages, "commitment.fields.suggestedResponsibleRole"),
      "Пропонована відповідальна роль",
    );
    assert.equal(
      authorKey(uk.messages, "commitment.generateCommitmentsDraft"),
      "Згенерувати чернетку зобов’язань із впровадження",
    );
    assert.equal(authorKey(uk.messages, "commitment.candidateStatuses.draft"), "Чернетка");
    assert.equal(authorKey(uk.messages, "commitment.viewStates.available"), "Доступно");
    assert.notEqual(
      authorKey(uk.messages, "commitment.generateCommitmentsDraft"),
      "Generate Implementation Commitments Draft",
    );
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
  });

  it("Ukrainian Tracking headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "tracking.fields.progress"), "Прогрес (%)");
    assert.equal(authorKey(uk.messages, "tracking.fields.status"), "Статус");
    assert.equal(
      authorKey(uk.messages, "tracking.generateTrackingDraft"),
      "Згенерувати чернетку відстеження впровадження",
    );
    assert.equal(
      authorKey(uk.messages, "tracking.publishAndContinue"),
      "Опублікувати та продовжити до офіційних відповідей",
    );
    assert.notEqual(
      authorKey(uk.messages, "tracking.generateTrackingDraft"),
      "Generate Implementation Tracking Draft",
    );
  });

  it("Commitment canonical form values remain state-bound; draft status display-only", () => {
    const editor = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentEditor.tsx",
    );
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{summary\}/);
    assert.match(editor, /value=\{candidate\.description\}/);
    assert.match(editor, /value=\{candidate\.priority\}/);
    assert.match(editor, /status: "draft"/);
    assert.match(editor, /resolveCommitmentCandidateStatusDisplayLabel\("draft", t\)/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Generate Implementation Commitments Draft</);
  });

  it("Commitment view-state localization is display-only; unknown/legacy safe", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveCommitmentViewStateDisplayLabel("available", en.messages), "Available");
    assert.equal(resolveCommitmentViewStateDisplayLabel("accepted", uk.messages), "Прийнято");
    assert.equal(resolveCommitmentViewStateDisplayLabel("legacy", en.messages), "");
    assert.equal(resolveCommitmentViewStateDisplayLabel("weird_state", en.messages), "weird_state");
    assert.equal(resolveCommitmentCandidateStatusDisplayLabel("draft", uk.messages), "Чернетка");
    assert.equal(resolveCommitmentCandidateStatusDisplayLabel("published", en.messages), "published");

    const publicResult = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );
    assert.match(publicResult, /resolveCommitmentViewStateDisplayLabel\(viewState, t\)/);
    assert.doesNotMatch(publicResult, /function formatStatusLabel/);
    assert.doesNotMatch(publicResult, /replaceAll\("_", " "\)/);
  });

  it("Tracking progress/status/dates remain canonical state-bound data", () => {
    const editor = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingEditor.tsx",
    );
    const preview = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingDraftPreview.tsx",
    );
    const publicResult = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingPublicResult.tsx",
    );
    assert.match(editor, /value=\{candidate\.progress\}/);
    assert.match(editor, /value=\{candidate\.currentStatus\}/);
    assert.match(editor, /value=\{candidate\.plannedStartDate\}/);
    assert.match(editor, /value=\{candidate\.targetDate\}/);
    assert.match(editor, /type="date"/);
    assert.match(editor, /\{candidate\.currentStatus\}/);
    assert.match(preview, /status: candidate\.currentStatus/);
    assert.match(preview, /progress: candidate\.progress/);
    assert.match(publicResult, /tracking\.currentStage/);
    assert.match(publicResult, /progress: tracking\.progress/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(publicResult, /resolveCommitmentViewStateDisplayLabel/);
  });

  it("source excerpts/IDs/URLs and civic bodies remain data-bound", () => {
    const cPanel = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentIntelligenceSnapshotPanel.tsx",
    );
    const tPanel = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingIntelligenceSnapshotPanel.tsx",
    );
    const cPublic = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );
    const tPublic = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingPublicResult.tsx",
    );
    assert.match(cPanel, /snapshot\.decisionReference\.title/);
    assert.match(tPanel, /snapshot\.packageReference\.title/);
    assert.match(cPublic, /commitment\.approvedAction/);
    assert.match(cPublic, /commitment\.summary/);
    assert.match(cPublic, /authorDisplayName !== "Unassigned"/);
    assert.match(tPublic, /tracking\.authorDisplayName/);
    assert.match(tPublic, /tracking\.summary/);
  });

  it("AI-generated civic content is not sourced from next-intl; derive banks untouched", () => {
    const cEditor = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentEditor.tsx",
    );
    const tEditor = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingEditor.tsx",
    );
    const cDerive = readWeb(
      "features/initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights.ts",
    );
    const tDerive = readWeb(
      "features/initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights.ts",
    );
    assert.match(cEditor, /generateInitiativeImplementationCommitmentDraft/);
    assert.match(tEditor, /generateInitiativeImplementationTrackingDraft/);
    assert.match(cEditor, /detailFromError/);
    assert.match(tEditor, /detailFromError/);
    assert.doesNotMatch(cEditor, /gemini/i);
    assert.doesNotMatch(tEditor, /gemini/i);
    assert.doesNotMatch(cDerive, /useTranslations/);
    assert.doesNotMatch(tDerive, /useTranslations/);
    assert.doesNotMatch(cDerive, /author\.commitment/);
    assert.doesNotMatch(tDerive, /author\.tracking/);
  });

  it("localized a11y names for Commitment and Tracking author chrome", () => {
    const cPreview = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentDraftPreview.tsx",
    );
    const cPublic = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
    );
    const tPreview = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingDraftPreview.tsx",
    );
    assert.match(cPreview, /author\.commitment\.preview\.aria/);
    assert.match(cPublic, /author\.commitment\.public\.aria/);
    assert.match(cPublic, /author\.commitment\.public\.takeAria/);
    assert.match(tPreview, /author\.tracking\.preview\.aria/);
    assert.doesNotMatch(cPreview, /aria-label="Implementation Commitments draft preview"/);
    assert.doesNotMatch(tPreview, /aria-label="Implementation Tracking draft preview"/);
  });

  it("no Gemini/runtime UI translation in Commitment/Tracking author components", () => {
    const files = [
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentAuthorWorkspace.tsx",
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentEditor.tsx",
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult.tsx",
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingAuthorWorkspace.tsx",
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingEditor.tsx",
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingPublicResult.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
    }
  });

  it("layout resilience for Commitment and Tracking CSS", () => {
    const cCss = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/initiative-implementation-commitment-stage-workspace.css",
    );
    const tCss = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/initiative-implementation-tracking-stage-workspace.css",
    );
    for (const css of [cCss, tCss]) {
      assert.match(css, /min-width:\s*0/);
      assert.match(css, /overflow-wrap:\s*anywhere|overflow-wrap:\s*break-word/);
      assert.match(css, /flex-wrap:\s*wrap/);
      assert.match(css, /padding-inline-start/);
    }
  });

  it("missing author.commitment key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { commitment?: { generateCommitmentsDraft?: string } };
      }
    ).author?.commitment?.generateCommitmentsDraft;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.commitment.generateCommitmentsDraft"),
      ),
    );
  });

  it("Official Response and later stages remain free of these author keys", () => {
    const official = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseAuthorWorkspace.tsx",
    );
    const impact = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactAuthorWorkspace.tsx",
    );
    assert.doesNotMatch(official, /author\.commitment/);
    assert.doesNotMatch(official, /author\.tracking/);
    assert.doesNotMatch(impact, /author\.commitment/);
    assert.doesNotMatch(impact, /author\.tracking/);
  });
});
