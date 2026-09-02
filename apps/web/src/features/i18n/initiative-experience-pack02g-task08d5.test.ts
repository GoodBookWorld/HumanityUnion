/**
 * Pack 02G Task 08D.5 — Improvement Proposals + embedded Revision author i18n.
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
  resolveProposalCurationDisplayLabel,
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

describe("Pack 02G Task 08D.5 — Proposal + Revision author workspace i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes author.proposal and author.revision", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "proposal.heading"), "string");
      assert.equal(typeof authorKey(loaded.messages, "proposal.curation.included_in_revision"), "string");
      assert.equal(typeof authorKey(loaded.messages, "revision.generateSuggestedChanges"), "string");
      assert.equal(typeof authorKey(loaded.messages, "revision.change.applyToDraft"), "string");
    }
  });

  it("Ukrainian Proposal headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "proposal.heading"), "Пропозиції покращень");
    assert.equal(authorKey(uk.messages, "proposal.fields.title"), "Заголовок");
    assert.equal(authorKey(uk.messages, "proposal.fields.expectedImprovement"), "Очікуване покращення");
    assert.equal(
      authorKey(uk.messages, "proposal.generateDraft"),
      "Згенерувати чернетку пропозицій покращень",
    );
    assert.equal(authorKey(uk.messages, "proposal.publishAndContinue"), "Опублікувати й продовжити до петиції");
    assert.equal(authorKey(uk.messages, "proposal.addManualProposal"), "Додати власну пропозицію");
    assert.notEqual(authorKey(uk.messages, "proposal.heading"), "Improvement Proposals");
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(authorKey(uk.messages, "actions.preview"), "Перегляд");
  });

  it("Ukrainian proposal-card and source chrome resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "proposal.saveProposal"), "Зберегти пропозицію");
    assert.equal(authorKey(uk.messages, "proposal.showSources"), "Показати джерела пропозицій");
    assert.equal(authorKey(uk.messages, "proposal.sourceSnapshot.title"), "Джерела пропозицій");
    assert.equal(authorKey(uk.messages, "proposal.sourceSnapshot.viewInDiscussion"), "Переглянути в обговоренні");
  });

  it("proposal curation code maps to localized display; canonical code unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    const code = "included_in_revision";

    assert.equal(resolveProposalCurationDisplayLabel(code, en.messages), "Accept");
    assert.equal(resolveProposalCurationDisplayLabel(code, uk.messages), "Прийняти");
    assert.equal(resolveProposalCurationDisplayLabel("keep_for_later", uk.messages), "Частково прийняти");
    assert.equal(resolveProposalCurationDisplayLabel("not_applicable", uk.messages), "Відхилити");
    assert.notEqual(resolveProposalCurationDisplayLabel(code, uk.messages), code);

    const card = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeStructuredProposalCard.tsx",
    );
    assert.match(card, /value=\{option\}/);
    assert.match(card, /resolveProposalCurationDisplayLabel\(option, t\)/);
    assert.doesNotMatch(card, /STATUS_LABELS/);
    assert.doesNotMatch(card, /value=\{t\(/);
  });

  it("ICU proposal counts are catalog-driven", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    assert.match(authorKey(en.messages, "proposal.counts.proposals"), /\{count,\s*plural/);
    assert.match(authorKey(uk.messages, "proposal.counts.proposals"), /\{count,\s*plural/);
    assert.match(authorKey(uk.messages, "proposal.sourceSnapshot.groupMeta"), /\{count,\s*plural/);
  });

  it("Ukrainian embedded Revision chrome resolves natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.ok(authorKey(uk.messages, "revision.embeddedEditorTitle").includes("{version}"));
    assert.equal(authorKey(uk.messages, "revision.generateSuggestedChanges"), "Згенерувати запропоновані зміни");
    assert.equal(authorKey(uk.messages, "revision.commitVersion"), "Зафіксувати оновлену версію ініціативи");
    assert.equal(authorKey(uk.messages, "revision.fields.before"), "До");
    assert.equal(authorKey(uk.messages, "revision.fields.after"), "Після");
    assert.equal(authorKey(uk.messages, "revision.change.applyToDraft"), "Застосувати до чернетки");
    assert.notEqual(authorKey(uk.messages, "revision.change.remove"), "Remove");
  });

  it("canonical Proposal field values remain bound to form state", () => {
    const card = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeStructuredProposalCard.tsx",
    );
    const editor = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
    );
    assert.match(card, /value=\{form\.title\}/);
    assert.match(card, /value=\{form\.summary\}/);
    assert.match(card, /value=\{form\.expectedImprovement\}/);
    assert.match(card, /value=\{form\.supportingSources\}/);
    assert.match(editor, /value=\{manualForm\.title\}/);
    assert.match(editor, /value=\{manualForm\.reason\}/);
    assert.doesNotMatch(card, /value=\{t\(/);
    assert.doesNotMatch(editor, /value=\{t\(/);
  });

  it("canonical Revision field values remain bound to editor/change state", () => {
    const editor = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionEditor.tsx",
    );
    const change = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionChangeCard.tsx",
    );
    const add = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionAddChangeForm.tsx",
    );
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{description\}/);
    assert.match(editor, /value=\{revisionSummary\}/);
    assert.match(editor, /value=\{communitySlug\}/);
    assert.match(editor, /value=\{activityArea\}/);
    assert.match(change, /value=\{after\}/);
    assert.match(change, /value=\{explanation\}/);
    assert.match(add, /value=\{after\}/);
    assert.match(add, /value=\{reason\}/);
    assert.match(add, /value=\{section\}/);
    assert.doesNotMatch(editor, /value=\{t\(/);
  });

  it("proposal/revision IDs and source content remain unchanged", () => {
    const panel = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeProposalIntelligenceSnapshotPanel.tsx",
    );
    const revisionPanel = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionIntelligenceSnapshotPanel.tsx",
    );
    const editor = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
    );
    assert.match(panel, /key=\{group\.groupId\}/);
    assert.match(panel, /group\.representativeExcerpt/);
    assert.match(panel, /href=\{group\.discussionUrl\}/);
    assert.match(panel, /group\.authorDisplayNames/);
    assert.match(revisionPanel, /key=\{proposal\.proposalId\}/);
    assert.match(revisionPanel, /warning\.message/);
    assert.match(revisionPanel, /check\.label/);
    assert.match(revisionPanel, /check\.detail/);
    assert.match(editor, /key=\{proposal\.proposalId\}/);
  });

  it("AI-generated civic draft content is not sourced from next-intl", () => {
    const editor = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
    );
    const revision = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionEditor.tsx",
    );
    assert.match(editor, /generateImprovementProposalsDraft/);
    assert.match(editor, /applyLifecycleAiSuggestionsToFields/);
    assert.match(revision, /generateInitiativeRevisionChanges/);
    assert.doesNotMatch(editor, /gemini/i);
    assert.doesNotMatch(revision, /gemini/i);

    const proposalInsights = readWeb(
      "features/initiative-improvement-proposals-stage/derive-proposal-ai-assistant-insights.ts",
    );
    const revisionInsights = readWeb(
      "features/initiative-version-revision/derive-revision-ai-assistant-insights.ts",
    );
    assert.doesNotMatch(proposalInsights, /useTranslations/);
    assert.doesNotMatch(revisionInsights, /author\.proposal/);
    assert.doesNotMatch(revisionInsights, /useTranslations/);
    assert.doesNotMatch(revisionInsights, /author\.revision/);
  });

  it("deterministic validation localized; Error.message not sentence-matched", () => {
    const editor = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
    );
    const card = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeStructuredProposalCard.tsx",
    );
    const revision = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionEditor.tsx",
    );
    const add = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionAddChangeForm.tsx",
    );
    assert.match(editor, /author\.proposal\.messages\.generateFailed/);
    assert.match(editor, /author\.proposal\.confirm\.publishAndContinue/);
    assert.match(card, /detailFromError/);
    assert.match(revision, /author\.revision\.commitBlocked/);
    assert.match(add, /author\.revision\.change\.validationRequired/);
    for (const source of [editor, card, revision, add]) {
      assert.doesNotMatch(source, /error\.message\s*===/);
      assert.doesNotMatch(source, /\.includes\("/);
    }
  });

  it("localized accessible names for Proposal/Revision author chrome", () => {
    const editor = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
    );
    const workspace = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsAuthorWorkspace.tsx",
    );
    const panel = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeProposalIntelligenceSnapshotPanel.tsx",
    );
    const preview = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsDraftPreview.tsx",
    );
    assert.match(editor, /author\.proposal\.manualFormAria/);
    assert.match(workspace, /author\.proposal\.versionSectionAria/);
    assert.match(panel, /author\.proposal\.sourceSnapshot\.statsAria/);
    assert.match(preview, /author\.proposal\.preview\.reactionAria/);
    assert.doesNotMatch(panel, /aria-label="Proposal collection statistics"/);
    assert.doesNotMatch(preview, /aria-label="Proposal reaction preview"/);
  });

  it("no Gemini/runtime UI translation in Proposal/Revision author components", () => {
    const files = [
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsAuthorWorkspace.tsx",
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsEditor.tsx",
      "features/initiative-improvement-proposals-stage/components/InitiativeStructuredProposalCard.tsx",
      "features/initiative-version-revision/components/InitiativeRevisionEditor.tsx",
      "features/initiative-version-revision/components/InitiativeRevisionChangeCard.tsx",
      "features/initiative-version-revision/components/InitiativeRevisionAddChangeForm.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
    }
  });

  it("layout resilience for Proposal/Revision CSS", () => {
    const proposalCss = readWeb(
      "features/initiative-improvement-proposals-stage/components/initiative-improvement-proposals-stage-workspace.css",
    );
    const revisionCss = readWeb(
      "features/initiative-version-revision/components/initiative-revision-stage-workspace.css",
    );
    assert.match(proposalCss, /min-width:\s*0/);
    assert.match(proposalCss, /overflow-wrap:\s*anywhere|overflow-wrap:\s*break-word/);
    assert.match(revisionCss, /min-width:\s*0/);
    assert.match(revisionCss, /flex-wrap:\s*wrap/);
  });

  it("missing author.proposal curation key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { proposal?: { curation?: { included_in_revision?: string } } } })
      .author?.proposal?.curation?.included_in_revision;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.proposal.curation.included_in_revision"),
      ),
    );
  });

  it("Petition and later lifecycle packs remain free of author.proposal/revision keys", () => {
    const petition = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionAuthorWorkspace.tsx",
    );
    const decision = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionAuthorWorkspace.tsx",
    );
    assert.doesNotMatch(petition, /author\.proposal/);
    assert.doesNotMatch(petition, /author\.revision/);
    assert.doesNotMatch(decision, /author\.proposal/);
    assert.doesNotMatch(decision, /author\.revision/);
  });
});
