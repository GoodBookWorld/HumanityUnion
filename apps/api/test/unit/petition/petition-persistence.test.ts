import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import {
  createPetition,
  deletePetitionsByIdForTests,
  deleteSignaturesByPetitionIdForTests,
  getPetition,
  closePetition,
  signPetition,
  updatePetition,
} from "../../../src/modules/petition/petition.store.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  FIXTURE_INITIATIVE_ID,
  buildFixturePetition,
  seedApprovedDecision,
  seedOpenPetition,
} from "./petition-test-helpers.js";

/**
 * Recovery Task 24 Part 21 — focused persistence / signature / structure
 * tests for the Mongo-backed Petition and Petition Signature aggregates.
 * Numbering below matches Part 21 of the task exactly, for traceability.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, "../../..");
const apiSrcDir = path.join(apiRoot, "src");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];

function nextId(label: string): string {
  const id = `petition-task24-focused-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

const NONEXISTENT_MEMBER_ID = `member-does-not-exist-task24-${testRunId}`;

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const petitionId of createdPetitionIds) {
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
  }

  await disconnectMongoClient();
});

describe("Petition persistence", () => {
  it("1. Petition creation persists to Mongo", async () => {
    const petitionId = nextId("create");
    const decisionId = `decision-task24-focused-create-${testRunId}`;
    await seedApprovedDecision(decisionId, FIXTURE_INITIATIVE_ID);

    await createPetition(
      buildFixturePetition({ petitionId, decisionId, initiativeId: FIXTURE_INITIATIVE_ID }),
    );

    const document = await getMongoCollection(MONGO_COLLECTIONS.petitions).findOne({ petitionId });
    assert.ok(document);
  });

  it("2. Petition survives repository reconstruction", async () => {
    const petitionId = nextId("reconstruct");
    const decisionId = `decision-task24-focused-reconstruct-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await disconnectMongoClient();
    await connectMongoClient();

    const reloaded = await getPetition(petitionId);
    assert.ok(reloaded);
  });

  it("3. Petition survives subprocess/process restart", async () => {
    const petitionId = `petition-task24-focused-restart-${testRunId}`;
    const decisionId = `decision-task24-focused-restart-${testRunId}`;
    createdPetitionIds.push(petitionId);

    const tempDir = mkdtempSync(path.join(tmpdir(), "petition-task24-restart-"));

    try {
      const writerScript = `
        import { createDecision } from ${JSON.stringify(path.join(apiSrcDir, "modules/collective-decision/collective-decision.store.ts"))};
        import { bootstrapCollectiveDecision } from ${JSON.stringify(path.join(apiSrcDir, "modules/collective-decision/bootstrap-collective-decision.ts"))};
        import { createPetition, getPetition } from ${JSON.stringify(path.join(apiSrcDir, "modules/petition/petition.store.ts"))};
        import { defaultPetitionPolicy, bootstrapInitiativeId } from ${JSON.stringify(path.join(apiSrcDir, "modules/petition/petition.defaults.ts"))};

        const decision = { ...bootstrapCollectiveDecision, decisionId: ${JSON.stringify(decisionId)}, decisionSubjectId: bootstrapInitiativeId };
        await createDecision(decision);
        await createPetition({
          petitionId: ${JSON.stringify(petitionId)},
          collectiveDecisionId: ${JSON.stringify(decisionId)},
          status: "Draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subject: { decisionId: ${JSON.stringify(decisionId)}, initiativeId: bootstrapInitiativeId, title: "restart probe", summary: "restart probe" },
          policy: defaultPetitionPolicy,
          shareLink: null,
          signatures: [],
          supportMetrics: { totalSignatures: 0, participantSignatures: 0, dailyActivity: [], supportThresholdStatus: { thresholdDefined: false, thresholdReached: false, currentCount: 0, thresholdCount: null } },
          outcome: null,
        });
        const created = await getPetition(${JSON.stringify(petitionId)});
        console.log(JSON.stringify({ createdVisible: created !== null }));
        process.exit(0);
      `;
      const readerScript = `
        import { getPetition } from ${JSON.stringify(path.join(apiSrcDir, "modules/petition/petition.store.ts"))};
        const reloaded = await getPetition(${JSON.stringify(petitionId)});
        console.log(JSON.stringify({ visibleInFreshProcess: reloaded !== null }));
        process.exit(0);
      `;

      const writerPath = path.join(tempDir, "writer.mjs");
      const readerPath = path.join(tempDir, "reader.mjs");
      writeFileSync(writerPath, writerScript, "utf8");
      writeFileSync(readerPath, readerScript, "utf8");

      const writerResult = spawnSync(
        process.execPath,
        ["--import", "tsx", writerPath],
        { cwd: apiRoot, encoding: "utf8", timeout: 30_000 },
      );
      assert.equal(writerResult.status, 0, `writer subprocess failed: ${writerResult.stderr}`);
      const writerOutput = JSON.parse(writerResult.stdout.trim().split("\n").pop()!);
      assert.equal(writerOutput.createdVisible, true);

      const readerResult = spawnSync(
        process.execPath,
        ["--import", "tsx", readerPath],
        { cwd: apiRoot, encoding: "utf8", timeout: 30_000 },
      );
      assert.equal(readerResult.status, 0, `reader subprocess failed: ${readerResult.stderr}`);
      const readerOutput = JSON.parse(readerResult.stdout.trim().split("\n").pop()!);

      assert.equal(
        readerOutput.visibleInFreshProcess,
        true,
        "a Petition created by one process must now be visible to a freshly-started process (Mongo-backed)",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("4. Petition detail response remains unchanged", async () => {
    const petitionId = nextId("detail-shape");
    const decisionId = `decision-task24-focused-detail-shape-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const detail = await getPetition(petitionId);
    assert.ok(detail);
    // Initiative Lifecycle — Part F, Section 9 (Canonical Traceability) added
    // `traceability` (nullable until `setPetitionTraceability` is called) as
    // a real, permanent field on every Petition — this pin is intentionally
    // updated to include it, rather than left to guard against it.
    assert.deepEqual(Object.keys(detail!).sort(), [
      "collectiveDecisionId",
      "createdAt",
      "outcome",
      "petitionId",
      "policy",
      "shareLink",
      "signatures",
      "status",
      "subject",
      "supportMetrics",
      "traceability",
      "updatedAt",
    ]);
  });

  it("5. Petition lifecycle transitions persist", async () => {
    const petitionId = nextId("lifecycle");
    const decisionId = `decision-task24-focused-lifecycle-${testRunId}`;
    const opened = await seedOpenPetition(petitionId, decisionId);
    assert.equal(opened.status, "Open");

    await closePetition(petitionId);
    await disconnectMongoClient();
    await connectMongoClient();

    const reloaded = await getPetition(petitionId);
    assert.equal(reloaded?.status, "Closed");
  });

  it("6. Petition Initiative ID is immutable", async () => {
    const petitionId = nextId("immutable");
    const decisionId = `decision-task24-focused-immutable-${testRunId}`;
    await seedApprovedDecision(decisionId, FIXTURE_INITIATIVE_ID);
    await createPetition(
      buildFixturePetition({ petitionId, decisionId, initiativeId: FIXTURE_INITIATIVE_ID }),
    );

    const updated = await updatePetition(petitionId, {
      subject: { initiativeId: "initiative-attempted-hijack-task24" } as never,
    });

    assert.equal(updated?.subject.initiativeId, FIXTURE_INITIATIVE_ID);
  });

  it("7. Nonexistent Initiative is rejected", async () => {
    const petitionId = nextId("no-initiative");
    const decisionId = `decision-task24-focused-no-initiative-${testRunId}`;
    const probeInitiativeId = "initiative-does-not-exist-task24-focused-probe";
    assert.equal(getInitiativeById(probeInitiativeId), null);

    await seedApprovedDecision(decisionId, probeInitiativeId);

    await assert.rejects(
      () =>
        createPetition(
          buildFixturePetition({ petitionId, decisionId, initiativeId: probeInitiativeId }),
        ),
      /does not exist/i,
    );
  });

  it("8. Initiative validation occurs once at creation", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const occurrences = source.match(/validateDirectInitiativeAncestry\(/g) ?? [];
    assert.equal(occurrences.length, 1);
  });

  it("9. Petition is not persisted after ancestry failure", async () => {
    const petitionId = nextId("no-persist-on-ancestry-failure");
    const decisionId = `decision-task24-focused-no-persist-${testRunId}`;
    const probeInitiativeId = "initiative-does-not-exist-task24-focused-probe-2";

    await seedApprovedDecision(decisionId, probeInitiativeId);

    await assert.rejects(() =>
      createPetition(
        buildFixturePetition({ petitionId, decisionId, initiativeId: probeInitiativeId }),
      ),
    );

    const document = await getMongoCollection(MONGO_COLLECTIONS.petitions).findOne({ petitionId });
    assert.equal(document, null);
  });

  it("10. Collective Decision failure prevents persistence", async () => {
    const petitionId = nextId("no-decision");
    const decisionId = `decision-task24-focused-does-not-exist-${testRunId}`;

    await assert.rejects(() =>
      createPetition(
        buildFixturePetition({ petitionId, decisionId, initiativeId: FIXTURE_INITIATIVE_ID }),
      ),
      /was not found/,
    );

    const document = await getMongoCollection(MONGO_COLLECTIONS.petitions).findOne({ petitionId });
    assert.equal(document, null);
  });
});

describe("Signature persistence", () => {
  it("11. Successful signing inserts one Signature document", async () => {
    const petitionId = nextId("sig-insert");
    const decisionId = `decision-task24-focused-sig-insert-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await signPetition(petitionId, sampleMember.id);

    const count = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(count, 1);
  });

  it("12. Signature has stable ID", async () => {
    const petitionId = nextId("sig-stable-id");
    const decisionId = `decision-task24-focused-sig-stable-id-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id);
    const signatureId = signed?.signatures[0]?.signatureId;

    assert.equal(typeof signatureId, "string");
    assert.ok(signatureId!.length > 0);

    const reloaded = await getPetition(petitionId);
    assert.equal(reloaded?.signatures[0]?.signatureId, signatureId);
  });

  it("13. Signature response shape remains unchanged", async () => {
    const petitionId = nextId("sig-shape");
    const decisionId = `decision-task24-focused-sig-shape-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id, "Community");
    const signature = signed!.signatures[0]!;

    assert.deepEqual(Object.keys(signature).sort(), [
      "participantId",
      "participationMode",
      "petitionId",
      "signatureId",
      "signedAt",
      "status",
      "visibility",
    ]);
    assert.equal("initiativeId" in signature, false, "internal initiativeId snapshot must not leak into the public Signature shape");
  });

  it("14. Signature list is reconstructed in Petition reads", async () => {
    const petitionId = nextId("sig-projection");
    const decisionId = `decision-task24-focused-sig-projection-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await signPetition(petitionId, sampleMember.id);

    const reloaded = await getPetition(petitionId);
    assert.equal(reloaded?.signatures.length, 1);
    assert.equal(reloaded?.signatures[0]?.participantId, sampleMember.id);
  });

  it("15. Signature ordering remains unchanged (signedAt ascending)", async () => {
    const source = readFileSync(
      path.join(apiSrcDir, "modules/petition/persistence/petition-signature.repository.ts"),
      "utf8",
    );

    assert.match(source, /\.sort\(\{\s*signedAt:\s*1\s*\}\)/);
  });

  it("16. Duplicate sequential signing returns existing duplicate error", async () => {
    const petitionId = nextId("sig-dup-seq");
    const decisionId = `decision-task24-focused-sig-dup-seq-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await signPetition(petitionId, sampleMember.id);
    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /already signed/);
  });

  it("17/18. Concurrent duplicate signing produces exactly one stored Signature (one success, one failure)", async () => {
    const petitionId = nextId("sig-dup-concurrent");
    const decisionId = `decision-task24-focused-sig-dup-concurrent-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const results = await Promise.allSettled([
      signPetition(petitionId, sampleMember.id),
      signPetition(petitionId, sampleMember.id),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const count = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(count, 1);
  });

  it("19. Process restart preserves Signature", async () => {
    const petitionId = nextId("sig-restart");
    const decisionId = `decision-task24-focused-sig-restart-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await signPetition(petitionId, sampleMember.id);

    await disconnectMongoClient();
    await connectMongoClient();

    const reloaded = await getPetition(petitionId);
    assert.equal(reloaded?.signatures.length, 1);
  });

  it("20. Signing performs zero Initiative lookups", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const signPetitionBody = source.slice(
      source.indexOf("export async function signPetition"),
      source.indexOf("export async function closePetition"),
    );

    assert.equal(/getInitiativeById\(/.test(signPetitionBody), false);
  });

  it("21. Signing uses Petition's persisted Initiative ID", async () => {
    const petitionId = nextId("sig-uses-persisted-initiative");
    const decisionId = `decision-task24-focused-sig-uses-persisted-initiative-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await signPetition(petitionId, sampleMember.id);

    const signatureDocument = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).findOne({
      petitionId,
    });
    assert.equal(signatureDocument?.initiativeId, FIXTURE_INITIATIVE_ID);
  });

  it("22. Closed Petition cannot be signed", async () => {
    const petitionId = nextId("sig-closed");
    const decisionId = `decision-task24-focused-sig-closed-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await closePetition(petitionId);

    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /not open for signing/);
  });

  it("23. Failed eligibility produces no Signature", async () => {
    const petitionId = nextId("sig-ineligible");
    const decisionId = `decision-task24-focused-sig-ineligible-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    await assert.rejects(
      () => signPetition(petitionId, NONEXISTENT_MEMBER_ID),
      /not eligible/,
    );

    const count = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).countDocuments({
      petitionId,
    });
    assert.equal(count, 0);
  });

  it("24. Failed Signature insert produces no partial state (duplicate-key path)", async () => {
    // A full storage-layer fault injection hook does not exist for the
    // Petition Signature repository (Task 24 does not add one — out of
    // scope per Part 29's "not allowed" list). The one reliably
    // reproducible non-happy-path insert failure is the duplicate-key path
    // already exercised above (#17/18): the losing concurrent insert leaves
    // no partial Signature document, which this test re-confirms at the
    // Mongo layer directly.
    const petitionId = nextId("sig-no-partial-state");
    const decisionId = `decision-task24-focused-sig-no-partial-state-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const results = await Promise.allSettled([
      signPetition(petitionId, sampleMember.id),
      signPetition(petitionId, sampleMember.id),
    ]);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const documents = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures)
      .find({ petitionId })
      .toArray();
    assert.equal(documents.length, 1, "the failed insert must not leave a partial/duplicate document");
  });

  it("25. Existing participation modes remain supported", async () => {
    const communityPetitionId = nextId("sig-mode-community");
    const communityDecisionId = `decision-task24-focused-sig-mode-community-${testRunId}`;
    await seedOpenPetition(communityPetitionId, communityDecisionId);
    const communitySigned = await signPetition(communityPetitionId, sampleMember.id, "Community");
    assert.equal(communitySigned?.signatures[0]?.participationMode, "Community");

    const publicPetitionId = nextId("sig-mode-public");
    const publicDecisionId = `decision-task24-focused-sig-mode-public-${testRunId}`;
    await seedOpenPetition(publicPetitionId, publicDecisionId);
    const publicSigned = await signPetition(publicPetitionId, sampleMember.id, "Public");
    assert.equal(publicSigned?.signatures[0]?.participationMode, "Public");
  });
});

describe("Persistence structure", () => {
  it("26. Petition document contains no embedded signatures", async () => {
    const petitionId = nextId("structure-no-embedded-signatures");
    const decisionId = `decision-task24-focused-structure-no-embedded-signatures-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await signPetition(petitionId, sampleMember.id);

    const document = await getMongoCollection(MONGO_COLLECTIONS.petitions).findOne({ petitionId });
    assert.equal("signatures" in (document ?? {}), false);
    assert.equal("supportMetrics" in (document ?? {}), false);
    assert.equal("outcome" in (document ?? {}), false);
  });

  it("27. Signature collection contains no mutable Petition content", async () => {
    const petitionId = nextId("structure-signature-no-petition-content");
    const decisionId = `decision-task24-focused-structure-signature-no-petition-content-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);
    await signPetition(petitionId, sampleMember.id);

    const document = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).findOne({
      petitionId,
    });
    assert.ok(document);
    assert.deepEqual(Object.keys(document!).sort(), [
      "_id",
      "initiativeId",
      "memberId",
      "participationMode",
      "petitionId",
      "signatureId",
      "signedAt",
      "status",
      "visibility",
    ]);
  });

  it("28. Unique indexes exist", async () => {
    const petitionIndexes = await getMongoCollection(MONGO_COLLECTIONS.petitions).indexes();
    const signatureIndexes = await getMongoCollection(MONGO_COLLECTIONS.petitionSignatures).indexes();

    const petitionIndexNames = petitionIndexes.map((index) => index.name);
    const signatureIndexNames = signatureIndexes.map((index) => index.name);

    assert.ok(petitionIndexNames.includes("petitions_petition_id_unique"));
    assert.ok(petitionIndexNames.includes("petitions_collective_decision_id_unique"));
    assert.ok(signatureIndexNames.includes("petition_signatures_signature_id_unique"));
    assert.ok(signatureIndexNames.includes("petition_signatures_petition_member_unique"));

    const petitionIdUniqueIndex = petitionIndexes.find(
      (index) => index.name === "petitions_petition_id_unique",
    );
    const memberUniqueIndex = signatureIndexes.find(
      (index) => index.name === "petition_signatures_petition_member_unique",
    );

    assert.equal(petitionIdUniqueIndex?.unique, true);
    assert.equal(memberUniqueIndex?.unique, true);
  });

  it("29. No process-global Petition Map remains authoritative", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    assert.equal(/new Map<string, Petition>/.test(source), false);
  });

  it("30. No snapshot persistence adapter is used", () => {
    const storeSource = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const petitionRepoSource = readFileSync(
      path.join(apiSrcDir, "modules/petition/persistence/petition.repository.ts"),
      "utf8",
    );
    const signatureRepoSource = readFileSync(
      path.join(apiSrcDir, "modules/petition/persistence/petition-signature.repository.ts"),
      "utf8",
    );

    for (const source of [storeSource, petitionRepoSource, signatureRepoSource]) {
      assert.equal(source.includes("create-mongo-snapshot-persistence"), false);
      assert.equal(source.includes("createMongoSnapshotPersistence"), false);
    }
  });
});
