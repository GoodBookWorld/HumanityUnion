/**
 * Localization Closure 03C.5D — CA generation must not flatten Improvement Proposal English.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.TRANSLATION_PROVIDER = "deterministic";

import {
  assertProviderPayloadHasNoLifecycleStageTokens,
  buildProviderOwnedLifecycleMachinePayload,
  lifecycleStageToken,
  presentLifecycleStageTokensAsEnglish,
  textContainsLifecycleStageToken,
} from "@hu/types";

import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";
import {
  DeterministicTranslationProvider,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  translateCollaborativeAnalysisFieldsWithLifecycleSlots,
  updateLanguageRegistryRecord,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";

const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");
const PROPOSAL = lifecycleStageToken("proposal");

function escapeToken(token: string): string {
  return token.replace(/[{}]/g, "\\$&");
}

describe("Localization Closure 03C.5D — CA Improvement Proposal lifecycle token", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    setTranslationProviderForTests(new DeterministicTranslationProvider());
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. CA suggestedImprovements uses proposal lifecycle token, not raw English stage name", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "init-03c5d",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      operation: "generate_draft",
      participantDisplayName: "Author",
      initiativeTitle: "Climate Safety",
      presentationMode: "author_workspace",
      availableSourceLabels: ["discussion"],
      sourceContextSummary: "Source snapshot summary for tests.",
      prompt: { systemPrompt: "test", userPrompt: "test" },
    });

    const suggested = result.suggestions.find(
      (item) => item.targetSectionId === "suggestedImprovements",
    );
    assert.ok(suggested, "expected suggestedImprovements suggestion");
    assert.match(suggested.suggestedText, new RegExp(escapeToken(PROPOSAL)));
    assert.doesNotMatch(suggested.suggestedText, /Improvement Proposal/);
    assert.doesNotMatch(suggested.suggestedText, /Improvement Proposals/);
    assert.ok(textContainsLifecycleStageToken(suggested.suggestedText));
  });

  it("B. Discussion references remain tokenized in CA generation", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "init-03c5d",
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      operation: "generate_draft",
      participantDisplayName: "Author",
      initiativeTitle: "Climate Safety",
      presentationMode: "author_workspace",
      availableSourceLabels: ["discussion"],
      sourceContextSummary: "Source snapshot summary for tests.",
      prompt: { systemPrompt: "test", userPrompt: "test" },
    });

    const risks = result.suggestions.find((item) => item.targetSectionId === "risks");
    const references = result.suggestions.find(
      (item) => item.targetSectionId === "references",
    );
    assert.ok(risks);
    assert.ok(references);
    assert.match(risks.suggestedText, new RegExp(escapeToken(DISCUSSION)));
    assert.match(references.suggestedText, new RegExp(escapeToken(DISCUSSION)));
  });

  it("C. English canonical presentation composes proposal token to registry label", () => {
    const canonical = `Note areas that need clarification before the ${PROPOSAL} stage.`;
    assert.equal(
      presentLifecycleStageTokensAsEnglish(canonical),
      "Note areas that need clarification before the Improvement Proposals stage.",
    );
  });

  it("D/E. proposal token follows machine-segment + glossary preferredTerm path; provider sees no tokens", async () => {
    await updateTerminologyConcept("improvement_proposal", {
      translations: {
        uk: { preferredTerm: "Пропозиції покращення", aliases: [] },
      },
    });
    await updateTerminologyConcept("collaborative_analysis", {
      translations: {
        uk: { preferredTerm: "Спільний аналіз", aliases: [] },
      },
    });
    await updateTerminologyConcept("discussion", {
      translations: {
        uk: { preferredTerm: "Обговорення", aliases: [] },
      },
    });

    const fields = {
      title: `${ANALYSIS}: Climate Safety`,
      summary: "Summary prose.",
      supportingEvidence: "Evidence.",
      risks: `Themes from ${DISCUSSION}.`,
      openQuestions: "Questions.",
      suggestedImprovements: `Clarify before the ${PROPOSAL} stage.`,
      references: `See ${DISCUSSION}.`,
    };

    const { payload } = buildProviderOwnedLifecycleMachinePayload(fields);
    assert.deepEqual(assertProviderPayloadHasNoLifecycleStageTokens(payload), []);

    const translated = await translateCollaborativeAnalysisFieldsWithLifecycleSlots({
      sanitizedFields: fields,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatePayload: async (machinePayload) => {
        assert.deepEqual(
          assertProviderPayloadHasNoLifecycleStageTokens(machinePayload),
          [],
        );
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(machinePayload)) {
          out[key] = `[uk] ${value}`;
        }
        return out;
      },
    });

    assert.match(translated.suggestedImprovements, /Пропозиції покращення/);
    assert.doesNotMatch(translated.suggestedImprovements, /\{lifecycleStage:/);
    assert.doesNotMatch(translated.suggestedImprovements, /Improvement Proposal/);
  });
});
