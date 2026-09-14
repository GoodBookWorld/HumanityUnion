/**
 * Pack 02G Task 08D.4 — Collaborative Analysis author workspace i18n.
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
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";

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

describe("Pack 02G Task 08D.4 — Collaborative Analysis author workspace i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes author.analysis", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "analysis.editorTitle"), "string");
      assert.equal(typeof authorKey(loaded.messages, "analysis.fields.title"), "string");
      assert.equal(typeof authorKey(loaded.messages, "analysis.generateAnalysisDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "analysis.sourceSnapshot.title"), "string");
    }
  });

  it("Ukrainian Analysis headings/field labels/help/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "analysis.editorTitle"), "Редактор аналізу");
    assert.equal(authorKey(uk.messages, "analysis.fields.title"), "Заголовок");
    assert.equal(authorKey(uk.messages, "analysis.fields.summary"), "Короткий виклад");
    assert.equal(authorKey(uk.messages, "analysis.fields.supportingEvidence"), "Підтримувальні аргументи");
    assert.equal(authorKey(uk.messages, "analysis.fields.risks"), "Застереження");
    assert.equal(authorKey(uk.messages, "analysis.generateAnalysisDraft"), "Згенерувати чернетку аналізу");
    assert.equal(authorKey(uk.messages, "analysis.showSourceSnapshot"), "Показати знімок джерел");
    assert.equal(authorKey(uk.messages, "analysis.hideSourceSnapshot"), "Приховати знімок джерел");
    assert.notEqual(authorKey(uk.messages, "analysis.fields.title"), "Title");
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(authorKey(uk.messages, "actions.publish"), "Опублікувати");
    assert.equal(authorKey(uk.messages, "actions.preview"), "Перегляд");
  });

  it("Ukrainian source-snapshot collection chrome localizes; content values stay out of catalogs", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "analysis.sourceSnapshot.openQuestions"), "Відкриті питання");
    assert.equal(authorKey(uk.messages, "analysis.sourceSnapshot.viewInDiscussion"), "Переглянути в обговоренні");
    assert.equal(authorKey(uk.messages, "analysis.sourceSnapshot.emptyTopics"), "Повторюваних тем ще не виявлено.");

    const panel = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisSourceSnapshotPanel.tsx",
    );
    assert.match(panel, /author\.analysis\.sourceSnapshot\.openQuestions/);
    assert.match(panel, /item\.excerpt/);
    assert.match(panel, /item\.authorDisplayName/);
    assert.match(panel, /item\.discussionUrl/);
    assert.match(panel, /topic\.topic/);
    assert.doesNotMatch(panel, />View in Discussion</);
    assert.doesNotMatch(panel, />Most Discussed Topics</);
    // Analysis form fields are flat textareas — no Add/Remove chrome on this stage.
    assert.doesNotMatch(panel, /Add /);
    assert.doesNotMatch(panel, /Remove /);
  });

  it("Analysis-specific Generate wording is distinct; shared Publish/Save reused", () => {
    const form = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
    );
    const workspace = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisAuthorWorkspace.tsx",
    );
    assert.match(form, /author\.analysis\.generateAnalysisDraft/);
    assert.match(workspace, /author\.analysis\.generateAnalysisDraft/);
    assert.match(form, /actions\.saveDraft/);
    assert.match(form, /actions\.preview/);
    assert.match(form, /actions\.publish/);
    assert.doesNotMatch(form, />Generate Analysis Draft</);
    assert.doesNotMatch(form, />Save Draft</);
    assert.doesNotMatch(form, />Publish</);
    assert.doesNotMatch(workspace, />Generate Analysis Draft</);
  });

  it("canonical English/source field values remain bound to form state", () => {
    const form = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
    );
    assert.match(form, /value=\{form\.title\}/);
    assert.match(form, /value=\{form\.summary\}/);
    assert.match(form, /value=\{form\.supportingEvidence\}/);
    assert.match(form, /value=\{form\.risks\}/);
    assert.match(form, /value=\{form\.openQuestions\}/);
    assert.match(form, /value=\{form\.suggestedImprovements\}/);
    assert.match(form, /value=\{form\.references\}/);
    assert.match(form, /draftContent=\{\{ \.\.\.form \}\}/);
    assert.doesNotMatch(form, /value=\{t\(/);
    assert.doesNotMatch(form, /value=\{actions\./);
  });

  it("preview/content fields render canonical body values; labels from catalogs", () => {
    const fields = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisContentFields.tsx",
    );
    const preview = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisDraftPreview.tsx",
    );
    assert.match(fields, /author\.analysis\.fields\.title/);
    assert.match(fields, /\{title\}/);
    assert.match(fields, /\{summary\}/);
    assert.match(fields, /\{supportingEvidence\}/);
    assert.match(preview, /title=\{analysis\.title\}/);
    assert.match(preview, /summary=\{analysis\.summary\}/);
    assert.match(preview, /references=\{analysis\.references\}/);
  });

  it("source snapshot item identity and civic excerpts remain unchanged", () => {
    const panel = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisSourceSnapshotPanel.tsx",
    );
    assert.match(panel, /key=\{item\.commentId\}/);
    assert.match(panel, /key=\{topic\.topic\}/);
    assert.match(panel, /href=\{item\.discussionUrl\}/);
    assert.match(panel, /\{item\.excerpt\}/);
    assert.match(panel, /\{item\.authorDisplayName\}/);
  });

  it("AI-generated draft content is not sourced from next-intl; apply notices are catalogs", () => {
    const form = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
    );
    assert.match(form, /generateInitiativeAnalysisDraft/);
    assert.match(form, /applyLifecycleAiSuggestionsToFields/);
    assert.match(form, /author\.analysis\.messages\.aiApplied/);
    assert.match(form, /author\.analysis\.messages\.draftGenerated/);
    assert.doesNotMatch(form, /t\("author\.analysis\.fields\.title"\).*form\.title/);
    assert.doesNotMatch(form, /gemini/i);
    assert.doesNotMatch(form, /deriveAiAssistantInsights/);

    const insights = readWeb(
      "features/initiative-collaborative-analysis/derive-ai-assistant-insights.ts",
    );
    assert.doesNotMatch(insights, /useTranslations/);
    assert.doesNotMatch(insights, /author\.analysis/);
  });

  it("deterministic client validation/messages localize; Error.message not sentence-matched", () => {
    const form = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
    );
    assert.match(form, /author\.analysis\.messages\.saveFailed/);
    assert.match(form, /author\.analysis\.messages\.generateFailed/);
    assert.match(form, /author\.analysis\.messages\.publishFailed/);
    assert.match(form, /detailFromError/);
    assert.match(form, /author\.analysis\.confirm\.generateOverwrite/);
    assert.match(form, /author\.analysis\.confirm\.publish/);
    assert.doesNotMatch(form, /\.includes\("/);
    assert.doesNotMatch(form, /\.match\(/);
    assert.doesNotMatch(form, /error\.message\s*===/);
    assert.doesNotMatch(form, /error\.message\s*==/);
  });

  it("localized accessible names for Analysis source snapshot and preview reaction", () => {
    const panel = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisSourceSnapshotPanel.tsx",
    );
    const preview = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisDraftPreview.tsx",
    );
    assert.match(panel, /aria-label=\{t\("author\.analysis\.sourceSnapshot\.statsAria"\)\}/);
    assert.match(panel, /aria-label=\{t\("author\.analysis\.sourceSnapshot\.openQuestionsAria"\)\}/);
    assert.match(preview, /aria-label=\{t\("author\.analysis\.preview\.reactionAria"\)\}/);
    assert.doesNotMatch(panel, /aria-label="Discussion statistics"/);
    assert.doesNotMatch(preview, /aria-label="Analysis reaction preview"/);
  });

  it("no Gemini/runtime UI translation in Analysis author components", () => {
    const files = [
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisAuthorWorkspace.tsx",
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisContentFields.tsx",
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisDraftPreview.tsx",
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisSourceSnapshotPanel.tsx",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.doesNotMatch(source, /\.includes\("/);
    }
  });

  it("layout resilience for Analysis editor/source CSS", () => {
    const css = readWeb(
      "features/initiative-collaborative-analysis/components/initiative-collaborative-analysis-workspace.css",
    );
    assert.match(css, /\.ica-editor__actions[\s\S]*flex-wrap:\s*wrap/);
    assert.match(css, /\.ica-editor__field[\s\S]*min-width:\s*0/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /margin-inline-start/);
    assert.doesNotMatch(css, /margin-left:\s*var\(--hu-space-2\)/);
  });

  it("missing author.analysis key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { analysis?: { editorTitle?: string } } }).author
      ?.analysis?.editorTitle;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.analysis.editorTitle"),
      ),
    );
  });

  it("Proposal/Revision and later lifecycle author packs remain untouched by this slice", () => {
    const proposal = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsAuthorWorkspace.tsx",
    );
    const revision = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionAuthorWorkspace.tsx",
    );
    assert.doesNotMatch(proposal, /author\.analysis/);
    assert.doesNotMatch(revision, /author\.analysis/);
  });
});
