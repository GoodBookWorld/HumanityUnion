/**
 * Production-isolated read-only chunk-plan diagnostic.
 * Deterministic only — no live provider and no Mongo writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { LanguageCode } from "@hu/types";

import { sanitizeFieldsForAutomaticTranslation } from "../../../src/modules/language/content-translation-eligibility.js";
import { buildBlogPostTranslatableSource } from "../../../src/modules/language/content-translation-blog-source.js";
import {
  contentTranslationChunkPlanReleasesTruncationHold,
  contentTranslationPlanSlotCount,
  maximumContentTranslationPlannedRequestOutputTokens,
  planContentTranslationRequests,
  resolveContentTranslationExecutableFields,
} from "../../../src/modules/language/content-translation-chunk-plan-core.js";
import {
  CONTENT_TRANSLATION_CHUNK_PLAN_DIAGNOSTIC_KEYS,
  diagnoseBlogPostChunkPlan,
  evaluateContentTranslationChunkPlan,
} from "../../../src/modules/language/content-translation-chunk-plan-diagnostic.js";
import { localeIsAutomaticWarmTarget } from "../../../src/modules/language/content-translation-chunk-plan-diagnostic-read.js";
import {
  contentTranslationUsesUnsplitSingleResponse,
  selectInvalidProviderPayloadRetry,
  shouldHoldAutomaticRetryForUnsplitTruncation,
  type InvalidProviderPayloadRetryAttempt,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import {
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import { resolveAutomaticContentTranslationWarmTargets } from "../../../src/modules/language/content-translation-warm-targets.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(HERE, "../../..");
const SENTINEL = "SENTINEL_PROSE_do_not_print_9f3a";
const EXPECTED_VERSION = "v-1-v-6268ff8ac13e5eea";
const RECORD_ID = "blog-57d5b2da-84f9-4ca4-96db-a02f8615ef09";

const FORBIDDEN_MODULES = [
  "blog.repository.ts",
  "language-registry.repository.ts",
  "localization-provider-governor.ts",
  "resolve-translation-provider.ts",
  "translation-provider.ts",
  "content-translation-warm-consumer.ts",
  "content-translation-warm-targets.ts",
  "content-translation.service.ts",
  "content-translation-chunk-plan.ts",
  "localization-reconciliation-driver.ts",
  "outbox.dispatcher.ts",
  "content-translation.repository.ts",
  "content-translation-worker-concurrency.ts",
  "thin-gemini-provider-state.ts",
];

const WRITE_CALL =
  /\.(insertOne|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite|findOneAndUpdate|findOneAndReplace)\b/;

function blogPost(content: string) {
  return {
    postId: RECORD_ID,
    title: "Harbor note",
    excerpt: "Short excerpt",
    content,
    updatedAt: "2026-10-09T00:00:00.000Z",
    publishedVersion: 1,
    originalLanguage: "en",
    authorParticipantId: "author-1",
    status: "published",
  };
}

function longHtml(): string {
  const paragraphs = Array.from({ length: 12 }, () => `<p>${"word ".repeat(40)}</p>`);
  return `<p>${SENTINEL}</p>${paragraphs.join("")}`;
}

function truncatedAttempt(sourceVersion: string): InvalidProviderPayloadRetryAttempt {
  return {
    status: "failed",
    architectureRetryBasis: null,
    sourceVersion,
    targetLocales: ["he"],
    attemptAt: "2020-01-01T00:00:00.000Z",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    failureTargetLocale: "he",
    retryabilityHint: "retryable",
    structuredOutputContract: "schema_v1",
    providerPayloadKind: "truncated",
  };
}

function walkImports(file: string, seen: Set<string>): void {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);
  const base = file.slice(file.lastIndexOf("/") + 1);
  assert.equal(FORBIDDEN_MODULES.includes(base), false, file);
  const text = readFileSync(file, "utf8");
  assert.equal(WRITE_CALL.test(text), false, file);
  const specifiers = [
    ...text.matchAll(/from "(\.[^"]+)"/g),
    ...text.matchAll(/import\(\s*"(\.[^"]+)"\s*\)/g),
  ];
  for (const match of specifiers) {
    const specifier = match[1];
    if (!specifier) {
      continue;
    }
    let next = resolve(dirname(file), specifier);
    if (next.endsWith(".js")) {
      next = `${next.slice(0, -3)}.ts`;
    } else if (!next.endsWith(".ts")) {
      next = `${next}.ts`;
    }
    walkImports(next, seen);
  }
}

describe("content translation chunk plan diagnostic", () => {
  it("matches the pure warm planner for automatic and search fields", () => {
    const source = buildBlogPostTranslatableSource(blogPost(longHtml()));
    for (const intent of ["automatic_warm", "search_discovery"] as const) {
      const diagnostic = evaluateContentTranslationChunkPlan({
        sourceExists: true,
        sourceKind: "blog_post",
        sourceVersion: source.sourceVersion,
        expectedSourceVersion: source.sourceVersion,
        fields: source.fields,
        intent,
        maxOutputTokens: 4096,
      });
      const executable = resolveContentTranslationExecutableFields({
        sourceKind: "blog_post",
        intent,
        sanitizedFields: sanitizeFieldsForAutomaticTranslation({
          sourceKind: "blog_post",
          fields: source.fields,
        }),
      });
      assert.ok(executable);
      const plan = planContentTranslationRequests(executable, 4096);
      assert.deepEqual([...diagnostic.eligibleFieldNames], Object.keys(executable).sort());
      assert.equal(diagnostic.providerRequestCount, plan.requests.length);
      assert.equal(diagnostic.slotCount, contentTranslationPlanSlotCount(plan));
      assert.equal(diagnostic.planMode, plan.mode);
      assert.equal(
        diagnostic.maximumEstimatedRequestOutputTokens,
        maximumContentTranslationPlannedRequestOutputTokens(plan),
      );
      assert.equal(
        diagnostic.truncationHoldWouldRelease,
        contentTranslationChunkPlanReleasesTruncationHold(executable, 4096),
      );
      assert.equal(diagnostic.chunkPlanValid, plan.capable && plan.mode !== "unsplittable");
    }
  });

  it("checks the source version and keeps output metadata-only", () => {
    const source = buildBlogPostTranslatableSource(blogPost(longHtml()));
    const mismatched = evaluateContentTranslationChunkPlan({
      sourceExists: true,
      sourceKind: "blog_post",
      sourceVersion: source.sourceVersion,
      expectedSourceVersion: EXPECTED_VERSION,
      fields: source.fields,
      intent: "automatic_warm",
      maxOutputTokens: 4096,
    });
    assert.equal(mismatched.sourceVersionMatchesExpected, false);
    assert.equal(mismatched.sourceVersion, source.sourceVersion);
    const encoded = JSON.stringify(mismatched);
    assert.deepEqual(Object.keys(mismatched), [...CONTENT_TRANSLATION_CHUNK_PLAN_DIAGNOSTIC_KEYS]);
    assert.equal(encoded.includes(SENTINEL), false);
    assert.equal(encoded.includes("<"), false);
    assert.equal(encoded.includes("mongodb://"), false);
    assert.equal(encoded.includes("GEMINI"), false);
    assert.equal(encoded.includes(EXPECTED_VERSION), false);
    for (const length of Object.values(mismatched.sanitizedFieldLengths)) {
      assert.equal(typeof length, "number");
    }
    assert.equal(mismatched.planMode, "chunked");
    assert.equal(mismatched.within24RequestLimit, true);
    assert.equal(mismatched.within4096TokenBudget, true);
  });

  it("reads one blog identity and skips the registry when the post is missing", async () => {
    const source = buildBlogPostTranslatableSource(blogPost("<p>Short civic note</p>"));
    let reads = 0;
    let registryReads = 0;
    const result = await diagnoseBlogPostChunkPlan(
      {
        sourceKind: "blog_post",
        sourceRecordId: RECORD_ID,
        targetLocale: "he",
        expectedSourceVersion: source.sourceVersion,
      },
      {
        readBlogPost: async (postId) => {
          reads += 1;
          assert.equal(postId, RECORD_ID);
          return blogPost("<p>Short civic note</p>");
        },
        isAutomaticWarmTarget: async () => {
          registryReads += 1;
          return true;
        },
      },
    );
    assert.equal(reads, 1);
    assert.equal(registryReads, 1);
    assert.equal(result.sourceExists, true);
    assert.equal(result.sourceVersionMatchesExpected, true);
    assert.equal(result.planMode, "single");
    assert.equal(result.truncationHoldWouldRelease, false);
    assert.deepEqual(result.eligibleFieldNames, ["content", "excerpt", "title"]);

    const missing = await diagnoseBlogPostChunkPlan(
      {
        sourceKind: "blog_post",
        sourceRecordId: RECORD_ID,
        targetLocale: "he",
        expectedSourceVersion: source.sourceVersion,
      },
      {
        readBlogPost: async () => null,
        isAutomaticWarmTarget: async () => {
          throw new Error("registry must not be read when the post is missing");
        },
      },
    );
    assert.equal(missing.sourceExists, false);
    await assert.rejects(
      diagnoseBlogPostChunkPlan({
        sourceKind: "initiative",
        sourceRecordId: RECORD_ID,
        targetLocale: "he",
        expectedSourceVersion: source.sourceVersion,
      }),
      /usage/,
    );
  });

  it("uses the production automatic warm membership rule", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    try {
      await ensureLanguageRegistrySeeded();
      const records = await listLanguageRegistry();
      const warm = await resolveAutomaticContentTranslationWarmTargets({
        excludeSourceLanguage: "en" as LanguageCode,
      });
      for (const record of records) {
        const targetLocale = record.locale.trim();
        assert.equal(
          localeIsAutomaticWarmTarget({
            targetLocale,
            sourceLanguage: "en",
            record: {
              locale: record.locale,
              enabled: record.enabled,
              contentTranslationEnabled: record.contentTranslationEnabled,
            },
          }),
          warm.warmTargetLocales.includes(targetLocale as LanguageCode),
        );
      }
      assert.equal(
        localeIsAutomaticWarmTarget({
          targetLocale: "he",
          sourceLanguage: "en",
          record: null,
        }),
        false,
      );
      assert.equal(
        localeIsAutomaticWarmTarget({
          targetLocale: "he",
          sourceLanguage: "he",
          record: { locale: "he", enabled: true, contentTranslationEnabled: true },
        }),
        false,
      );
    } finally {
      resetLanguageRegistryStoreForTests();
      setLanguageRegistryForceMemoryForTests(false);
    }
  });

  it("imports neither the provider, the worker, nor a write repository", () => {
    const seen = new Set<string>();
    walkImports(
      resolve(API_ROOT, "src/scripts/diagnose-content-translation-chunk-plan.ts"),
      seen,
    );
    walkImports(
      resolve(API_ROOT, "src/modules/language/content-translation-chunk-plan-diagnostic.ts"),
      seen,
    );
    const readSource = readFileSync(
      resolve(API_ROOT, "src/modules/language/content-translation-chunk-plan-diagnostic-read.ts"),
      "utf8",
    );
    assert.equal(readSource.includes("findOne(\n      { postId }"), true);
    assert.equal(readSource.includes("findOne(\n      { localeKey }"), true);
    assert.equal(readSource.includes("maxTimeMS:"), true);
    assert.equal(readSource.includes("projection:"), true);
    const cli = readFileSync(
      resolve(API_ROOT, "src/scripts/diagnose-content-translation-chunk-plan.ts"),
      "utf8",
    );
    assert.equal(cli.includes('process.env.HU_READ_ONLY_DIAGNOSTIC = "1"'), true);
    assert.equal(cli.includes("disconnectMongoClient"), true);
    const service = readFileSync(
      resolve(API_ROOT, "src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    assert.equal(service.includes("return buildBlogPostTranslatableSource(post);"), true);
    const executor = readFileSync(
      resolve(API_ROOT, "src/modules/language/content-translation-chunk-plan.ts"),
      "utf8",
    );
    assert.equal(
      executor.includes('from "./content-translation-chunk-plan-core.js"'),
      true,
    );
    assert.equal(executor.includes("function planContentTranslationRequests"), false);
    for (const relativePath of [
      "src/index.ts",
      "src/modules/language/content-translation-warm-consumer.ts",
      "src/modules/language/localization-reconciliation-driver.ts",
      "src/infrastructure/outbox/outbox.dispatcher.ts",
      "src/scripts/diagnose-content-translation-chunk-plan.ts",
      "src/modules/language/content-translation-chunk-plan-diagnostic.ts",
      "src/modules/language/content-translation-chunk-plan-diagnostic-read.ts",
    ]) {
      const text = readFileSync(resolve(API_ROOT, relativePath), "utf8");
      assert.equal(text.includes("content-translation-chunk-plan.ts"), false, relativePath);
      assert.equal(text.includes('content-translation-chunk-plan.js"'), false, relativePath);
    }
  });

  it("keeps the truncation hold closed when a chunk plan is capable", () => {
    assert.equal(contentTranslationUsesUnsplitSingleResponse(), true);
    const attempt = truncatedAttempt(EXPECTED_VERSION);
    const selection = {
      sourceKind: "blog_post" as const,
      sourceRecordId: RECORD_ID,
      targetLocale: "he",
      sourceVersion: EXPECTED_VERSION,
      attempts: [attempt],
      nowMs: Date.parse("2030-01-01T00:00:00.000Z"),
    };
    assert.deepEqual(selectInvalidProviderPayloadRetry(selection), {
      outcome: "due",
      countedFailures: 1,
    });
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: EXPECTED_VERSION,
        targetLocale: "he",
        attempts: [attempt],
        retryOutcome: "due",
      }),
      true,
    );
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: EXPECTED_VERSION,
        targetLocale: "he",
        attempts: [attempt],
        retryOutcome: "recover_once",
      }),
      true,
    );
    const source = buildBlogPostTranslatableSource(blogPost(longHtml()));
    const executable = resolveContentTranslationExecutableFields({
      sourceKind: "blog_post",
      intent: "automatic_warm",
      sanitizedFields: sanitizeFieldsForAutomaticTranslation({
        sourceKind: "blog_post",
        fields: source.fields,
      }),
    });
    assert.ok(executable);
    assert.equal(contentTranslationChunkPlanReleasesTruncationHold(executable, 4096), true);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: EXPECTED_VERSION,
        targetLocale: "he",
        attempts: [attempt],
        retryOutcome: "due",
      }),
      true,
    );
    const shortFields = { title: "Harbor", excerpt: "Short", content: "<p>Short</p>" };
    assert.equal(contentTranslationChunkPlanReleasesTruncationHold(shortFields, 4096), false);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: EXPECTED_VERSION,
        targetLocale: "he",
        attempts: [attempt],
        retryOutcome: "due",
      }),
      true,
    );
    assert.deepEqual(selectInvalidProviderPayloadRetry(selection), {
      outcome: "due",
      countedFailures: 1,
    });
    const holdSource = readFileSync(
      resolve(API_ROOT, "src/modules/language/content-translation-provider-payload-retry.ts"),
      "utf8",
    );
    assert.equal(holdSource.includes("content-translation-chunk-plan"), false);
    assert.equal(holdSource.includes("sourceFields"), false);
    assert.equal(holdSource.includes("content-translation-chunk-plan-diagnostic"), false);
  });
});
