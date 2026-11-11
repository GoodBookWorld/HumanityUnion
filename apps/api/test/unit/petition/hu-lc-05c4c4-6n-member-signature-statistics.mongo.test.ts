/**
 * HU-LC-05C.4C.6N — public Member-signature statistics.
 *
 * A signature's `participantId` is the account's `memberId`; earned Membership
 * is keyed by the auth `userId` (`members.identityId`). Member signatures are
 * those whose signer holds an `active_member` Membership. Every registered,
 * eligible Participant may sign regardless of Membership.
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
process.env.JWT_ACCESS_SECRET = "hu-lc-05c4c4-6n-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05c4c4-6n-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { DecisionSession, Initiative, MembershipStatus } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_pet_member_sig_${RUN}`;
const INITIATIVE_ID = `initiative-6n-public-${RUN}`;

/** userId and memberId are distinct, as in real registration. */
const account = (key: string) => ({
  userId: `user-6n-${key}-${RUN}`,
  memberId: `member-6n-${key}-${RUN}`,
});
const P1_PARTICIPANT = account("participant");
const P2_ACTIVE_MEMBER = account("active-member");
const P3_INACTIVE_MEMBER = account("inactive-member");
const P4_UNMAPPED = account("unmapped");
const ACCOUNTS = { P1_PARTICIPANT, P2_ACTIVE_MEMBER, P3_INACTIVE_MEMBER, P4_UNMAPPED };
type Caller = keyof typeof ACCOUNTS;

let store: typeof PetitionStore;
let tokens: typeof AuthTokens;
let db: Db;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
const petitionA = `petition-6n-a-${RUN}`;
const petitionB = `petition-6n-b-${RUN}`;

async function call(method: "GET" | "POST", path: string, caller?: Caller) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (caller) {
    const user = ACCOUNTS[caller];
    headers.Authorization = `Bearer ${tokens.createAccessToken({
      sub: user.userId,
      memberId: user.memberId,
      role: "member",
      displayName: `6N ${caller}`,
      email: `${user.userId}@example.test`,
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

async function breakdown(petitionId: string) {
  const result = await call("GET", `/api/v1/public/petitions/${petitionId}`);
  assert.equal(result.status, 200, result.text);
  return result.data!.supportBreakdown as {
    participantSignatures: number;
    memberSignatures: number;
  };
}

async function seedMembership(userId: string, status: MembershipStatus): Promise<void> {
  const now = new Date().toISOString();
  await db.collection("memberships").insertOne({
    membershipId: `membership-${userId}`,
    userId,
    profileId: `profile-${userId}`,
    memberNumber: status === "active_member" ? `HU-6N-${userId}` : null,
    status,
    applicationStatus: status === "active_member" ? "approved" : "submitted",
    countryCode: null,
    participationCountryCodes: null,
    displayNameConfirmed: null,
    termsVersion: null,
    termsAcceptedAt: null,
    applicationSubmittedAt: now,
    memberGrantedAt: status === "active_member" ? now : null,
    createdAt: now,
    updatedAt: now,
  });
}

describe("HU-LC-05C.4C.6N — public Member-signature statistics", () => {
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
    db = database.getMongoDatabase();
    assert.equal(db.databaseName, DATABASE);
    await indexes.ensureMongoIndexes();

    const gate = await import("../../../src/modules/auth/auth-active-account-gate.js");
    gate.setAuthUserLookupOverrideForTests(
      async (userId: string) => ({ id: userId, userId, status: "active" }) as never,
    );

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    const now = new Date().toISOString();
    initiatives.createInitiative({
      initiativeId: INITIATIVE_ID,
      stewardId: `member-6n-steward-${RUN}`,
      title: "6N public Initiative",
      description: "Fixture Initiative for Member-signature statistics.",
      status: "implementation",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as Initiative);

    // Every signer is a registered Participant (canonical account record); the
    // member repository refuses writes under NODE_TEST_ENV, so seed directly.
    const memberPersistence =
      await import("../../../src/modules/member/infrastructure/member.persistence.js");
    for (const user of Object.values(ACCOUNTS)) {
      await db.collection("members").insertOne(
        memberPersistence.toMemberMongoDocument(
          memberPersistence.buildNewPersistedMember({
            memberId: user.memberId,
            identityId: user.userId,
            displayName: `6N ${user.memberId}`,
            uniqueName: user.memberId,
          }),
        ),
      );
    }
    await seedMembership(P2_ACTIVE_MEMBER.userId, "active_member");
    await seedMembership(P3_INACTIVE_MEMBER.userId, "payment_refunded");

    store = await import("../../../src/modules/petition/petition.store.js");
    tokens = await import("../../../src/modules/auth/auth-tokens.js");
    const helpers = await import("./petition-test-helpers.js");
    for (const petitionId of [petitionA, petitionB]) {
      const decisionId = `decision-${petitionId}`;
      await helpers.seedApprovedDecision(decisionId, INITIATIVE_ID);
      const fixture = helpers.buildFixturePetition({
        petitionId,
        decisionId,
        initiativeId: INITIATIVE_ID,
      });
      await store.createPetition({
        ...fixture,
        policy: {
          ...fixture.policy,
          withdrawalPolicy: { ...fixture.policy.withdrawalPolicy, withdrawalPermitted: true },
        },
      });
      await store.preparePetition(petitionId);
      await store.publishPetitionForTests(petitionId);
      await store.openPetition(petitionId);
    }

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
    try {
      if (connected && db.databaseName === DATABASE) {
        await db.dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("every registered Participant can sign regardless of Membership", async () => {
    for (const caller of Object.keys(ACCOUNTS) as Caller[]) {
      const signed = await call("POST", `/api/v1/petitions/${petitionA}/signatures`, caller);
      assert.equal(signed.status, 201, `${caller}: ${signed.text}`);
    }
    for (const caller of ["P2_ACTIVE_MEMBER", "P3_INACTIVE_MEMBER"] as const) {
      const signed = await call("POST", `/api/v1/petitions/${petitionB}/signatures`, caller);
      assert.equal(signed.status, 201, `${caller}: ${signed.text}`);
    }
  });

  it("counts only active Members; Participants and inactive Members are Participant signatures", async () => {
    // P1 (no Membership), P2 (active_member), P3 (payment_refunded), P4 (no Membership).
    assert.deepEqual(await breakdown(petitionA), {
      participantSignatures: 4,
      memberSignatures: 1,
      visitorSignals: 0,
    });
  });

  it("a signer whose identity mapping is missing is not counted as a Member", async () => {
    // P4's Participant account record disappears after signing (legacy/orphan data);
    // P2's record is untouched, so the counts stay correct and never throw.
    await db.collection("members").deleteOne({ memberId: P4_UNMAPPED.memberId });
    const { countActiveMemberSignatures } =
      await import("../../../src/modules/petition/petition-member-signatures.js");
    const petition = await store.getPetition(petitionA);
    assert.equal(await countActiveMemberSignatures(petition!.signatures), 1);
    assert.deepEqual(await breakdown(petitionA), {
      participantSignatures: 4,
      memberSignatures: 1,
      visitorSignals: 0,
    });
    // A Membership keyed by the signer's participantId (memberId) never matches.
    await seedMembership(P4_UNMAPPED.memberId, "active_member");
    assert.equal(await countActiveMemberSignatures(petition!.signatures), 1);
  });

  it("counts are independent per Petition and ignore withdrawn Member signatures", async () => {
    assert.deepEqual(await breakdown(petitionB), {
      participantSignatures: 2,
      memberSignatures: 1,
      visitorSignals: 0,
    });
    const withdrawn = await call(
      "POST",
      `/api/v1/petitions/${petitionB}/signatures/withdraw`,
      "P2_ACTIVE_MEMBER",
    );
    assert.equal(withdrawn.status, 200, withdrawn.text);
    assert.deepEqual(await breakdown(petitionB), {
      participantSignatures: 1,
      memberSignatures: 0,
      visitorSignals: 0,
    });
    assert.equal((await breakdown(petitionA)).memberSignatures, 1, "Petition A unaffected");
  });

  it("the public Decision Session Petition context uses the same Member count", async () => {
    const { toPublicDecisionSessionProjection } =
      await import("../../../src/modules/decision-session/public-decision-session.projection.js");
    const now = new Date().toISOString();
    const projection = await toPublicDecisionSessionProjection({
      sessionId: `session-6n-${RUN}`,
      initiativeId: INITIATIVE_ID,
      initiativeVersion: 1,
      title: "6N session",
      purpose: "Decide.",
      decisionQuestion: "Adopt?",
      status: "published",
      opensAt: now,
      closesAt: now,
      stewardId: `member-6n-steward-${RUN}`,
      publishedAt: now,
      updatedAt: now,
      packageReferences: {
        revisionIds: [],
        analysisIds: [],
        proposalIds: [],
        petitionId: petitionA,
      },
    } as unknown as DecisionSession);
    const context = projection.relatedPetitionContext as unknown as Record<string, unknown>;
    assert.equal(
      JSON.stringify(context).includes('"memberSignatures":1'),
      true,
      JSON.stringify(context),
    );
  });

  it("stored signatures, identities and Petition status are unchanged", async () => {
    const a = await store.getPetition(petitionA);
    assert.equal(a?.petitionId, petitionA);
    assert.equal(a?.status, "Open");
    assert.deepEqual(
      a?.signatures.map((signature) => [signature.participantId, signature.status]).sort(),
      Object.values(ACCOUNTS)
        .map((user) => [user.memberId, "Active"])
        .sort(),
    );
    const b = await store.getPetition(petitionB);
    assert.deepEqual(
      b?.signatures.map((signature) => [signature.participantId, signature.status]).sort(),
      [
        [P2_ACTIVE_MEMBER.memberId, "Withdrawn"],
        [P3_INACTIVE_MEMBER.memberId, "Active"],
      ].sort(),
    );
  });
});
