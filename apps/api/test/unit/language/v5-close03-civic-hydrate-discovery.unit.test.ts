/**
 * V5.CLOSE.03 — decision session, implementation commitment, and implementation
 * tracking maps are captured before Mongo hydrate. Post-hydrate sync must
 * rebind them so boot reconciliation can see durable public rows.
 * No provider calls and no Mongo writes.
 */
import "./v5-close03-civic-hydrate-env.ts";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  DecisionSession,
  Initiative,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  LanguageHistoricalBackfillPlan,
  TranslatedContentRecord,
} from "@hu/types";

import { installHydratedDecisionSessionSnapshotForTests } from "../../../src/modules/decision-session/persistence/decision-session-mongo.persistence.js";
import { createMongoDecisionSessionPersistenceAdapter } from "../../../src/modules/decision-session/persistence/decision-session-mongo.persistence.js";
import {
  listPublicSessionsByInitiative,
  listSessions,
  syncDecisionSessionStoreAfterMongoHydrate,
} from "../../../src/modules/decision-session/decision-session.store.js";
import { installHydratedImplementationCommitmentSnapshotForTests } from "../../../src/modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js";
import { createMongoInitiativeImplementationCommitmentPersistenceAdapter } from "../../../src/modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js";
import {
  listPublicCommitmentsByInitiative,
  listCommitments,
  syncInitiativeImplementationCommitmentStoreAfterMongoHydrate,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { installHydratedImplementationTrackingSnapshotForTests } from "../../../src/modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js";
import { createMongoInitiativeImplementationTrackingPersistenceAdapter } from "../../../src/modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js";
import {
  listPublicTrackingsByInitiative,
  listTrackings,
  syncInitiativeImplementationTrackingStoreAfterMongoHydrate,
} from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { discoverStagingInitiativePathWarmSources } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import { measureLiveActivationCtCoverage } from "../../../src/modules/language/live-residual-ct-coverage.js";
import {
  resetLocalizationReconciliationDriverForTests,
  runLocalizationReconciliationPass,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import { assessWebUiCatalogReadinessForLocale } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { planLanguageHistoricalBackfill } from "../../../src/modules/language/language-localization-activation/language-historical-backfill-planner.js";
import {
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import { setTranslationProviderForTests } from "../../../src/modules/language/resolve-translation-provider.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { findContentTranslationMemory } from "../../../src/modules/language/persistence/content-translation.memory.store.js";
import { resetContentTranslationMemoryStoreForTests } from "../../../src/modules/language/persistence/content-translation.memory.store.js";
import { runPublicLocalizationResidualRetry } from "../../../src/modules/language/public-localization-residual-retry.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../../..");
const INITIATIVE_ID = "initiative-v5close03";
const CURRENT_SESSION_ID = "decision-session-v5close03-current";
const HISTORICAL_KINDS = [
  "decision_session",
  "implementation_commitment",
  "implementation_tracking",
] as const;

const HISTORICAL_IDS = {
  decision_session: ["decision-session-v5close03-1"],
  implementation_commitment: [
    "implementation-commitment-v5close03-0",
    "implementation-commitment-v5close03-1",
    "implementation-commitment-v5close03-2",
  ],
  implementation_tracking: [
    "implementation-tracking-v5close03-0",
    "implementation-tracking-v5close03-1",
    "implementation-tracking-v5close03-2",
  ],
} as const;

function read(relativePath: string): string {
  return readFileSync(path.join(repo, relativePath), "utf8");
}

function syncAll(): void {
  syncDecisionSessionStoreAfterMongoHydrate();
  syncInitiativeImplementationCommitmentStoreAfterMongoHydrate();
  syncInitiativeImplementationTrackingStoreAfterMongoHydrate();
}

function initiative(): Initiative {
  const now = "2026-08-18T02:49:53.864Z";
  return {
    initiativeId: INITIATIVE_ID,
    stewardId: "member-v5close03",
    createdAt: now,
    updatedAt: "2026-08-19T00:26:18.039Z",
    title: "Fixture",
    description: "Fixture",
    status: "proposal",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Environment",
      communitySlug: "fixture-community",
      category: "Environment",
    },
    contributions: [],
    timeline: [],
  } as Initiative;
}

function session(sessionId: string): DecisionSession {
  return {
    sessionId,
    initiativeId: INITIATIVE_ID,
    stewardId: "member-v5close03",
    title: `Session ${sessionId}`,
    purpose: `Purpose ${sessionId}`,
    decisionQuestion: `Question ${sessionId}`,
    status: "published",
    opensAt: "2026-08-19T00:26:41.935Z",
    closesAt: "2026-08-20T00:26:41.935Z",
    publishedAt: "2026-08-19T00:26:41.984Z",
    createdAt: "2026-08-19T00:26:41.935Z",
    updatedAt: "2026-08-19T00:26:42.032Z",
    initiativeVersion: 1,
    structuredContent: null,
    packageReferences: {
      revisionIds: [],
      analysisIds: [],
      proposalIds: [],
      petitionId: null,
    },
  } as DecisionSession;
}

function commitment(commitmentId: string): InitiativeImplementationCommitment {
  const at = "2026-08-19T00:36:06.348Z";
  return {
    commitmentId,
    initiativeId: INITIATIVE_ID,
    decisionId: "collective-decision-v5close03",
    participantId: null,
    commitmentTitle: `Commitment ${commitmentId}`,
    commitmentSummary: `Summary ${commitmentId}`,
    organizationName: "Fixture org",
    commitmentScope: "local",
    status: "published",
    publishedAt: at,
    createdAt: at,
    updatedAt: at,
    packageId: "implementation-commitment-package-v5close03",
  } as InitiativeImplementationCommitment;
}

function tracking(trackingId: string): InitiativeImplementationTracking {
  const at = "2026-08-19T00:36:52.134Z";
  return {
    trackingId,
    initiativeId: INITIATIVE_ID,
    commitmentId: "",
    participantId: "member-v5close03",
    status: "active",
    currentStage: `Stage ${trackingId}`,
    summary: `Tracking ${trackingId}`,
    activatedAt: at,
    createdAt: at,
    updatedAt: at,
    packageId: "implementation-tracking-package-v5close03",
    notes: "",
    approvedAction: "",
    dependencies: [],
    obstacles: [],
    evidenceReferences: [],
  } as InitiativeImplementationTracking;
}

function installHistoricalCache(): void {
  installHydratedDecisionSessionSnapshotForTests({
    version: 1,
    sessions: {
      [HISTORICAL_IDS.decision_session[0]]: session(HISTORICAL_IDS.decision_session[0]),
    },
  });
  installHydratedImplementationCommitmentSnapshotForTests({
    version: 1,
    commitments: Object.fromEntries(
      HISTORICAL_IDS.implementation_commitment.map((id) => [id, commitment(id)]),
    ),
  });
  installHydratedImplementationTrackingSnapshotForTests({
    version: 1,
    trackings: Object.fromEntries(
      HISTORICAL_IDS.implementation_tracking.map((id) => [id, tracking(id)]),
    ),
    updates: {},
  });
}

function countSaves(adapter: { save: (snapshot: never) => void }): { readonly count: () => number } {
  let saves = 0;
  adapter.save = () => {
    saves += 1;
  };
  return { count: () => saves };
}

describe("V5.CLOSE.03 civic post-hydrate discovery", () => {
  after(() => {
    deleteInitiative(INITIATIVE_ID);
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLocalizationReconciliationDriverForTests();
    setContentTranslationWarmForceMemoryForTests(false);
  });

  it("rebinds the three stores before boot reconciliation", () => {
    const bootstrap = read("apps/api/src/infrastructure/mongodb/bootstrap-mongo-persistence.ts");
    const operator = read(
      "apps/api/src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    const index = read("apps/api/src/index.ts");
    const pairs = [
      ["hydrateDecisionSessionMongoPersistence", "syncDecisionSessionStoreAfterMongoHydrate"],
      [
        "hydrateInitiativeImplementationCommitmentMongoPersistence",
        "syncInitiativeImplementationCommitmentStoreAfterMongoHydrate",
      ],
      [
        "hydrateInitiativeImplementationTrackingMongoPersistence",
        "syncInitiativeImplementationTrackingStoreAfterMongoHydrate",
      ],
    ] as const;

    for (const [hydrateName, syncName] of pairs) {
      const hydrateAt = bootstrap.indexOf(hydrateName);
      const syncAt = bootstrap.indexOf(syncName);
      assert.ok(hydrateAt >= 0 && syncAt > hydrateAt, `${syncName} must follow hydrate`);
      assert.ok(
        operator.indexOf(hydrateName) >= 0 &&
          operator.indexOf(hydrateName) < operator.indexOf(syncName),
        `${syncName} must follow hydrate in the CT operator bootstrap`,
      );
    }

    const flushAt = bootstrap.lastIndexOf("flushInitiativeMongoPersistence();");
    const lastSyncAt = bootstrap.lastIndexOf(
      "syncInitiativeImplementationTrackingStoreAfterMongoHydrate();",
    );
    assert.ok(flushAt > lastSyncAt);
    assert.ok(
      index.indexOf("await bootstrapMongoPersistence()") <
        index.indexOf("resumeLocalizationReconciliationOnBoot"),
    );
    assert.doesNotMatch(bootstrap + operator + index, /decision-session-v5close03|1787099201935/);
    assert.match(read("apps/api/src/modules/language/localization-reconciliation-driver.ts"), /Does not consult activation\.status/);
    assert.match(
      read("apps/api/src/modules/decision-session/decision-session.service.ts"),
      /scheduleContentTranslationWarmAfterMutation\(\{[\s\S]*sourceKind: "decision_session"/,
    );
    assert.match(
      read("apps/api/src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.ts"),
      /scheduleContentTranslationWarmAfterMutation\(\{[\s\S]*sourceKind: "implementation_commitment"/,
    );
    assert.match(
      read(
        "apps/api/src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.ts",
      ),
      /sourceKind: "implementation_commitment"/,
    );
    assert.match(
      read("apps/api/src/modules/initiative-implementation-tracking/initiative-implementation-tracking.service.ts"),
      /scheduleContentTranslationWarmAfterMutation\(\{[\s\S]*sourceKind: "implementation_tracking"/,
    );
    assert.match(
      read(
        "apps/api/src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle.service.ts",
      ),
      /sourceKind: "implementation_tracking"/,
    );
  });

  it("discovers hydrated 1/3/3 rows and enqueues only missing identities", async () => {
    const sessionSaves = countSaves(createMongoDecisionSessionPersistenceAdapter());
    const commitmentSaves = countSaves(
      createMongoInitiativeImplementationCommitmentPersistenceAdapter(),
    );
    const trackingSaves = countSaves(createMongoInitiativeImplementationTrackingPersistenceAdapter());

    assert.equal(listSessions().length, 0);
    assert.equal(listCommitments().length, 0);
    assert.equal(listTrackings().length, 0);

    installHistoricalCache();
    const durableBefore = {
      sessions: createMongoDecisionSessionPersistenceAdapter().load(),
      commitments: createMongoInitiativeImplementationCommitmentPersistenceAdapter().load(),
      trackings: createMongoInitiativeImplementationTrackingPersistenceAdapter().load(),
    };

    assert.equal(listSessions().length, 0);
    assert.equal(listCommitments().length, 0);
    assert.equal(listTrackings().length, 0);
    assert.equal(Object.keys(durableBefore.sessions.sessions).length, 1);
    assert.equal(Object.keys(durableBefore.commitments.commitments).length, 3);
    assert.equal(Object.keys(durableBefore.trackings.trackings).length, 3);

    syncAll();

    assert.equal(listPublicSessionsByInitiative(INITIATIVE_ID).length, 1);
    assert.equal(listPublicCommitmentsByInitiative(INITIATIVE_ID).length, 3);
    assert.equal(listPublicTrackingsByInitiative(INITIATIVE_ID).length, 3);

    createInitiative(initiative());
    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: [...HISTORICAL_KINDS],
    });
    const idsByKind = {
      decision_session: discovered.candidates
        .filter((row) => row.sourceKind === "decision_session")
        .map((row) => row.sourceRecordId)
        .sort(),
      implementation_commitment: discovered.candidates
        .filter((row) => row.sourceKind === "implementation_commitment")
        .map((row) => row.sourceRecordId)
        .sort(),
      implementation_tracking: discovered.candidates
        .filter((row) => row.sourceKind === "implementation_tracking")
        .map((row) => row.sourceRecordId)
        .sort(),
    };
    assert.deepEqual(idsByKind.decision_session, [...HISTORICAL_IDS.decision_session]);
    assert.deepEqual(
      idsByKind.implementation_commitment,
      [...HISTORICAL_IDS.implementation_commitment].sort(),
    );
    assert.deepEqual(
      idsByKind.implementation_tracking,
      [...HISTORICAL_IDS.implementation_tracking].sort(),
    );

    syncAll();
    assert.equal(listSessions().length, 1);
    assert.equal(listCommitments().length, 3);
    assert.equal(listTrackings().length, 3);
    assert.deepEqual(createMongoDecisionSessionPersistenceAdapter().load(), durableBefore.sessions);
    assert.deepEqual(
      createMongoInitiativeImplementationCommitmentPersistenceAdapter().load(),
      durableBefore.commitments,
    );
    assert.deepEqual(
      createMongoInitiativeImplementationTrackingPersistenceAdapter().load(),
      durableBefore.trackings,
    );
    assert.equal(sessionSaves.count(), 0);
    assert.equal(commitmentSaves.count(), 0);
    assert.equal(trackingSaves.count(), 0);
    for (const id of HISTORICAL_IDS.decision_session) {
      assert.equal(
        findContentTranslationMemory({
          sourceKind: "decision_session",
          sourceRecordId: id,
          sourceVersion: "unused",
          targetLanguage: "uk",
        }),
        null,
      );
    }

    installHydratedDecisionSessionSnapshotForTests({
      version: 1,
      sessions: {
        [HISTORICAL_IDS.decision_session[0]]: session(HISTORICAL_IDS.decision_session[0]),
        [CURRENT_SESSION_ID]: session(CURRENT_SESSION_ID),
      },
    });
    syncDecisionSessionStoreAfterMongoHydrate();
    assert.equal(listPublicSessionsByInitiative(INITIATIVE_ID).length, 2);

    const currentSource = await loadTranslatableSource({
      sourceKind: "decision_session",
      sourceRecordId: CURRENT_SESSION_ID,
    });
    assert.ok(currentSource);
    const translatedContent = Object.fromEntries(
      Object.entries(currentSource.fields).map(([key, value]) => [key, `Traduccion ${value}`]),
    );
    const currentRow: TranslatedContentRecord = {
      translationId: "translation-v5close03-current",
      sourceKind: "decision_session",
      sourceRecordId: CURRENT_SESSION_ID,
      sourceVersion: currentSource.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent,
      translationProvider: "gemini",
      translationKind: "human",
      createdAt: "2026-10-01T00:00:00.000Z",
      stale: false,
      freshness: "current",
    };
    await upsertContentTranslation(currentRow);

    let providerCalls = 0;
    setLanguageRegistryForceMemoryForTests(true);
    setTranslationProviderForTests({
      providerId: "gemini",
      async translate() {
        providerCalls += 1;
        throw new Error("provider must not be called");
      },
    });
    await ensureLanguageRegistrySeeded();
    for (const row of await listLanguageRegistry()) {
      await updateLanguageRegistryRecord(row.languageId, {
        enabled: row.locale === "en" || row.locale === "uk",
        contentTranslationEnabled: row.locale === "uk",
        searchEnabled: false,
      });
    }

    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
    const pass = await runLocalizationReconciliationPass("uk", {
      resolveLocale: async () =>
        ({
          locale: "uk",
          enabled: true,
          contentTranslationEnabled: true,
        }) as Awaited<ReturnType<typeof resolveLanguageRegistryLocale>>,
      assessWebUi: async () =>
        ({
          dataReady: true,
        }) as Awaited<ReturnType<typeof assessWebUiCatalogReadinessForLocale>>,
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      planBackfill: async () =>
        ({
          items: [],
          summary: { plpWorkItems: 0 },
        }) as LanguageHistoricalBackfillPlan,
      measureCtWork: (input) =>
        measureLiveActivationCtCoverage({
          locale: input.locale,
          kinds: [...HISTORICAL_KINDS],
        }),
      runResidual: (input) =>
        runPublicLocalizationResidualRetry({
          ...input,
          kinds: [...HISTORICAL_KINDS],
        }),
      enqueuePlp: async () => undefined,
      maxPresentationsPerPass: 25,
    });

    const pendingIds = listContentTranslationWarmMemoryPendingForTests().map(
      (row) => `${row.command.sourceKind}::${row.command.sourceRecordId}`,
    );
    const expected = [
      ...HISTORICAL_IDS.decision_session.map((id) => `decision_session::${id}`),
      ...HISTORICAL_IDS.implementation_commitment.map((id) => `implementation_commitment::${id}`),
      ...HISTORICAL_IDS.implementation_tracking.map((id) => `implementation_tracking::${id}`),
    ].sort();
    assert.deepEqual([...pendingIds].sort(), expected);
    assert.equal(pendingIds.includes(`decision_session::${CURRENT_SESSION_ID}`), false);
    assert.equal(pass.presentationsScheduled, 7);
    assert.equal(providerCalls, 0);
    assert.equal(sessionSaves.count(), 0);
    assert.equal(commitmentSaves.count(), 0);
    assert.equal(trackingSaves.count(), 0);
    for (const [kind, ids] of Object.entries(HISTORICAL_IDS)) {
      for (const id of ids) {
        const source = await loadTranslatableSource({
          sourceKind: kind as "decision_session",
          sourceRecordId: id,
        });
        assert.ok(source);
        assert.equal(
          findContentTranslationMemory({
            sourceKind: source.sourceKind,
            sourceRecordId: id,
            sourceVersion: source.sourceVersion,
            targetLanguage: "uk",
          }),
          null,
        );
      }
    }
  });
});
