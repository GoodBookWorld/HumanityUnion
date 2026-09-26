/**
 * STEP 15D.14.C — Gate C: unified localization reconciliation.
 * Language-agnostic planner + classification/work contract.
 * No provider calls in pure cases. No locale-specific branches.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TerminologyConcept, TranslatedContentRecord } from "@hu/types";

import {
  classifyContentTranslationForReconciliation,
  classifyContentTranslationValidity,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  buildLocalizationInputVersionFromConcepts,
} from "../../../src/modules/language/localization-input-contract.js";
import {
  isProviderWorkAction,
  planLocalizationReconciliationItem,
  planSourceOriginalExclusion,
  reconciliationActionForState,
  reconciliationWorkPriority,
  sortLocalizationReconciliationPlan,
} from "../../../src/modules/language/localization-reconciliation-planner.js";
import { classifyPublishedLocalizedPresentationValidity } from "../../../src/modules/language/published-localized-presentation/plp-validity.js";
import {
  participantPublicHasMachineLocalizationObligation,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import { resolveCanonicalRegistryLocale } from "../../../src/modules/language/language-registry/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import { isActionableLiveResidualBucket } from "../../../src/modules/language/live-residual-identity.js";
import { uniquePresentationsRequiringWork } from "../../../src/modules/language/public-localization-corpus.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function concept(input: {
  conceptId: string;
  canonicalEnglishTerm: string;
  category: TerminologyConcept["category"];
  preferredByLocale?: Record<string, string>;
}): TerminologyConcept {
  const translations: TerminologyConcept["translations"] = {};
  for (const [locale, preferredTerm] of Object.entries(
    input.preferredByLocale ?? {},
  )) {
    translations[locale] = { preferredTerm, aliases: [] };
  }
  return {
    conceptId: input.conceptId,
    canonicalEnglishTerm: input.canonicalEnglishTerm,
    category: input.category,
    status: "published",
    translations,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const HUMANITY_UNION = concept({
  conceptId: "humanity_union",
  canonicalEnglishTerm: "Humanity Union",
  category: "brand",
  preferredByLocale: {
    "zh-Hant": "人道聯盟協會",
    uk: "Союз Людства",
    ar: "اتحاد الإنسانية",
    ka: "ადამიანობის კავშირი",
  },
});

const INITIATIVE = concept({
  conceptId: "initiative",
  canonicalEnglishTerm: "Initiative",
  category: "workflow_stage",
  preferredByLocale: {
    "zh-Hant": "倡議",
  },
});

const UNRELATED = concept({
  conceptId: "workspace",
  canonicalEnglishTerm: "Workspace",
  category: "domain",
  preferredByLocale: {
    "zh-Hant": "工作空間-CHANGED",
  },
});

function baseCt(
  overrides: Partial<TranslatedContentRecord>,
): TranslatedContentRecord {
  return {
    translationId: "t1",
    sourceKind: "initiative",
    sourceRecordId: "init-1",
    sourceVersion: "v-source",
    sourceLanguage: "en",
    targetLanguage: "zh-Hant",
    translatedContent: { title: "localized", description: "body" },
    translationProvider: "gemini",
    translationKind: "machine",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

describe("15D.14.C — unified localization reconciliation", () => {
  it("A. READY valid CT → PRESERVE / zero provider work", () => {
    const row = baseCt({
      translatedContent: { title: "人道聯盟協會 平台", description: "說明" },
    });
    const validity = classifyContentTranslationForReconciliation({
      translation: row,
      liveSourceVersion: "v-source",
      originalFields: {
        title: "Humanity Union platform",
        description: "desc",
      },
      concepts: [HUMANITY_UNION],
    });
    assert.equal(validity.reconciliationState, "READY");
    const plan = planLocalizationReconciliationItem({
      owner: "CT",
      entityType: "initiative",
      entityId: "init-1",
      targetLocale: "zh-Hant",
      reconciliationState: validity.reconciliationState,
    });
    assert.equal(plan.action, "PRESERVE");
    assert.equal(isProviderWorkAction(plan.action), false);
    assert.equal(plan.workRemaining, false);
  });

  it("B. MISSING CT → GENERATE", () => {
    const validity = classifyContentTranslationForReconciliation({
      translation: null,
      liveSourceVersion: "v-source",
    });
    assert.equal(validity.reconciliationState, "MISSING");
    const plan = planLocalizationReconciliationItem({
      owner: "CT",
      entityType: "initiative",
      entityId: "init-missing",
      targetLocale: "ka",
      reconciliationState: "MISSING",
    });
    assert.equal(plan.action, "GENERATE");
    assert.equal(isProviderWorkAction(plan.action), true);
  });

  it("C. STALE sourceVersion → REGENERATE", () => {
    const row = baseCt({ sourceVersion: "v-old" });
    const validity = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: "v-new",
    });
    assert.equal(validity.reconciliationState, "STALE");
    assert.equal(reconciliationActionForState("STALE"), "REGENERATE");
  });

  it("D. STALE localizationInputVersion → REGENERATE with current terminology", () => {
    const sourceText = "Welcome to Humanity Union civic work";
    const before = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v-source",
      targetLocale: "zh-Hant",
      concepts: [
        {
          ...HUMANITY_UNION,
          translations: {
            "zh-Hant": { preferredTerm: "人類聯盟", aliases: [] },
          },
        },
      ],
      sourceText,
    });
    const after = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v-source",
      targetLocale: "zh-Hant",
      concepts: [HUMANITY_UNION],
      sourceText,
    });
    assert.notEqual(
      before.localizationInputVersion,
      after.localizationInputVersion,
    );
    const row = baseCt({
      localizationInputVersion: before.localizationInputVersion,
      translatedContent: { title: "人類聯盟 歡迎", description: "x" },
    });
    const validity = classifyContentTranslationForReconciliation({
      translation: row,
      liveSourceVersion: "v-source",
      originalFields: { title: sourceText, description: "x" },
      concepts: [HUMANITY_UNION],
    });
    assert.equal(validity.reconciliationState, "STALE");
    assert.ok(validity.reasons.includes("localization_input_stale"));
    assert.equal(reconciliationActionForState("STALE"), "REGENERATE");
  });

  it("E. INVALID deterministic CURRENT → REGENERATE", () => {
    const row = baseCt({
      translationProvider: "deterministic",
      translatedContent: {
        title: "[zh-Hant] English title",
        description: "[zh-Hant] body",
      },
    });
    const validity = classifyContentTranslationForReconciliation({
      translation: row,
      liveSourceVersion: "v-source",
      originalFields: { title: "English title", description: "body" },
      concepts: [],
    });
    assert.equal(validity.reconciliationState, "INVALID");
    assert.equal(reconciliationActionForState("INVALID"), "REGENERATE");
    assert.equal(isActionableLiveResidualBucket("RETRY_READY_INVALID"), true);
  });

  it("F/G/H. failed replacement / structure / terminology → not READY (no corrupt READY)", () => {
    const invalidProvider = classifyContentTranslationValidity({
      translation: baseCt({
        translationProvider: "deterministic",
        translatedContent: { title: "[zh-Hant] x" },
      }),
      liveSourceVersion: "v-source",
    });
    assert.notEqual(invalidProvider.reconciliationState, "READY");

    const incomplete = classifyContentTranslationValidity({
      translation: baseCt({ translatedContent: { title: "only-title" } }),
      liveSourceVersion: "v-source",
      originalFields: { title: "English title", description: "needed" },
    });
    assert.notEqual(incomplete.reconciliationState, "READY");

    const termFail = classifyContentTranslationForReconciliation({
      translation: baseCt({
        translatedContent: {
          title: "Humanity Union 平台的開發",
          description: "說明",
        },
      }),
      liveSourceVersion: "v-source",
      originalFields: {
        title: "Development of the Humanity Union platform",
        description: "desc",
      },
      concepts: [HUMANITY_UNION],
    });
    assert.equal(termFail.reconciliationState, "INVALID");
    assert.ok(termFail.reasons.includes("terminology_protection_violation"));
  });

  it("I. unrelated terminology change → valid artifact remains READY", () => {
    const sourceText = "Humanity Union Initiative launch";
    const withA = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v-source",
      targetLocale: "zh-Hant",
      concepts: [
        HUMANITY_UNION,
        INITIATIVE,
        {
          ...UNRELATED,
          translations: {
            "zh-Hant": { preferredTerm: "工作空間", aliases: [] },
          },
        },
      ],
      sourceText,
    });
    const withB = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v-source",
      targetLocale: "zh-Hant",
      concepts: [HUMANITY_UNION, INITIATIVE, UNRELATED],
      sourceText,
    });
    assert.equal(withA.localizationInputVersion, withB.localizationInputVersion);
    const row = baseCt({
      localizationInputVersion: withA.localizationInputVersion,
      translatedContent: {
        title: "人道聯盟協會 倡議 啟動",
        description: "內容",
      },
    });
    const validity = classifyContentTranslationForReconciliation({
      translation: row,
      liveSourceVersion: "v-source",
      originalFields: { title: sourceText, description: "content" },
      concepts: [HUMANITY_UNION, INITIATIVE, UNRELATED],
    });
    assert.equal(validity.reconciliationState, "READY");
  });

  it("J. uk/ar/zh-Hant/ka use same planner (no locale branches)", () => {
    const locales = ["uk", "ar", "zh-Hant", "ka"] as const;
    const plans = locales.map((locale) =>
      planLocalizationReconciliationItem({
        owner: "CT",
        entityType: "initiative",
        entityId: "same",
        targetLocale: locale,
        reconciliationState: "MISSING",
      }),
    );
    for (const plan of plans) {
      assert.equal(plan.action, "GENERATE");
      assert.equal(plan.priority, reconciliationWorkPriority("MISSING"));
    }
    const plannerSource = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-planner.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(
      plannerSource,
      /\b(uk|ar|arabic|zh-Hant|zh-hant|ka|georgian)\b/,
    );
  });

  it("K. participant_public biography/skills → NOT_APPLICABLE / zero provider work", () => {
    assert.equal(participantPublicHasMachineLocalizationObligation(), false);
    const plan = planSourceOriginalExclusion({
      entityType: "participant_public",
      entityId: "p1",
      targetLocale: "uk",
      reason: "biography_skills_source_original",
    });
    assert.equal(plan.reconciliationState, "NOT_APPLICABLE");
    assert.equal(plan.action, "NO_WORK");
    assert.equal(isProviderWorkAction(plan.action), false);
  });

  it("L. Public News / SOURCE_ORIGINAL → zero provider work", () => {
    const plan = planSourceOriginalExclusion({
      entityType: "public_news",
      entityId: "news-1",
      targetLocale: "ar",
      reason: "source_original_rss",
    });
    assert.equal(plan.action, "NO_WORK");
    assert.equal(plan.workRemaining, false);
  });

  it("M. PLP translatable owner shares READY/MISSING/STALE/INVALID planner semantics", () => {
    const missing = classifyPublishedLocalizedPresentationValidity({
      locale: "uk",
      liveCanonicalVersion: "v1",
      snapshot: null,
      canonicalPresentation: null,
    });
    assert.equal(missing.reconciliationState, "MISSING");
    assert.equal(
      planLocalizationReconciliationItem({
        owner: "PLP",
        entityType: "civic_media",
        entityId: "m1",
        targetLocale: "uk",
        reconciliationState: missing.reconciliationState,
      }).action,
      "GENERATE",
    );
  });

  it("N. INVALID/STALE/MISSING remain rediscoverable work (uniquePresentations)", () => {
    const presentations = uniquePresentationsRequiringWork([
      {
        sourceKind: "initiative",
        sourceRecordId: "a",
        sourceVersion: "v1",
        targetLanguage: "uk",
        state: "INVALID",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
      {
        sourceKind: "initiative",
        sourceRecordId: "b",
        sourceVersion: "v1",
        targetLanguage: "ka",
        state: "STALE",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
      {
        sourceKind: "initiative",
        sourceRecordId: "c",
        sourceVersion: "v1",
        targetLanguage: "ar",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    ]);
    assert.equal(presentations.length, 3);
  });

  it("O. WEB_UI gate preserved (15D.9.1) — residual enqueue still gated", () => {
    const jobService = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.match(jobService, /isLanguageActivationWebUiReadyForHistoricalEnqueue/);
    assert.match(jobService, /webUiReadyForHistorical/);
    const domains = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.domains.ts",
      ),
      "utf8",
    );
    assert.match(domains, /Authoritative WEB_UI READY gate/);
  });

  it("P. Gate A canonical zh-Hant regression", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }
  });

  it("Q. Gate B deterministic INVALID regression", () => {
    const validity = classifyContentTranslationValidity({
      translation: baseCt({
        translationProvider: "deterministic",
        translatedContent: { title: "[zh-Hant] title" },
      }),
      liveSourceVersion: "v-source",
    });
    assert.equal(validity.reconciliationState, "INVALID");
  });

  it("R. B.2 terminology dependency + Chinese historical defect classification", () => {
    const defectA = classifyContentTranslationForReconciliation({
      translation: baseCt({
        translatedContent: {
          title: "Humanity Union 平台的開發",
          description: "說明",
        },
      }),
      liveSourceVersion: "v-source",
      originalFields: {
        title: "Development of the Humanity Union platform",
        description: "desc",
      },
      concepts: [HUMANITY_UNION],
    });
    assert.equal(defectA.reconciliationState, "INVALID");
    assert.notEqual(defectA.reconciliationState, "READY");

    const defectB = classifyContentTranslationForReconciliation({
      translation: baseCt({
        translatedContent: {
          title: "全球人類資本與民主Initiative",
          description: "說明",
        },
      }),
      liveSourceVersion: "v-source",
      originalFields: {
        title: "Global Human Capital and Democracy Initiative",
        description: "desc",
      },
      concepts: [INITIATIVE],
    });
    assert.equal(defectB.reconciliationState, "INVALID");
    assert.equal(
      planLocalizationReconciliationItem({
        owner: "CT",
        entityType: "initiative",
        entityId: "chinese-defect",
        targetLocale: "zh-Hant",
        reconciliationState: defectB.reconciliationState,
      }).action,
      "REGENERATE",
    );
  });

  it("S. Blog localized consumer still uses shared hu-persisted blog_post boundary", () => {
    const latest = readFileSync(
      path.resolve(
        here,
        "../../../../../apps/web/src/features/blog/components/BlogLatestMiniCards.tsx",
      ),
      "utf8",
    );
    assert.match(latest, /useHuPersistedOrdinaryFields/);
    assert.match(latest, /sourceKind:\s*"blog_post"/);
  });

  it("priority order INVALID → STALE → MISSING; warm regenerates non-READY", () => {
    const sorted = sortLocalizationReconciliationPlan([
      planLocalizationReconciliationItem({
        owner: "CT",
        entityType: "initiative",
        entityId: "m",
        targetLocale: "uk",
        reconciliationState: "MISSING",
      }),
      planLocalizationReconciliationItem({
        owner: "CT",
        entityType: "initiative",
        entityId: "i",
        targetLocale: "uk",
        reconciliationState: "INVALID",
      }),
      planLocalizationReconciliationItem({
        owner: "CT",
        entityType: "initiative",
        entityId: "s",
        targetLocale: "uk",
        reconciliationState: "STALE",
      }),
    ]);
    assert.deepEqual(
      sorted.map((item) => item.reconciliationState),
      ["INVALID", "STALE", "MISSING"],
    );

    const warmService = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/content-translation.service.ts",
      ),
      "utf8",
    );
    assert.match(warmService, /classifyContentTranslationForReconciliation/);
    assert.match(warmService, /reconciliationState === "READY"/);
  });

  it("no provider-on-read in resolve-translated-display", () => {
    const resolve = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/resolve-translated-display.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(resolve, /getOrCreateContentTranslation/);
    assert.doesNotMatch(resolve, /resolveTranslationProvider/);
  });
});
