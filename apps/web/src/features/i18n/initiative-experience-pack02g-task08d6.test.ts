/**
 * Pack 02G Task 08D.6 — Petition author workspace i18n.
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
  resolveInitiativeExperienceMessage,
  resolvePetitionProposalAcceptanceDisplayLabel,
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

describe("Pack 02G Task 08D.6 — Petition author workspace i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes author.petition", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "petition.editorTitle"), "string");
      assert.equal(typeof authorKey(loaded.messages, "petition.generatePetitionDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "petition.keyArguments.add"), "string");
      assert.equal(typeof authorKey(loaded.messages, "petition.proposalAcceptance.accepted"), "string");
    }
  });

  it("Ukrainian Petition workspace/editor headings and field labels resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "petition.editorTitle"), "Чернетка петиції");
    assert.equal(authorKey(uk.messages, "petition.fields.title"), "Заголовок петиції");
    assert.equal(authorKey(uk.messages, "petition.fields.requestStatement"), "Формулювання запиту");
    assert.equal(authorKey(uk.messages, "petition.fields.keyArguments"), "Ключові аргументи");
    assert.equal(authorKey(uk.messages, "petition.generatePetitionDraft"), "Згенерувати чернетку петиції");
    assert.equal(authorKey(uk.messages, "petition.publishPetition"), "Опублікувати петицію");
    assert.notEqual(authorKey(uk.messages, "petition.editorTitle"), "Petition Draft");
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(authorKey(uk.messages, "actions.preview"), "Перегляд");
  });

  it("key-argument Add/Remove chrome localizes; values stay state-bound", () => {
    const editor = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    assert.match(editor, /author\.petition\.keyArguments\.add/);
    assert.match(editor, /author\.petition\.keyArguments\.remove/);
    assert.match(editor, /author\.petition\.keyArguments\.itemAria/);
    assert.match(editor, /value=\{argument\}/);
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{publicSummary\}/);
    assert.match(editor, /value=\{requestStatement\}/);
    assert.match(editor, /draftContent=\{\{/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Add Key Argument</);
    assert.doesNotMatch(editor, />Remove</);
  });

  it("proposal acceptance uses canonical codes only; unknown codes are not partially accepted", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");

    assert.equal(resolvePetitionProposalAcceptanceDisplayLabel("accepted", en.messages), "Accepted");
    assert.equal(
      resolvePetitionProposalAcceptanceDisplayLabel("partially_accepted", en.messages),
      "Partially accepted",
    );
    assert.equal(resolvePetitionProposalAcceptanceDisplayLabel("accepted", uk.messages), "Прийнято");
    assert.equal(
      resolvePetitionProposalAcceptanceDisplayLabel("partially_accepted", uk.messages),
      "Частково прийнято",
    );
    assert.equal(resolvePetitionProposalAcceptanceDisplayLabel("declined", uk.messages), "declined");
    assert.equal(resolvePetitionProposalAcceptanceDisplayLabel("ready", en.messages), "ready");
    assert.notEqual(
      resolvePetitionProposalAcceptanceDisplayLabel("declined", en.messages),
      "Partially accepted",
    );

    const panel = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionIntelligenceSnapshotPanel.tsx",
    );
    assert.match(panel, /resolvePetitionProposalAcceptanceDisplayLabel\(proposal\.status, t\)/);
    assert.doesNotMatch(panel, /Partially accepted/);
    assert.doesNotMatch(panel, /\? "Accepted" :/);
  });

  it("source excerpts/IDs/URLs and consistency API prose remain unchanged", () => {
    const panel = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionIntelligenceSnapshotPanel.tsx",
    );
    const publicResult = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(panel, /proposal\.title/);
    assert.match(panel, /proposal\.summary/);
    assert.match(panel, /resolveApiConsistencyLabelDisplay/);
    assert.match(panel, /resolveApiConsistencyCheckDisplay/);
    assert.doesNotMatch(panel, /\{check\.label\}/);
    assert.doesNotMatch(panel, /\{check\.detail\}/);
    assert.match(panel, /revisionReference\.revisionSummary/);
    assert.match(publicResult, /traceability\.revisionId/);
    assert.match(publicResult, /participationTransparencyNote/);
    assert.match(publicResult, /shareReference\.sharingNote/);
  });

  it("author-preview signature chrome localizes; live SignatureWidget uses petitionSignature", () => {
    const preview = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionDraftPreview.tsx",
    );
    const publicResult = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    const widget = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    assert.match(preview, /author\.petition\.preview\.signaturesTitle/);
    assert.match(preview, /author\.petition\.preview\.signaturesNote/);
    assert.match(publicResult, /author\.petition\.public\.previewSignatureDisabled/);
    assert.match(publicResult, /isPreview \?/);
    assert.match(publicResult, /InitiativePetitionSignatureWidget/);
    assert.match(widget, /useTranslations\("initiativeExperience"\)/);
    assert.match(widget, /petitionSignature\.sign/);
    assert.doesNotMatch(widget, /author\.petition/);
    assert.doesNotMatch(widget, />Sign this Petition</);
  });

  it("deterministic client validation localized; Error.message not sentence-matched", () => {
    const editor = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    assert.match(editor, /author\.petition\.messages\.generateFailed/);
    assert.match(editor, /author\.petition\.messages\.saveFailed/);
    assert.match(editor, /author\.petition\.confirm\.publish/);
    assert.match(editor, /author\.petition\.requiredFieldNames/);
    assert.match(editor, /detailFromError/);
    assert.doesNotMatch(editor, /error\.message\s*===/);
    assert.doesNotMatch(editor, /\.includes\("/);
  });

  it("AI-generated civic content is not sourced from next-intl; derive banks untouched", () => {
    const editor = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    const derive = readWeb(
      "features/initiative-petition-lifecycle/derive-petition-ai-assistant-insights.ts",
    );
    assert.match(editor, /generateInitiativePetitionDraft/);
    assert.match(editor, /useLifecycleAiFormApply/);
    assert.match(editor, /onApplyWorkingTranslation/);
    assert.doesNotMatch(editor, /gemini/i);
    assert.doesNotMatch(derive, /useTranslations/);
    assert.doesNotMatch(derive, /author\.petition/);
  });

  it("localized accessible names for Petition author chrome", () => {
    const editor = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    const panel = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionIntelligenceSnapshotPanel.tsx",
    );
    const preview = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionDraftPreview.tsx",
    );
    assert.match(editor, /author\.petition\.keyArguments\.itemAria/);
    assert.match(panel, /author\.petition\.sourceSnapshot\.proposalsAria/);
    assert.match(preview, /author\.petition\.preview\.signaturesAria/);
    assert.doesNotMatch(editor, /aria-label=\{`Key argument/);
    assert.doesNotMatch(preview, /aria-label="Representative signatures preview"/);
  });

  it("no Gemini/runtime UI translation in Petition author components", () => {
    const files = [
      "features/initiative-petition-lifecycle/components/InitiativePetitionAuthorWorkspace.tsx",
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
      "features/initiative-petition-lifecycle/components/InitiativePetitionIntelligenceSnapshotPanel.tsx",
      "features/initiative-petition-lifecycle/components/InitiativePetitionDraftPreview.tsx",
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
    }
  });

  it("layout resilience for Petition CSS", () => {
    const css = readWeb(
      "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css",
    );
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /overflow-wrap:\s*anywhere|overflow-wrap:\s*break-word/);
    assert.match(css, /flex-wrap:\s*wrap/);
    assert.match(css, /padding-inline-start|margin-inline/);
  });

  it("missing author.petition key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { petition?: { generatePetitionDraft?: string } } })
      .author?.petition?.generatePetitionDraft;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.petition.generatePetitionDraft"),
      ),
    );
  });

  it("Decision Session and later stages remain free of author.petition keys", () => {
    const decision = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionAuthorWorkspace.tsx",
    );
    const collective = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionAuthorWorkspace.tsx",
    );
    assert.doesNotMatch(decision, /author\.petition/);
    assert.doesNotMatch(collective, /author\.petition/);
  });
});
