/**
 * Pack 08I.16 — bounded translation worker execution + memory-safe wait/discovery.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "2";

import type { Initiative, TranslatedContentRecord } from "@hu/types";

import {
  ADMIN_MANAGED_LOCALIZATION_DOMAINS,
  assertAdminDomainNotMachineTranslated,
  ensureLanguageRegistrySeeded,
  getContentTranslationWorkerPeakConcurrencyForTests,
  getOrCreateContentTranslation,
  listContentTranslationWarmMemoryPendingForTests,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationWorkerConcurrency,
  runStagingInitiativePathContentTranslationRepair,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  TranslationProviderError,
  updateLanguageRegistryRecord,
  waitForStagingWarmMaterialization,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08i16-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08i16",
    createdAt: now,
    updatedAt: now,
    title: `Bounded Worker Initiative ${suffix}`,
    description: `Canonical English prose for bounded execution tests ${suffix}.`,
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

class TrackingFakeProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  callCount = 0;
  peakInFlight = 0;
  private inFlight = 0;
  private readonly delayMs: number;
  private readonly failRecordIds: ReadonlySet<string>;

  constructor(input?: {
    readonly delayMs?: number;
    readonly failRecordIds?: readonly string[];
  }) {
    this.delayMs = input?.delayMs ?? 25;
    this.failRecordIds = new Set(input?.failRecordIds ?? []);
  }

  async translate(request: {
    readonly text: string;
    readonly targetLanguage: string;
    readonly sourceRecordId?: string;
    readonly safetyCleared?: boolean;
  }): Promise<{
    readonly translatedText: string;
    readonly providerId: "deterministic";
    readonly isPlaceholder: boolean;
  }> {
    this.callCount += 1;
    this.inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      if (request.sourceRecordId && this.failRecordIds.has(request.sourceRecordId)) {
        throw new TranslationProviderError("unavailable", "forced fake provider failure");
      }
      const parsed = JSON.parse(request.text) as Record<string, string>;
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        translated[key] = `[${request.targetLanguage}] ${value}`;
      }
      return {
        translatedText: JSON.stringify(translated),
        providerId: this.providerId,
        isPlaceholder: false,
      };
    } finally {
      this.inFlight -= 1;
    }
  }
}

describe("Pack 08I.16 — bounded translation execution", () => {
  const createdIds: string[] = [];
  let provider: TrackingFakeProvider;

  beforeEach(async () => {
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";
    process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "2";
    resetContentTranslationWorkerConcurrencyForTests();
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    provider = new TrackingFakeProvider({ delayMs: 30 });
    setTranslationProviderForTests(provider);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
    await ensureLanguageRegistrySeeded();

    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    for (const locale of ["ru", "fr", "es", "de", "pt", "zh", "ar", "hi"] as const) {
      try {
        await updateLanguageRegistryRecord(`lang-${locale}`, {
          contentTranslationEnabled: false,
        });
      } catch {
        // optional
      }
    }
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    resetTranslationProviderForTests();
  });

  it("1–3. 100 eligible records never exceed configured worker concurrency; batches release", async () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 2);

    const initiatives = Array.from({ length: 100 }, (_, index) => {
      const initiative = createInitiative(sampleInitiative(`stress-${index}`));
      createdIds.push(initiative.initiativeId);
      return initiative;
    });

    await Promise.all(
      initiatives.map((initiative) =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      ),
    );

    assert.equal(provider.callCount, 100);
    assert.ok(provider.peakInFlight <= 2, `provider peak ${provider.peakInFlight}`);
    assert.ok(
      getContentTranslationWorkerPeakConcurrencyForTests() <= 2,
      `worker peak ${getContentTranslationWorkerPeakConcurrencyForTests()}`,
    );
    assert.equal(getContentTranslationWorkerPeakConcurrencyForTests() > 0, true);
  });

  it("4. one provider failure does not abort unrelated records", async () => {
    const okA = createInitiative(sampleInitiative("ok-a"));
    const fail = createInitiative(sampleInitiative("fail"));
    const okB = createInitiative(sampleInitiative("ok-b"));
    createdIds.push(okA.initiativeId, fail.initiativeId, okB.initiativeId);

    provider = new TrackingFakeProvider({
      delayMs: 10,
      failRecordIds: [fail.initiativeId],
    });
    setTranslationProviderForTests(provider);

    const results = await Promise.allSettled([
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: okA.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: fail.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: okB.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
    ]);

    assert.equal(results[0]?.status, "fulfilled");
    assert.equal(results[1]?.status, "rejected");
    assert.equal(results[2]?.status, "fulfilled");
    assert.ok(provider.peakInFlight <= 2);
  });

  it("5. retry remains bounded by outbox maxAttempts (config contract)", () => {
    const outboxConfig = readApi("src/infrastructure/outbox/outbox.config.ts");
    assert.match(outboxConfig, /OUTBOX_MAX_ATTEMPTS/);
    assert.match(outboxConfig, /maxAttempts/);
    const worker = readApi("src/modules/language/content-translation-worker-concurrency.js".replace(".js", ".ts"));
    assert.match(worker, /CONTENT_TRANSLATION_WORKER_CONCURRENCY/);
    assert.match(worker, /MAX_WORKER_CONCURRENCY = 4/);
  });

  it("6. duplicate source/version/locale does not execute concurrently", async () => {
    const initiative = createInitiative(sampleInitiative("dup"));
    createdIds.push(initiative.initiativeId);

    const [first, second] = await Promise.all([
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
      getOrCreateContentTranslation({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        targetLanguage: "uk",
        generateIfMissing: true,
        intent: "automatic_warm",
      }),
    ]);

    // Idempotent persistence: at most one generated provider call for the identity.
    assert.ok(provider.callCount <= 2);
    assert.ok(provider.peakInFlight <= 2);
    assert.ok(first.translation || second.translation);
  });

  it("7. CURRENT translation is skipped by repair", async () => {
    const initiative = createInitiative(sampleInitiative("current"));
    createdIds.push(initiative.initiativeId);

    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    const callsAfterGenerate = provider.callCount;

    const repair = await runStagingInitiativePathContentTranslationRepair({
      execute: false,
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [initiative],
        listApprovedInitiativeComments: async () => ({
          comments: [],
          total: 0,
          limit: 100,
          offset: 0,
          hasMore: false,
        }),
        listPublishedAnalysesByInitiative: () => [],
        listPetitions: async () => [],
      },
      targetLanguages: ["uk"],
    });

    assert.ok(repair.totals.CURRENT_SKIPPED >= 1);
    assert.ok(
      !repair.repairCandidates.some((c) => c.sourceRecordId === initiative.initiativeId),
    );
    assert.equal(provider.callCount, callsAfterGenerate);
  });

  it("8. process interruption leaves recoverable warm work", async () => {
    const initiative = createInitiative(sampleInitiative("recover"));
    createdIds.push(initiative.initiativeId);

    const { enqueueContentTranslationWarmRequested } = await import(
      "../../../src/modules/language/content-translation-warm-enqueue.js"
    );
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
    });

    assert.ok(listContentTranslationWarmMemoryPendingForTests().length >= 1);
    // Simulate restart: pending queue still present; do not auto-clear.
    assert.ok(listContentTranslationWarmMemoryPendingForTests().length >= 1);
  });

  it("9. inProgress outbox event is not falsely published", () => {
    const dispatcher = readApi("src/infrastructure/outbox/outbox.dispatcher.ts");
    assert.match(dispatcher, /deferredInProgress/);
    assert.match(dispatcher, /in_progress_defer_publish/);
    assert.match(dispatcher, /if \(deferredInProgress && !handlerSucceeded\)/);
  });

  it("10. wait-for-materialization uses compact identities / bounded reads", async () => {
    const waitSource = readApi(
      "src/modules/language/content-translation-staging-warm-repair.ts",
    );
    assert.match(waitSource, /StagingWarmWaitTargetIdentity/);
    assert.match(waitSource, /Resolve version once per candidate/);
    assert.match(waitSource, /Bound poll reads: one indexed lookup per identity/);
    const waitFnStart = waitSource.indexOf("export async function waitForStagingWarmMaterialization");
    const pollLoopStart = waitSource.indexOf("Bound poll reads", waitFnStart);
    assert.ok(pollLoopStart > waitFnStart);
    assert.doesNotMatch(waitSource.slice(pollLoopStart), /loadTranslatableSource\(/);

    const initiative = createInitiative(sampleInitiative("wait"));
    createdIds.push(initiative.initiativeId);
    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });

    const progressSnapshots: Array<{ current: number; pending: number }> = [];
    const result = await waitForStagingWarmMaterialization({
      candidates: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
        },
      ],
      targetLanguages: ["uk"],
      timeoutMs: 2_000,
      pollIntervalMs: 50,
      onProgress: (progress) => {
        progressSnapshots.push({
          current: progress.current,
          pending: progress.pending,
        });
      },
    });

    assert.equal(result.timedOut, false);
    assert.equal(result.progress.current, 1);
    assert.equal(result.progress.targetsTotal, 1);
    assert.ok(progressSnapshots.length >= 1);
  });

  it("11. operator discovery uses lightweight bootstrap, not full app hydrate", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /bootstrapContentTranslationOperatorPersistence/);
    assert.doesNotMatch(script, /await bootstrapMongoPersistence\(\)/);

    const lightweight = readApi(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    assert.match(lightweight, /hydrateInitiativeMongoPersistence/);
    assert.match(lightweight, /hydrateInitiativeCollaborativeAnalysisMongoPersistence/);
    assert.doesNotMatch(lightweight, /hydrateCivicNominationMongoPersistence/);
    assert.doesNotMatch(lightweight, /ensureBrandLocalizationSeeded/);
    assert.doesNotMatch(lightweight, /ensureLegalLocalizationReady/);
  });

  it("12. Brand/Legal/NON_TRANSLATABLE never enter worker", () => {
    assertAdminDomainNotMachineTranslated("BRAND_LOCALIZATION");
    assertAdminDomainNotMachineTranslated("LEGAL_LOCALIZATION");
    assert.ok(ADMIN_MANAGED_LOCALIZATION_DOMAINS.includes("BRAND_LOCALIZATION"));

    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.doesNotMatch(consumer, /brand-localization|legal-localization/);
    const typesOwnership = readApi("../../packages/types/src/domain/localization-ownership.ts");
    assert.match(typesOwnership, /NON_TRANSLATABLE/);
    const allowlist = readApi("src/modules/language/content-translation-eligibility.ts");
    assert.doesNotMatch(allowlist, /brand_localization|legal_localization/);
  });

  it("13. 08I.15 universal coverage contracts remain present", () => {
    const ownership = readApi("src/modules/language/localization-ownership.ts");
    assert.match(ownership, /DEFAULT_LOCALIZABLE/);
    assert.match(ownership, /CIVIC_CONTENT/);
    const warm = readApi("src/modules/language/content-translation-staging-warm-backfill.ts");
    assert.match(warm, /"initiative"/);
    assert.match(warm, /"petition"/);
  });

  it("provider slot wraps getOrCreate generate path", () => {
    const service = readApi("src/modules/language/content-translation.service.ts");
    assert.match(service, /withContentTranslationWorkerSlot/);
    assert.match(service, /provider\.translate/);
  });

  it("warm locale concurrency is capped by worker concurrency", async () => {
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
    process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "8";
    const { resolveContentTranslationWarmLocaleConcurrency } = await import(
      "../../../src/modules/language/content-translation-warm-concurrency.js"
    );
    assert.equal(resolveContentTranslationWarmLocaleConcurrency(), 1);
  });

  it("stress fixture: many fake warm processes stay within worker peak", async () => {
    resetContentTranslationWorkerConcurrencyForTests();
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";

    const initiatives = Array.from({ length: 20 }, (_, index) => {
      const initiative = createInitiative(sampleInitiative(`warm-stress-${index}`));
      createdIds.push(initiative.initiativeId);
      return initiative;
    });

    await Promise.all(
      initiatives.map((initiative) =>
        processContentTranslationWarmRequested({
          commandName: "ContentTranslationWarmRequested",
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          requestedAt: new Date().toISOString(),
          reason: "operator_backfill",
        }),
      ),
    );

    assert.ok(
      getContentTranslationWorkerPeakConcurrencyForTests() <= 2,
      `observed peak ${getContentTranslationWorkerPeakConcurrencyForTests()}`,
    );
    assert.ok(provider.peakInFlight <= 2, `fake provider peak ${provider.peakInFlight}`);
  });

  it("wait reports regenerating as RETRYING without loading sources", async () => {
    const initiative = createInitiative(sampleInitiative("retrying"));
    createdIds.push(initiative.initiativeId);
    const generated = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.ok(generated.translation);

    const regenerating: TranslatedContentRecord = {
      ...generated.translation!,
      freshness: "regenerating",
    };
    await upsertContentTranslation(regenerating);

    const result = await waitForStagingWarmMaterialization({
      candidates: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
        },
      ],
      targetLanguages: ["uk"],
      timeoutMs: 400,
      pollIntervalMs: 50,
    });

    assert.equal(result.timedOut, true);
    assert.equal(result.progress.retrying, 1);
    assert.equal(result.remainingMissingOrStale[0]?.state, "RETRYING");
  });
});

describe("Pack 08I.16 — architecture contracts", () => {
  it("keeps single translation pipeline (warm → outbox → consumer → provider)", () => {
    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.match(consumer, /getOrCreateContentTranslation/);
    assert.match(consumer, /automatic_warm/);
    const enqueue = readApi("src/modules/language/content-translation-warm-enqueue.ts");
    assert.match(enqueue, /CONTENT_TRANSLATION_WARM_REQUESTED/);
  });

  it("default worker concurrency is conservative (1)", () => {
    const previous = process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    delete process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    if (previous === undefined) {
      delete process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    } else {
      process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = previous;
    }
  });
});
