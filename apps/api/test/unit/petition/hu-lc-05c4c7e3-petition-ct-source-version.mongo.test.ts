/**
 * HU-LC-05C.4C.7E.3 — Petition Content Translation sourceVersion follows the
 * translatable Petition text only. Status transitions, signatures and other
 * updatedAt changes keep existing translations current (no provider re-calls).
 *
 * Real Petition store + routes over a process-owned single-node MongoMemoryReplSet
 * (one hu_test_ database, dropped afterwards); translations stay in memory.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
// Retained CT engine suite: sourceVersion / warm / presentation need CT unfrozen.
// Does not change process-wide defaults for other suites (per-file process).
process.env.CONTENT_TRANSLATION_FROZEN = "false";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c7e3-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c7e3-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as Language from "../../../src/modules/language/index.js";
import type * as Service from "../../../src/modules/language/content-translation.service.js";
import type * as Repository from "../../../src/modules/language/persistence/content-translation.repository.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_ct_ver_${RUN}`;
const LOCALE = "xx-C7E3";
const STEWARD = { userId: `user-7e3-steward-${RUN}`, memberId: `member-7e3-steward-${RUN}` };
const SIGNER = { userId: `user-7e3-signer-${RUN}`, memberId: `member-7e3-signer-${RUN}` };
const PUBLIC_INITIATIVE = `initiative-7e3-public-${RUN}`;
const HIDDEN_INITIATIVE = `initiative-7e3-hidden-${RUN}`;

const SUBJECT = {
  title: `Clean River Petition ${RUN}`,
  summary: "Restore the river banks within one year.",
  requestStatement: "Fund the river restoration plan.",
  expectedOutcome: "A restored, accessible river front.",
  supportingContext: "Water quality has declined since 2020.",
  keyArguments: ["Public health", "Biodiversity"],
};

let store: typeof PetitionStore;
let service: typeof Service;
let repository: typeof Repository;
let language: typeof Language;
let tokens: typeof AuthTokens;
let petitions: () => Collection<Document>;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let providerCalls = 0;
const seeded: string[] = [];

function initiative(initiativeId: string, visibility: "public" | "private"): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD.memberId,
    title: "7E3 Initiative",
    description: "Fixture Initiative for Petition source versions.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: visibility },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community", language: "en" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative;
}

async function seedPetition(
  suffix: string,
  initiativeId: string,
  subject: Partial<typeof SUBJECT> = {},
): Promise<string> {
  const helpers = await import("./petition-test-helpers.js");
  const petitionId = `petition-7e3-${suffix}-${RUN}`;
  const decisionId = `decision-${petitionId}`;
  await helpers.seedApprovedDecision(decisionId, initiativeId);
  const fixture = helpers.buildFixturePetition({ petitionId, decisionId, initiativeId });
  await store.createPetition({
    ...fixture,
    subject: { ...fixture.subject, ...SUBJECT, ...subject },
    policy: {
      ...fixture.policy,
      withdrawalPolicy: { ...fixture.policy.withdrawalPolicy, withdrawalPermitted: true },
    },
  });
  await store.preparePetition(petitionId);
  await store.publishPetitionForTests(petitionId);
  seeded.push(petitionId);
  return petitionId;
}

async function version(petitionId: string): Promise<string> {
  const source = await service.loadTranslatableSource({
    sourceKind: "petition",
    sourceRecordId: petitionId,
  });
  assert.ok(source, `${petitionId} should load`);
  return source.sourceVersion;
}

async function sign(petitionId: string, action: "sign" | "withdraw"): Promise<number> {
  const path =
    action === "sign"
      ? `/api/v1/petitions/${petitionId}/signatures`
      : `/api/v1/petitions/${petitionId}/signatures/withdraw`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.createAccessToken({
        sub: SIGNER.userId,
        memberId: SIGNER.memberId,
        role: "member",
        displayName: "7E3 signer",
        email: `${SIGNER.userId}@example.test`,
      })}`,
    },
    body: "{}",
  });
  return response.status;
}

async function warm(petitionId: string) {
  return language.processContentTranslationWarmRequested({
    commandName: "ContentTranslationWarmRequested",
    sourceKind: "petition",
    sourceRecordId: petitionId,
    requestedAt: new Date().toISOString(),
    reason: "public_mutation",
  });
}

describe("HU-LC-05C.4C.7E.3 — stable published Petition CT source version", () => {
  before(async () => {
    const isolation =
      await import("../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js");
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    const indexes = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    isolation.assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    isolation.lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connection.connectMongoClient();
    connected = true;
    assert.equal(database.getMongoDatabase().databaseName, DATABASE);
    await indexes.ensureMongoIndexes();
    petitions = () => database.getMongoDatabase().collection("petitions");

    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(
      async (userId: string) => ({ id: userId, userId, status: "active" }) as never,
    );
    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    initiatives.createInitiative(initiative(PUBLIC_INITIATIVE, "public"));
    initiatives.createInitiative(initiative(HIDDEN_INITIATIVE, "private"));
    const memberPersistence =
      await import("../../../src/modules/member/infrastructure/member.persistence.js");
    await database
      .getMongoDatabase()
      .collection("members")
      .insertOne(
        memberPersistence.toMemberMongoDocument(
          memberPersistence.buildNewPersistedMember({
            memberId: SIGNER.memberId,
            identityId: SIGNER.userId,
            displayName: "7E3 signer",
            uniqueName: SIGNER.memberId,
          }),
        ),
      );

    store = await import("../../../src/modules/petition/petition.store.js");
    service = await import("../../../src/modules/language/content-translation.service.js");
    repository = await import(
      "../../../src/modules/language/persistence/content-translation.repository.js"
    );
    tokens = await import("../../../src/modules/auth/auth-tokens.js");
    language = await import("../../../src/modules/language/index.js");
    (
      await import("../../../src/modules/language/localization-reconciliation-driver.js")
    ).setLocalizationReconciliationDriverDepsForTests({ listTargetLocales: async () => [] });

    language.resetTranslationProviderForTests();
    language.resetContentTranslationMemoryStoreForTests();
    language.resetContentTranslationWarmMemoryForTests();
    language.setContentTranslationWarmForceMemoryForTests(true);
    language.setLanguageRegistryForceMemoryForTests(true);
    language.setTerminologyGlossaryForceMemoryForTests(true);
    language.resetLanguageRegistryStoreForTests();
    language.resetTerminologyGlossaryStoreForTests();
    await language.ensureLanguageRegistrySeeded();
    await language.ensureTerminologyGlossarySeeded();
    await language.createLanguageRegistryRecord({
      languageId: `lang-${LOCALE.toLowerCase()}`,
      locale: LOCALE,
      englishName: "Version Synthetic",
      nativeName: "Version Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    const deterministic = new language.DeterministicTranslationProvider();
    language.setTranslationProviderForTests({
      providerId: "gemini",
      translate: async (request) => {
        providerCalls += 1;
        const result = await deterministic.translate(request);
        return {
          ...result,
          providerId: "gemini",
          isPlaceholder: false,
          translatedText: result.translatedText
            .split(`[${request.targetLanguage}] `)
            .join("Localized "),
        };
      },
    });

    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/petitions",
      (await import("../../../src/modules/petition/petition.routes.js")).default,
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    const driver = await import("../../../src/modules/language/localization-reconciliation-driver.js");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = driver.peekLocalizationReconciliationDriverStateForTests();
      if (state.inFlight.length === 0 && state.pendingWake.length === 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    driver.resetLocalizationReconciliationDriverForTests();
    if (language) {
      language.resetTranslationProviderForTests();
      language.resetContentTranslationMemoryStoreForTests();
      language.resetContentTranslationWarmMemoryForTests();
      language.setContentTranslationWarmForceMemoryForTests(false);
      language.resetTerminologyGlossaryStoreForTests();
      language.resetLanguageRegistryStoreForTests();
      language.setTerminologyGlossaryForceMemoryForTests(false);
      language.setLanguageRegistryForceMemoryForTests(false);
    }
    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(null);
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    try {
      if (connected && database.getMongoDatabase().databaseName === DATABASE) {
        await database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("A. an operational updatedAt change alone keeps the same sourceVersion", async () => {
    const id = await seedPetition("stamp", PUBLIC_INITIATIVE);
    const before = await version(id);
    await petitions().updateOne(
      { petitionId: id },
      { $set: { updatedAt: new Date(Date.now() + 86_400_000).toISOString() } },
    );
    assert.equal(await version(id), before);
  });

  it("B/I. Open → Closed → Archived keeps the version, so warm makes no new provider calls", async () => {
    const id = await seedPetition("lifecycle", PUBLIC_INITIATIVE);
    const published = await version(id);
    await store.openPetition(id);
    assert.equal(await version(id), published, "Open");

    const first = await warm(id);
    assert.equal(first.outcome, "completed", JSON.stringify(first));
    const callsAfterFirstWarm = providerCalls;
    assert.ok(callsAfterFirstWarm > 0, "the first warm translates once");

    await store.closePetition(id);
    assert.equal(await version(id), published, "Closed");
    await warm(id);
    await store.archivePetition(id);
    assert.equal(await version(id), published, "Archived");
    await warm(id);
    assert.equal(providerCalls, callsAfterFirstWarm, "status transitions must not re-translate");

    const rows = await repository.listContentTranslationsForSource({
      sourceKind: "petition",
      sourceRecordId: id,
    });
    assert.deepEqual(
      rows.map((row) => [row.sourceVersion, row.targetLanguage, row.stale]),
      [[published, LOCALE, false]],
    );
  });

  it("C. signing and withdrawing keep the same sourceVersion", async () => {
    const id = await seedPetition("signatures", PUBLIC_INITIATIVE);
    await store.openPetition(id);
    const before = await version(id);
    assert.equal(await sign(id, "sign"), 201);
    assert.equal(await version(id), before, "after signature");
    assert.equal(await sign(id, "withdraw"), 200);
    assert.equal(await version(id), before, "after withdrawal");
  });

  it("D. a change to translatable text produces a new sourceVersion", async () => {
    const id = await seedPetition("content", PUBLIC_INITIATIVE);
    const before = await version(id);
    for (const [field, value] of [
      ["subject.title", "Clean River Petition (revised)"],
      ["subject.requestStatement", "Fund the revised plan."],
      ["subject.keyArguments", ["Public health", "Biodiversity", "Climate"]],
    ] as const) {
      const previous = await version(id);
      await petitions().updateOne({ petitionId: id }, { $set: { [field]: value } });
      assert.notEqual(await version(id), previous, field);
    }
    assert.notEqual(await version(id), before);
  });

  it("E/F. Petitions A, B, C and a derived Petition keep independent identities", async () => {
    const a = await seedPetition("a", PUBLIC_INITIATIVE);
    const b = await seedPetition("b", PUBLIC_INITIATIVE);
    const c = await seedPetition("c", PUBLIC_INITIATIVE);
    const derived = await seedPetition("derived-from-a", PUBLIC_INITIATIVE);
    const ids = [a, b, c, derived];
    assert.equal(new Set(ids).size, 4);
    for (const id of ids) {
      await store.openPetition(id);
      await warm(id);
    }
    for (const id of ids) {
      const rows = await repository.listContentTranslationsForSource({
        sourceKind: "petition",
        sourceRecordId: id,
      });
      assert.equal(rows.length, 1, id);
      assert.equal(rows[0]?.sourceRecordId, id);
    }
  });

  it("G. 7E.2 visibility gates still hold", async () => {
    const ready = `petition-7e3-ready-${RUN}`;
    const helpers = await import("./petition-test-helpers.js");
    await helpers.seedApprovedDecision(`decision-${ready}`, PUBLIC_INITIATIVE);
    await store.createPetition(
      helpers.buildFixturePetition({
        petitionId: ready,
        decisionId: `decision-${ready}`,
        initiativeId: PUBLIC_INITIATIVE,
      }),
    );
    await store.preparePetition(ready);
    const hidden = await seedPetition("hidden", HIDDEN_INITIATIVE);
    for (const id of [ready, hidden]) {
      assert.equal(
        await service.loadTranslatableSource({ sourceKind: "petition", sourceRecordId: id }),
        null,
        id,
      );
    }
  });

  it("H. a pre-7E.3 row is treated as stale and falls back to the original; a current row is presented", async () => {
    const id = await seedPetition("fallback", PUBLIC_INITIATIVE);
    await store.openPetition(id);
    const source = await service.loadTranslatableSource({ sourceKind: "petition", sourceRecordId: id });
    assert.ok(source);
    const stored = await store.getPetition(id);
    const versionModule = await import(
      "../../../src/modules/language/content-translation-version.js"
    );
    const legacyVersion = versionModule.buildContentTranslationSourceVersion({
      fields: source.fields,
      versionStamp: stored!.updatedAt,
    });
    assert.notEqual(legacyVersion, source.sourceVersion);
    await repository.upsertContentTranslation({
      translationId: `translation-legacy-${id}`,
      sourceKind: "petition",
      sourceRecordId: id,
      sourceVersion: legacyVersion,
      sourceLanguage: "en",
      targetLanguage: LOCALE,
      translatedContent: Object.fromEntries(
        Object.entries(source.fields).map(([key, value]) => [key, `Localized ${value}`]),
      ),
      translationProvider: "gemini",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });
    const legacy = await service.resolvePublicTranslatedContent({
      sourceKind: "petition",
      sourceRecordId: id,
      preferredReadingLanguage: LOCALE,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(legacy.presentationMode, "original");
    assert.equal(legacy.content.title, SUBJECT.title);

    const result = await warm(id);
    assert.equal(result.outcome, "completed", JSON.stringify(result));
    const current = await service.resolvePublicTranslatedContent({
      sourceKind: "petition",
      sourceRecordId: id,
      preferredReadingLanguage: LOCALE,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.notEqual(current.presentationMode, "original");
    assert.match(String(current.content.title), /^Localized /);
    const stillLegacy = (
      await repository.listContentTranslationsForSource({ sourceKind: "petition", sourceRecordId: id })
    ).find((row) => row.sourceVersion === legacyVersion);
    assert.ok(stillLegacy, "historical rows are never rewritten or deleted");
  });

  it("does not modify stored Petition records when loading sources", async () => {
    const snapshot = async () =>
      JSON.stringify(
        await petitions()
          .find({ petitionId: { $in: seeded } }, { projection: { _id: 0 } })
          .sort({ petitionId: 1 })
          .toArray(),
      );
    const before = await snapshot();
    for (const id of seeded) {
      await service.loadTranslatableSource({ sourceKind: "petition", sourceRecordId: id });
    }
    assert.equal(await snapshot(), before);
  });
});
