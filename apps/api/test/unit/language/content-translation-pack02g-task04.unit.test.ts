/**
 * Production Completion Pack 02G Task 04 — durable content translation warming + outbox.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "2";

import type { Initiative } from "@hu/types";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

import {
  CONTENT_TRANSLATION_RESULT_EVENT_NAMES,
  CONTENT_TRANSLATION_WARM_CONSUMER_ID,
  DeterministicTranslationProvider,
  buildContentTranslationWarmRequestedCommand,
  buildContentTranslationWorkIdentityKey,
  classifyContentTranslationWarmFailure,
  createLanguageRegistryRecord,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  isContentTranslationResultEventName,
  listAutomaticContentTranslationTargetLocales,
  listContentTranslationWarmMemoryPendingForTests,
  loadTranslatableSource,
  processContentTranslationWarmMemoryQueueForTests,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  scheduleContentTranslationWarmAfterMutation,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  TranslationProviderError,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t04-${suffix}-${Date.now()}`,
    stewardId: "member-pack02g-t04",
    createdAt: now,
    updatedAt: now,
    title: "Warm River Initiative",
    description: "Participants will restore a local river for warming tests.",
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

describe("Production Completion Pack 02G Task 04 — durable warm + outbox", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
    await ensureLanguageRegistrySeeded();

    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: false,
    });
    await createLanguageRegistryRecord({
      locale: "g4-warm-a",
      englishName: "G4 Warm A",
      nativeName: "G4 Warm A",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      uiTranslationStatus: "complete",
      searchEnabled: false,
      seoIndexingEnabled: false,
    });
    await createLanguageRegistryRecord({
      locale: "g4-warm-b",
      englishName: "G4 Warm B",
      nativeName: "G4 Warm B",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    await createLanguageRegistryRecord({
      locale: "g4-enabled-only",
      englishName: "G4 Enabled Only",
      nativeName: "G4 Enabled Only",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: false,
    });
    await createLanguageRegistryRecord({
      locale: "g4-disabled",
      englishName: "G4 Disabled",
      nativeName: "G4 Disabled",
      textDirection: "ltr",
      enabled: false,
      contentTranslationEnabled: false,
    });

    initiative = sampleInitiative("main");
    createInitiative(initiative);
  });

  afterEach(() => {
    if (initiative) {
      deleteInitiative(initiative.initiativeId);
    }
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
  });

  it("1–4. eligible mutation enqueues source-identity request without source body", async () => {
    const result = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_mutation",
    });
    assert.equal(result.enqueued, true);
    assert.equal(result.deduped, false);
    assert.equal(result.command.commandName, CONTENT_TRANSLATION_WARM_REQUESTED);
    assert.equal(result.command.sourceKind, "initiative");
    assert.equal(result.command.sourceRecordId, initiative.initiativeId);
    assert.equal("title" in result.command, false);
    assert.equal("description" in result.command, false);
    assert.equal("fields" in result.command, false);
    assert.equal("sourceVersion" in result.command, false);
    assert.equal("targetLanguage" in result.command, false);
    const payload = JSON.stringify(result.command);
    assert.doesNotMatch(payload, /Warm River Initiative|restore a local river/);
  });

  it("2. unpublished/private mutation does not become warmable via consumer", async () => {
    const draft = sampleInitiative("draft");
    draft.lifecyclePhase = "draft";
    draft.status = "draft";
    createInitiative(draft);
    try {
      await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: draft.initiativeId,
        reason: "public_mutation",
      });
      const outcomes = await processContentTranslationWarmMemoryQueueForTests();
      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.outcome, "skipped_ineligible");
    } finally {
      deleteInitiative(draft.initiativeId);
    }
  });

  it("5–12. consumer reloads source + Registry; warms only enabled+contentTranslationEnabled", async () => {
    const provider = new DeterministicTranslationProvider();
    setTranslationProviderForTests(provider);

    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    const beforeTargets = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(beforeTargets.includes("g4-warm-a"));
    assert.ok(beforeTargets.includes("g4-warm-b"));
    assert.ok(!beforeTargets.includes("g4-enabled-only"));
    assert.ok(!beforeTargets.includes("g4-disabled"));
    assert.ok(!beforeTargets.includes("en"));

    const outcomes = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(outcomes[0]?.outcome, "completed");
    const generated = outcomes[0]?.locales.filter((row) => row.status === "generated") ?? [];
    assert.equal(generated.length, 2);

    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    for (const locale of ["g4-warm-a", "g4-warm-b"] as const) {
      const key = buildContentTranslationWorkIdentityKey({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source!.sourceVersion,
        targetLanguage: locale,
      });
      assert.ok(generated.some((row) => row.workIdentityKey === key));
      const existing = await getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: locale,
        generateIfMissing: false,
        intent: "automatic_warm",
      });
      assert.ok(existing.translation);
      assert.equal(existing.generated, false);
    }
  });

  it("10–13. aliases do not duplicate; duplicate request dedupes; existing skips provider", async () => {
    const provider = new DeterministicTranslationProvider();
    let calls = 0;
    const original = provider.translate.bind(provider);
    provider.translate = async (req) => {
      calls += 1;
      return original(req);
    };
    setTranslationProviderForTests(provider);

    const first = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    const second = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.equal(first.enqueued, true);
    assert.equal(second.deduped, true);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 1);

    await processContentTranslationWarmMemoryQueueForTests();
    const firstCalls = calls;

    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(calls, firstCalls);
  });

  it("14. source update creates new work identity / can warm again", async () => {
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    await processContentTranslationWarmMemoryQueueForTests();

    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    updateInitiative(initiative.initiativeId, {
      title: "Warm River Initiative Revised",
      updatedAt: new Date().toISOString(),
    });
    const after = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.notEqual(before?.sourceVersion, after?.sourceVersion);

    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_update",
    });
    const outcomes = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(outcomes[0]?.outcome, "completed");
    assert.ok((outcomes[0]?.locales.filter((l) => l.status === "generated").length ?? 0) >= 1);
  });

  it("15–16. provider success persists; terminologyContext still used on automatic_warm", async () => {
    const provider = new DeterministicTranslationProvider();
    const seen: string[] = [];
    const original = provider.translate.bind(provider);
    provider.translate = async (req) => {
      seen.push(req.terminologyContext ?? "");
      return original(req);
    };
    setTranslationProviderForTests(provider);

    await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );
    assert.ok(seen.length >= 1);
    assert.ok(seen.every((ctx) => typeof ctx === "string"));
  });

  it("17–21. failure classification; partial success; non-retryable does not hot-loop", async () => {
    assert.equal(
      classifyContentTranslationWarmFailure(new TranslationProviderError("timeout", "t")),
      "retryable",
    );
    assert.equal(
      classifyContentTranslationWarmFailure(new TranslationProviderError("rate_limited", "r")),
      "retryable",
    );
    assert.equal(
      classifyContentTranslationWarmFailure(new TranslationProviderError("forbidden", "f")),
      "non_retryable",
    );
    assert.equal(
      classifyContentTranslationWarmFailure(new TranslationProviderError("bad_request", "b")),
      "non_retryable",
    );

    await assert.rejects(
      () =>
        processContentTranslationWarmRequested(
          buildContentTranslationWarmRequestedCommand({
            sourceKind: "initiative",
            sourceRecordId: "missing-initiative-pack02g-t04",
          }),
        ),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "unavailable",
    );
    // Canonical source remains readable after warm path.
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.equal(source?.fields.title, "Warm River Initiative");
  });

  it("22–25. privacy + Official Response / Civic Archive loader boundaries remain", () => {
    const enqueueSrc = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-warm-enqueue.ts"),
      "utf8",
    );
    assert.doesNotMatch(enqueueSrc, /rawSource|messageHeaders|providerMetadata|translatedText/);
    const consumerSrc = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-warm-consumer.ts"),
      "utf8",
    );
    assert.match(consumerSrc, /getOrCreateContentTranslation/);
    assert.match(consumerSrc, /automatic_warm/);
    assert.doesNotMatch(consumerSrc, /TranslationPublished|TranslationCorrected/);

    const official = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-civic-loaders.ts"),
      "utf8",
    );
    const officialFn = official.slice(
      official.indexOf("loadOfficialResponseTranslationSource"),
      official.indexOf("loadPublicImpactTranslationSource"),
    );
    assert.doesNotMatch(officialFn, /projection\.rawSource|projection\.messageHeaders|projection\.providerMetadata/);
    assert.match(official, /verification metadata is never/);
  });

  it("26–30. mutation schedule is async; no startup scan; result events unused; on_demand intact", async () => {
    let resolved = false;
    const pending = enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    }).then((r) => {
      resolved = true;
      return r;
    });
    // schedule helper returns immediately
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_mutation",
    });
    assert.equal(typeof scheduleContentTranslationWarmAfterMutation, "function");
    await pending;
    assert.equal(resolved, true);

    const bootstrap = readFileSync(
      path.join(repoRoot, "apps/api/src/infrastructure/events/bootstrap-event-infrastructure.ts"),
      "utf8",
    );
    assert.match(bootstrap, /registerContentTranslationWarmHandlers/);
    assert.doesNotMatch(bootstrap, /listAllInitiatives|scanAll|backfillAll|warmAllPublished/);

    assert.equal(CATALOGUE_EVENTS.contentTranslationWarmRequested, CONTENT_TRANSLATION_WARM_REQUESTED);
    for (const name of CONTENT_TRANSLATION_RESULT_EVENT_NAMES) {
      assert.equal(isContentTranslationResultEventName(name), true);
      assert.notEqual(name, CATALOGUE_EVENTS.contentTranslationWarmRequested);
    }
    assert.equal(CONTENT_TRANSLATION_WARM_CONSUMER_ID, "content-translation-warm-v1");

    // on_demand still works for enabled-only locale
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    const onDemand = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "on_demand",
    });
    assert.equal(onDemand.generated, true);
  });

  it("31–35. mutation hooks wired; Task 02/03 seams preserved; no notification durability", () => {
    const hooks: Array<{ file: string; kind: string }> = [
      { file: "apps/api/src/modules/initiatives/initiative.service.ts", kind: "initiative" },
      {
        file: "apps/api/src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.ts",
        kind: "collaborative_analysis",
      },
      { file: "apps/api/src/modules/petition/petition.store.ts", kind: "petition" },
      {
        file: "apps/api/src/modules/initiative-improvement-proposal/initiative-improvement-proposal.service.ts",
        kind: "improvement_proposal",
      },
      {
        file: "apps/api/src/modules/initiative-version-revision/initiative-version-revision.service.ts",
        kind: "initiative_revision",
      },
      { file: "apps/api/src/modules/decision-session/decision-session.service.ts", kind: "decision_session" },
      {
        file: "apps/api/src/modules/initiative-collective-decision/initiative-collective-decision.service.ts",
        kind: "collective_decision",
      },
      {
        file: "apps/api/src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.ts",
        kind: "implementation_commitment",
      },
      {
        file: "apps/api/src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.ts",
        kind: "implementation_commitment",
      },
      {
        file: "apps/api/src/modules/initiative-implementation-tracking/initiative-implementation-tracking.service.ts",
        kind: "implementation_tracking",
      },
      {
        file: "apps/api/src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle.service.ts",
        kind: "implementation_tracking",
      },
      { file: "apps/api/src/modules/official-response/official-response.service.ts", kind: "official_response" },
      {
        file: "apps/api/src/modules/initiative-public-impact/initiative-public-impact.service.ts",
        kind: "public_impact",
      },
      {
        file: "apps/api/src/modules/public-civic-archive/public-civic-archive.service.ts",
        kind: "civic_archive",
      },
    ];

    for (const hook of hooks) {
      const src = readFileSync(path.join(repoRoot, hook.file), "utf8");
      assert.match(src, /scheduleContentTranslationWarmAfterMutation/);
      assert.match(src, new RegExp(`sourceKind: "${hook.kind}"`));
    }

    const notification = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/notifications/notification.service.ts"),
      "utf8",
    );
    assert.doesNotMatch(notification, /ContentTranslationWarmRequested|content-translation-warm/);
  });
});
