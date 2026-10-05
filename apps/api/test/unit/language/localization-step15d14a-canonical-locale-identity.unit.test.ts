/**
 * STEP 15D.14.A — Gate A: Canonical locale identity contract.
 * No provider calls. No locale-specific allowlists.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  normalizeLanguageRegistryLocaleKey,
  type TerminologyConcept,
} from "@hu/types";

import {
  getBrandLocalizationByLocale,
  resetBrandLocalizationStoreForTests,
  setBrandLocalizationForceMemoryForTests,
  upsertBrandLocalization,
} from "../../../src/modules/brand-localization/brand-localization.repository.js";
import { assessControlledVocabularyReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-controlled-vocabulary-readiness.js";
import { evaluateLanguageLocalizationReadiness } from "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js";
import {
  ensureLanguageRegistrySeeded,
  getLanguageRegistryByLocale,
  resetLanguageRegistryStoreForTests,
  resolveCanonicalRegistryLocale,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/index.js";
import { assertEnabledSelectableLocale } from "../../../src/modules/language/language-registry-runtime.js";
import { resolvePackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  loadBundledWebUiMessagePackFromFs,
  resetBundledWebUiStemIndexForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

function publishedZhHantConcept(preferredTerm: string): TerminologyConcept {
  return {
    conceptId: "initiative",
    canonicalEnglishTerm: "Initiative",
    category: "workflow_stage",
    status: "published",
    translations: {
      "zh-Hant": {
        preferredTerm,
        aliases: [],
      },
    },
    linkedRefs: { stageId: "initiative" },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    updatedByParticipantId: null,
  };
}

function publishedZhHantBrand() {
  return {
    brandId: "brand-zh-Hant-gate-a",
    locale: "zh-Hant",
    status: "published" as const,
    siteName: "人類聯盟",
    slogan: "世界團結",
    heroUnityQuote: "q",
    seoSiteName: "人類聯盟",
    defaultMetaDescription: "d",
    shortName: "HU",
    seoTitleSuffix: " | HU",
    openGraphBrandName: "人類聯盟",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    updatedByParticipantId: null,
  };
}

describe("15D.14.A — canonical locale identity", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setBrandLocalizationForceMemoryForTests(true);
    resetBrandLocalizationStoreForTests();
    resetBundledWebUiStemIndexForTests();
  });

  afterEach(() => {
    setLanguageRegistryForceMemoryForTests(false);
    setBrandLocalizationForceMemoryForTests(false);
    resetBundledWebUiStemIndexForTests();
  });

  it("A. Registry: zh-hant and zh-Hant resolve to canonical zh-Hant", async () => {
    const a = await resolveCanonicalRegistryLocale("zh-hant");
    const b = await resolveCanonicalRegistryLocale("zh-Hant");
    const c = await resolveCanonicalRegistryLocale("  zh-Hant  ");
    assert.equal(a, "zh-Hant");
    assert.equal(b, "zh-Hant");
    assert.equal(c, "zh-Hant");
    assert.equal(normalizeLanguageRegistryLocaleKey(a!), "zh-hant");
    const record = await resolveLanguageRegistryLocale("zh-hant");
    assert.equal(record?.locale, "zh-Hant");
  });

  it("A. Registry: uk/ar/ka identity unchanged", async () => {
    assert.equal(await resolveCanonicalRegistryLocale("uk"), "uk");
    assert.equal(await resolveCanonicalRegistryLocale("ar"), "ar");
    // ka may be seeded only after Admin create in some envs — resolve if present
    const ka = await resolveLanguageRegistryLocale("ka");
    if (ka) {
      assert.equal(await resolveCanonicalRegistryLocale("ka"), "ka");
    }
  });

  it("A. Registry: unknown locale returns null (no invented spelling)", async () => {
    assert.equal(await resolveCanonicalRegistryLocale("zz-Invented"), null);
  });

  it("B. CV: translations[zh-Hant] visible from zh-hant assessment", async () => {
    const concepts: TerminologyConcept[] = [publishedZhHantConcept("倡議")];
    const fromIdentity = await assessControlledVocabularyReadinessForLocale({
      locale: "zh-hant",
      listConcepts: async () => concepts,
    });
    const fromCanonical = await assessControlledVocabularyReadinessForLocale({
      locale: "zh-Hant",
      listConcepts: async () => concepts,
    });
    assert.equal(
      fromIdentity.conceptsWithTerminologyPreferredTerm,
      fromCanonical.conceptsWithTerminologyPreferredTerm,
    );
    assert.ok(fromIdentity.conceptsWithTerminologyPreferredTerm >= 1);
    assert.equal(
      Object.keys(concepts[0]!.translations).includes("zh-hant"),
      false,
      "must not invent lowercase durable glossary keys",
    );
  });

  it("C. Brand: published zh-Hant row found from zh-hant input", async () => {
    await upsertBrandLocalization(publishedZhHantBrand());
    const fromIdentity = await getBrandLocalizationByLocale("zh-hant");
    const fromCanonical = await getBrandLocalizationByLocale("zh-Hant");
    assert.ok(fromIdentity);
    assert.ok(fromCanonical);
    assert.equal(fromIdentity?.locale, "zh-Hant");
    assert.equal(fromIdentity?.siteName, fromCanonical?.siteName);
  });

  it("D. WEB_UI: zh-hant resolves zh-Hant bundled and packaged identity", () => {
    const bundledIdentity = loadBundledWebUiMessagePackFromFs("zh-hant");
    const bundledCanonical = loadBundledWebUiMessagePackFromFs("zh-Hant");
    assert.ok(bundledIdentity);
    assert.ok(bundledCanonical);
    assert.deepEqual(Object.keys(bundledIdentity!), Object.keys(bundledCanonical!));

    const packagedIdentity = resolvePackagedWebUiCatalog("zh-hant");
    const packagedCanonical = resolvePackagedWebUiCatalog("zh-Hant");
    assert.equal(packagedIdentity.outcome, "found");
    assert.equal(packagedCanonical.outcome, "found");
    if (packagedIdentity.outcome === "found" && packagedCanonical.outcome === "found") {
      assert.equal(packagedIdentity.fileStem, "zh-Hant");
      assert.equal(packagedCanonical.fileStem, "zh-Hant");
      assert.equal(packagedIdentity.localeKey, packagedCanonical.localeKey);
    }
  });

  it("E. CT target path: assertEnabledSelectableLocale returns canonical zh-Hant", async () => {
    const existing = await getLanguageRegistryByLocale("zh-Hant");
    assert.ok(existing);
    await updateLanguageRegistryRecord(existing!.languageId, {
      enabled: true,
      contentTranslationEnabled: true,
    });
    const resolved = await assertEnabledSelectableLocale("zh-hant");
    assert.equal(resolved, "zh-Hant");
  });

  it("F. Admin/readiness: lowercase job identity matches canonical owner readiness", async () => {
    const zh = await resolveLanguageRegistryLocale("zh-Hant");
    assert.ok(zh);
    await updateLanguageRegistryRecord(zh!.languageId, {
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
    });
    await upsertBrandLocalization(publishedZhHantBrand());

    const concepts: TerminologyConcept[] = [publishedZhHantConcept("倡議")];

    const fromJobKey = await evaluateLanguageLocalizationReadiness({
      locale: "zh-hant",
      registryRecord: {
        ...zh!,
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
      },
      skipCorpusPlan: true,
      assessControlledVocabulary: async ({ locale }) =>
        assessControlledVocabularyReadinessForLocale({
          locale,
          listConcepts: async () => concepts,
        }),
    });
    const fromCanonical = await evaluateLanguageLocalizationReadiness({
      locale: "zh-Hant",
      registryRecord: {
        ...zh!,
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
      },
      skipCorpusPlan: true,
      assessControlledVocabulary: async ({ locale }) =>
        assessControlledVocabularyReadinessForLocale({
          locale,
          listConcepts: async () => concepts,
        }),
    });

    assert.equal(fromJobKey.locale, "zh-Hant");
    assert.equal(fromCanonical.locale, "zh-Hant");
    assert.equal(
      fromJobKey.controlledVocabulary.conceptsWithTerminologyPreferredTerm,
      fromCanonical.controlledVocabulary.conceptsWithTerminologyPreferredTerm,
    );
    assert.equal(fromJobKey.higherAuthority.brandPublished, true);
    assert.equal(fromCanonical.higherAuthority.brandPublished, true);
  });

  it("does not introduce locale-specific branches in resolveCanonicalRegistryLocale source", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-registry/language-registry.repository.ts",
      ),
      "utf8",
    );
    const start = src.indexOf("export async function resolveCanonicalRegistryLocale");
    assert.ok(start >= 0);
    const nextExport = src.indexOf("\nexport async function", start + 1);
    const helper = nextExport >= 0 ? src.slice(start, nextExport) : src.slice(start);
    assert.equal(
      /zh-Hant|zh-hant|georgian/i.test(helper),
      false,
      "helper must not hard-code locale-specific branches",
    );
  });
});
