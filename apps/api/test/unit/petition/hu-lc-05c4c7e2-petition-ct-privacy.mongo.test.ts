/**
 * HU-LC-05C.4C.7E.2 — Content Translation never exposes or processes Petitions
 * that are not publicly readable (Draft, Ready, or under a non-public
 * Initiative). They behave exactly like unknown Petition ids.
 *
 * Real Express routers over a process-owned single-node MongoMemoryReplSet
 * (one hu_test_ database, dropped afterwards); translations stay in memory.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
// Retained CT engine suite: exercise privacy gates with warm/discovery active.
// Does not change process-wide defaults for other suites (per-file process).
process.env.CONTENT_TRANSLATION_FROZEN = "false";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c7e2-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c7e2-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as Eligibility from "../../../src/modules/language/content-translation-eligibility.js";
import type * as SearchDiscovery from "../../../src/modules/language/content-translation-search-discovery-enumerate.js";
import type * as WarmBackfill from "../../../src/modules/language/content-translation-staging-warm-backfill.js";
import type * as WarmConsumer from "../../../src/modules/language/content-translation-warm-consumer.js";
import type * as ContentTranslation from "../../../src/modules/language/content-translation.service.js";
import type * as TranslationRepository from "../../../src/modules/language/persistence/content-translation.repository.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_ct_priv_${RUN}`;

const STEWARD = { userId: `user-7e2-steward-${RUN}`, memberId: `member-7e2-steward-${RUN}` };
const SIGNER = { userId: `user-7e2-signer-${RUN}`, memberId: `member-7e2-signer-${RUN}` };
const PUBLIC_INITIATIVE = `initiative-7e2-public-${RUN}`;
const HIDDEN_INITIATIVE = `initiative-7e2-hidden-${RUN}`;

const STATES = ["Draft", "Ready", "Published", "Open", "Closed", "Archived"] as const;
type Case = (typeof STATES)[number] | "Hidden";
const READABLE: readonly Case[] = ["Published", "Open", "Closed", "Archived"];
const PRIVATE: readonly Case[] = ["Draft", "Ready", "Hidden"];

const ids = {} as Record<Case, string>;
const secret = (name: Case) => `SECRET-${name}-${RUN}`;

type Mods = {
  tokens: typeof AuthTokens;
  translation: typeof ContentTranslation;
  eligibility: typeof Eligibility;
  consumer: typeof WarmConsumer;
  backfill: typeof WarmBackfill;
  search: typeof SearchDiscovery;
  repository: typeof TranslationRepository;
  collection: (name: string) => Collection<Document>;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;

async function call(
  method: "GET" | "POST",
  path: string,
  caller: "anonymous" | "signer" = "anonymous",
): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (caller === "signer") {
    headers.Authorization = `Bearer ${mods.tokens.createAccessToken({
      sub: SIGNER.userId,
      memberId: SIGNER.memberId,
      role: "member",
      displayName: "7E2 signer",
      email: `${SIGNER.userId}@example.test`,
    })}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) as Record<string, unknown> };
}

const resolvePath = (petitionId: string) =>
  `/api/v1/translations/resolve/petition/${encodeURIComponent(petitionId)}?language=uk`;

async function snapshot(): Promise<Record<string, Document[]>> {
  const out: Record<string, Document[]> = {};
  for (const name of ["petitions", "petition_signatures", "initiative_petition_slots"]) {
    out[name] = await mods
      .collection(name)
      .find({}, { projection: { _id: 0 } })
      .sort({ petitionId: 1, signatureId: 1 })
      .toArray();
  }
  return out;
}

function initiative(initiativeId: string, visibility: "public" | "private"): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD.memberId,
    title: `7E2 ${visibility} Initiative`,
    description: "Fixture Initiative for Petition translation privacy.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: visibility },
    metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Initiative;
}

describe("HU-LC-05C.4C.7E.2 — Petition Content Translation privacy gate", () => {
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
            displayName: "7E2 signer",
            uniqueName: SIGNER.memberId,
          }),
        ),
      );

    const store = await import("../../../src/modules/petition/petition.store.js");
    const helpers = await import("./petition-test-helpers.js");
    const seed = async (name: Case, initiativeId: string, state: PetitionState) => {
      const petitionId = `petition-7e2-${name.toLowerCase()}-${RUN}`;
      const decisionId = `decision-${petitionId}`;
      await helpers.seedApprovedDecision(decisionId, initiativeId);
      const fixture = helpers.buildFixturePetition({ petitionId, decisionId, initiativeId });
      await store.createPetition({
        ...fixture,
        subject: {
          ...fixture.subject,
          title: secret(name),
          summary: `${secret(name)} summary`,
          requestStatement: `${secret(name)} request`,
        },
      });
      const steps: Array<() => Promise<unknown>> = [];
      if (state !== "Draft") steps.push(() => store.preparePetition(petitionId));
      if (["Published", "Open", "Closed", "Archived"].includes(state)) {
        steps.push(() => store.publishPetitionForTests(petitionId));
      }
      if (["Open", "Closed", "Archived"].includes(state)) {
        steps.push(() => store.openPetition(petitionId));
      }
      if (["Closed", "Archived"].includes(state)) steps.push(() => store.closePetition(petitionId));
      if (state === "Archived") steps.push(() => store.archivePetition(petitionId));
      for (const step of steps) {
        await step();
      }
      const stored = await store.getPetition(petitionId);
      assert.equal(stored?.status, state, `${name} fixture state`);
      ids[name] = petitionId;
    };
    for (const state of STATES) {
      await seed(state, PUBLIC_INITIATIVE, state);
    }
    await seed("Hidden", HIDDEN_INITIATIVE, "Open");

    mods = {
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      translation: await import("../../../src/modules/language/content-translation.service.js"),
      eligibility: await import("../../../src/modules/language/content-translation-eligibility.js"),
      consumer: await import("../../../src/modules/language/content-translation-warm-consumer.js"),
      backfill: await import(
        "../../../src/modules/language/content-translation-staging-warm-backfill.js"
      ),
      search: await import(
        "../../../src/modules/language/content-translation-search-discovery-enumerate.js"
      ),
      repository: await import(
        "../../../src/modules/language/persistence/content-translation.repository.js"
      ),
      collection: (name: string) => database.getMongoDatabase().collection(name),
    };

    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/translations",
      (await import("../../../src/modules/language/language.routes.js")).default,
    );
    app.use(
      "/api/v1/petitions",
      (await import("../../../src/modules/petition/petition.routes.js")).default,
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    const signed = await call("POST", `/api/v1/petitions/${ids.Open}/signatures`, "signer");
    assert.equal(signed.status, 201, signed.text);
  });

  after(async () => {
    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(null);
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
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

  it("anonymous resolve hides Draft, Ready and hidden-Initiative Petitions exactly like unknown ids", async () => {
    const unknown = await call("GET", resolvePath(`petition-7e2-unknown-${RUN}`));
    assert.ok(unknown.status >= 400, unknown.text);
    for (const name of PRIVATE) {
      const result = await call("GET", resolvePath(ids[name]));
      assert.equal(result.status, unknown.status, `${name}: ${result.text}`);
      assert.deepEqual(result.json, unknown.json, `${name} differs from an unknown id`);
      assert.equal(result.text.includes("SECRET"), false, `${name} leaks source text`);
      assert.doesNotMatch(result.text, /Draft|Ready|private|hidden/i, `${name} leaks state`);
    }
  });

  it("anonymous resolve still serves every publicly readable Petition", async () => {
    for (const name of READABLE) {
      const result = await call("GET", resolvePath(ids[name]));
      assert.equal(result.status, 200, `${name}: ${result.text}`);
      const data = result.json.data as { content: Record<string, string> };
      assert.equal(data.content.title, secret(name), name);
      assert.equal(data.content.requestStatement, `${secret(name)} request`, name);
    }
  });

  it("only publicly readable Petitions load as translation sources", async () => {
    for (const name of PRIVATE) {
      const source = await mods.translation.loadTranslatableSource({
        sourceKind: "petition",
        sourceRecordId: ids[name],
      });
      assert.equal(source, null, name);
    }
    for (const name of READABLE) {
      const source = await mods.translation.loadTranslatableSource({
        sourceKind: "petition",
        sourceRecordId: ids[name],
      });
      assert.ok(source, name);
      assert.equal(source.sourceRecordId, ids[name]);
      assert.equal(source.isPublished, true);
      for (const intent of ["automatic_warm", "search_discovery", "on_demand"] as const) {
        assert.doesNotThrow(
          () =>
            mods.eligibility.assertCanonicalSourceEligibleForTranslation({
              source: { ...source, safetyCleared: true },
              intent,
            }),
          `${name} ${intent}`,
        );
      }
    }
  });

  it("warm processing refuses unpublished and hidden Petitions before any provider call", async () => {
    for (const name of PRIVATE) {
      await assert.rejects(
        mods.consumer.processContentTranslationWarmRequested({
          commandName: "ContentTranslationWarmRequested",
          sourceKind: "petition",
          sourceRecordId: ids[name],
          requestedAt: new Date().toISOString(),
          reason: "public_mutation",
        }),
        (error: Error) => /source unavailable/i.test(error.message),
        name,
      );
      const rows = await mods.repository.listContentTranslationsForSource({
        sourceKind: "petition",
        sourceRecordId: ids[name],
      });
      assert.deepEqual(rows, [], `${name} produced translation rows`);
    }
  });

  it("activation/backfill and search discovery select only publicly readable Petitions", async () => {
    const expected = READABLE.map((name) => ids[name]).sort();
    const discovered = await mods.backfill.discoverStagingInitiativePathWarmSources({
      kinds: ["petition"],
    });
    const backfilled = discovered.candidates
      .filter((candidate) => candidate.sourceKind === "petition")
      .map((candidate) => candidate.sourceRecordId)
      .filter((id) => id.includes(RUN))
      .sort();
    assert.deepEqual(backfilled, expected);

    const searched = (await mods.search.listSearchDiscoveryWarmTargets())
      .filter((target) => target.sourceKind === "petition")
      .map((target) => target.sourceRecordId)
      .filter((id) => id.includes(RUN))
      .sort();
    assert.deepEqual(searched, expected);
  });

  it("keeps Petition A and Petition B translations isolated", async () => {
    const [a, b] = [ids.Open, ids.Closed];
    for (const [petitionId, text] of [
      [a, "TRANSLATION-A"],
      [b, "TRANSLATION-B"],
    ] as const) {
      const source = await mods.translation.loadTranslatableSource({
        sourceKind: "petition",
        sourceRecordId: petitionId,
      });
      assert.ok(source);
      await mods.repository.upsertContentTranslation({
        translationId: `translation-${petitionId}`,
        sourceKind: "petition",
        sourceRecordId: petitionId,
        sourceVersion: source.sourceVersion,
        sourceLanguage: "en",
        targetLanguage: "uk",
        translatedContent: { title: text },
        translationProvider: "deterministic",
        translationKind: "machine",
        createdAt: new Date().toISOString(),
        stale: false,
        freshness: "current",
      });
    }
    const rowsA = await mods.repository.listContentTranslationsForSource({
      sourceKind: "petition",
      sourceRecordId: a,
    });
    assert.deepEqual(
      rowsA.map((row) => [row.sourceRecordId, (row.translatedContent as { title: string }).title]),
      [[a, "TRANSLATION-A"]],
    );
    const resolvedA = await call("GET", resolvePath(a));
    const resolvedB = await call("GET", resolvePath(b));
    assert.equal(resolvedA.text.includes("TRANSLATION-B"), false);
    assert.equal(resolvedB.text.includes("TRANSLATION-A"), false);
    assert.equal(resolvedA.text.includes(secret("Closed")), false);
  });

  it("translation operations never write Petitions, signatures or slots", async () => {
    const before = await snapshot();
    assert.equal(before.petition_signatures?.length, 1, "fixture signature");
    for (const name of [...PRIVATE, ...READABLE]) {
      await call("GET", resolvePath(ids[name]));
      await mods.translation
        .loadTranslatableSource({ sourceKind: "petition", sourceRecordId: ids[name] })
        .catch(() => undefined);
    }
    await mods.backfill.discoverStagingInitiativePathWarmSources({ kinds: ["petition"] });
    await mods.search.listSearchDiscoveryWarmTargets();
    assert.deepEqual(await snapshot(), before);
  });
});
