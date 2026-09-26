/**
 * WEB_UI remote/Admin message packs — foundation tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
} from "@hu/types";

import { ADMIN_WEB_UI_MESSAGE_PACK_JSON_LIMIT } from "../../../src/modules/web-ui-message-packs/index.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
  getPublishedWebUiMessagePackByLocale,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WebUiMessagePackValidationError } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";
import { resolveEffectiveWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import {
  collectStringPaths,
  inspectMessageStructure,
  loadBundledEnglishWebUiMessagePack,
  loadBundledWebUiMessagePackFromFs,
  selectEnglishWebUiMessages,
  validateWebUiMessageTreeAgainstEnglish,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
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

  it("bundled locale resolves from filesystem when no published pack (uk)", async () => {
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

  it("public scope is ordinary public∪participant unique paths and excludes author workspace keys", () => {
    const prepared = selectEnglishWebUiMessages("public");
    const full = selectEnglishWebUiMessages("full");
    const english = loadBundledEnglishWebUiMessagePack();
    const allPaths = collectStringPaths(english);
    const uniqueOrdinary = new Set([
      ...allPaths.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey)),
      ...allPaths.filter((pathKey) => isParticipantWebUiRequiredPath(pathKey)),
    ]);
    assert.equal(prepared.selectedPaths.length, uniqueOrdinary.size);
    assert.ok(prepared.publicRequiredKeyCount > 0);
    assert.ok(prepared.participantRequiredKeyCount > 0);
    assert.ok(prepared.selectedPaths.length > prepared.publicRequiredKeyCount);
    assert.ok(
      prepared.selectedPaths.length <=
        prepared.publicRequiredKeyCount + prepared.participantRequiredKeyCount,
    );
    assert.ok(prepared.publicRequiredKeyCount < prepared.fullCatalogKeyCount);
    assert.equal(full.selectedPaths.length, full.fullCatalogKeyCount);
    assert.ok(
      prepared.selectedPaths.every(
        (pathKey) =>
          isPublicReaderWebUiRequiredPath(pathKey) || isParticipantWebUiRequiredPath(pathKey),
      ),
    );
    assert.equal(
      prepared.selectedPaths.some((pathKey) => pathKey.startsWith("initiativeExperience.author.sidebar")),
      false,
    );
    assert.ok(
      full.selectedPaths.some((pathKey) => pathKey.startsWith("initiativeExperience.author.sidebar")),
    );
  });

  it("ICU branch text is not treated as a placeholder", () => {
    const inspected = inspectMessageStructure(
      "{count, plural, =0 {No proposals} one {# proposal} other {# proposals}}",
    );
    assert.deepEqual([...inspected.placeholders], ["count"]);
    const report = validateWebUiMessageTreeAgainstEnglish({
      initiativeExperience: {
        author: {
          proposal: {
            counts: {
              proposals: "{count, plural, =0 {0 proposals} one {# proposal} other {# proposals}}",
            },
          },
        },
      },
    } as never);
    assert.equal(
      report.placeholderMismatchPaths.some((entry) => entry.includes("{No}")),
      false,
    );
    assert.equal(
      report.placeholderMismatchPaths.some((entry) => entry.includes("counts.proposals")),
      false,
    );
  });

  it("rejects a dropped interpolation placeholder and diagnoses empty values", async () => {
    const report = validateWebUiMessageTreeAgainstEnglish({
      common: { language: "   " },
      blogPublic: { pagination: { showingCount: "no count here" } },
    } as never);
    assert.ok(report.emptyPaths.includes("common.language"));
    assert.ok(
      report.placeholderMismatchPaths.some(
        (entry) => entry.includes("blogPublic.pagination.showingCount") && entry.includes("{count}"),
      ),
    );
    await assert.rejects(
      () =>
        upsertWebUiMessagePack({
          locale: "eo",
          status: "published",
          messages: {
            blogPublic: { pagination: { showingCount: "no count here" } },
          } as never,
        }),
      (error: unknown) =>
        error instanceof WebUiMessagePackValidationError && /showingCount/.test(error.message),
    );
  });

  it("public-only pack satisfies public readiness and a full pack stays valid", async () => {
    const englishPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../web/src/features/i18n/messages/en.json",
    );
    const before = readFileSync(englishPath);
    const prepared = selectEnglishWebUiMessages("public");
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: prepared.messages,
      sourceNote: "public scope",
    });
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(readiness.dataReady, true);
    assert.equal(readiness.missingKeyCount, 0);
    const full = await assessWebUiCatalogReadinessForLocale({
      locale: "eo",
      requiredPaths: selectEnglishWebUiMessages("full").selectedPaths,
    });
    assert.equal(full.dataReady, false);
    assert.ok(full.missingKeyCount > 0);
    assert.equal(readFileSync(englishPath).equals(before), true);

    resetWebUiMessagePackStoreForTests();
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "published",
      messages: english as never,
    });
    const complete = await assessWebUiCatalogReadinessForLocale({
      locale: "eo",
      requiredPaths: selectEnglishWebUiMessages("full").selectedPaths,
    });
    assert.equal(complete.dataReady, true);
    assert.equal(complete.missingKeyCount, 0);
  });

  it("draft packs are not runtime packs; published Mongo wins over bundled", async () => {
    const prepared = selectEnglishWebUiMessages("public");
    await upsertWebUiMessagePack({
      locale: "eo",
      status: "draft",
      messages: prepared.messages,
    });
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
    const draftReadiness = await assessWebUiCatalogReadinessForLocale({ locale: "eo" });
    assert.equal(draftReadiness.dataReady, false);

    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "uk",
      status: "published",
      messages: {
        ...(english as Record<string, unknown>),
        common: {
          ...((english as { common?: Record<string, unknown> }).common ?? {}),
          language: "PUBLISHED_WINS",
        },
      } as never,
    });
    const uk = await resolveEffectiveWebUiMessagePack("uk");
    assert.equal(uk?.source, "remote");
    assert.equal(
      (uk?.messages as { common?: { language?: string } }).common?.language,
      "PUBLISHED_WINS",
    );
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const bundled = loadBundledWebUiMessagePackFromFs(locale);
      assert.ok(bundled);
      const report = validateWebUiMessageTreeAgainstEnglish(bundled as never);
      assert.equal(report.rejectedUnknownPaths.length, 0);
    }
    // Without a published pack, bundled locales remain bootstrap authority.
    resetWebUiMessagePackStoreForTests();
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const effective = await resolveEffectiveWebUiMessagePack(locale);
      assert.equal(effective?.source, "bundled");
    }
  });

  it("pack workflow has no locale-specific branch, provider call, or second store", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const moduleDir = path.resolve(here, "../../../src/modules/web-ui-message-packs");
    const appSource = readFileSync(path.resolve(here, "../../../src/app.ts"), "utf8");
    assert.equal(ADMIN_WEB_UI_MESSAGE_PACK_JSON_LIMIT, "4mb");
    assert.match(appSource, /req\.method === "PUT" && req\.path\.startsWith\("\/api\/v1\/admin\/web-ui-message-packs\/"\)/);
    for (const name of [
      "web-ui-message-pack.service.ts",
      "web-ui-message-pack.validate.ts",
      "admin-web-ui-message-pack.routes.ts",
      "web-ui-message-pack.repository.ts",
    ]) {
      const src = readFileSync(path.join(moduleDir, name), "utf8");
      assert.doesNotMatch(src, /locale === ["']ka["']|locale === ["']he["']/);
      assert.doesNotMatch(src, /from ["'][^"']*TranslationProvider|GEMINI_API_KEY|generateContent/);
      assert.doesNotMatch(src, /content_translations/);
      assert.doesNotMatch(src, /writeFile/);
    }
  });
});
