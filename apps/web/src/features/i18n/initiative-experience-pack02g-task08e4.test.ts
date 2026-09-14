/**
 * Pack 02G Task 08E.4 — structured localized AI apply notices.
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
  formatLifecycleAiApplyNotice,
  resolveInitiativeExperienceMessage,
  resolveLifecycleAiApplyFieldDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { applyLifecycleAiSuggestionsToFields } from "../lifecycle-ai-assistant/lifecycle-ai-apply-suggestions.js";
import { getLifecycleAiStageApplyContract } from "../lifecycle-ai-assistant/lifecycle-ai-stage-apply-contract.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

function translatorFor(messages: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>) => {
    let text = ieKey(messages, key);
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

describe("Pack 02G Task 08E.4 — structured localized AI apply notices", () => {
  it("catalog parity includes author.actions.aiApplied", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof ieKey(loaded.messages, "author.actions.aiApplied"), "string");
      assert.match(ieKey(loaded.messages, "author.actions.aiApplied"), /\{fields\}/);
      assert.match(ieKey(loaded.messages, "author.actions.aiApplied"), /\{saveDraft\}/);
    }
  });

  it("shared apply hook exposes structured changedKeys; no English prose construction", () => {
    const hook = readWeb("features/lifecycle-ai-assistant/use-lifecycle-ai-form-apply.ts");
    assert.match(hook, /LifecycleAiFormApplyNotice/);
    assert.match(hook, /changedKeys:\s*result\.changedKeys/);
    assert.doesNotMatch(hook, /Applied AI suggestions to:/);
    assert.doesNotMatch(hook, /Review before Save Draft/);
  });

  it("Petition / Decision Session / Collective Decision do not render the old English sentence", () => {
    const petition = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionEditor.tsx",
    );
    const decisionSession = readWeb(
      "features/initiative-decision-session-lifecycle/components/InitiativeDecisionSessionEditor.tsx",
    );
    const collectiveDecision = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionEditor.tsx",
    );
    for (const source of [petition, decisionSession, collectiveDecision]) {
      assert.match(source, /formatLifecycleAiApplyNotice/);
      assert.match(source, /changedKeys/);
      assert.doesNotMatch(source, /Applied AI suggestions to:/);
      assert.doesNotMatch(source, /onAppliedNotice:\s*\(text\)/);
    }
  });

  it("Ukrainian apply notices use localized field labels for Petition / DS / CD", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    const saveDraft = ieKey(uk.messages, "author.actions.saveDraft");
    const preview = ieKey(uk.messages, "author.actions.preview");
    const publish = ieKey(uk.messages, "author.actions.publish");

    const petitionNotice = formatLifecycleAiApplyNotice({
      locale: "uk",
      stageId: "petition",
      changedKeys: ["title", "publicSummary"],
      t,
      saveDraft,
      preview,
      publish,
    });
    assert.match(petitionNotice, /Застосовано пропозиції ШІ/);
    assert.match(petitionNotice, /петиц/i);
    assert.match(petitionNotice, /Публічн/i);
    assert.doesNotMatch(petitionNotice, /Applied AI suggestions/);
    assert.doesNotMatch(petitionNotice, /publicSummary/);

    const dsNotice = formatLifecycleAiApplyNotice({
      locale: "uk",
      stageId: "decision_session",
      changedKeys: ["decisionQuestion", "decisionContext"],
      t,
      saveDraft,
      preview,
      publish,
    });
    assert.match(dsNotice, /Застосовано пропозиції ШІ/);
    assert.doesNotMatch(dsNotice, /decisionQuestion/);
    assert.doesNotMatch(dsNotice, /Applied AI suggestions/);

    const cdNotice = formatLifecycleAiApplyNotice({
      locale: "uk",
      stageId: "collective_decision",
      changedKeys: ["decisionSummary", "approvedActions"],
      t,
      saveDraft,
      preview,
      publish,
    });
    assert.match(cdNotice, /Застосовано пропозиції ШІ/);
    assert.doesNotMatch(cdNotice, /decisionSummary/);
    assert.doesNotMatch(cdNotice, /Applied AI suggestions/);
  });

  it("canonical field IDs remain stable; unknown field falls back to raw id", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);

    assert.deepEqual(getLifecycleAiStageApplyContract("petition")?.knownKeys, [
      "title",
      "publicSummary",
      "requestStatement",
      "expectedOutcome",
      "supportingContext",
      "keyArguments",
    ]);

    assert.equal(
      resolveLifecycleAiApplyFieldDisplayLabel("petition", "title", t),
      ieKey(en.messages, "author.petition.fields.title"),
    );
    assert.equal(
      resolveLifecycleAiApplyFieldDisplayLabel("decision_session", "decisionQuestion", t),
      ieKey(en.messages, "author.decisionSession.fields.question"),
    );
    assert.equal(
      resolveLifecycleAiApplyFieldDisplayLabel("collective_decision", "decisionSummary", t),
      ieKey(en.messages, "author.collectiveDecision.fields.summary"),
    );
    assert.equal(
      resolveLifecycleAiApplyFieldDisplayLabel("petition", "notARealField", t),
      "notARealField",
    );
    assert.equal(
      resolveLifecycleAiApplyFieldDisplayLabel("decision_session", "mysteryKey", t),
      "mysteryKey",
    );
  });

  it("apply mapping still returns the same changed field IDs (behavior preserved)", () => {
    const current = {
      title: "",
      publicSummary: "old",
      requestStatement: "",
      expectedOutcome: "",
      supportingContext: "",
      keyArguments: "",
    };
    const result = applyLifecycleAiSuggestionsToFields({
      current,
      suggestions: [
        {
          targetSectionId: "title",
          suggestedText: "New title",
        },
        {
          targetSectionId: "publicSummary",
          suggestedText: "New summary",
        },
      ],
      knownKeys: [
        "title",
        "publicSummary",
        "requestStatement",
        "expectedOutcome",
        "supportingContext",
        "keyArguments",
      ],
      fallbackKey: "publicSummary",
      forbiddenKeys: [],
    });
    assert.equal(result.applied, true);
    assert.deepEqual(result.changedKeys, ["title", "publicSummary"]);
    assert.equal(result.next.title, "New title");
    assert.equal(result.next.publicSummary, "New summary");
  });

  it("already-localized Archive / OR / PI editors keep catalog aiApplied; no English sentence matching", () => {
    const archive = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
    );
    const official = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
    );
    const impact = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
    );
    assert.match(archive, /author\.archive\.messages\.aiApplied/);
    assert.match(official, /author\.officialResponse\.messages\.aiApplied/);
    assert.match(impact, /author\.publicImpact\.messages\.aiApplied/);
    assert.doesNotMatch(archive, /Applied AI suggestions to:/);
    assert.doesNotMatch(official, /Applied AI suggestions to:/);
    assert.doesNotMatch(impact, /Applied AI suggestions to:/);
    assert.doesNotMatch(archive, /\.startsWith\("Applied AI/);
  });

  it("missing author.actions.aiApplied fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { actions?: { aiApplied?: string } } }).author
      ?.actions?.aiApplied;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.actions.aiApplied"),
      ),
    );
  });
});
