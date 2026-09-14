/**
 * WEB_UI remote/Admin message packs — foundation tests.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
  getPublishedWebUiMessagePackByLocale,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { resolveEffectiveWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import { validateWebUiMessageTreeAgainstEnglish } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { assessControlledVocabularyReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-controlled-vocabulary-readiness.js";
import { resetWebUiControlledLabelCacheForTests } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";

describe("WEB_UI remote message packs", () => {
  beforeEach(() => {
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    resetWebUiControlledLabelCacheForTests();
  });

  it("rejects unknown paths against English foundation", () => {
    const report = validateWebUiMessageTreeAgainstEnglish({
      common: { language: "ენა" },
      notARealNamespace: { foo: "bar" },
    } as never);
    assert.ok(report.acceptedKeyCount >= 1);
    assert.ok(report.rejectedUnknownPaths.some((p) => p.startsWith("notARealNamespace")));
  });

  it("bundled locale still resolves from filesystem (uk)", async () => {
    const effective = await resolveEffectiveWebUiMessagePack("uk");
    assert.ok(effective);
    assert.equal(effective?.source, "bundled");
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "uk" });
    assert.equal(readiness.dataReady, true);
    assert.equal(readiness.missingKeyCount, 0);
  });

  it("arbitrary Registry locale with complete remote pack loads that pack", async () => {
    // Minimal complete pack: mirror English public chrome via full English tree.
    const { loadBundledEnglishWebUiMessagePack } = await import(
      "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js"
    );
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: english as never,
      sourceNote: "test fixture",
    });

    const published = await getPublishedWebUiMessagePackByLocale("ka");
    assert.ok(published);
    assert.equal(published?.locale, "ka");

    const effective = await resolveEffectiveWebUiMessagePack("ka");
    assert.equal(effective?.source, "remote");
    assert.equal(effective?.locale, "ka");

    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "ka" });
    assert.equal(readiness.dataReady, true);
    assert.equal(readiness.missingKeyCount, 0);
  });

  it("arbitrary locale with no remote pack falls back (not data-ready)", async () => {
    const effective = await resolveEffectiveWebUiMessagePack("ka");
    assert.equal(effective, null);
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "ka" });
    assert.equal(readiness.dataReady, false);
    assert.ok(readiness.missingKeyCount > 0);
  });

  it("partial remote pack reports missing keys accurately", async () => {
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: {
        common: { language: "ენა" },
      },
    });
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "ka" });
    assert.equal(readiness.dataReady, false);
    assert.ok(readiness.missingKeyCount > 0);
    assert.ok(readiness.requiredKeyCount > readiness.missingKeyCount);
  });

  it("CV readiness uses same effective WEB_UI source; Terminology outranks WEB_UI", async () => {
    await upsertWebUiMessagePack({
      locale: "ka",
      status: "published",
      messages: {
        initiativeExperience: {
          stages: {
            discussion: "დისკუსია",
          },
          collaboration: {
            discussion: {
              chrome: {
                readyToCollaborate: "მზად",
                helpful: "სასარგებლო",
                notHelpful: "არა",
              },
            },
          },
          author: {
            analysis: {
              sourceSnapshot: {
                activeAllies: "მოკავშირეები",
                helpful: "სასარგებლო",
                notHelpful: "არა",
              },
            },
          },
        },
      },
    });

    const withoutTerms = await assessControlledVocabularyReadinessForLocale({
      locale: "ka",
      listConcepts: async () => [],
    });
    // Partial stages only — still missing many lifecycle stage labels.
    assert.equal(withoutTerms.presentationReady, false);
    assert.ok(withoutTerms.conceptsWithWebUiFallbackOnly >= 1);

    const withTerm = await assessControlledVocabularyReadinessForLocale({
      locale: "ka",
      listConcepts: async () =>
        [
          {
            conceptId: "discussion",
            englishTerm: "Discussion",
            category: "lifecycle",
            status: "published",
            linkedRefs: { stageId: "discussion" },
            translations: {
              ka: { preferredTerm: "ტერმინოლოგია-დისკუსია" },
            },
          },
        ] as never,
    });
    assert.ok(withTerm.conceptsWithTerminologyPreferredTerm >= 1);
  });

  it("no provider imports in remote pack module graph", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const repo = join(here, "../../../src/modules/web-ui-message-packs");
    for (const name of [
      "web-ui-message-pack.repository.ts",
      "resolve-effective-web-ui-message-pack.ts",
      "public-web-ui-message-pack.routes.ts",
    ]) {
      const src = readFileSync(join(repo, name), "utf8");
      assert.doesNotMatch(src, /TranslationProvider|GEMINI_API_KEY|generateContent/);
      assert.doesNotMatch(src, /\bka\.json\b/);
    }
  });
});
