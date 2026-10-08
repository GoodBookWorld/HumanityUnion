/**
 * Content Translation structured JSON contract and same-version
 * INVALID_PROVIDER_PAYLOAD retry ceiling.
 * Deterministic only — no live Gemini and no Mongo writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  buildPublicLocalizationRetryPreflight,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryFailedForTests,
  parseContentTranslationFailureMetadata,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolvePublicTranslatedContent,
  selectReadyPresentationsForResidualRetry,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
  enqueueContentTranslationWarmRequested,
} from "../../../src/modules/language/index.js";
import { contentTranslationStructuredResponseSchema } from "../../../src/modules/language/content-translation-structured-response.js";
import {
  CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS,
  selectInvalidProviderPayloadRetry,
  type InvalidProviderPayloadRetryAttempt,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { ContentTranslationValidationError } from "../../../src/modules/language/content-translation-failure-metadata.js";
import { buildGeminiGenerationConfig } from "../../../src/modules/language/providers/gemini-translation-provider.js";
import { PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA } from "../../../src/modules/language/media-plp-materializer/provider-response-contract.js";
import { webUiProviderResponseSchema } from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { runPublicLocalizationResidualRetry } from "../../../src/modules/language/public-localization-residual-retry.js";
import { listContentTranslationsForSource } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_VERSION = "v-bb89502a8ffa6ea3";
const RECORD_ID = "4d69b8ea-ee97-44ad-9835-4c2e995438f9";

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-ct-schema-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-ct-schema",
    createdAt: now,
    updatedAt: now,
    title: `Structured contract title ${suffix}`,
    description: `Canonical English description for structured contract ${suffix}.`,
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

class SchemaCapturingProvider {
  readonly providerId = "gemini" as const;
  callCount = 0;
  lastRequest: TranslationProviderRequest | null = null;
  mode: "valid" | "truncated" | "fenced" | "prose" = "valid";

  async translate(request: TranslationProviderRequest) {
    this.callCount += 1;
    this.lastRequest = request;
    if (this.mode === "truncated") {
      return { translatedText: "{", providerId: this.providerId, isPlaceholder: false };
    }
    if (this.mode === "fenced") {
      return {
        translatedText: "```json\n{\"title\":\"x\"}\n```",
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }
    if (this.mode === "prose") {
      return {
        translatedText: "Here is the translation: {\"title\":\"x\"}",
        providerId: this.providerId,
        isPlaceholder: false,
      };
    }
    const parsed = JSON.parse(request.text) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      translated[key] = `Localized prose for ${value}`;
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}

function historicalAttempt(
  index: number,
  overrides: Partial<InvalidProviderPayloadRetryAttempt> = {},
): InvalidProviderPayloadRetryAttempt {
  return {
    status: "failed",
    architectureRetryBasis: null,
    sourceVersion: SOURCE_VERSION,
    targetLocales: ["zh-Hant"],
    attemptAt: new Date(Date.UTC(2026, 9, 1, 0, index, 0)).toISOString(),
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    failureTargetLocale: "zh-Hant",
    localeFailures: [{ targetLocale: "zh-Hant", failureReasonCode: "INVALID_PROVIDER_PAYLOAD" }],
    structuredOutputContract: null,
    ...overrides,
  };
}

function historicalLastError(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLocale: string;
}): string {
  return `CT_FAIL_META_V1:${JSON.stringify({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale,
    failedAt: "2026-10-01T00:00:00.000Z",
    retryabilityHint: "retryable",
    localeFailures: [
      {
        targetLocale: input.targetLocale,
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        retryabilityHint: "retryable",
      },
    ],
  })}`;
}

describe("CT structured response schema", () => {
  it("builds an object schema of required string fields from the source keys", () => {
    const schema = contentTranslationStructuredResponseSchema({
      body: "Establish Regional Democratic Leadership Academies.",
    });
    assert.ok(schema);
    assert.equal(schema.type, "object");
    assert.deepEqual(schema.properties.body, { type: "string" });
    assert.deepEqual(schema.required, ["body"]);
    assert.deepEqual(schema.propertyOrdering, ["body"]);
    assert.equal(contentTranslationStructuredResponseSchema({}), null);
  });

  it("asks Gemini for application/json only when a schema is supplied", () => {
    const schema = contentTranslationStructuredResponseSchema({
      body: "Establish Regional Democratic Leadership Academies.",
    });
    const withSchema = buildGeminiGenerationConfig({
      maxOutputTokens: 4096,
      responseSchema: schema ?? undefined,
    });
    assert.equal(withSchema.responseMimeType, "application/json");
    assert.equal(withSchema.responseSchema, schema);
    const plain = buildGeminiGenerationConfig({ maxOutputTokens: 4096 });
    assert.equal(plain.responseMimeType, undefined);
    assert.equal(plain.responseSchema, undefined);
  });

  it("leaves WEB_UI span arrays and the PLP translations array on their own contracts", () => {
    const webUi = webUiProviderResponseSchema({
      keys: ["nav.home"],
      payload: { "nav.home": ["Home"] },
    });
    assert.equal(webUi.properties["nav.home"]?.type, "array");
    assert.equal(webUi.properties["nav.home"]?.minItems, 1);
    assert.equal(PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA.type, "object");
    assert.equal(PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA.properties.translations.type, "array");
    assert.deepEqual(PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA.required, ["translations"]);
    const plpTransport = readApi(
      "src/modules/language/media-plp-materializer/thin-gemini-transport.ts",
    );
    assert.match(plpTransport, /PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA/);
    const webUiShape = readApi(
      "src/modules/web-ui-message-packs/web-ui-provider-output-structure.ts",
    );
    assert.match(webUiShape, /WEB_UI_PROVIDER_SHAPE_VERSION = 4/);
  });
});

describe("CT structured publish gate", () => {
  const createdIds: string[] = [];
  let provider: SchemaCapturingProvider;

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    provider = new SchemaCapturingProvider();
    setTranslationProviderForTests(provider);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("sends the object schema and publishes valid structured JSON once", async () => {
    const initiative = createInitiative(sampleInitiative("publish"));
    createdIds.push(initiative.initiativeId);
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(created.generated, true);
    assert.equal(created.translation?.freshness, "current");
    assert.equal(provider.callCount, 1);
    const schema = provider.lastRequest?.responseSchema as {
      type?: string;
      properties?: Record<string, { type?: string }>;
      required?: string[];
      propertyOrdering?: string[];
    };
    assert.equal(schema.type, "object");
    const sent = JSON.parse(provider.lastRequest?.text ?? "{}") as Record<string, string>;
    assert.deepEqual(schema.required, Object.keys(sent));
    assert.deepEqual(schema.propertyOrdering, Object.keys(sent));
    for (const key of schema.required ?? []) {
      assert.equal(schema.properties?.[key]?.type, "string");
    }
    const mime = buildGeminiGenerationConfig({
      maxOutputTokens: 4096,
      responseSchema: provider.lastRequest?.responseSchema,
    });
    assert.equal(mime.responseMimeType, "application/json");

    const again = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(again.generated, false);
    assert.equal(again.translation?.freshness, "current");
    assert.equal(provider.callCount, 1);
  });

  it("rejects truncated, fenced, and prose-wrapped provider output before publish", async () => {
    for (const mode of ["truncated", "fenced", "prose"] as const) {
      provider.mode = mode;
      provider.callCount = 0;
      const initiative = createInitiative(sampleInitiative(mode));
      createdIds.push(initiative.initiativeId);
      await assert.rejects(
        () =>
          getOrCreateContentTranslation({
            sourceKind: "initiative",
            sourceRecordId: initiative.initiativeId,
            targetLanguage: "uk",
            generateIfMissing: true,
            intent: "automatic_warm",
          }),
        (error: unknown) =>
          error instanceof ContentTranslationValidationError &&
          error.reasonCode === "INVALID_PROVIDER_PAYLOAD",
      );
      const rows = await listContentTranslationsForSource({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      });
      assert.equal(rows.length, 0);
    }
  });

  it("public resolve does not call the provider", async () => {
    const initiative = createInitiative(sampleInitiative("resolve"));
    createdIds.push(initiative.initiativeId);
    provider.mode = "truncated";
    const resolved = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "uk",
      generateIfMissing: false,
    });
    assert.equal(provider.callCount, 0);
    assert.equal(resolved.presentationMode === "original" || resolved.translation == null, true);
    const route = readApi("src/modules/language/language.routes.ts");
    assert.match(route, /generateIfMissing:\s*false/);
  });
});

describe("INVALID_PROVIDER_PAYLOAD same-version budget", () => {
  const farFuture = Date.UTC(2026, 11, 1);
  const identity = {
    sourceKind: "discussion_comment" as const,
    sourceRecordId: RECORD_ID,
    targetLocale: "zh-Hant",
    sourceVersion: SOURCE_VERSION,
  };

  it("counts separate outbox events and waits inside the cap", () => {
    const attempts = [0, 1, 2].map((index) => historicalAttempt(index));
    const due = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts,
      nowMs: farFuture,
    });
    assert.equal(due.outcome, "due");
    assert.equal(due.countedFailures, 3);

    const waiting = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts,
      nowMs: Date.parse(attempts[2]!.attemptAt) + 60_000,
    });
    assert.equal(waiting.outcome, "waiting");
    if (waiting.outcome === "waiting") {
      assert.ok(Date.parse(waiting.retryEligibleAt) > Date.parse(attempts[2]!.attemptAt));
    }
  });

  it("stops identical retries at the cap and keeps another locale and version eligible", () => {
    const exhausted = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: Array.from({ length: 8 }, (_, index) =>
        historicalAttempt(index, { structuredOutputContract: "schema_v1" }),
      ),
      nowMs: farFuture,
    });
    assert.equal(exhausted.outcome, "exhausted");
    assert.notEqual(exhausted.outcome, "due");

    const otherLocale = selectInvalidProviderPayloadRetry({
      ...identity,
      targetLocale: "uk",
      attempts: Array.from({ length: 8 }, (_, index) => historicalAttempt(index)),
      nowMs: farFuture,
    });
    assert.equal(otherLocale.outcome, "not_applicable");

    const nextVersion = selectInvalidProviderPayloadRetry({
      ...identity,
      sourceVersion: "v-next",
      attempts: Array.from({ length: 8 }, (_, index) => historicalAttempt(index)),
      nowMs: farFuture,
    });
    assert.equal(nextVersion.outcome, "not_applicable");
  });

  it("grants one historical recovery and does not grant a second", () => {
    const historical = Array.from({ length: 8 }, (_, index) => historicalAttempt(index));
    const first = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: historical,
      nowMs: Date.parse(historical[7]!.attemptAt) + 1000,
    });
    assert.equal(first.outcome, "recover_once");
    if (first.outcome === "recover_once") {
      assert.equal(first.architectureRetryBasis, CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS);
    }

    const pending = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [
        ...historical,
        historicalAttempt(9, {
          status: "pending",
          architectureRetryBasis: CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS,
          failureReasonCode: null,
          failureTargetLocale: null,
          localeFailures: null,
          structuredOutputContract: null,
        }),
      ],
      nowMs: farFuture,
    });
    assert.equal(pending.outcome, "exhausted");

    const afterFailure = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [
        ...historical,
        historicalAttempt(10, {
          architectureRetryBasis: CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS,
          structuredOutputContract: "schema_v1",
        }),
      ],
      nowMs: farFuture,
    });
    assert.equal(afterFailure.outcome, "exhausted");
  });

  it("marks newly encoded failures as schema-era and leaves historical metadata unmarked", () => {
    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      sourceKind: "discussion_comment",
      sourceRecordId: RECORD_ID,
      sourceVersion: SOURCE_VERSION,
      targetLocale: "zh-Hant",
      failedAt: "2026-10-07T00:00:00.000Z",
      retryabilityHint: "retryable",
    });
    assert.equal(parseContentTranslationFailureMetadata(encoded)?.structuredOutputContract, "schema_v1");
    const historical = parseContentTranslationFailureMetadata(
      historicalLastError({
        sourceKind: "discussion_comment",
        sourceRecordId: RECORD_ID,
        sourceVersion: SOURCE_VERSION,
        targetLocale: "zh-Hant",
      }),
    );
    assert.equal(historical?.structuredOutputContract, undefined);
    assert.equal(historical?.failureReasonCode, "INVALID_PROVIDER_PAYLOAD");
  });
});

describe("historical payload recovery selection", () => {
  const createdIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setTranslationProviderForTests(new SchemaCapturingProvider());
    await ensureLanguageRegistrySeeded();
    for (const locale of ["uk", "zh-Hant"] as const) {
      await updateLanguageRegistryRecord(`lang-${locale}`, {
        enabled: true,
        contentTranslationEnabled: true,
      });
    }
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  async function seedFailed(input: {
    readonly initiativeId: string;
    readonly sourceVersion: string;
    readonly targetLocale: "uk" | "zh-Hant";
    readonly lastError: string;
    readonly architectureRetryBasis?: string;
  }): Promise<void> {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: [input.targetLocale],
      sourceVersion: input.sourceVersion,
      ...(input.architectureRetryBasis
        ? { architectureRetryBasis: input.architectureRetryBasis }
        : {}),
    });
    assert.equal(enqueued.enqueued, true);
    markContentTranslationWarmMemoryFailedForTests(enqueued.eventId, input.lastError);
  }

  it("allows one recovery enqueue for a pre-contract ceiling, then stops", async () => {
    const initiative = createInitiative(sampleInitiative("recover"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    const liveVersion = source.sourceVersion;
    for (let index = 0; index < 8; index += 1) {
      await seedFailed({
        initiativeId: initiative.initiativeId,
        sourceVersion: liveVersion,
        targetLocale: "zh-Hant",
        lastError: historicalLastError({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          sourceVersion: liveVersion,
          targetLocale: "zh-Hant",
        }),
      });
    }

    const recovery = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: liveVersion,
        targetLanguage: "zh-Hant",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(recovery.ready, true);
    assert.equal(recovery.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(recovery.semanticRetryDeferred, false);
    assert.equal(recovery.architectureRetryBasis, CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS);
    assert.equal(recovery.currentTranslationAbsent, true);

    const uk = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: liveVersion,
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(uk.semanticRetryDeferred, false);
    assert.notEqual(uk.architectureRetryBasis, CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS);

    const provider = new SchemaCapturingProvider();
    setTranslationProviderForTests(provider);
    const firstPass = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      targetLocales: ["zh-Hant"],
      maxPresentations: 5,
    });
    assert.equal(provider.callCount, 0);
    assert.equal(firstPass.presentationsScheduled, 1);
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.equal(pending.length, 1);
    assert.equal(
      pending[0]?.command.architectureRetryBasis,
      CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS,
    );

    const secondPass = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      targetLocales: ["zh-Hant"],
      maxPresentations: 5,
    });
    assert.equal(provider.callCount, 0);
    assert.equal(secondPass.presentationsScheduled, 0);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 1);

    markContentTranslationWarmMemoryFailedForTests(
      pending[0]!.eventId,
      encodeContentTranslationFailureMetadata({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: liveVersion,
        targetLocale: "zh-Hant",
        failedAt: new Date().toISOString(),
        retryabilityHint: "retryable",
      }),
    );

    const stopped = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: liveVersion,
        targetLanguage: "zh-Hant",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(stopped.ready, true);
    assert.equal(stopped.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(stopped.semanticRetryDeferred, true);
    assert.equal(stopped.semanticRetryEligibleAt, null);
    assert.notEqual(stopped.readyState, "CURRENT");

    const schedule = selectReadyPresentationsForResidualRetry({
      RETRY_READY_IDENTITIES: 1,
      RETRY_BLOCKED_IDENTITIES: 0,
      ready: [
        {
          family: "initiative",
          presentationIdentity: {
            sourceKind: "initiative",
            sourceRecordId: initiative.initiativeId,
          },
          targetLocale: "zh-Hant",
          translationState: "MISSING",
          sourceVersionMatch: "no_row",
          failureClass: "VALIDATION_FAILED",
          failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
          retryability: "retryable",
          lastFailureAt: null,
          outboxDisposition: "failed",
          mayScheduleNewWarm: false,
          retryPreflight: stopped,
          latestAttemptAt: null,
          latestAttemptReason: null,
          latestAttemptTargetLocale: "zh-Hant",
          failureMetadataVersion: liveVersion,
        },
      ],
      blocked: [],
      byFamilyReady: {},
      byLocaleReady: {},
    });
    assert.equal(schedule.length, 0);

    const thirdPass = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      targetLocales: ["zh-Hant"],
      maxPresentations: 5,
    });
    assert.equal(provider.callCount, 0);
    assert.equal(thirdPass.presentationsScheduled, 0);
  });

  it("treats a new source version as eligible after the old version is exhausted", async () => {
    const initiative = createInitiative(sampleInitiative("next-version"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await seedFailed({
      initiativeId: initiative.initiativeId,
      sourceVersion: "v-old",
      targetLocale: "zh-Hant",
      lastError: historicalLastError({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "v-old",
        targetLocale: "zh-Hant",
      }),
    });
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "zh-Hant",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.notEqual(preflight.architectureRetryBasis, CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS);
    assert.notEqual(source.sourceVersion, "v-old");
  });
});
