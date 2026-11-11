/**
 * HU-LC-05C.4C.6L — public Petition outputs never expose raw lifecycle tokens.
 *
 * Generated Petition content stores `{lifecycleStage:<id>}` tokens. Every public
 * output (detail projection, Initiative list, legacy safe record, Content
 * Translation originals) presents them as English registry labels, while the
 * stored Petition keeps its tokens unchanged.
 *
 * Real Express routers + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.PETITION_VISITOR_SIGNAL_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c4-6l-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c4-6l-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Collection, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import {
  getInitiativeLifecycleStageDefinition,
  type Initiative,
  type PetitionSubject,
} from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as ContentTranslation from "../../../src/modules/language/content-translation.service.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_lc_tokens_${RUN}`;
const RAW_TOKEN = /\{lifecycleStage:/;

const STEWARD = { userId: `user-6l-steward-${RUN}`, memberId: `member-6l-steward-${RUN}` };
const SIGNER = { userId: `user-6l-signer-${RUN}`, memberId: `member-6l-signer-${RUN}` };
const INITIATIVE_ID = `initiative-6l-public-${RUN}`;

const label = (stageId: "analysis" | "proposal" | "petition"): string => {
  const definition = getInitiativeLifecycleStageDefinition(stageId);
  assert.ok(definition?.label, `registry label for ${stageId}`);
  return definition.label;
};

/** Stored, generated-style content: valid tokens everywhere plus one malformed token. */
const TOKENIZED_SUBJECT = {
  title: "{lifecycleStage:petition}: Clean Rivers",
  summary: "Built from the {lifecycleStage:analysis} and the accepted {lifecycleStage:proposal}.",
  requestStatement: "Adopt the {lifecycleStage:proposal} items for clean rivers.",
  expectedOutcome: "A funded {lifecycleStage:petition} response within one year.",
  supportingContext:
    "{lifecycleStage:analysis}: river quality has declined {lifecycleStage:bogus} since 2020.",
  keyArguments: [
    "{lifecycleStage:analysis}: measured pollution",
    '{lifecycleStage:proposal} "Buffer zones": restore riverbanks',
  ],
} satisfies Partial<PetitionSubject>;

type Mods = {
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  tokens: typeof AuthTokens;
  petitions: () => Collection<Document>;
  translation: typeof ContentTranslation;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let petitionId = "";

async function call(
  method: "GET" | "POST",
  path: string,
  caller: "anonymous" | "signer" = "anonymous",
): Promise<{ status: number; text: string; data: Record<string, unknown> | null }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (caller === "signer") {
    headers.Authorization = `Bearer ${mods.tokens.createAccessToken({
      sub: SIGNER.userId,
      memberId: SIGNER.memberId,
      role: "member",
      displayName: "6L signer",
      email: `${SIGNER.userId}@example.test`,
    })}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  const text = await response.text();
  const json = JSON.parse(text) as { data?: Record<string, unknown> | null };
  return { status: response.status, text, data: json.data ?? null };
}

function assertNoRawTokens(result: { status: number; text: string }, where: string): void {
  assert.ok(result.status < 300, `${where}: ${result.status} ${result.text}`);
  assert.equal(RAW_TOKEN.test(result.text), false, `${where} exposes a raw lifecycle token`);
}

describe("HU-LC-05C.4C.6L — public Petitions present lifecycle tokens", () => {
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
    const now = new Date().toISOString();
    initiatives.createInitiative({
      initiativeId: INITIATIVE_ID,
      stewardId: STEWARD.memberId,
      title: "6L public Initiative",
      description: "Fixture Initiative for public Petition lifecycle tokens.",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as Initiative);

    // The member repository refuses writes under NODE_TEST_ENV; seed the canonical
    // Participant account record directly into this test's isolated database.
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
            displayName: "6L signer",
            uniqueName: SIGNER.memberId,
          }),
        ),
      );

    mods = {
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      petitions: () => database.getMongoDatabase().collection("petitions"),
      translation: await import("../../../src/modules/language/content-translation.service.js"),
    };

    petitionId = `petition-6l-${RUN}`;
    const decisionId = `decision-${petitionId}`;
    await mods.helpers.seedApprovedDecision(decisionId, INITIATIVE_ID);
    const fixture = mods.helpers.buildFixturePetition({
      petitionId,
      decisionId,
      initiativeId: INITIATIVE_ID,
    });
    await mods.store.createPetition({
      ...fixture,
      subject: { ...fixture.subject, ...TOKENIZED_SUBJECT },
      policy: {
        ...fixture.policy,
        withdrawalPolicy: { ...fixture.policy.withdrawalPolicy, withdrawalPermitted: true },
      },
    });
    await mods.store.preparePetition(petitionId);
    await mods.store.publishPetitionForTests(petitionId);
    await mods.store.openPetition(petitionId);

    const petitionRouter = (await import("../../../src/modules/petition/petition.routes.js"))
      .default;
    const publicPetitionRouter = (
      await import("../../../src/modules/petition/public-petition.routes.js")
    ).default;
    const app = express();
    app.use(express.json());
    app.use("/api/v1/petitions", petitionRouter);
    app.use("/api/v1/public/petitions", publicPetitionRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
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

  it("public Petition detail presents every document field with English stage labels", async () => {
    const result = await call("GET", `/api/v1/public/petitions/${petitionId}`);
    assertNoRawTokens(result, "public detail");
    const data = result.data!;
    const subject = data.petitionSubject as Record<string, unknown>;
    assert.equal(subject.title, `${label("petition")}: Clean Rivers`);
    assert.equal((data.petitionIdentity as { title: string }).title, subject.title);
    assert.equal(
      subject.summary,
      `Built from the ${label("analysis")} and the accepted ${label("proposal")}.`,
    );
    assert.equal((data.petitionSummary as { purpose: string }).purpose, subject.summary);
    assert.equal(
      subject.requestStatement,
      `Adopt the ${label("proposal")} items for clean rivers.`,
    );
    assert.equal(
      subject.expectedOutcome,
      `A funded ${label("petition")} response within one year.`,
    );
    // An unknown stage fails closed: the existing presenter strips every token
    // span of that field rather than show any raw token.
    assert.equal(subject.supportingContext, ": river quality has declined since 2020.");
    assert.deepEqual(subject.keyArguments, [
      `${label("analysis")}: measured pollution`,
      `${label("proposal")} "Buffer zones": restore riverbanks`,
    ]);
  });

  it("public Initiative Petition list (widget titles) has no raw tokens", async () => {
    const result = await call("GET", `/api/v1/public/petitions/by-initiative/${INITIATIVE_ID}`);
    assertNoRawTokens(result, "public list");
    assert.ok(result.text.includes(`${label("petition")}: Clean Rivers`));
  });

  it("legacy safe public Petition outputs have no raw tokens", async () => {
    for (const path of [
      "/api/v1/petitions",
      `/api/v1/petitions/${petitionId}`,
      `/api/v1/petitions/by-initiative/${INITIATIVE_ID}`,
      `/api/v1/petitions/by-collective-decision/decision-${petitionId}`,
    ]) {
      assertNoRawTokens(await call("GET", path), path);
    }
    const record = (await call("GET", `/api/v1/petitions/${petitionId}`)).data!;
    assert.equal((record.subject as { title: string }).title, `${label("petition")}: Clean Rivers`);

    const signed = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer");
    assert.equal(signed.status, 201, signed.text);
    assertNoRawTokens(signed, "sign response");
    const withdrawn = await call(
      "POST",
      `/api/v1/petitions/${petitionId}/signatures/withdraw`,
      "signer",
    );
    assertNoRawTokens(withdrawn, "withdraw response");
  });

  it("Content Translation originals for a Petition have no raw tokens", async () => {
    const display = await mods.translation.resolvePublicTranslatedContent({
      sourceKind: "petition",
      sourceRecordId: petitionId,
      generateIfMissing: false,
    });
    const original = display.originalContent as Record<string, string>;
    assert.equal(RAW_TOKEN.test(JSON.stringify(original)), false);
    assert.equal(original.title, `${label("petition")}: Clean Rivers`);
  });

  it("stored Petition content keeps its tokens; identity, signatures and status are unchanged", async () => {
    const stored = await mods.petitions().findOne({ petitionId }, { projection: { _id: 0 } });
    assert.ok(stored);
    for (const [field, value] of Object.entries(TOKENIZED_SUBJECT)) {
      assert.deepEqual((stored.subject as Record<string, unknown>)[field], value, field);
    }
    assert.equal(stored.petitionId, petitionId);
    assert.equal(stored.status, "Open");

    const petition = await mods.store.getPetition(petitionId);
    assert.equal(petition?.subject.title, TOKENIZED_SUBJECT.title);
    assert.deepEqual(
      petition?.signatures.map((signature) => [signature.participantId, signature.status]),
      [[SIGNER.memberId, "Withdrawn"]],
    );
  });
});
