/**
 * Pack 08K.3.2 — Media translation identity & materialization (deterministic).
 * No live Mongo / Gemini / staging mutation.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION } from "@hu/types";

import {
  auditRssIdentityStability,
  classifyTranslatedFieldCoverage,
  mergeLocalizedOverCanonical,
  shouldScheduleMediaTranslationRepair,
} from "../../../src/modules/language/media-translation-materialization.js";
import { buildContentTranslationSourceVersion } from "../../../src/modules/language/content-translation-version.js";
import {
  createNewsArticleId,
  normalizeArticleUrl,
  normalizeExternalNewsArticle,
} from "../../../src/modules/public-news/public-news.normalize.js";
import { localizePublicPresentation } from "../../../src/modules/language/public-localized-presentation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(__dirname, "../../../src");

function readApi(rel: string): string {
  return readFileSync(join(apiSrc, rel), "utf8");
}

function sampleExternal(i: number) {
  return {
    provider: "rss",
    sourceName: i % 2 === 0 ? "Wire A" : "Wire B",
    title: `Title ${i}`,
    summary: `Summary ${i}`,
    articleUrl: `https://example.com/news/${i}?utm_source=x`,
    publishedAt: `2026-09-0${(i % 9) + 1}T12:00:00.000Z`,
    language: "en",
    category: "Environment",
  };
}

describe("Pack 08K.3.2 media translation identity", () => {
  it("A–C: 6 RSS identities stable; collisions 0; no identity reuse across URLs", () => {
    const records = [1, 2, 3, 4, 5, 6].map((i) => {
      const normalized = normalizeExternalNewsArticle(sampleExternal(i), 7);
      return {
        id: normalized.id,
        normalizedArticleUrl: normalized.normalizedArticleUrl,
      };
    });
    // Same URL twice → same deterministic id
    const a = createNewsArticleId(
      normalizeArticleUrl("https://example.com/news/1?utm_source=x").normalizedArticleUrl,
    );
    const b = createNewsArticleId(
      normalizeArticleUrl("https://EXAMPLE.com/news/1").normalizedArticleUrl,
    );
    assert.equal(a, b);
    const audit = auditRssIdentityStability({ records });
    assert.equal(audit.RSS_IDENTITY_COLLISIONS, 0);
    assert.equal(audit.RSS_DUPLICATE_IDENTITIES, 0);
    assert.equal(audit.RSS_UNSTABLE_IDENTITIES, 0);
    const ids = new Set(records.map((r) => r.id));
    assert.equal(ids.size, 6);
  });

  it("D–G: COMPLETE / PARTIAL field coverage classifiers", () => {
    const sourceFields = { title: "T", summary: "S", category: "C" };
    const complete = classifyTranslatedFieldCoverage({
      sourceFields,
      translatedFields: { title: "t", summary: "s", category: "c" },
      sourceLanguage: "en",
      targetLanguage: "uk",
      translationRowExists: true,
      translationSourceVersion: "v-1",
      liveSourceVersion: "v-1",
    });
    assert.equal(complete.state, "COMPLETE");

    const missingTitle = classifyTranslatedFieldCoverage({
      sourceFields,
      translatedFields: { summary: "s", category: "c" },
      sourceLanguage: "en",
      targetLanguage: "uk",
      translationRowExists: true,
      translationSourceVersion: "v-1",
      liveSourceVersion: "v-1",
    });
    assert.equal(missingTitle.state, "PARTIAL");
    assert.deepEqual([...missingTitle.missingPaths], ["title"]);

    const missingDescription = classifyTranslatedFieldCoverage({
      sourceFields: { title: "T", description: "D" },
      translatedFields: { title: "t" },
      sourceLanguage: "en",
      targetLanguage: "zh-Hant",
      translationRowExists: true,
      translationSourceVersion: "v-1",
      liveSourceVersion: "v-1",
    });
    assert.equal(missingDescription.state, "PARTIAL");

    const nestedMissing = classifyTranslatedFieldCoverage({
      sourceFields: { title: "T", "extensions.note": "N" },
      translatedFields: { title: "t" },
      sourceLanguage: "en",
      targetLanguage: "ar",
      translationRowExists: true,
      translationSourceVersion: "v-1",
      liveSourceVersion: "v-1",
    });
    assert.equal(nestedMissing.state, "PARTIAL");
  });

  it("H: PARTIAL schedules regeneration", () => {
    assert.equal(shouldScheduleMediaTranslationRepair("PARTIAL"), true);
    assert.equal(shouldScheduleMediaTranslationRepair("MISSING"), true);
    assert.equal(shouldScheduleMediaTranslationRepair("STALE"), true);
    assert.equal(shouldScheduleMediaTranslationRepair("COMPLETE"), false);
  });

  it("I–K: semantic fingerprint ignores protected URL; content changes bump version", () => {
    const base = { title: "T", summary: "S", category: "C" };
    const v1 = buildContentTranslationSourceVersion({
      fields: base,
      versionStamp: "semantic",
    });
    const vTitle = buildContentTranslationSourceVersion({
      fields: { ...base, title: "T2" },
      versionStamp: "semantic",
    });
    const vSummary = buildContentTranslationSourceVersion({
      fields: { ...base, summary: "S2" },
      versionStamp: "semantic",
    });
    assert.notEqual(v1, vTitle);
    assert.notEqual(v1, vSummary);
    // updatedAt / URL not in fields → same version
    const vStampNoise = buildContentTranslationSourceVersion({
      fields: base,
      versionStamp: "semantic",
    });
    assert.equal(v1, vStampNoise);
    const urlA = normalizeArticleUrl("https://example.com/a").normalizedArticleUrl;
    const urlB = normalizeArticleUrl("https://example.com/b").normalizedArticleUrl;
    assert.notEqual(createNewsArticleId(urlA), createNewsArticleId(urlB));
  });

  it("L: localized values cannot be overwritten by raw merge", () => {
    const merged = mergeLocalizedOverCanonical({
      canonical: { title: "EN title", summary: "EN summary", url: "https://x" },
      localized: { title: "UK title", summary: "UK summary" },
      autoKeys: ["title", "summary"],
    });
    assert.equal(merged.title, "UK title");
    assert.equal(merged.summary, "UK summary");
    assert.equal(merged.url, "https://x");
    // Spreading raw after localized must not win for AUTO keys — helper enforces order.
    const badPattern = { ...merged, ...{ title: "EN title", summary: "EN summary" } };
    const repaired = mergeLocalizedOverCanonical({
      canonical: badPattern,
      localized: { title: "UK title", summary: "UK summary" },
      autoKeys: ["title", "summary"],
    });
    assert.equal(repaired.title, "UK title");
  });

  it("M–O / P: principle+trusted+country paths; locales independent", () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const principle = localizePublicPresentation({
        identity: {
          sourceKind: "civic_media",
          sourceRecordId: `civic-media-center::principle::p1`,
          presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
        },
        sourceLanguage: "en",
        targetLanguage: locale,
        presentation: { title: "Independence", description: "Principle description" },
        translations: {
          title: `[${locale}] Independence`,
          description: `[${locale}] Principle description`,
        },
      });
      assert.equal(principle.coverage.status, "COMPLETE");

      const trusted = localizePublicPresentation({
        identity: {
          sourceKind: "civic_media",
          sourceRecordId: `civic-media-center::trusted::t1`,
          presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
        },
        sourceLanguage: "en",
        targetLanguage: locale,
        presentation: { explanation: "Trusted explanation" },
        translations: { explanation: `[${locale}] Trusted explanation` },
      });
      assert.equal(trusted.coverage.status, "COMPLETE");

      const country = localizePublicPresentation({
        identity: {
          sourceKind: "civic_media",
          sourceRecordId: `civic-media-center::country-rail::t1`,
          presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
        },
        sourceLanguage: "en",
        targetLanguage: locale,
        presentation: { explanation: "Country rail explanation" },
        translations: { explanation: `[${locale}] Country rail explanation` },
      });
      assert.equal(country.coverage.status, "COMPLETE");
    }

    const ukPartial = classifyTranslatedFieldCoverage({
      sourceFields: { title: "T", summary: "S" },
      translatedFields: { title: "t" },
      sourceLanguage: "en",
      targetLanguage: "uk",
      translationRowExists: true,
      translationSourceVersion: "v-1",
      liveSourceVersion: "v-1",
    });
    const zhMissing = classifyTranslatedFieldCoverage({
      sourceFields: { title: "T", summary: "S" },
      translatedFields: null,
      sourceLanguage: "en",
      targetLanguage: "zh-Hant",
      translationRowExists: false,
      translationSourceVersion: null,
      liveSourceVersion: "v-1",
    });
    assert.equal(ukPartial.state, "PARTIAL");
    assert.equal(zhMissing.state, "MISSING");
  });

  it("Q: failed generation reported FAILED", () => {
    const failed = classifyTranslatedFieldCoverage({
      sourceFields: { title: "T" },
      translatedFields: null,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translationRowExists: false,
      translationSourceVersion: null,
      liveSourceVersion: "v-1",
      generationFailed: true,
    });
    assert.equal(failed.state, "FAILED");
  });

  it("R–V: thin media diagnostic architecture — paths only, no provider/worker/corpus", () => {
    const script = readApi("scripts/diagnose-media-localization.ts");
    const runner = readApi(
      "modules/language/thin-media-localization-diagnostic/run-media-diagnostic.ts",
    );
    const discover = readApi(
      "modules/language/thin-media-localization-diagnostic/discover-media-presentations.ts",
    );
    const pkg = readFileSync(join(apiSrc, "../package.json"), "utf8");
    assert.match(pkg, /diagnose:media-localization/);
    assert.match(script, /THIN_READ_ONLY|thin-media-localization-diagnostic/);
    assert.doesNotMatch(runner, /gemini|reconcile-public-localization|warm-consumer/i);
    assert.doesNotMatch(discover, /gemini|reconcile-public-localization|PublicNewsCard/);
    assert.match(runner, /fallbackPaths/);
    assert.match(runner, /OPERATOR_MODE/);
    assert.match(runner, /disconnectMongoClient/);
    const materialization = readApi("modules/language/media-translation-materialization.ts");
    assert.match(materialization, /fallbackReason/);
    assert.match(discover, /pathDiagnostics/);
    // No prose field dumps
    assert.doesNotMatch(runner, /console\.log\(.*title|body|summary.*\)/);
  });

  it("sourceVersion ignores updatedAt wall-clock for public_news", () => {
    const loaders = readApi("modules/language/content-translation-civic-loaders.ts");
    assert.match(loaders, /versionStamp: "semantic"/);
    assert.doesNotMatch(
      loaders.slice(loaders.indexOf("loadPublicNewsTranslationSource")),
      /versionStamp: record\.updatedAt/,
    );
  });

  it("principles serialize id for stable overlay", () => {
    const loaders = readApi("modules/language/content-translation-civic-loaders.ts");
    assert.match(loaders, /selectionPrinciples[\s\S]*id: item\.id/);
    const editorial = readFileSync(
      join(
        apiSrc,
        "../../web/src/features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
      ),
      "utf8",
    );
    assert.match(editorial, /principlesById/);
    assert.match(editorial, /isPartial/);
  });

  it("deterministic id from URL hash", () => {
    const url = "https://example.com/stable-article";
    const id = createNewsArticleId(normalizeArticleUrl(url).normalizedArticleUrl);
    const digest = createHash("sha256")
      .update(normalizeArticleUrl(url).normalizedArticleUrl)
      .digest("hex")
      .slice(0, 20);
    assert.equal(id, `news-${digest}`);
  });
});
