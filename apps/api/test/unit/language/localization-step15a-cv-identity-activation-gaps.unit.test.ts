/**
 * Step 15A — CV concept identity + structured activation gap reporting.
 * Deterministic; no TranslationProvider / Gemini / DB writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTROLLED_PUBLIC_VOCABULARY_REGISTRY,
  glossaryConceptIdsForControlledVocabularyConcept,
  type LanguageLocalizationReadinessReport,
  type TerminologyConcept,
} from "@hu/types";

import { assessControlledVocabularyReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-controlled-vocabulary-readiness.js";
import {
  buildControlledVocabularyDomainProgress,
  buildDiagnosticSummary,
  buildWebUiDomainProgress,
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVATION_ROOT = join(
  HERE,
  "../../../src/modules/language/language-localization-activation",
);

function publishedConcept(
  partial: Pick<TerminologyConcept, "conceptId"> &
    Partial<TerminologyConcept> & {
      readonly preferred?: string;
      readonly locale?: string;
    },
): TerminologyConcept {
  const locale = partial.locale ?? "xx";
  const preferred = partial.preferred ?? "Localized";
  return {
    conceptId: partial.conceptId,
    canonicalEnglishTerm: partial.canonicalEnglishTerm ?? partial.conceptId,
    category: partial.category ?? "domain",
    linkedRefs: partial.linkedRefs,
    translations: {
      [locale]: { preferredTerm: preferred, aliases: [] },
    },
    status: "published",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedByParticipantId: null,
  };
}

function baseReadiness(
  overrides: Partial<LanguageLocalizationReadinessReport> = {},
): LanguageLocalizationReadinessReport {
  const emptyBucket = {
    current: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    workItemsRequired: 0,
  };
  return {
    pack: "closure07",
    locale: "xx",
    languageId: "lang-xx",
    state: "DATA_NOT_READY",
    engineReady: true,
    languageDataReady: false,
    searchLocalizationReady: false,
    seoReady: false,
    registry: {
      enabled: false,
      contentTranslationEnabled: false,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
    },
    webUi: {
      engineReady: true,
      dataReady: false,
      requiredKeyCount: 2240,
      missingKeyCount: 2240,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: [],
    },
    controlledVocabulary: {
      presentationReady: false,
      conceptsChecked: CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.length,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 2,
      missingLocalizedLabelConceptIds: ["helpful", "not_helpful"],
      missingPreferredTermGaps: [],
    },
    higherAuthority: {
      brandPublished: null,
      legalPublished: null,
      note: null,
    },
    pwaCivic: {
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
      pwaCivicReadinessStatus: "DISABLED",
      coverage: {
        ...emptyBucket,
        measuredKindCount: 0,
        unmeasuredKindCount: 0,
        coverageMeasurement: "partial_unmeasured",
      },
      note: null,
    },
    ct: emptyBucket,
    plpMedia: emptyBucket,
    kindRows: [],
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
    ...overrides,
  };
}

describe("Step 15A — CV identity + activation gap reporting", () => {
  it("1 — glossary active_ally satisfies controlled active_allies", async () => {
    const slice = await assessControlledVocabularyReadinessForLocale({
      locale: "xx",
      listConcepts: async () => [
        publishedConcept({ conceptId: "active_ally", preferred: "Ally XX", locale: "xx" }),
      ],
    });
    assert.ok(!slice.missingLocalizedLabelConceptIds.includes("active_allies"));
    assert.ok(slice.conceptsWithTerminologyPreferredTerm >= 1);
  });

  it("2 — exact controlled conceptId matching still works", async () => {
    const slice = await assessControlledVocabularyReadinessForLocale({
      locale: "xx",
      listConcepts: async () => [
        publishedConcept({
          conceptId: "active_allies",
          preferred: "Allies Exact",
          locale: "xx",
        }),
      ],
    });
    assert.ok(!slice.missingLocalizedLabelConceptIds.includes("active_allies"));
  });

  it("3 — lifecycle stageId matching still works", async () => {
    const slice = await assessControlledVocabularyReadinessForLocale({
      locale: "xx",
      listConcepts: async () => [
        publishedConcept({
          conceptId: "discussion_glossary",
          preferred: "Discussion XX",
          locale: "xx",
          linkedRefs: { stageId: "discussion" },
          category: "lifecycle",
        }),
      ],
    });
    assert.ok(!slice.missingLocalizedLabelConceptIds.includes("discussion"));
    assert.ok(slice.conceptsWithTerminologyPreferredTerm >= 1);
  });

  it("4+5 — missing helpful and not_helpful remain missing", async () => {
    const slice = await assessControlledVocabularyReadinessForLocale({
      locale: "xx",
      listConcepts: async () => [
        publishedConcept({ conceptId: "active_ally", preferred: "Ally XX", locale: "xx" }),
        publishedConcept({
          conceptId: "ready_to_collaborate",
          preferred: "Ready XX",
          locale: "xx",
        }),
        ...CONTROLLED_PUBLIC_VOCABULARY_REGISTRY.filter((e) => e.stageId).map((entry) =>
          publishedConcept({
            conceptId: entry.conceptId,
            preferred: `${entry.conceptId} XX`,
            locale: "xx",
            linkedRefs: { stageId: entry.conceptId },
            category: "lifecycle",
          }),
        ),
      ],
    });
    assert.ok(slice.missingLocalizedLabelConceptIds.includes("helpful"));
    assert.ok(slice.missingLocalizedLabelConceptIds.includes("not_helpful"));
    assert.ok(!slice.missingLocalizedLabelConceptIds.includes("active_allies"));
    assert.equal(slice.conceptsMissingLocalizedLabel, 2);
  });

  it("6 — missing concept IDs are reported on readiness and activation detail", async () => {
    const readiness = baseReadiness();
    const cv = buildControlledVocabularyDomainProgress(readiness);
    assert.deepEqual(cv.missingConceptIds, ["helpful", "not_helpful"]);
    assert.match(cv.detail ?? "", /missing=2/);
    assert.match(cv.detail ?? "", /missingConcepts=\[helpful, not_helpful\]/);
    assert.equal(cv.status, "waiting_for_data");
  });

  it("7 — WEB_UI blocking counts propagate into activation detail", async () => {
    const readiness = baseReadiness();
    const webUi = await buildWebUiDomainProgress(readiness);
    assert.equal(webUi.status, "waiting_for_data");
    assert.equal(webUi.missingKeyCount, 2240);
    assert.equal(webUi.requiredKeyCount, 2240);
    assert.equal(webUi.dataReady, false);
    assert.match(webUi.detail ?? "", /missing=2240/);
    assert.match(webUi.detail ?? "", /required=2240/);
    assert.match(webUi.detail ?? "", /dataReady=false/);
  });

  it("8 — CV blocking counts/details propagate into diagnostic summary", async () => {
    const readiness = baseReadiness();
    const domains = emptyPendingDomains();
    domains.webUi.status = "waiting_for_data";
    domains.webUi.missingKeyCount = 2240;
    domains.webUi.requiredKeyCount = 2240;
    domains.webUi.dataReady = false;
    domains.controlledVocabulary = buildControlledVocabularyDomainProgress(readiness);
    const summary = buildDiagnosticSummary({
      status: "waiting_for_data",
      readiness,
      domains,
    });
    assert.match(summary, /webUi=waiting_for_data\(phase=none,batches=0\/0,dataReady=false/);
    assert.match(summary, /missingConcepts=\[helpful, not_helpful\]/);
  });

  it("9 — waiting_for_data remains top-level while blockers exist", () => {
    const readiness = baseReadiness();
    const domains = emptyPendingDomains();
    domains.webUi = {
      ...emptyPendingDomains().webUi,
      status: "waiting_for_data",
      dataReady: false,
      missingKeyCount: 2240,
      emptyKeyCount: 0,
      requiredKeyCount: 2240,
      effectiveSource: "none",
      detail: "waiting_for_data missing=2240",
    };
    domains.controlledVocabulary = buildControlledVocabularyDomainProgress(readiness);
    assert.equal(
      deriveActivationJobStatus({
        readiness,
        domains,
        ctEnqueueAttempted: false,
        plpEnqueueAttempted: false,
      }),
      "waiting_for_data",
    );
  });

  it("9b — WEB_UI in_progress forces top-level running (not waiting_for_data)", () => {
    const readiness = baseReadiness();
    const domains = emptyPendingDomains();
    domains.webUi = {
      ...emptyPendingDomains().webUi,
      status: "in_progress",
      preparationPhase: "primary",
      dataReady: false,
      totalBatches: 10,
      completedBatches: 3,
      detail: "Preparing public interface… 3 / 10 batches",
    };
    domains.controlledVocabulary = buildControlledVocabularyDomainProgress(readiness);
    assert.equal(
      deriveActivationJobStatus({
        readiness,
        domains,
        ctEnqueueAttempted: false,
        plpEnqueueAttempted: false,
      }),
      "running",
    );
  });

  it("10 — no provider call surface introduced in activation modules", () => {
    const files = [
      "assess-controlled-vocabulary-readiness.ts",
      "language-activation-job.domains.ts",
      "language-activation-job.mongo-document.ts",
    ];
    for (const name of files) {
      const source = readFileSync(join(ACTIVATION_ROOT, name), "utf8");
      assert.doesNotMatch(source, /TranslationProvider|gemini|@google\/generative-ai/i);
    }
    assert.deepEqual(
      glossaryConceptIdsForControlledVocabularyConcept("active_allies"),
      ["active_allies", "active_ally"],
    );
    assert.deepEqual(glossaryConceptIdsForControlledVocabularyConcept("helpful"), [
      "helpful",
    ]);
  });
});
