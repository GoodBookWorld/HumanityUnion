/**
 * Pack 02G Task 08D.7 — Decision Session + Collective Decision author workspace i18n.
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
  resolveCollectiveDecisionStatusDisplayLabel,
  resolveInitiativeDecisionVoteChoiceDisplayLabel,
  resolveInitiativeExperienceMessage,
  resolveParticipationScopeDisplayLabel,
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

function experienceKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing ${key}`);
  return value;
}

describe("Pack 02G Task 08D.7 — Decision Session + Collective Decision author i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes decisionSession and collectiveDecision", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "decisionSession.generateDecisionDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "decisionSession.fields.options"), "string");
      assert.equal(
        typeof authorKey(loaded.messages, "collectiveDecision.generateCollectiveDecisionDraft"),
        "string",
      );
      assert.equal(typeof authorKey(loaded.messages, "collectiveDecision.statuses.opened"), "string");
      assert.equal(typeof authorKey(loaded.messages, "collectiveDecision.statuses.cancelled"), "string");
    }
  });

  it("Ukrainian Decision Session headings/field labels/help/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "decisionSession.fields.title"), "Заголовок рішення");
    assert.equal(authorKey(uk.messages, "decisionSession.fields.question"), "Питання рішення");
    assert.equal(authorKey(uk.messages, "decisionSession.fields.options"), "Варіанти рішення (по одному на рядок)");
    assert.equal(authorKey(uk.messages, "decisionSession.generateDecisionDraft"), "Згенерувати чернетку рішення");
    assert.equal(
      authorKey(uk.messages, "decisionSession.public.votingBelongsNotice"),
      "Сесія рішень має інформаційний характер. Голосування належить до колективного рішення.",
    );
    assert.notEqual(authorKey(uk.messages, "decisionSession.generateDecisionDraft"), "Generate Decision Draft");
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(authorKey(uk.messages, "actions.preview"), "Перегляд");
  });

  it("Ukrainian Collective Decision headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "collectiveDecision.fields.summary"), "Підсумок рішення");
    assert.equal(authorKey(uk.messages, "collectiveDecision.fields.participationScope"), "Сфера участі");
    assert.equal(authorKey(uk.messages, "collectiveDecision.fields.closingDate"), "Дата закриття");
    assert.equal(
      authorKey(uk.messages, "collectiveDecision.generateCollectiveDecisionDraft"),
      "Згенерувати чернетку колективного рішення",
    );
    assert.equal(authorKey(uk.messages, "collectiveDecision.statuses.draft"), "Чернетка");
    assert.equal(authorKey(uk.messages, "collectiveDecision.statuses.opened"), "Відкрито");
    assert.equal(authorKey(uk.messages, "collectiveDecision.statuses.closed"), "Закрито");
    assert.equal(authorKey(uk.messages, "collectiveDecision.statuses.cancelled"), "Скасовано");
  });

  it("Decision Session canonical form values remain state-bound", () => {
    const editor = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionEditor.tsx",
    );
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{decisionQuestion\}/);
    assert.match(editor, /value=\{options\}/);
    assert.match(editor, /value=\{objectives\}/);
    assert.match(editor, /listToLines\(draft\.options\)/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Decision Title</);
    assert.doesNotMatch(editor, />Generate Decision Draft</);
  });

  it("Collective Decision participationScope stays canonical; display uses resolver", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveParticipationScopeDisplayLabel("world", en.messages), "World");
    assert.equal(resolveParticipationScopeDisplayLabel("community", uk.messages), "Спільнота");
    assert.equal(resolveParticipationScopeDisplayLabel("unknown_scope", uk.messages), "unknown_scope");

    const editor = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionEditor.tsx",
    );
    const ballot = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
    );
    assert.match(editor, /resolveParticipationScopeDisplayLabel\(scope, t\)/);
    assert.match(editor, /value=\{participationScope\}/);
    assert.match(editor, /value=\{scope\}/);
    assert.match(editor, /participationScope,/);
    assert.match(ballot, /resolveParticipationScopeDisplayLabel\(projection\.participationScope, t\)/);
    assert.doesNotMatch(editor, /\{scope\}<\/option>/);
    assert.doesNotMatch(ballot, /\{projection\.participationScope\}/);
  });

  it("Collective Decision status maps display-only; unknown codes are not remapped", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveCollectiveDecisionStatusDisplayLabel("draft", en.messages), "Draft");
    assert.equal(resolveCollectiveDecisionStatusDisplayLabel("opened", uk.messages), "Відкрито");
    assert.equal(resolveCollectiveDecisionStatusDisplayLabel("closed", uk.messages), "Закрито");
    assert.equal(resolveCollectiveDecisionStatusDisplayLabel("cancelled", uk.messages), "Скасовано");
    assert.equal(resolveCollectiveDecisionStatusDisplayLabel("weird_status", en.messages), "weird_status");
    assert.notEqual(
      resolveCollectiveDecisionStatusDisplayLabel("weird_status", en.messages),
      "Draft",
    );

    const publicResult = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    assert.match(publicResult, /resolveCollectiveDecisionStatusDisplayLabel\(projection\.status, t\)/);
    assert.doesNotMatch(publicResult, /replaceAll\("_", " "\)/);
  });

  it("collaboration.vote labels reused for vote chrome; codes/totals unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveInitiativeDecisionVoteChoiceDisplayLabel("support", uk.messages), "Підтримати");
    assert.equal(
      resolveInitiativeDecisionVoteChoiceDisplayLabel("do_not_support", uk.messages),
      "Не підтримувати",
    );
    assert.equal(resolveInitiativeDecisionVoteChoiceDisplayLabel("abstain", uk.messages), "Утриматися");
    assert.equal(resolveInitiativeDecisionVoteChoiceDisplayLabel("candidate", uk.messages), "candidate");

    const ballot = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
    );
    const publicResult = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    assert.match(ballot, /resolveInitiativeDecisionVoteChoiceDisplayLabel/);
    assert.match(ballot, /collaboration\.vote\.closesMeta/);
    assert.match(ballot, /collaboration\.vote\.signInToVote/);
    assert.match(ballot, /collaboration\.vote\.currentVote/);
    assert.match(ballot, /INITIATIVE_DECISION_VOTE_CHOICES/);
    assert.match(ballot, /castOrUpdateInitiativeDecisionVote\(decisionId, choice\)/);
    assert.match(publicResult, /stats\.supportCount/);
    assert.match(publicResult, /stats\.totalVotesCast/);
    assert.doesNotMatch(ballot, /labelInitiativeDecisionVoteChoice/);
  });

  it("voting-unavailable prose is not sentence-matched", () => {
    const ballot = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
    );
    const voting = readWeb(
      "features/initiative-collective-decision-lifecycle/collective-decision-voting.ts",
    );
    assert.match(ballot, /describeCollectiveDecisionVotingUnavailable\(projection\)/);
    assert.match(ballot, /unavailableReason \?\? t\("collaboration\.vote\.unavailable"\)/);
    assert.doesNotMatch(ballot, /unavailableReason\s*===/);
    assert.doesNotMatch(ballot, /includes\("This Collective Decision/);
    assert.match(voting, /This Collective Decision was cancelled/);
    assert.doesNotMatch(voting, /useTranslations/);
  });

  it("canonical civic fields and closesAt remain unbound to next-intl values", () => {
    const editor = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionEditor.tsx",
    );
    const preview = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionDraftPreview.tsx",
    );
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{decisionSummary\}/);
    assert.match(editor, /value=\{toDatetimeLocalValue\(closesAt\)\}/);
    assert.match(editor, /participationScope,/);
    assert.match(editor, /closesAt,/);
    assert.match(preview, /\{draft\.decisionSummary\}/);
    assert.match(preview, /\{draft\.approvedActions\}/);
    assert.doesNotMatch(editor, /value=\{t\(/);
  });

  it("source excerpts/API consistency labels preserved; AI draft content not from next-intl", () => {
    const dsPanel = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionIntelligenceSnapshotPanel.tsx",
    );
    const cdPanel = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionIntelligenceSnapshotPanel.tsx",
    );
    const dsEditor = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionEditor.tsx",
    );
    const cdEditor = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionEditor.tsx",
    );
    assert.match(dsPanel, /snapshot\.petitionReference\.title/);
    assert.match(dsPanel, /snapshot\.revisionReference\.revisionSummary/);
    assert.match(dsPanel, /snapshot\.analysisReference\?\.title/);
    assert.match(cdPanel, /snapshot\.decisionSessionReference\.title/);
    assert.match(cdPanel, /check\.status === "warning"/);
    assert.match(dsEditor, /generateInitiativeDecisionSessionDraft/);
    assert.match(cdEditor, /generateInitiativeCollectiveDecisionDraft/);
    assert.match(dsEditor, /useLifecycleAiFormApply/);
    assert.match(cdEditor, /useLifecycleAiFormApply/);
    assert.match(dsEditor, /detailFromError/);
    assert.match(cdEditor, /detailFromError/);
    assert.doesNotMatch(dsEditor, /gemini/i);
    assert.doesNotMatch(cdEditor, /gemini/i);
  });

  it("localized a11y names for Decision Session and Collective Decision author chrome", () => {
    const dsPreview = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionDraftPreview.tsx",
    );
    const dsPublic = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionPublicResult.tsx",
    );
    const dsPanel = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionIntelligenceSnapshotPanel.tsx",
    );
    const ballot = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
    );
    assert.match(dsPreview, /author\.decisionSession\.preview\.aria/);
    assert.match(dsPublic, /author\.decisionSession\.public\.aria/);
    assert.match(dsPanel, /author\.decisionSession\.sourceSnapshot\.aria/);
    assert.match(ballot, /author\.collectiveDecision\.ballot\.aria/);
    assert.match(ballot, /collaboration\.vote\.voteChoicesAria/);
    assert.doesNotMatch(dsPreview, /aria-label="Decision Session draft preview"/);
    assert.doesNotMatch(ballot, /aria-label="Collective Decision voting"/);
    assert.doesNotMatch(ballot, /aria-label="Vote choices"/);
  });

  it("PublicChoiceElectionResultsBoard chrome localized; CD wrapper uses status display resolver", () => {
    const publicResult = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(publicResult, /PublicChoiceElectionResultsBoard/);
    assert.match(publicResult, /author\.collectiveDecision\.public\.previewMeta/);
    assert.match(
      publicResult,
      /resolvePublicChoiceElectionVotingStatusDisplayLabel\(\s*votingStatus/,
    );
    assert.doesNotMatch(publicResult, /publicChoiceElectionVotingStatusLabel\(votingStatus\)/);
    assert.match(board, /useTranslations/);
    assert.match(board, /publicChoice\.results\./);
  });

  it("no Gemini/runtime UI translation in Decision Session / Collective Decision author components", () => {
    const files = [
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionAuthorWorkspace.tsx",
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionEditor.tsx",
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionDraftPreview.tsx",
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionPublicResult.tsx",
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionIntelligenceSnapshotPanel.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionAuthorWorkspace.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionEditor.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionDraftPreview.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionBallotWidget.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionIntelligenceSnapshotPanel.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
    }
  });

  it("layout resilience for Decision Session and Collective Decision CSS", () => {
    const idsCss = readWeb(
      "features/initiative-decision-session-lifecycle/components/initiative-decision-session-stage-workspace.css",
    );
    const icdCss = readWeb(
      "features/initiative-collective-decision-lifecycle/components/initiative-collective-decision-stage-workspace.css",
    );
    for (const css of [idsCss, icdCss]) {
      assert.match(css, /min-width:\s*0/);
      assert.match(css, /overflow-wrap:\s*anywhere|overflow-wrap:\s*break-word/);
      assert.match(css, /flex-wrap:\s*wrap/);
      assert.match(css, /padding-inline-start/);
    }
  });

  it("missing author.decisionSession key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { decisionSession?: { generateDecisionDraft?: string } };
      }
    ).author?.decisionSession?.generateDecisionDraft;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.decisionSession.generateDecisionDraft"),
      ),
    );
  });

  it("Commitment and later stages remain free of these author keys", () => {
    const commitment = readWeb(
      "features/initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentAuthorWorkspace.tsx",
    );
    const tracking = readWeb(
      "features/initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingAuthorWorkspace.tsx",
    );
    assert.doesNotMatch(commitment, /author\.decisionSession/);
    assert.doesNotMatch(commitment, /author\.collectiveDecision/);
    assert.doesNotMatch(tracking, /author\.decisionSession/);
    assert.doesNotMatch(tracking, /author\.collectiveDecision/);
  });

  it("reuse manage.scopes and collaboration.vote vocabulary without duplication", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(experienceKey(en.messages, "manage.scopes.world"), "World");
    assert.equal(experienceKey(en.messages, "collaboration.vote.support"), "Support");
    assert.equal(experienceKey(en.messages, "collaboration.vote.doNotSupport"), "Do not support");
    assert.equal(experienceKey(en.messages, "collaboration.vote.abstain"), "Abstain");
    // No duplicate scope vocabulary under collectiveDecision
    const cd = (
      en.messages as {
        initiativeExperience?: { author?: { collectiveDecision?: Record<string, unknown> } };
      }
    ).initiativeExperience?.author?.collectiveDecision;
    assert.ok(cd);
    assert.equal("scopes" in cd, false);
  });
});
