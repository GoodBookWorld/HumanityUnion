/**
 * Production Completion Pack 02F Task 05 — locale-aware provider terminology injection.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.TRANSLATION_PROVIDER = "deterministic";

import {
  DeterministicTranslationProvider,
  HUMANITY_UNION_TRANSLATION_TERMINOLOGY,
  TerminologyGlossaryValidationError,
  TranslationProviderError,
  buildGeminiTranslationSystemInstructionForTests,
  buildProviderTerminologyContext,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  formatProviderTerminologyContext,
  getTerminologyConceptById,
  listPublishedProviderTerminologyLines,
  listTerminologyConcepts,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  resolveProviderTerminologyContext,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  translateDraft,
  updateLanguageRegistryRecord,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Production Completion Pack 02F Task 05 — provider terminology injection", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetTranslationProviderForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    await updateLanguageRegistryRecord("lang-zh-Hant", { enabled: true });
    setTranslationProviderForTests(new DeterministicTranslationProvider());
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. published glossary concepts are included", async () => {
    const concepts = await listTerminologyConcepts();
    const context = formatProviderTerminologyContext(concepts, "en");
    assert.match(context, /Participant \(participant\) => Participant/);
    assert.match(context, /Initiative \(initiative\) => Initiative/);
    assert.match(context, /Humanity Union \(humanity_union\) => Humanity Union/);
    const lines = listPublishedProviderTerminologyLines(concepts, "en");
    assert.equal(lines.length, concepts.filter((c) => c.status === "published").length);
  });

  it("2. draft concepts are excluded", async () => {
    await updateTerminologyConcept("assistant", { status: "draft" });
    const concepts = await listTerminologyConcepts();
    const context = formatProviderTerminologyContext(concepts, "uk");
    assert.doesNotMatch(context, /assistant/);
    assert.doesNotMatch(context, /\bAssistant\b/);
  });

  it("3. retired concepts are excluded", async () => {
    await updateTerminologyConcept("civic_media", { status: "retired" });
    const concepts = await listTerminologyConcepts();
    const context = formatProviderTerminologyContext(concepts, "uk");
    assert.doesNotMatch(context, /civic_media/);
    assert.doesNotMatch(context, /Civic Media/);
  });

  it("4. target preferred term is used when present", async () => {
    await updateTerminologyConcept("participant", {
      translations: {
        uk: { preferredTerm: "Учасник", aliases: [] },
      },
    });
    const context = await buildProviderTerminologyContext("uk");
    assert.match(context, /Participant \(participant\) => Учасник/);
  });

  it("5. missing target term falls back to canonical English", async () => {
    const context = await buildProviderTerminologyContext("uk");
    assert.match(context, /Participant \(participant\) => Participant \| fallback: en/);
    assert.match(context, /Member \(member\) => Member \| fallback: en/);
  });

  it("6. zh-TW resolves to zh-Hant", async () => {
    await updateTerminologyConcept("workspace", {
      translations: {
        "zh-TW": { preferredTerm: "工作區", aliases: ["工作空间"] },
      },
    });
    const concept = await getTerminologyConceptById("workspace");
    assert.equal(concept?.translations["zh-TW"], undefined);
    assert.equal(concept?.translations["zh-Hant"]?.preferredTerm, "工作區");

    const context = await buildProviderTerminologyContext("zh-TW");
    assert.match(context, /Workspace \(workspace\) => 工作區/);
    assert.match(context, /aliases: 工作空间/);
  });

  it("7. Participant / Member / Membership remain distinct", async () => {
    await updateTerminologyConcept("participant", {
      translations: { uk: { preferredTerm: "Учасник", aliases: [] } },
    });
    await updateTerminologyConcept("member", {
      translations: { uk: { preferredTerm: "Член", aliases: [] } },
    });
    await updateTerminologyConcept("membership", {
      translations: { uk: { preferredTerm: "Членство", aliases: [] } },
    });
    const lines = listPublishedProviderTerminologyLines(await listTerminologyConcepts(), "uk");
    const byId = new Map(lines.map((line) => [line.conceptId, line]));
    assert.equal(byId.get("participant")?.preferredTerm, "Учасник");
    assert.equal(byId.get("member")?.preferredTerm, "Член");
    assert.equal(byId.get("membership")?.preferredTerm, "Членство");
    assert.notEqual(byId.get("participant")?.preferredTerm, byId.get("member")?.preferredTerm);
    assert.notEqual(byId.get("member")?.preferredTerm, byId.get("membership")?.preferredTerm);
  });

  it("8. lifecycle preferred term does not change stageId", async () => {
    await updateTerminologyConcept("improvement_proposal", {
      translations: {
        uk: { preferredTerm: "Пропозиція покращення", aliases: ["пропозиції покращення"] },
      },
    });
    const before = await getTerminologyConceptById("improvement_proposal");
    assert.equal(before?.linkedRefs?.stageId, "proposal");
    const context = await buildProviderTerminologyContext("uk");
    assert.match(
      context,
      /Improvement Proposal \(improvement_proposal\) => Пропозиція покращення/,
    );
    const after = await getTerminologyConceptById("improvement_proposal");
    assert.equal(after?.linkedRefs?.stageId, "proposal");
    assert.doesNotMatch(context, /stageId/);
  });

  it("9. Humanity Union guidance is represented", async () => {
    await updateTerminologyConcept("humanity_union", {
      translations: {
        uk: {
          preferredTerm: "Humanity Union",
          aliases: [],
          guidance: "Keep brand name Humanity Union; do not localize the product name.",
        },
      },
    });
    const context = await buildProviderTerminologyContext("uk");
    assert.match(context, /Humanity Union \(humanity_union\) => Humanity Union/);
    assert.match(context, /guidance: Keep brand name Humanity Union/);
  });

  it("10. aliases and guidance are deterministic", async () => {
    await updateTerminologyConcept("initiative", {
      translations: {
        uk: {
          preferredTerm: "Ініціатива",
          aliases: ["ініціативи", "ініціативу"],
          guidance: "Capitalize when naming a specific Initiative.",
        },
      },
    });
    const a = await resolveProviderTerminologyContext("uk");
    const b = await resolveProviderTerminologyContext("uk");
    assert.equal(a, b);
    assert.match(a, /aliases: ініціативи, ініціативу/);
    assert.match(a, /guidance: Capitalize when naming a specific Initiative\./);
  });

  it("11–12. Gemini prompt uses preferred terms and protects machine identifiers", () => {
    const prompt = buildGeminiTranslationSystemInstructionForTests({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: "hello",
      terminologyContext: "Participant (participant) => Учасник",
      safetyCleared: true,
    });
    assert.doesNotMatch(prompt, /Preserve these Humanity Union terms consistently/);
    assert.match(prompt, /preferred target-language term/);
    assert.match(prompt, /machine identifiers, IDs, enum tokens, routes/);
    assert.match(prompt, /Keep Participant, Member, and Membership semantically distinct/);
    assert.match(prompt, /Participant \(participant\) => Учасник/);

    const geminiSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/providers/gemini-translation-provider.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(geminiSource, /Preserve these Humanity Union terms consistently/);
    assert.match(geminiSource, /Do not alter machine identifiers/);
  });

  it("13–14. content-translation.service and translate-draft use the canonical builder", async () => {
    const contentService = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    const translateDraftSource = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/translate-draft.ts"),
      "utf8",
    );
    assert.match(contentService, /resolveProviderTerminologyContext/);
    assert.match(translateDraftSource, /resolveProviderTerminologyContext/);
    assert.doesNotMatch(contentService, /formatProviderTerminologyContext\(/);
    assert.doesNotMatch(translateDraftSource, /formatProviderTerminologyContext\(/);
    assert.doesNotMatch(
      contentService,
      /terminologyContext:\s*HUMANITY_UNION_TRANSLATION_TERMINOLOGY/,
    );
    assert.doesNotMatch(
      translateDraftSource,
      /terminologyContext:\s*HUMANITY_UNION_TRANSLATION_TERMINOLOGY/,
    );

    await updateTerminologyConcept("participant", {
      translations: { uk: { preferredTerm: "Учасник", aliases: [] } },
    });
    const provider = new DeterministicTranslationProvider();
    setTranslationProviderForTests(provider);
    await translateDraft({
      sourceKind: "petition",
      sourceRecordId: "draft-task05-1",
      sourceVersion: "v1",
      sourceLanguage: "en",
      targetLanguage: "uk",
      draftContent: { title: "Hello" },
    });
    const last = provider.getLastRequestForTests();
    assert.ok(last?.terminologyContext);
    assert.match(last.terminologyContext!, /Participant \(participant\) => Учасник/);
  });

  it("15. deterministic provider remains network-free and records terminologyContext", async () => {
    const providerSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/providers/deterministic-translation-provider.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(providerSource, /\bfetch\s*\(/);
    assert.doesNotMatch(providerSource, /generativelanguage\.googleapis/);

    const provider = new DeterministicTranslationProvider();
    const result = await provider.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: "Hello",
      terminologyContext: "Participant (participant) => Учасник",
      safetyCleared: true,
    });
    assert.equal(result.translatedText, "[uk] Hello");
    assert.equal(
      provider.getLastRequestForTests()?.terminologyContext,
      "Participant (participant) => Учасник",
    );
  });

  it("16. provider eligibility / privacy gates remain unchanged", async () => {
    const provider = new DeterministicTranslationProvider();
    await assert.rejects(
      () =>
        provider.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: "private",
          safetyCleared: false,
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "safety_rejected",
    );

    const builderSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/terminology-glossary/terminology-glossary.provider-context.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(builderSource, /privateMessage|directMessage|shippingAddress|passwordHash/);
    assert.doesNotMatch(builderSource, /initiative\.revisions|full history|stewardOnly/);

    const contentService = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    assert.match(contentService, /safetyCleared:\s*true/);
  });

  it("17. unknown target locale is rejected by locale authority", async () => {
    await assert.rejects(
      () => buildProviderTerminologyContext("xx-NOT-A-LOCALE"),
      TerminologyGlossaryValidationError,
    );
    await assert.rejects(
      () =>
        translateDraft({
          sourceKind: "petition",
          sourceRecordId: "draft-task05-unknown",
          sourceVersion: "v1",
          sourceLanguage: "en",
          targetLanguage: "xx-NOT-A-LOCALE",
          draftContent: "hi",
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        (error.code === "unsupported_language" || error.code === "validation_error"),
    );
  });

  it("18. no search index / Admin UI mutation in Task 05 injection path", () => {
    const builderSource = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/terminology-glossary/terminology-glossary.provider-context.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(builderSource, /searchIndex|opensearch|meilisearch|elasticsearch/i);
    assert.doesNotMatch(builderSource, /AdminTerminologyGlossary|terminology-glossary\.tsx/);

    const contentService = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    const translateDraftSource = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/translate-draft.ts"),
      "utf8",
    );
    assert.doesNotMatch(contentService, /searchIndex|opensearch/i);
    assert.doesNotMatch(translateDraftSource, /searchIndex|opensearch/i);
  });

  it("failure policy: empty published set falls back to English compatibility list", async () => {
    for (const concept of await listTerminologyConcepts()) {
      await updateTerminologyConcept(concept.conceptId, { status: "retired" });
    }
    const context = await buildProviderTerminologyContext("uk");
    assert.equal(context, HUMANITY_UNION_TRANSLATION_TERMINOLOGY);
  });
});
