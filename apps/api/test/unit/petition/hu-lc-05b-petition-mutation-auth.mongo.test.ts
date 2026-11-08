/**
 * HU-LC-05B — legacy Petition mutation routes require a verified access token and
 * stewardship of the Petition's Initiative; signers act only as themselves.
 *
 * Real Express router + auth middleware over a process-owned single-node
 * MongoMemoryReplSet (one hu_test_ database, dropped afterwards).
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.JWT_ACCESS_SECRET = "hu-lc-05b-test-access-secret-0123456789abcdef";
process.env.JWT_REFRESH_SECRET = "hu-lc-05b-test-refresh-secret-0123456789abcdef";
process.env.AUTH_BOOTSTRAP_FALLBACK = "false";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { Initiative, Petition, PetitionState } from "@hu/types";

import type * as AuthTokens from "../../../src/modules/auth/auth-tokens.js";
import type * as PetitionDefaults from "../../../src/modules/petition/petition.defaults.js";
import type * as PetitionStore from "../../../src/modules/petition/petition.store.js";
import type * as PetitionTestHelpers from "./petition-test-helpers.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_petition_auth_${RUN}`;
const INITIATIVE_ID = `initiative-lc05b-${RUN}`;
const STEWARD = { userId: `user-lc05b-steward-${RUN}`, memberId: `member-lc05b-steward-${RUN}` };
const OTHER = { userId: `user-lc05b-other-${RUN}`, memberId: `member-lc05b-other-${RUN}` };
const DISABLED_STEWARD = { userId: `user-lc05b-disabled-${RUN}`, memberId: STEWARD.memberId };

/** Loaded after the environment above is set; persistence adapters bind at import. */
type Mods = {
  store: typeof PetitionStore;
  helpers: typeof PetitionTestHelpers;
  tokens: typeof AuthTokens;
  defaults: typeof PetitionDefaults;
  sampleMemberId: string;
};

let mods: Mods;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;
let counter = 0;

function nextId(label: string): string {
  counter += 1;
  return `petition-lc05b-${label}-${counter}-${RUN}`;
}

function tokenFor(user: { userId: string; memberId: string }): string {
  return mods.tokens.createAccessToken({
    sub: user.userId,
    memberId: user.memberId,
    role: "member",
    displayName: "LC-05B Test",
    email: `${user.userId}@example.test`,
  });
}

type Caller = "anonymous" | "invalid" | "disabled" | "other" | "steward" | "signer";

function headersFor(caller: Caller): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (caller === "invalid") {
    headers.Authorization = "Bearer not-a-real-token";
  } else if (caller === "disabled") {
    headers.Authorization = `Bearer ${tokenFor(DISABLED_STEWARD)}`;
  } else if (caller === "other") {
    headers.Authorization = `Bearer ${tokenFor(OTHER)}`;
  } else if (caller === "steward") {
    headers.Authorization = `Bearer ${tokenFor(STEWARD)}`;
  } else if (caller === "signer") {
    headers.Authorization = `Bearer ${tokenFor({ userId: `user-lc05b-signer-${RUN}`, memberId: mods.sampleMemberId })}`;
  }
  return headers;
}

async function call(
  method: "GET" | "POST" | "PATCH",
  path: string,
  caller: Caller,
  body?: unknown,
): Promise<{ status: number; message: string; data: Record<string, unknown> | null }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headersFor(caller),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: Record<string, unknown> | null;
  };
  return { status: response.status, message: json.message ?? "", data: json.data ?? null };
}

/** Seeds a Petition owned by INITIATIVE_ID and advances it to `status`. */
async function seedPetition(status: PetitionState, policy?: Petition["policy"]): Promise<string> {
  const petitionId = nextId(status.toLowerCase());
  const decisionId = `decision-${petitionId}`;
  await mods.helpers.seedApprovedDecision(decisionId, INITIATIVE_ID);
  const fixture = mods.helpers.buildFixturePetition({
    petitionId,
    decisionId,
    initiativeId: INITIATIVE_ID,
  });
  await mods.store.createPetition(policy ? { ...fixture, policy } : fixture);
  const steps: Array<[PetitionState, (id: string) => Promise<unknown>]> = [
    ["Ready", mods.store.preparePetition],
    ["Published", mods.store.publishPetition],
    ["Open", mods.store.openPetition],
    ["Closed", mods.store.closePetition],
  ];
  for (const [reached, step] of steps) {
    if (status === "Draft") {
      break;
    }
    await step(petitionId);
    if (reached === status) {
      break;
    }
  }
  return petitionId;
}

async function statusOf(petitionId: string): Promise<PetitionState | null> {
  return (await mods.store.getPetition(petitionId))?.status ?? null;
}

describe("HU-LC-05B — legacy Petition mutation authorization", () => {
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
      async (userId: string) =>
        ({
          id: userId,
          status: userId === DISABLED_STEWARD.userId ? "disabled" : "active",
        }) as never,
    );

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    const now = new Date().toISOString();
    initiatives.createInitiative({
      initiativeId: INITIATIVE_ID,
      stewardId: STEWARD.memberId,
      title: "LC-05B Petition authorization fixture",
      description: "Fixture Initiative for legacy Petition route authorization.",
      status: "implementation",
      lifecyclePhase: "published",
      lifecycleProfile: "STANDARD",
      visibility: { policy: "public" },
      metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
      timeline: [],
      createdAt: now,
      updatedAt: now,
    } as unknown as Initiative);

    mods = {
      store: await import("../../../src/modules/petition/petition.store.js"),
      helpers: await import("./petition-test-helpers.js"),
      tokens: await import("../../../src/modules/auth/auth-tokens.js"),
      defaults: await import("../../../src/modules/petition/petition.defaults.js"),
      sampleMemberId: (await import("../../../src/modules/member/member.sample.js")).sampleMember
        .id,
    };

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

  const ROUTES: Array<{
    name: string;
    method: "POST" | "PATCH";
    from: PetitionState;
    to: PetitionState;
    path: (id: string) => string;
    body?: unknown;
  }> = [
    {
      name: "PATCH /:petitionId",
      method: "PATCH",
      from: "Draft",
      to: "Draft",
      path: (id) => `/api/v1/petitions/${id}`,
      body: { subject: { title: "Updated by steward" } },
    },
    {
      name: "prepare",
      method: "POST",
      from: "Draft",
      to: "Ready",
      path: (id) => `/api/v1/petitions/${id}/prepare`,
    },
    {
      name: "publish",
      method: "POST",
      from: "Ready",
      to: "Published",
      path: (id) => `/api/v1/petitions/${id}/publish`,
    },
    {
      name: "open",
      method: "POST",
      from: "Published",
      to: "Open",
      path: (id) => `/api/v1/petitions/${id}/open`,
    },
    {
      name: "close",
      method: "POST",
      from: "Open",
      to: "Closed",
      path: (id) => `/api/v1/petitions/${id}/close`,
    },
    {
      name: "archive",
      method: "POST",
      from: "Closed",
      to: "Archived",
      path: (id) => `/api/v1/petitions/${id}/archive`,
    },
  ];

  for (const route of ROUTES) {
    describe(route.name, () => {
      const rejected: Array<[Caller, number]> = [
        ["anonymous", 401],
        ["invalid", 401],
        ["disabled", 403],
        ["other", 403],
      ];

      for (const [caller, expected] of rejected) {
        it(`${caller} is rejected with ${expected} and nothing changes`, async () => {
          const petitionId = await seedPetition(route.from);
          const before = await mods.store.getPetition(petitionId);
          const result = await call(route.method, route.path(petitionId), caller, route.body);
          assert.equal(result.status, expected, result.message);
          const afterward = await mods.store.getPetition(petitionId);
          assert.equal(afterward?.status, route.from);
          assert.equal(afterward?.subject.title, before?.subject.title);
          assert.equal(afterward?.updatedAt, before?.updatedAt);
        });
      }

      it("the Initiative steward is accepted", async () => {
        const petitionId = await seedPetition(route.from);
        const result = await call(route.method, route.path(petitionId), "steward", route.body);
        assert.equal(result.status, 200, result.message);
        assert.equal(await statusOf(petitionId), route.to);
        if (route.method === "PATCH") {
          assert.equal(
            (await mods.store.getPetition(petitionId))?.subject.title,
            "Updated by steward",
          );
        }
      });

      it("an unknown Petition returns 404 for the steward", async () => {
        const result = await call(
          route.method,
          route.path(`missing-${RUN}`),
          "steward",
          route.body,
        );
        assert.equal(result.status, 404, result.message);
      });
    });
  }

  describe("POST / (create)", () => {
    async function createBody(): Promise<Petition> {
      const petitionId = nextId("create");
      const decisionId = `decision-${petitionId}`;
      await mods.helpers.seedApprovedDecision(decisionId, INITIATIVE_ID);
      return mods.helpers.buildFixturePetition({
        petitionId,
        decisionId,
        initiativeId: INITIATIVE_ID,
      });
    }

    for (const [caller, expected] of [
      ["anonymous", 401],
      ["invalid", 401],
      ["disabled", 403],
      ["other", 403],
    ] as Array<[Caller, number]>) {
      it(`${caller} is rejected with ${expected} and no Petition is created`, async () => {
        const body = await createBody();
        const result = await call("POST", "/api/v1/petitions", caller, body);
        assert.equal(result.status, expected, result.message);
        assert.equal(await mods.store.getPetition(body.petitionId), null);
      });
    }

    it("the Initiative steward creates a Draft Petition", async () => {
      const body = await createBody();
      const result = await call("POST", "/api/v1/petitions", "steward", body);
      assert.equal(result.status, 201, result.message);
      assert.equal(await statusOf(body.petitionId), "Draft");
    });

    it("an unknown Initiative returns 404 and creates nothing", async () => {
      const body = await createBody();
      body.subject = { ...body.subject, initiativeId: `initiative-missing-${RUN}` };
      const result = await call("POST", "/api/v1/petitions", "steward", body);
      assert.equal(result.status, 404, result.message);
      assert.equal(await mods.store.getPetition(body.petitionId), null);
    });
  });

  it("the bootstrap fallback never authorizes administrative mutations", async () => {
    const petitionId = await seedPetition("Open");
    process.env.AUTH_BOOTSTRAP_FALLBACK = "true";
    try {
      const result = await call("POST", `/api/v1/petitions/${petitionId}/close`, "anonymous");
      assert.equal(result.status, 401, result.message);
    } finally {
      process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
    }
    assert.equal(await statusOf(petitionId), "Open");
  });

  describe("signing and withdrawal", () => {
    const withdrawalPolicy = () => ({
      ...structuredClone(mods.defaults.defaultPetitionPolicy),
      withdrawalPolicy: {
        withdrawalPermitted: true,
        withdrawalPolicyDescription: "Signatures may be withdrawn while open.",
      },
    });
    const activeSigners = async (petitionId: string) =>
      ((await mods.store.getPetition(petitionId))?.signatures ?? [])
        .filter((signature) => signature.status === "Active")
        .map((signature) => signature.participantId);

    it("anonymous signing is rejected", async () => {
      const petitionId = await seedPetition("Open");
      const result = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "anonymous", {
        participantId: mods.sampleMemberId,
      });
      assert.equal(result.status, 401, result.message);
      assert.deepEqual(await activeSigners(petitionId), []);
    });

    it("a signed-in Participant signs as themselves", async () => {
      const petitionId = await seedPetition("Open");
      const result = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {
        participationMode: "Community",
      });
      assert.equal(result.status, 201, result.message);
      assert.deepEqual(await activeSigners(petitionId), [mods.sampleMemberId]);
    });

    it("a matching body participantId keeps working", async () => {
      const petitionId = await seedPetition("Open");
      const result = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {
        participantId: mods.sampleMemberId,
      });
      assert.equal(result.status, 201, result.message);
      assert.deepEqual(await activeSigners(petitionId), [mods.sampleMemberId]);
    });

    it("signing as another Participant is rejected", async () => {
      const petitionId = await seedPetition("Open");
      const result = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "other", {
        participantId: mods.sampleMemberId,
      });
      assert.equal(result.status, 403, result.message);
      assert.deepEqual(await activeSigners(petitionId), []);
    });

    it("withdrawal works for the signer and rejects anonymous callers", async () => {
      const petitionId = await seedPetition("Open", withdrawalPolicy());
      assert.equal(
        (await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {})).status,
        201,
      );
      const anonymous = await call(
        "POST",
        `/api/v1/petitions/${petitionId}/signatures/withdraw`,
        "anonymous",
      );
      assert.equal(anonymous.status, 401, anonymous.message);
      assert.deepEqual(await activeSigners(petitionId), [mods.sampleMemberId]);

      const withdrawn = await call(
        "POST",
        `/api/v1/petitions/${petitionId}/signatures/withdraw`,
        "signer",
      );
      assert.equal(withdrawn.status, 200, withdrawn.message);
      assert.deepEqual(await activeSigners(petitionId), []);
    });
  });

  describe("HU-LC-05B.1 — viewer signature state (public projection)", () => {
    const viewerHasSigned = async (petitionId: string, caller: Caller) => {
      const result = await call("GET", `/api/v1/public/petitions/${petitionId}`, caller);
      assert.equal(result.status, 200, result.message);
      return result.data?.viewerHasSigned;
    };

    it("a signed-in Participant who has not signed is reported unsigned", async () => {
      const petitionId = await seedPetition("Open");
      assert.equal(await viewerHasSigned(petitionId, "signer"), false);
    });

    it("signing is reflected immediately and after a fresh reload", async () => {
      const petitionId = await seedPetition("Open");
      const signed = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {
        participationMode: "Community",
      });
      assert.equal(signed.status, 201, signed.message);
      assert.equal(await viewerHasSigned(petitionId, "signer"), true);
      assert.equal(await viewerHasSigned(petitionId, "signer"), true);
    });

    it("an already-signed Participant stays signed and cannot sign twice", async () => {
      const petitionId = await seedPetition("Open");
      await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {});
      const again = await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {});
      assert.equal(again.status, 409, again.message);
      assert.equal(await viewerHasSigned(petitionId, "signer"), true);
      assert.deepEqual(
        ((await mods.store.getPetition(petitionId))?.signatures ?? []).filter(
          (signature) => signature.status === "Active",
        ).length,
        1,
      );
    });

    it("a different signed-in Participant is not reported as the signer", async () => {
      const petitionId = await seedPetition("Open");
      await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {});
      assert.equal(await viewerHasSigned(petitionId, "other"), false);
      assert.equal(await viewerHasSigned(petitionId, "steward"), false);
    });

    it("an anonymous visitor is never reported as a signer", async () => {
      const petitionId = await seedPetition("Open");
      await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {});
      assert.equal(await viewerHasSigned(petitionId, "anonymous"), false);
      process.env.AUTH_BOOTSTRAP_FALLBACK = "true";
      try {
        assert.equal(await viewerHasSigned(petitionId, "anonymous"), false);
      } finally {
        process.env.AUTH_BOOTSTRAP_FALLBACK = "false";
      }
    });

    it("withdrawal returns the signer to unsigned where the policy permits it", async () => {
      const petitionId = await seedPetition("Open", {
        ...structuredClone(mods.defaults.defaultPetitionPolicy),
        withdrawalPolicy: {
          withdrawalPermitted: true,
          withdrawalPolicyDescription: "Signatures may be withdrawn while open.",
        },
      });
      await call("POST", `/api/v1/petitions/${petitionId}/signatures`, "signer", {});
      assert.equal(await viewerHasSigned(petitionId, "signer"), true);
      const withdrawn = await call(
        "POST",
        `/api/v1/petitions/${petitionId}/signatures/withdraw`,
        "signer",
      );
      assert.equal(withdrawn.status, 200, withdrawn.message);
      assert.equal(await viewerHasSigned(petitionId, "signer"), false);
    });
  });

  describe("public reads stay anonymous", () => {
    it("legacy and public GET routes need no identity", async () => {
      const petitionId = await seedPetition("Open");
      for (const path of [
        "/api/v1/petitions",
        `/api/v1/petitions/${petitionId}`,
        `/api/v1/petitions/by-initiative/${INITIATIVE_ID}`,
        `/api/v1/petitions/by-collective-decision/decision-${petitionId}`,
        `/api/v1/public/petitions/${petitionId}`,
      ]) {
        const result = await call("GET", path, "anonymous");
        assert.equal(result.status, 200, `${path}: ${result.message}`);
      }
    });
  });

  describe("Lifecycle Author publication (service path)", () => {
    it("publishes and opens a Petition without the legacy routes", async () => {
      const lifecycleInitiativeId = `initiative-lc05b-lifecycle-${RUN}`;
      const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
      const now = new Date().toISOString();
      const initiative = initiatives.createInitiative({
        initiativeId: lifecycleInitiativeId,
        stewardId: STEWARD.memberId,
        title: "LC-05B lifecycle Petition fixture",
        description: "Lifecycle Author publication still works after HU-LC-05B.",
        status: "implementation",
        lifecyclePhase: "published",
        lifecycleProfile: "STANDARD",
        visibility: { policy: "public" },
        metadata: { activityArea: "Environment", communitySlug: "fixture-community" },
        timeline: [],
        createdAt: now,
        updatedAt: now,
      } as unknown as Initiative);
      const revisions =
        await import("../../../src/modules/initiative-version-revision/initiative-version-revision.service.js");
      revisions.createInitialInitiativeVersionRevision(initiative, STEWARD.memberId);

      const lifecycle =
        await import("../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js");
      const identity = { participantId: STEWARD.memberId };
      await lifecycle.generateInitiativePetitionDraft(identity, lifecycleInitiativeId);
      lifecycle.saveInitiativePetitionDraft(identity, lifecycleInitiativeId, {
        title: "Lifecycle Petition",
        publicSummary: "Lifecycle summary.",
        requestStatement: "Please act.",
        expectedOutcome: "Action is taken.",
        supportingContext: "Context.",
        keyArguments: ["Argument"],
      });
      const published = await lifecycle.publishInitiativePetitionStage(
        identity,
        lifecycleInitiativeId,
      );
      assert.equal(published.status, "Open");
      assert.equal(published.subject.initiativeId, lifecycleInitiativeId);
    });
  });
});
