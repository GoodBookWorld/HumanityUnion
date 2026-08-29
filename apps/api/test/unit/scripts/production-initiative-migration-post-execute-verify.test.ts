import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_INITIATIVE_EXPECTATIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXPECTED_MUST_MIGRATE_CIVIC_CHILDREN,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  InMemoryMediaCopyExecutor,
  VLAD_SHAPRAN_USER_ID,
  assertNoSecretLeak,
  runPostExecuteProductionInitiativeVerification,
} from "../../../src/modules/production-initiative-migration/index.js";

type MemDoc = Document & { _id?: string };

function getPath(doc: MemDoc, path: string): unknown {
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, doc);
}

function matchesFilter(doc: MemDoc, filter: Document): boolean {
  if (filter.$or && Array.isArray(filter.$or)) {
    return (filter.$or as Document[]).some((part) => matchesFilter(doc, part));
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$or") continue;
    const actual = getPath(doc, key);
    if (value && typeof value === "object" && !Array.isArray(value) && "$in" in (value as object)) {
      const list = (value as { $in: unknown[] }).$in;
      if (!list.some((candidate) => String(candidate) === String(actual))) return false;
      continue;
    }
    if (String(actual) !== String(value)) return false;
  }
  return true;
}

class MemoryCursor {
  constructor(private readonly docs: MemDoc[]) {}
  project(_p: Document) {
    return this;
  }
  limit(n: number) {
    return new MemoryCursor(this.docs.slice(0, n));
  }
  async toArray() {
    return this.docs.map((d) => ({ ...d }));
  }
}

class MemoryCollection {
  constructor(
    private readonly store: Map<string, MemDoc[]>,
    private readonly name: string,
  ) {}
  private rows(): MemDoc[] {
    return this.store.get(this.name) ?? [];
  }
  async findOne(filter: Document) {
    return this.rows().find((doc) => matchesFilter(doc, filter)) ?? null;
  }
  find(filter: Document) {
    return new MemoryCursor(this.rows().filter((doc) => matchesFilter(doc, filter)));
  }
}

class MemoryDb {
  readonly store = new Map<string, MemDoc[]>();
  collection(name: string) {
    if (!this.store.has(name)) this.store.set(name, []);
    return new MemoryCollection(this.store, name);
  }
  seed(name: string, docs: MemDoc[]) {
    this.store.set(
      name,
      docs.map((d) => ({ ...d })),
    );
  }
  asDb(): Db {
    return this as unknown as Db;
  }
}

function baseInitiative(
  id: string,
  stewardMemberId: string,
  extras: Partial<MemDoc> = {},
): MemDoc {
  return {
    _id: id,
    initiativeId: id,
    title: CANONICAL_INITIATIVE_EXPECTATIONS.find((e) => e.initiativeId === id)?.title ?? id,
    stewardId: stewardMemberId,
    status: "active",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    lifecycleProfile: null,
    ...extras,
  };
}

function seedPerfectPair(): {
  source: MemoryDb;
  dest: MemoryDb;
  media: InMemoryMediaCopyExecutor;
  bootstrapBaseline: MemDoc;
} {
  const source = new MemoryDb();
  const dest = new MemoryDb();
  const media = new InMemoryMediaCopyExecutor();

  const roots = CANONICAL_INITIATIVE_EXPECTATIONS.map((e) =>
    baseInitiative(e.initiativeId, e.stewardMemberId),
  );
  const bootstrapBaseline = baseInitiative(
    "initiative-bootstrap-001",
    APPROVED_PRODUCTION_PARTICIPANTS[4]!.memberId,
    {
      title: "Bootstrap",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      lifecyclePhase: "draft",
      visibility: { policy: "steward_only" },
      lifecycleProfile: undefined,
    },
  );
  // Remove undefined key so baseline uses missing (not null) lifecycleProfile
  delete bootstrapBaseline.lifecycleProfile;

  source.seed("initiatives", [
    ...roots,
    baseInitiative("initiative-1787191372634", APPROVED_PRODUCTION_PARTICIPANTS[0]!.memberId, {
      title: "Test 2",
      createdAt: "2026-02-01T00:00:00.000Z",
    }),
  ]);
  dest.seed("initiatives", [...roots, { ...bootstrapBaseline }]);

  for (const p of APPROVED_PRODUCTION_PARTICIPANTS) {
    for (const db of [source, dest]) {
      const auth = db.store.get("auth_users") ?? [];
      auth.push({ _id: p.userId, userId: p.userId, memberId: p.memberId, role: p.authRole });
      db.store.set("auth_users", auth);
      const members = db.store.get("members") ?? [];
      members.push({ _id: p.memberId, memberId: p.memberId, userId: p.userId });
      db.store.set("members", members);
      const profiles = db.store.get("member_profiles") ?? [];
      profiles.push({
        _id: p.profileId,
        profileId: p.profileId,
        userId: p.userId,
        membershipPubliclyVisible: p.userId === VLAD_SHAPRAN_USER_ID ? false : true,
      });
      db.store.set("member_profiles", profiles);
    }
  }

  const membership = {
    _id: "mem-vlad",
    userId: VLAD_SHAPRAN_USER_ID,
    status: "active_member",
    memberNumber: "HU-0001",
    applicationStatus: "approved",
    memberGrantedAt: "2026-01-10T00:00:00.000Z",
    stripeCustomerId: null,
  };
  source.seed("memberships", [
    membership,
    ...APPROVED_PRODUCTION_PARTICIPANTS.slice(1).map((p) => ({
      _id: `mem-${p.userId}`,
      userId: p.userId,
      status: "not_started",
    })),
  ]);
  dest.seed("memberships", [{ ...membership }]);

  const badge = {
    _id: "badge-1",
    applicationId: "badge-app-1",
    userId: VLAD_SHAPRAN_USER_ID,
    participantId: APPROVED_PRODUCTION_PARTICIPANTS[0]!.memberId,
    paymentStatus: "paid",
    fulfillmentStatus: "shipped",
    shippingAddress: {
      recipientName: "Secret Recipient",
      addressLine1: "123 Secret Street",
      city: "Secret City",
      postalCode: "00000",
      phone: "+1-555-0100",
    },
    stripeCheckoutSessionId: null,
  };
  source.seed("member_badge_applications", [badge]);
  dest.seed("member_badge_applications", [
    {
      ...badge,
      shippingAddress: { ...badge.shippingAddress },
    },
  ]);
  source.seed("membership_contributions", [
    { _id: "c1", userId: VLAD_SHAPRAN_USER_ID, amount: 10, stripePaymentIntentId: null },
  ]);
  dest.seed("membership_contributions", [
    { _id: "c1", userId: VLAD_SHAPRAN_USER_ID, amount: 10, stripePaymentIntentId: null },
  ]);

  const analyses: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_MUST_MIGRATE_CIVIC_CHILDREN; i += 1) {
    const initiativeId =
      CANONICAL_PRODUCTION_INITIATIVE_IDS[i % CANONICAL_PRODUCTION_INITIATIVE_IDS.length]!;
    analyses.push({
      _id: `analysis-${i}`,
      analysisId: `analysis-${i}`,
      initiativeId,
    });
  }
  source.seed("initiative_analyses", analyses);
  dest.seed(
    "initiative_analyses",
    analyses.map((d) => ({ ...d })),
  );

  const mediaDocs: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS; i += 1) {
    const storageKey = `initiatives/verify-${i}.png`;
    const body = Buffer.from(`media-bytes-${i}`);
    media.seedSource(storageKey, body);
    media.seedDestination(storageKey, Buffer.from(`media-bytes-${i}`));
    const initiativeId =
      CANONICAL_PRODUCTION_INITIATIVE_IDS[i % CANONICAL_PRODUCTION_INITIATIVE_IDS.length]!;
    mediaDocs.push({
      _id: `media-${i}`,
      mediaId: `media-${i}`,
      storageKey,
      mediaUrl: `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey}`,
      purpose: "initiative-image",
      initiativeId,
      ownerParticipantId: "system-media-recovery",
      visibility: "public",
    });
  }
  source.seed("media_upload_records", mediaDocs);
  dest.seed(
    "media_upload_records",
    mediaDocs.map((d) => ({ ...d })),
  );

  source.seed("membership_webhook_events", [
    { _id: "wh-1", userId: VLAD_SHAPRAN_USER_ID, eventId: "evt_staging_1" },
  ]);
  dest.seed("membership_webhook_events", []);
  for (const name of [
    "outbox",
    "processed_events",
    "auth_sessions",
    "email_verification_tokens",
    "email_confirmation_codes",
    "member_notifications",
    "petitions",
  ] as const) {
    source.seed(name, []);
    dest.seed(name, []);
  }

  return { source, dest, media, bootstrapBaseline };
}

async function verify(
  source: MemoryDb,
  dest: MemoryDb,
  media: InMemoryMediaCopyExecutor,
  extras: Partial<Parameters<typeof runPostExecuteProductionInitiativeVerification>[0]> = {},
) {
  return runPostExecuteProductionInitiativeVerification({
    sourceDb: source.asDb(),
    destinationDb: dest.asDb(),
    mediaReader: media,
    probePublicInitiative: async () => "ok",
    mutationCounters: {
      mongoWrites: 0,
      putObjectCalls: 0,
      deleteObjectCalls: 0,
      recoveryStoreWrites: 0,
    },
    ...extras,
  });
}

describe("Production Initiative migration post-execute verify — Task 07.6", () => {
  it("perfect migrated state → PASS", async () => {
    const { source, dest, media, bootstrapBaseline } = seedPerfectPair();
    const report = await verify(source, dest, media, {
      baselineBootstrap: bootstrapBaseline,
    });
    assert.equal(report.verdict, "PASS");
    assert.equal(report.rootsVerified, 9);
    assert.equal(report.civicChildrenVerified, 113);
    assert.equal(report.identitiesVerified, 5);
    assert.equal(report.mediaRecordsVerified, 13);
    assert.equal(report.r2ObjectsEquivalent, 13);
    assert.equal(report.membershipVerification, "PASS");
    assert.equal(report.badgeVerification, "PASS");
    assert.equal(report.forbiddenStateVerification, "PASS");
    assert.equal(report.projectionVerification, "PASS");
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.shippingDataPresent, true);
  });

  it("one missing root → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.seed(
      "initiatives",
      dest
        .store.get("initiatives")!
        .filter((d) => d.initiativeId !== CANONICAL_PRODUCTION_INITIATIVE_IDS[0]),
    );
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Destination root missing/.test(b)));
  });

  it("wrong steward → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.store.get("initiatives")![0]!.stewardId =
      APPROVED_PRODUCTION_PARTICIPANTS[1]!.memberId;
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Wrong steward/.test(b)));
  });

  it("lifecycleProfile changed/null normalized → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    const destRoot = dest.store
      .get("initiatives")!
      .find((d) => d.initiativeId === CANONICAL_PRODUCTION_INITIATIVE_IDS[0])!;
    delete destRoot.lifecycleProfile;
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /lifecycleProfile not preserved/.test(b)));
  });

  it("missing civic child → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.seed("initiative_analyses", dest.store.get("initiative_analyses")!.slice(1));
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(
      report.blockers.some((b) => /Missing civic child|Destination civic children/.test(b)),
    );
  });

  it("ancestry mismatch → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    const a = CANONICAL_PRODUCTION_INITIATIVE_IDS[0]!;
    const b = CANONICAL_PRODUCTION_INITIATIVE_IDS[1]!;
    dest.seed("petitions", [
      {
        _id: "pet-bad",
        petitionId: "pet-bad",
        initiativeId: a,
        subject: { initiativeId: b },
      },
    ]);
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Ambiguous\/unresolved MUST ancestry|Civic ancestry/.test(b)));
  });

  it("Vlad membership mismatch → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.store.get("memberships")![0]!.status = "cancelled";
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /active_member/.test(b)));
  });

  it("unwanted membership row for another steward → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.store.get("memberships")!.push({
      _id: "bad",
      userId: APPROVED_PRODUCTION_PARTICIPANTS[1]!.userId,
      status: "not_started",
    });
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Unexpected membership/.test(b)));
  });

  it("Stripe Test operational ID leaked into production state → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.store.get("memberships")![0]!.stripeCustomerId = "cus_test_leaked";
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /stripeCustomerId/.test(b)));
    assert.doesNotMatch(JSON.stringify(report), /cus_test_leaked/);
  });

  it("badge state mismatch → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.store.get("member_badge_applications")![0]!.paymentStatus = "pending";
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /paymentStatus/.test(b)));
  });

  it("shipping private data absent → FAIL, but never printed", async () => {
    const { source, dest, media } = seedPerfectPair();
    delete dest.store.get("member_badge_applications")![0]!.shippingAddress;
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.equal(report.shippingDataPresent, false);
    const text = JSON.stringify(report);
    assert.doesNotMatch(text, /Secret Recipient|123 Secret Street|Secret City|\+1-555-0100/);
    assert.doesNotMatch(text, /shippingAddress/);
    assertNoSecretLeak(text);
  });

  it("media record missing → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.seed("media_upload_records", []);
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /Missing media_upload_records/.test(b)));
  });

  it("R2 hash mismatch → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    const key = "initiatives/verify-0.png";
    media.destination.set(key, {
      body: Buffer.from("wrong"),
      contentType: "image/png",
      etag: "x",
      metadata: {},
    });
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /R2 integrity mismatch/.test(b)));
  });

  it("forbidden migrated operational data detected → FAIL", async () => {
    const { source, dest, media } = seedPerfectPair();
    dest.seed("membership_webhook_events", [
      { _id: "wh-1", userId: VLAD_SHAPRAN_USER_ID, eventId: "evt_staging_1" },
    ]);
    const report = await verify(source, dest, media);
    assert.equal(report.verdict, "FAIL");
    assert.ok(report.blockers.some((b) => /membership_webhook_events/.test(b)));
  });

  it("projection unavailable/restart required → distinct verdict", async () => {
    const { source, dest, media, bootstrapBaseline } = seedPerfectPair();
    const report = await verify(source, dest, media, {
      baselineBootstrap: bootstrapBaseline,
      probePublicInitiative: async () => "unavailable",
    });
    assert.equal(report.verdict, "PROJECTION_RESTART_REQUIRED");
    assert.equal(report.projectionVerification, "PROJECTION_RESTART_REQUIRED");
    assert.equal(report.blockers.length, 0);
  });

  it("zero writes on every verification path", async () => {
    const { source, dest, media } = seedPerfectPair();
    const report = await verify(source, dest, media, {
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: media.writeCount,
        deleteObjectCalls: media.deleteCount,
        recoveryStoreWrites: 0,
      },
    });
    assert.equal(media.writeCount, 0);
    assert.equal(media.deleteCount, 0);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.mutationProof.recoveryStoreWrites, 0);
  });

  it("report redaction / no secret or shipping leakage", async () => {
    const { source, dest, media } = seedPerfectPair();
    const report = await verify(source, dest, media);
    const text = JSON.stringify(report);
    assert.doesNotMatch(
      text,
      /Secret Recipient|123 Secret Street|shippingAddress|SECRET_ACCESS_KEY|mongodb(\+srv)?:\/\//i,
    );
    assertNoSecretLeak(text);
  });
});
