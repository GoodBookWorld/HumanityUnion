import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db, Document } from "mongodb";

import {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID,
  InMemoryMediaCopyExecutor,
  MEDIA_RECOVERY_COLLECTION,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  R2_MIGRATION_OWNERSHIP_MARKER,
  R2_MIGRATION_OWNERSHIP_METADATA_KEYS,
  VLAD_SHAPRAN_USER_ID,
  assertNoSecretLeak,
  classifyDestinationR2Residual,
  classifyRecoveryRowResidualKind,
  classifyVladProfileVisibilityResidual,
  runFailedExecutionResidualAudit,
} from "../../../src/modules/production-initiative-migration/index.js";

type MemDoc = Document & { _id?: string };

const FAILED_EXEC = FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID;
const VLAD_PROFILE_ID = APPROVED_PRODUCTION_PARTICIPANTS[0]!.profileId;

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
  for (const [key, value] of filterEntries(filter)) {
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

function filterEntries(filter: Document): Array<[string, unknown]> {
  return Object.entries(filter);
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
  async countDocuments(filter: Document = {}) {
    return this.rows().filter((doc) => matchesFilter(doc, filter)).length;
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

function seedSourceMediaPlan(source: MemoryDb, media: InMemoryMediaCopyExecutor): string[] {
  const keys: string[] = [];
  const mediaDocs: MemDoc[] = [];
  for (let i = 0; i < EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS; i += 1) {
    const storageKey = `initiatives/residual-audit-${i}.png`;
    keys.push(storageKey);
    const body = Buffer.from(`residual-media-${i}`);
    media.seedSource(storageKey, body);
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
  source.seed(
    "initiatives",
    CANONICAL_PRODUCTION_INITIATIVE_IDS.map((initiativeId) => ({
      _id: initiativeId,
      initiativeId,
      title: initiativeId,
    })),
  );
  source.seed("media_upload_records", mediaDocs);
  source.seed("shared_documents", []);
  source.seed("member_profiles", [
    {
      _id: VLAD_PROFILE_ID,
      profileId: VLAD_PROFILE_ID,
      userId: VLAD_SHAPRAN_USER_ID,
      membershipPubliclyVisible: false,
    },
  ]);
  return keys;
}

/** Post-rollback clean destination: no migration payload; recovery evidence optional. */
function seedCleanDestination(dest: MemoryDb, opts?: {
  profileVisible?: boolean | null;
  profileFieldAbsent?: boolean;
  recoveryStatuses?: Array<{ storageKey: string; status: string }>;
}) {
  dest.seed("initiatives", []);
  dest.seed("memberships", []);
  dest.seed("membership_contributions", []);
  dest.seed("member_badge_applications", []);
  dest.seed("media_upload_records", []);
  dest.seed("shared_documents", []);
  dest.seed("initiative_analyses", []);

  if (opts?.profileFieldAbsent) {
    dest.seed("member_profiles", [
      {
        _id: VLAD_PROFILE_ID,
        profileId: VLAD_PROFILE_ID,
        userId: VLAD_SHAPRAN_USER_ID,
      },
    ]);
  } else {
    dest.seed("member_profiles", [
      {
        _id: VLAD_PROFILE_ID,
        profileId: VLAD_PROFILE_ID,
        userId: VLAD_SHAPRAN_USER_ID,
        membershipPubliclyVisible: opts?.profileVisible ?? true,
      },
    ]);
  }

  if (opts?.recoveryStatuses) {
    dest.seed(
      MEDIA_RECOVERY_COLLECTION,
      opts.recoveryStatuses.map((row, i) => ({
        _id: `rec-${i}`,
        migrationExecutionId: FAILED_EXEC,
        storageKey: row.storageKey,
        status: row.status,
      })),
    );
  } else {
    dest.seed(MEDIA_RECOVERY_COLLECTION, []);
  }
}

async function audit(
  source: MemoryDb,
  dest: MemoryDb,
  media: InMemoryMediaCopyExecutor,
  extras: Partial<Parameters<typeof runFailedExecutionResidualAudit>[0]> = {},
) {
  return runFailedExecutionResidualAudit({
    sourceDb: source.asDb(),
    destinationDb: dest.asDb(),
    mediaReader: media,
    migrationExecutionId: FAILED_EXEC,
    baselineMembershipPubliclyVisible: true,
    mutationCounters: {
      mongoWrites: 0,
      putObjectCalls: 0,
      deleteObjectCalls: 0,
      recoveryStoreWrites: 0,
    },
    ...extras,
  });
}

describe("Failed-execution residual audit — classifiers", () => {
  it("classifies recovery row residual kinds", () => {
    assert.equal(classifyRecoveryRowResidualKind("rollback_deleted"), "HISTORICAL_EVIDENCE_ONLY");
    assert.equal(classifyRecoveryRowResidualKind("created_verified"), "ACTIVE_OWNERSHIP_CLAIM");
    assert.equal(classifyRecoveryRowResidualKind("rollback_failed"), "ROLLBACK_FAILED_CLAIM");
    assert.equal(classifyRecoveryRowResidualKind("weird"), "INDETERMINATE");
  });

  it("classifies R2 residuals", () => {
    assert.equal(
      classifyDestinationR2Residual({
        sourceReadable: true,
        observed: null,
        failedExecutionId: FAILED_EXEC,
      }),
      "ABSENT",
    );
    assert.equal(
      classifyDestinationR2Residual({
        sourceReadable: true,
        observed: {
          contentLength: 1,
          contentType: "image/png",
          checksumSHA256: "a".repeat(64),
          ownership: {
            kind: "owned",
            migrationExecutionId: FAILED_EXEC,
            marker: R2_MIGRATION_OWNERSHIP_MARKER,
          },
          rawOwnershipExecutionId: FAILED_EXEC,
          rawOwnershipMarker: R2_MIGRATION_OWNERSHIP_MARKER,
        },
        failedExecutionId: FAILED_EXEC,
      }),
      "OWNED_BY_FAILED_EXECUTION",
    );
  });

  it("classifies profile visibility states", () => {
    assert.equal(
      classifyVladProfileVisibilityResidual({
        current: true,
        fieldPresent: true,
        sourceApplied: false,
        baselinePrevious: true,
        phaseBLikelyCompleted: true,
      }).classification,
      "ROLLBACK_RESTORED",
    );
    assert.equal(
      classifyVladProfileVisibilityResidual({
        current: false,
        fieldPresent: true,
        sourceApplied: false,
        baselinePrevious: true,
        phaseBLikelyCompleted: true,
      }).classification,
      "RESIDUAL_PATCH",
    );
    assert.equal(
      classifyVladProfileVisibilityResidual({
        current: true,
        fieldPresent: true,
        sourceApplied: false,
        baselinePrevious: undefined,
        phaseBLikelyCompleted: true,
      }).classification,
      "INDETERMINATE",
    );
    assert.equal(
      classifyVladProfileVisibilityResidual({
        current: true,
        fieldPresent: true,
        sourceApplied: false,
        baselinePrevious: true,
        phaseBLikelyCompleted: false,
      }).classification,
      "UNCHANGED",
    );
  });
});

describe("Failed-execution residual audit — Task 07.7.6", () => {
  it("clean completed rollback → CLEAN_FOR_FRESH_DRY_RUN", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, {
      profileVisible: true,
      recoveryStatuses: keys.map((storageKey) => ({
        storageKey,
        status: "rollback_deleted",
      })),
    });

    const report = await audit(source, dest, media);
    assert.equal(report.verdict, "CLEAN_FOR_FRESH_DRY_RUN");
    assert.equal(report.destinationPayload.payloadResidual, false);
    assert.equal(report.vladProfileVisibility.classification, "ROLLBACK_RESTORED");
    assert.equal(report.durableRecovery.rowCount, EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS);
    assert.equal(report.destinationR2.byClassification.ABSENT, EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS);
    assert.equal(report.mutationProof.mongoWrites, 0);
    assert.equal(report.mutationProof.putObjectCalls, 0);
    assert.equal(report.mutationProof.deleteObjectCalls, 0);
    assert.equal(report.mutationProof.recoveryStoreWrites, 0);
    assertNoSecretLeak(JSON.stringify(report));
  });

  it("recovery evidence remains but payload/R2 absent → CLEAN", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, {
      profileVisible: true,
      recoveryStatuses: keys.slice(0, 3).map((storageKey) => ({
        storageKey,
        status: "rollback_deleted",
      })),
    });
    const report = await audit(source, dest, media);
    assert.equal(report.verdict, "CLEAN_FOR_FRESH_DRY_RUN");
    assert.ok(report.durableRecovery.rowCount > 0);
    assert.equal(report.destinationR2.ownedByFailedExecutionKeys.length, 0);
  });

  it("owned R2 residual → RESIDUAL_CLEANUP_REQUIRED", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, {
      profileVisible: true,
      recoveryStatuses: keys.map((storageKey) => ({
        storageKey,
        status: "rollback_deleted",
      })),
    });
    const leftover = keys[0]!;
    media.seedDestination(leftover, Buffer.from("residual-media-0"), "image/png", {
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.executionId]: FAILED_EXEC,
      [R2_MIGRATION_OWNERSHIP_METADATA_KEYS.marker]: R2_MIGRATION_OWNERSHIP_MARKER,
    });

    const report = await audit(source, dest, media);
    assert.equal(report.verdict, "RESIDUAL_CLEANUP_REQUIRED");
    assert.ok(report.destinationR2.ownedByFailedExecutionKeys.includes(leftover));
    assert.ok(report.ownershipConsistency.contradictions.some((c) => /rollback_deleted/.test(c)));
  });

  it("Mongo residual → RESIDUAL_CLEANUP_REQUIRED", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, { profileVisible: true });
    dest.seed("initiatives", [
      {
        _id: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
        initiativeId: CANONICAL_PRODUCTION_INITIATIVE_IDS[0],
        title: "leftover",
      },
    ]);

    const report = await audit(source, dest, media);
    assert.equal(report.verdict, "RESIDUAL_CLEANUP_REQUIRED");
    assert.equal(report.destinationPayload.payloadResidual, true);
    assert.equal(report.destinationPayload.rootsCount, 1);
  });

  it("profile patch restored → ROLLBACK_RESTORED + CLEAN", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, {
      profileVisible: true,
      recoveryStatuses: [{ storageKey: keys[0]!, status: "rollback_deleted" }],
    });
    const report = await audit(source, dest, media, {
      baselineMembershipPubliclyVisible: true,
    });
    assert.equal(report.vladProfileVisibility.classification, "ROLLBACK_RESTORED");
    assert.equal(report.verdict, "CLEAN_FOR_FRESH_DRY_RUN");
  });

  it("profile patch residual → RESIDUAL_CLEANUP_REQUIRED", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, { profileVisible: false });
    const report = await audit(source, dest, media, {
      baselineMembershipPubliclyVisible: true,
    });
    assert.equal(report.vladProfileVisibility.classification, "RESIDUAL_PATCH");
    assert.equal(report.verdict, "RESIDUAL_CLEANUP_REQUIRED");
  });

  it("profile state indeterminate → AUDIT_INDETERMINATE", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, { profileVisible: true });
    const report = await audit(source, dest, media, {
      baselineMembershipPubliclyVisible: undefined,
    });
    assert.equal(report.vladProfileVisibility.classification, "INDETERMINATE");
    assert.equal(report.verdict, "AUDIT_INDETERMINATE");
  });

  it("recovery/object contradiction (active claim, object absent) → AUDIT_INDETERMINATE", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    const keys = seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, {
      profileVisible: true,
      recoveryStatuses: [{ storageKey: keys[0]!, status: "created_verified" }],
    });
    const report = await audit(source, dest, media);
    assert.equal(report.verdict, "AUDIT_INDETERMINATE");
    assert.ok(report.ownershipConsistency.contradictions.length > 0);
  });

  it("zero mutation proof — refuses CLEAN when counters nonzero", async () => {
    const source = new MemoryDb();
    const dest = new MemoryDb();
    const media = new InMemoryMediaCopyExecutor();
    seedSourceMediaPlan(source, media);
    seedCleanDestination(dest, { profileVisible: true });
    const report = await audit(source, dest, media, {
      mutationCounters: {
        mongoWrites: 1,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        recoveryStoreWrites: 0,
      },
    });
    assert.notEqual(report.verdict, "CLEAN_FOR_FRESH_DRY_RUN");
    assert.equal(report.mutationProof.mongoWrites, 1);
    assert.ok(report.blockers.some((b) => /mutation detected/i.test(b)));
  });
});
