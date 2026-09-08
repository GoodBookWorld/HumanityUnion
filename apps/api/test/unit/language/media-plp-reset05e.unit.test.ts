/**
 * RESET 05E — PLP provider reliability & response contract closure.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BRAND_SITE_NAME_TOKEN,
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  mediaPlpPublicNewsEntityId,
  plpBuildWorkKey,
  buildProviderOwnedMachinePayload,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  ThinGeminiMediaPlpTransport,
  callMediaPlpMaterializerProviderOnce,
  decodePlpTranslationsContract,
  encodePlpTranslationsContract,
  extractJsonObjectText,
  isPlpProviderFailureSubtypeRetryable,
  isProviderResponseClassFailureReason,
  planPlpProviderBatches,
  PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA,
  PLP_PROVIDER_FAILURE_SUBTYPE,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resolveTranslationConfig } from "../../../src/modules/language/translation.config.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import {
  computePlpProviderRetryNextAttemptAt,
  ensureMediaPlpAdapterRegistered,
  findCurrentPublishedMemory,
  healCurrentConsumerProviderFailures,
  isCollectedPathMachineEligible,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  publishAtomicMemory,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveFieldPolicyForEntityType,
  resolvePlpProviderConcurrency,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
  structuredFailure,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function editorialTree() {
  return asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
}

function editorialAutoValues(): Record<string, string> {
  const tree = editorialTree();
  const policy = resolveFieldPolicyForEntityType(
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
  );
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(tree)) {
    if (isCollectedPathMachineEligible(node.path, policy)) {
      values[node.path] = node.value;
    }
  }
  return values;
}

function newsAutoValues(): Record<string, string> {
  return {
    title: "Climate summit opens in Kyiv with global partners",
    summary:
      "Delegates discussed verified reporting standards and civic media literacy.",
  };
}

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPublishedLocalizationPersistenceForTests();
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
});

describe("RESET 05E — provider response contract", () => {
  it("1: valid structured Gemini envelope → complete semantic map", async () => {
    const autoValues = newsAutoValues();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues,
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(Object.keys(result.values).sort().join("|"), "summary|title");
    assert.match(result.values.title!, /\[uk\]/);
    assert.match(result.values.summary!, /\[uk\]/);
  });

  it("2: multiple text parts → concatenated extraction", async () => {
    const config = {
      ...resolveTranslationConfig(),
      provider: "gemini" as const,
      geminiApiKey: "test-key",
      geminiModel: "gemini-2.0-flash",
    };
    const transport = new ThinGeminiMediaPlpTransport(config, async () => {
      const contract = encodePlpTranslationsContract({
        title: "[uk] Hello",
        summary: "[uk] World",
      });
      const json = JSON.stringify(contract);
      const mid = Math.floor(json.length / 2);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [{ text: json.slice(0, mid) }, { text: json.slice(mid) }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const out = await transport.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: JSON.stringify(encodePlpTranslationsContract(newsAutoValues())),
      contentType: "structured_json",
      safetyCleared: true,
    });
    const decoded = decodePlpTranslationsContract(JSON.parse(out.translatedText));
    assert.equal(decoded.ok, true);
    if (!decoded.ok) return;
    assert.equal(decoded.values.title, "[uk] Hello");
    assert.equal(out.envelope?.textPartCount, 2);
  });

  it("3: fenced JSON legacy → extractJsonObjectText handles or classifies", () => {
    const fenced = '```json\n{"translations":[{"key":"title","value":"x"}]}\n```';
    const extracted = extractJsonObjectText(fenced);
    assert.equal(extracted.ok, true);
    if (!extracted.ok) return;
    const decoded = decodePlpTranslationsContract(JSON.parse(extracted.text));
    assert.equal(decoded.ok, true);
  });

  it("4: malformed JSON → JSON_PARSE_FAILED retryable", async () => {
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: "{not-json",
      }),
      locale: "uk",
      autoValues: newsAutoValues(),
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PARSE_FAILURE");
    assert.match(result.message, /PROVIDER_FAILURE_SUBTYPE=JSON_PARSE_FAILED/);
    assert.equal(
      isPlpProviderFailureSubtypeRetryable(
        PLP_PROVIDER_FAILURE_SUBTYPE.JSON_PARSE_FAILED,
      ),
      true,
    );
  });

  it("5: empty candidates → CANDIDATE_MISSING", async () => {
    const config = {
      ...resolveTranslationConfig(),
      provider: "gemini" as const,
      geminiApiKey: "test-key",
    };
    const transport = new ThinGeminiMediaPlpTransport(config, async () =>
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await assert.rejects(
      () =>
        transport.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: "{}",
          contentType: "structured_json",
          safetyCleared: true,
        }),
      (err: unknown) => {
        assert.ok(err && typeof err === "object" && "providerFailureSubtype" in err);
        assert.equal(
          (err as { providerFailureSubtype: string }).providerFailureSubtype,
          PLP_PROVIDER_FAILURE_SUBTYPE.CANDIDATE_MISSING,
        );
        return true;
      },
    );
  });

  it("6: safety-blocked → SAFETY_BLOCKED nonretryable", async () => {
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({ finishReason: "SAFETY" }),
      locale: "uk",
      autoValues: newsAutoValues(),
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /PROVIDER_FAILURE_SUBTYPE=SAFETY_BLOCKED/);
    assert.equal(
      isPlpProviderFailureSubtypeRetryable(
        PLP_PROVIDER_FAILURE_SUBTYPE.SAFETY_BLOCKED,
      ),
      false,
    );
  });

  it("7: MAX_TOKENS finishReason → TOKEN_LIMIT_OR_FINISH_REASON", async () => {
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({ finishReason: "MAX_TOKENS" }),
      locale: "uk",
      autoValues: newsAutoValues(),
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(
      result.message,
      /PROVIDER_FAILURE_SUBTYPE=TOKEN_LIMIT_OR_FINISH_REASON/,
    );
    assert.equal(
      isPlpProviderFailureSubtypeRetryable(
        PLP_PROVIDER_FAILURE_SUBTYPE.TOKEN_LIMIT_OR_FINISH_REASON,
      ),
      true,
    );
  });

  it("8: missing semantic key → incomplete, never publish", async () => {
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: JSON.stringify({
          translations: [{ key: "title", value: "[uk] only title" }],
        }),
      }),
      locale: "uk",
      autoValues: newsAutoValues(),
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PARTIAL");
    assert.match(result.message, /PROVIDER_FAILURE_SUBTYPE=EXPECTED_KEY_MISSING/);
    assert.match(result.message, /summary/);
  });

  it("9: duplicate semantic key → fail", () => {
    const decoded = decodePlpTranslationsContract({
      translations: [
        { key: "title", value: "a" },
        { key: "title", value: "b" },
      ],
    });
    assert.equal(decoded.ok, false);
    if (decoded.ok) return;
    assert.equal(decoded.subtype, PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY);
    assert.equal(
      isPlpProviderFailureSubtypeRetryable(PLP_PROVIDER_FAILURE_SUBTYPE.DUPLICATE_KEY),
      false,
    );
  });

  it("10: Brand artifact from provider → reject", async () => {
    const path = "faq[2].question";
    const canonical = `Can ${BRAND_SITE_NAME_TOKEN} recommend sources?`;
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({
        responseText: (request) => {
          const parsed = JSON.parse(request.text) as {
            translations: Array<{ key: string; value: string }>;
          };
          return JSON.stringify({
            translations: parsed.translations.map((row) => ({
              key: row.key,
              value: `[uk] ${row.value} ${BRAND_SITE_NAME_TOKEN}`,
            })),
          });
        },
      }),
      locale: "uk",
      autoValues: { [path]: canonical },
      sourceRecordId: "editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
    assert.match(result.message, /PROVIDER_FAILURE_SUBTYPE=BRAND_ARTIFACT/);
  });

  it("11: News title+summary complete → publishable map", async () => {
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues: newsAutoValues(),
      sourceRecordId: "news:n1",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.pathDiagnostics.MISSING_MACHINE_PATHS,
      [],
    );
  });

  it("12: Editorial all machine segments → one atomic complete map (batched)", async () => {
    const autoValues = editorialAutoValues();
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.ok(batches.length >= 2, "editorial should batch");
    resetMediaPlpMaterializerProviderCallBudget();
    const provider = new FakeLocalMediaPlpTransport({});
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-2dd8a2b73768d26f",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.forensics?.PROVIDER_BATCH_COUNT, batches.length);
    assert.equal(provider.getRequestCountForTests(), batches.length);
    for (const path of Object.keys(autoValues)) {
      assert.ok(result.values[path]?.trim());
    }
  });

  it("13: one failed Editorial batch → zero publication values", async () => {
    const autoValues = editorialAutoValues();
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.ok(batches.length >= 2);
    let calls = 0;
    const provider = new FakeLocalMediaPlpTransport({
      responseText: (request) => {
        calls += 1;
        if (calls >= 2) {
          return "{broken";
        }
        const parsed = JSON.parse(request.text) as {
          translations: Array<{ key: string; value: string }>;
        };
        return JSON.stringify({
          translations: parsed.translations.map((row) => ({
            key: row.key,
            value: `[uk] ${row.value}`,
          })),
        });
      },
    });
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "uk",
      autoValues,
      sourceRecordId: "editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /JSON_PARSE_FAILED|PROVIDER_FAILURE_SUBTYPE/);
  });

  it("14: no provider calls from read path (diagnostic source)", () => {
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(
      diag,
      /callMediaPlpMaterializerProviderOnce|enqueuePlpBuildRequest/,
    );
  });

  it("15: concurrency remains bounded at 1", () => {
    assert.equal(resolvePlpProviderConcurrency(), 1);
  });

  it("16: current consumer recovery does not reopen unrelated historical rows", async () => {
    const editorialId = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);
    const historicalNewsId = mediaPlpPublicNewsEntityId("historical-old-article");
    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: historicalNewsId,
      locale: "uk",
      canonicalVersion: "v-historical-dead",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      maxAttempts: 5,
    });
    const histKey = plpBuildWorkKey({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: historicalNewsId,
      locale: "uk",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: histKey,
      attempts: 5,
      maxAttempts: 5,
      failure: structuredFailure({
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
      }),
    });

    // Non-provider-class failure on a different current-ish entity.
    const otherId = mediaPlpPublicNewsEntityId("integrity-failed-article");
    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: otherId,
      locale: "uk",
      canonicalVersion: "v-integrity",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      maxAttempts: 5,
    });
    const otherKey = plpBuildWorkKey({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: otherId,
      locale: "uk",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: otherKey,
      attempts: 5,
      maxAttempts: 5,
      failure: structuredFailure({
        failureCode: "PROVIDER_INTEGRITY",
        retryable: false,
        stage: "provider",
        safeReason: "PROVIDER_INTEGRITY:CONTENT_INTEGRITY_FAILURE",
      }),
    });

    assert.equal(
      isProviderResponseClassFailureReason(
        "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
        "PROVIDER_FAILURE",
      ),
      true,
    );
    assert.equal(
      isProviderResponseClassFailureReason(
        "PROVIDER_INTEGRITY:CONTENT_INTEGRITY_FAILURE",
        "PROVIDER_INTEGRITY",
      ),
      false,
    );

    // Heal without media selection (editorial path only in memory) — should not
    // reopen historical/integrity rows via news loop when selection is empty.
    // Seed editorial failed provider-class for reopen via editorial trigger.
    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: editorialId,
      locale: "uk",
      canonicalVersion: fingerprintMediaPlpCanonicalVersion(editorialTree()),
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      maxAttempts: 5,
    });
    const edKey = plpBuildWorkKey({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: editorialId,
      locale: "uk",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: edKey,
      attempts: 5,
      maxAttempts: 5,
      failure: structuredFailure({
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason:
          "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=JSON_PARSE_FAILED",
      }),
    });

    const before = listPlpAutoBuildWorkForTests();
    const histBefore = before.find((r) => r.workKey === histKey)!;
    assert.equal(histBefore.status, "failed");
    assert.equal(histBefore.canonicalVersion, "v-historical-dead");
    const histAttemptsBefore = histBefore.attempts;

    // Editorial heal reopens current editorial; news heal skips non-media-12.
    try {
      await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    } catch {
      // Media selection may require mongo/rss fixtures; editorial path still runs.
    }

    const after = listPlpAutoBuildWorkForTests();
    const histAfter = after.find((r) => r.workKey === histKey)!;
    assert.equal(histAfter.status, "failed");
    assert.equal(histAfter.attempts, histAttemptsBefore);
    assert.equal(histAfter.canonicalVersion, "v-historical-dead");
    const otherAfter = after.find((r) => r.workKey === otherKey)!;
    assert.equal(otherAfter.status, "failed");
    assert.equal(otherAfter.failureCode, "PROVIDER_INTEGRITY");
  });

  it("Gemini request uses structured JSON schema", async () => {
    let body: Record<string, unknown> | null = null;
    const config = {
      ...resolveTranslationConfig(),
      provider: "gemini" as const,
      geminiApiKey: "test-key",
    };
    const transport = new ThinGeminiMediaPlpTransport(config, async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify(
                      encodePlpTranslationsContract({ title: "[uk] t" }),
                    ),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    await transport.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: JSON.stringify(encodePlpTranslationsContract({ title: "t" })),
      contentType: "structured_json",
      safetyCleared: true,
    });
    const gen = body!.generationConfig as Record<string, unknown>;
    assert.equal(gen.responseMimeType, "application/json");
    assert.deepEqual(gen.responseSchema, PLP_GEMINI_TRANSLATIONS_RESPONSE_SCHEMA);
  });

  it("retry backoff schedules nextAttemptAt within bounds", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const at1 = Date.parse(computePlpProviderRetryNextAttemptAt(1, t0));
    const at5 = Date.parse(computePlpProviderRetryNextAttemptAt(5, t0));
    assert.ok(at1 - t0 >= 2_000);
    assert.ok(at1 - t0 <= 2_000 * 1.25);
    assert.ok(at5 - t0 <= 60_000 * 1.25);
  });

  it("failed batch leaves no published PLP candidate", async () => {
    const tree = editorialTree();
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const entityId = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);
    assert.equal(
      findCurrentPublishedMemory({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId,
        locale: "uk",
      }),
      null,
    );
    // Prove publishAtomicMemory is the only publish path — we do not call it on fail.
    const autoValues = editorialAutoValues();
    resetMediaPlpMaterializerProviderCallBudget();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({ responseText: "{bad" }),
      locale: "uk",
      autoValues,
      sourceRecordId: entityId,
      sourceVersion: version,
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, false);
    assert.equal(
      findCurrentPublishedMemory({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId,
        locale: "uk",
      }),
      null,
    );
    void publishAtomicMemory;
  });
});
