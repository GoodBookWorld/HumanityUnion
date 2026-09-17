/**
 * Focused tests for lightweight CT coverage diagnostic (no staging Mongo).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROXIMATE_MISSING_CAVEAT,
  assertCtCoverageLightSafetyGate,
  buildCanonicalEligibleCharsPipeline,
  buildCanonicalKindMeasurePlans,
  buildContentTranslationStatusCountsPipeline,
  buildCoverageRows,
  buildCurrentTranslatedCharactersPipeline,
  classifyContentTranslationRow,
  computeApproximateMissing,
  CT_COVERAGE_LIGHT_REQUIRED_DATABASE,
  CT_COVERAGE_LIGHT_TARGET_LANGUAGES,
  formatCtCoverageLightReport,
  pipelineReturnsTranslatedText,
} from "../../../src/scripts/diagnose-staging-ct-coverage-light.logic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

/** Call-graph markers the CLI/logic must never reach. Kept in the test only. */
const FORBIDDEN_MARKERS = [
  "bootstrapContentTranslationOperatorPersistence",
  "auditPublicLocalizationCorpus",
  "discoverStagingInitiativePathWarmSources",
  "content-translation-staging-warm-backfill",
  "content-translation-warm-consumer",
  "gemini-translation-provider",
  "resolve-translation-provider",
  "reconcile-public-localization",
  "loadTranslatableSource(",
  "listInitiatives(",
  "upsertContentTranslation",
  "updateOne(",
  "updateMany(",
  "insertOne(",
  "insertMany(",
  "deleteOne(",
  "deleteMany(",
  "replaceOne(",
] as const;

function readRel(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

describe("diagnose:ct-coverage-light safety gate", () => {
  it("refuses when NODE_ENV != production", () => {
    const result = assertCtCoverageLightSafetyGate({
      nodeEnv: "development",
      mongoDatabase: CT_COVERAGE_LIGHT_REQUIRED_DATABASE,
    });
    assert.equal(result.ok, false);
    assert.match(result.refusalMessage ?? "", /NODE_ENV=production/);
  });

  it("refuses when database != humanity_union_staging", () => {
    const result = assertCtCoverageLightSafetyGate({
      nodeEnv: "production",
      mongoDatabase: "humanity_union",
    });
    assert.equal(result.ok, false);
    assert.match(result.refusalMessage ?? "", /humanity_union_staging/);
  });

  it("refuses when database is unset", () => {
    const result = assertCtCoverageLightSafetyGate({
      nodeEnv: "production",
      mongoDatabase: undefined,
    });
    assert.equal(result.ok, false);
  });

  it("accepts production + humanity_union_staging", () => {
    const result = assertCtCoverageLightSafetyGate({
      nodeEnv: "production",
      mongoDatabase: CT_COVERAGE_LIGHT_REQUIRED_DATABASE,
    });
    assert.equal(result.ok, true);
    assert.equal(result.refusalMessage, null);
  });
});

describe("diagnose:ct-coverage-light target languages", () => {
  it("targets exactly uk / ar / zh-Hant", () => {
    assert.deepEqual([...CT_COVERAGE_LIGHT_TARGET_LANGUAGES], ["uk", "ar", "zh-Hant"]);
  });
});

describe("diagnose:ct-coverage-light CURRENT/STALE classification", () => {
  it("classifies CURRENT when freshness=current and stale!=true", () => {
    assert.equal(classifyContentTranslationRow({ freshness: "current", stale: false }), "CURRENT");
    assert.equal(classifyContentTranslationRow({ freshness: "current" }), "CURRENT");
  });

  it("classifies STALE when stale=true or freshness=stale", () => {
    assert.equal(classifyContentTranslationRow({ freshness: "current", stale: true }), "STALE");
    assert.equal(classifyContentTranslationRow({ freshness: "stale", stale: false }), "STALE");
  });

  it("classifies OTHER for regenerating / unknown", () => {
    assert.equal(
      classifyContentTranslationRow({ freshness: "regenerating", stale: false }),
      "OTHER",
    );
    assert.equal(classifyContentTranslationRow({}), "OTHER");
  });
});

describe("diagnose:ct-coverage-light character aggregation contract", () => {
  it("does not return translated text in CT char pipelines", () => {
    const pipeline = buildCurrentTranslatedCharactersPipeline({
      targetLanguage: "uk",
      sourceKind: "initiative",
      allowlistedKeys: ["title", "description"],
    });
    assert.equal(pipelineReturnsTranslatedText(pipeline), false);
    const serialized = JSON.stringify(pipeline);
    assert.match(serialized, /\$strLenCP/);
    assert.match(serialized, /\$objectToArray/);
    assert.doesNotMatch(serialized, /"translatedContent"\s*:\s*1/);
  });

  it("status count pipeline never projects translatedContent", () => {
    const pipeline = buildContentTranslationStatusCountsPipeline();
    assert.equal(pipelineReturnsTranslatedText(pipeline), false);
    assert.doesNotMatch(JSON.stringify(pipeline), /translatedContent/);
  });

  it("canonical pipeline projects only scalar char sums", () => {
    const pipeline = buildCanonicalEligibleCharsPipeline({
      match: { status: "published" },
      allowlistedFields: ["title", "summary"],
    });
    const serialized = JSON.stringify(pipeline);
    assert.match(serialized, /\$strLenCP/);
    assert.match(serialized, /eligibleCharacters/);
    assert.doesNotMatch(serialized, /translatedContent/);
  });
});

describe("diagnose:ct-coverage-light approximateMissing", () => {
  it("never becomes negative", () => {
    assert.equal(computeApproximateMissing({ canonicalEligible: 10, current: 3 }), 7);
    assert.equal(computeApproximateMissing({ canonicalEligible: 10, current: 10 }), 0);
    assert.equal(computeApproximateMissing({ canonicalEligible: 10, current: 15 }), 0);
    assert.equal(computeApproximateMissing({ canonicalEligible: 0, current: 5 }), 0);
  });
});

describe("diagnose:ct-coverage-light formatting", () => {
  it("formats aggregation scalars with caveat and cost inputs", () => {
    const canonical = [
      {
        sourceKind: "initiative" as const,
        status: "measured" as const,
        eligibleRecords: 10,
        eligibleCharacters: 1000,
      },
      {
        sourceKind: "petition" as const,
        status: "UNMEASURED" as const,
        reason: "nested subject fields",
      },
    ];
    const counts = [
      {
        targetLanguage: "uk",
        sourceKind: "initiative",
        current: 4,
        stale: 1,
        other: 0,
      },
    ];
    const coverage = buildCoverageRows({ counts, canonical });
    const report = formatCtCoverageLightReport({
      database: CT_COVERAGE_LIGHT_REQUIRED_DATABASE,
      targetLanguages: [...CT_COVERAGE_LIGHT_TARGET_LANGUAGES],
      counts,
      charBuckets: [
        {
          targetLanguage: "uk",
          sourceKind: "initiative",
          currentRecords: 4,
          translatedCharacters: 400,
        },
      ],
      canonical,
      coverage,
    });

    assert.match(report, /CURRENT=4/);
    assert.match(report, /STALE=1/);
    assert.match(report, /UNMEASURED/);
    assert.match(report, /approximateMissing=6/);
    assert.match(report, new RegExp(APPROXIMATE_MISSING_CAVEAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(report, /CANONICAL_ELIGIBLE_RECORDS=10/);
    assert.match(report, /CANONICAL_ELIGIBLE_CHARACTERS=1000/);
    assert.match(report, /CURRENT_TRANSLATION_RECORDS=4/);
    assert.match(report, /CURRENT_TRANSLATED_CHARACTERS=400/);
    assert.match(report, /STALE_TRANSLATION_RECORDS=1/);
    assert.match(report, /TOTAL_CURRENT_TRANSLATION_JOBS=4/);
    assert.doesNotMatch(report, /translated text sample/i);
    assert.doesNotMatch(report, /\$0\.|USD|Gemini token/i);
  });
});

describe("diagnose:ct-coverage-light measured vs UNMEASURED plans", () => {
  it("measures flat public kinds and marks nested/projection kinds UNMEASURED", () => {
    const plans = buildCanonicalKindMeasurePlans();
    const byKind = Object.fromEntries(plans.map((p) => [p.sourceKind, p]));

    assert.equal(byKind.initiative?.status, "measured");
    assert.equal(byKind.collaborative_analysis?.status, "measured");
    assert.equal(byKind.blog_post?.status, "measured");
    assert.equal(byKind.discussion_comment?.status, "measured");
    assert.equal(byKind.official_response?.status, "measured");

    assert.equal(byKind.petition?.status, "UNMEASURED");
    assert.equal(byKind.improvement_proposal?.status, "UNMEASURED");
    assert.equal(byKind.civic_media?.status, "UNMEASURED");
    assert.equal(byKind.civic_archive?.status, "UNMEASURED");
    assert.equal(byKind.public_news?.status, "UNMEASURED");
    assert.match(byKind.petition?.reason ?? "", /nested|array/i);
  });
});

describe("diagnose:ct-coverage-light no provider/warm/write path", () => {
  it("CLI + logic sources never reach forbidden hydrate/provider/write markers", () => {
    const logic = readRel("src/scripts/diagnose-staging-ct-coverage-light.logic.ts");
    const cli = readRel("src/scripts/diagnose-staging-ct-coverage-light.ts");
    const combined = `${logic}\n${cli}`;

    for (const marker of FORBIDDEN_MARKERS) {
      assert.equal(
        combined.includes(marker),
        false,
        `forbidden marker present: ${marker}`,
      );
    }

    assert.doesNotMatch(combined, /from ["'].*gemini-translation-provider/);
    assert.doesNotMatch(combined, /from ["'].*resolve-translation-provider/);
    assert.doesNotMatch(combined, /from ["'].*content-translation-staging-warm/);
    assert.match(cli, /aggregate\(/);
    assert.match(cli, /assertCtCoverageLightSafetyGate/);
    assert.match(cli, /disconnectMongoClient/);
  });

  it("package.json exposes diagnose:ct-coverage-light", () => {
    const pkg = JSON.parse(readRel("package.json")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts["diagnose:ct-coverage-light"] ?? "", /diagnose-staging-ct-coverage-light/);
  });
});
