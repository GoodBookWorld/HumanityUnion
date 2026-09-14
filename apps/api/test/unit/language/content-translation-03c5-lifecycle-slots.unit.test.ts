/**
 * Localization Closure 03C.5 — semantic lifecycle slots for Collaborative Analysis CT.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.TRANSLATION_PROVIDER = "deterministic";

import {
  assertProviderPayloadHasNoLifecycleStageTokens,
  buildProviderOwnedLifecycleMachinePayload,
  composeLifecycleStageTokensToEnglishRegistry,
  lifecycleStageToken,
  presentLifecycleStageTokensAsEnglish,
  reassembleLifecycleStageSlotPlans,
  textContainsLifecycleStageToken,
} from "@hu/types";

import {
  ContentTranslationValidationError,
  DeterministicTranslationProvider,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  formatProviderTerminologyContext,
  listTerminologyConcepts,
  presentCollaborativeAnalysisCanonicalFields,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  resolveWorkflowStagePreferredTerm,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  translateCollaborativeAnalysisFieldsWithLifecycleSlots,
  updateLanguageRegistryRecord,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

describe("Localization Closure 03C.5 — CA lifecycle semantic slots", () => {
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

  describe("B. Canonical English fallback", () => {
    it("tokenized canonical CA displays English lifecycle labels", () => {
      const title = `${ANALYSIS}: Community Garden`;
      const summary = `No ${DISCUSSION} activity yet.`;
      assert.equal(
        presentLifecycleStageTokensAsEnglish(title),
        "Collaborative Analysis: Community Garden",
      );
      assert.equal(
        presentLifecycleStageTokensAsEnglish(summary),
        "No Discussion activity yet.",
      );
      const composed = composeLifecycleStageTokensToEnglishRegistry(title);
      assert.equal(composed.ok, true);
      if (composed.ok) {
        assert.doesNotMatch(composed.text, /\{lifecycleStage:/);
      }
    });

    it("public projection never exposes raw lifecycle tokens", () => {
      // Mirrors presentAnalysisFieldsForParticipants (English Registry presentation).
      // Avoids Mongo author lookup so this unit stays provider/network-free.
      const title = `${ANALYSIS}: Token Title`;
      const summary = `See ${DISCUSSION} for sources.`;
      const references = `(see ${DISCUSSION})`;
      const presentedTitle = presentLifecycleStageTokensAsEnglish(title);
      const presentedSummary = presentLifecycleStageTokensAsEnglish(summary);
      const presentedReferences = presentLifecycleStageTokensAsEnglish(references);
      assert.equal(presentedTitle, "Collaborative Analysis: Token Title");
      assert.equal(presentedSummary, "See Discussion for sources.");
      assert.doesNotMatch(presentedTitle, /\{lifecycleStage:/);
      assert.doesNotMatch(presentedReferences, /\{lifecycleStage:/);

      const projectionSrc = readFileSync(
        path.join(
          repoRoot,
          "apps/api/src/modules/initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.ts",
        ),
        "utf8",
      );
      assert.match(projectionSrc, /presentLifecycleStageTokensAsEnglish/);
    });

    it("presentCollaborativeAnalysisCanonicalFields strips tokens from bags", () => {
      const presented = presentCollaborativeAnalysisCanonicalFields({
        title: `${ANALYSIS}: X`,
        summary: `from ${DISCUSSION}`,
      });
      assert.equal(presented.title, "Collaborative Analysis: X");
      assert.equal(presented.summary, "from Discussion");
    });
  });

  describe("C. Provider boundary", () => {
    it("provider input does not contain lifecycle-stage tokens; prose remains machine-owned", () => {
      const fields = {
        title: `${ANALYSIS}: Garden Initiative`,
        summary: `No ${DISCUSSION} activity for "Garden Initiative" yet.`,
        references: `"quote" — Ally (see ${DISCUSSION})`,
      };
      const { payload, plans } = buildProviderOwnedLifecycleMachinePayload(fields);
      assert.ok(plans.some((p) => p.hasLifecycleStageSlots));
      const leak = assertProviderPayloadHasNoLifecycleStageTokens(payload);
      assert.deepEqual(leak, []);
      for (const value of Object.values(payload)) {
        assert.equal(textContainsLifecycleStageToken(value), false);
      }
      assert.ok(
        Object.values(payload).some((v) => v.includes("Garden Initiative")),
        "Initiative title prose remains in machine segments",
      );
      assert.ok(
        Object.values(payload).some((v) => v.includes("quote")),
        "Comment excerpt remains in machine segments",
      );
    });
  });

  describe("D. Postprocessing", () => {
    async function seedUkWorkflowStages() {
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
    }

    it("uk + analysis / discussion restore preferredTerms; repeated tokens restore", async () => {
      await seedUkWorkflowStages();
      const fields = {
        title: `${ANALYSIS}: Garden`,
        summary: `${DISCUSSION} then ${DISCUSSION} again.`,
        supportingEvidence: "a",
        risks: "b",
        openQuestions: "c",
        suggestedImprovements: "d",
        references: `see ${DISCUSSION}`,
      };

      const translated = await translateCollaborativeAnalysisFieldsWithLifecycleSlots({
        sanitizedFields: fields,
        sourceLanguage: "en",
        targetLanguage: "uk",
        translatePayload: async (payload) => {
          const out: Record<string, string> = {};
          for (const [key, value] of Object.entries(payload)) {
            out[key] = `[uk] ${value}`;
          }
          return out;
        },
      });

      assert.equal(translated.title, "Спільний аналіз[uk] : Garden");
      assert.equal(
        translated.summary,
        "Обговорення[uk]  then Обговорення[uk]  again.",
      );
      assert.equal(translated.references, "[uk] see Обговорення");
      assert.doesNotMatch(JSON.stringify(translated), /\{lifecycleStage:/);
    });

    it("malformed/unknown tokens fail closed", async () => {
      await seedUkWorkflowStages();
      await assert.rejects(
        () =>
          translateCollaborativeAnalysisFieldsWithLifecycleSlots({
            sanitizedFields: {
              title: "{lifecycleStage:not_a_real_stage}: X",
              summary: "s",
              supportingEvidence: "a",
              risks: "b",
              openQuestions: "c",
              suggestedImprovements: "d",
              references: "e",
            },
            sourceLanguage: "en",
            targetLanguage: "uk",
            translatePayload: async (payload) => ({ ...payload }),
          }),
        (error: unknown) =>
          error instanceof ContentTranslationValidationError &&
          error.reasonCode === "OTHER_VALIDATION_FAILURE",
      );
    });

    it("missing Terminology preferredTerm falls through to WEB_UI controlled label (Closure 03)", async () => {
      // Seeds ship translations: {} — no uk preferredTerm; WEB_UI uk stage label exists.
      const concepts = await listTerminologyConcepts();
      assert.equal(
        resolveWorkflowStagePreferredTerm({
          concepts,
          stageId: "analysis",
          targetLocale: "uk",
        }),
        null,
      );

      const values = await translateCollaborativeAnalysisFieldsWithLifecycleSlots({
        sanitizedFields: {
          title: `${ANALYSIS}: Garden`,
          summary: "summary without slots",
          supportingEvidence: "a",
          risks: "b",
          openQuestions: "c",
          suggestedImprovements: "d",
          references: "e",
        },
        sourceLanguage: "en",
        targetLanguage: "uk",
        translatePayload: async (payload) => {
          const out: Record<string, string> = {};
          for (const [key, value] of Object.entries(payload)) {
            out[key] = `[uk] ${value}`;
          }
          return out;
        },
      });

      assert.match(values.title ?? "", /Спільний аналіз/);
      assert.doesNotMatch(values.title ?? "", /Collaborative Analysis/);
      assert.doesNotMatch(values.title ?? "", /\{lifecycleStage:/);
    });

    it("reassembleLifecycleStageSlotPlans fails closed on unresolved labels", () => {
      const { plans } = buildProviderOwnedLifecycleMachinePayload({
        title: `${ANALYSIS}: X`,
      });
      const result = reassembleLifecycleStageSlotPlans({
        plans,
        translatedSegments: { "title#m0": ": X" },
        resolveStageLabel: () => null,
      });
      assert.ok(result.unresolvedStageIds.includes("analysis"));
      assert.equal(result.values.title, undefined);
    });
  });

  describe("E. Glossary context", () => {
    it("non-English workflow_stage with missing preferredTerm does NOT emit English => guidance", async () => {
      const concepts = await listTerminologyConcepts();
      const context = formatProviderTerminologyContext(concepts, "uk");
      assert.doesNotMatch(context, /Discussion \(discussion\) => Discussion/);
      assert.doesNotMatch(
        context,
        /Collaborative Analysis \(collaborative_analysis\) => Collaborative Analysis/,
      );
      assert.doesNotMatch(context, /Discussion \(discussion\).*fallback: en/);
      // Unrelated categories still fall back to English with marker.
      assert.match(context, /Participant \(participant\) => Participant \| fallback: en/);
    });

    it("workflow_stage with published preferredTerm is emitted", async () => {
      await updateTerminologyConcept("discussion", {
        translations: { uk: { preferredTerm: "Обговорення", aliases: [] } },
      });
      const concepts = await listTerminologyConcepts();
      const context = formatProviderTerminologyContext(concepts, "uk");
      assert.match(context, /Discussion \(discussion\) => Обговорення/);
      assert.doesNotMatch(context, /Discussion \(discussion\).*fallback: en/);
    });
  });

  describe("F. Architecture guards", () => {
    it("CT lifecycle path does not import Media/PLP or next-intl/web", () => {
      const lifecycleSlots = readFileSync(
        path.join(
          repoRoot,
          "apps/api/src/modules/language/content-translation-lifecycle-slots.ts",
        ),
        "utf8",
      );
      const ctService = readFileSync(
        path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
        "utf8",
      );
      assert.doesNotMatch(lifecycleSlots, /media-plp/);
      assert.doesNotMatch(lifecycleSlots, /next-intl/);
      assert.doesNotMatch(lifecycleSlots, /apps\/web/);
      assert.doesNotMatch(ctService, /media-plp/);
      assert.doesNotMatch(ctService, /next-intl/);
      assert.match(ctService, /translateCollaborativeAnalysisFieldsWithLifecycleSlots/);
      assert.match(ctService, /presentCollaborativeAnalysisCanonicalFields/);
    });

    it("resolvePublicTranslatedContent does not call provider when generateIfMissing is false", async () => {
      // Architecture: public resolve without generate uses stored CT / original only.
      const resolveSrc = readFileSync(
        path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
        "utf8",
      );
      assert.match(resolveSrc, /if \(input\.generateIfMissing\)/);
      assert.match(
        resolveSrc,
        /presentCollaborativeAnalysisCanonicalFields\(source\.fields\)/,
      );
      // 03C.5C — CA must not use reassembled glossary fields as machine-prose proof.
      assert.match(resolveSrc, /validated against the provider machine payload/);
    });
  });
});
