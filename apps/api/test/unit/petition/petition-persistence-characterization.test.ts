import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { CIVIC_ARTIFACT_TYPES, CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import {
  deletePetitionsByIdForTests,
  deletePetitionsByInitiativeIdForTests,
  deleteSignaturesByPetitionIdForTests,
  getPetition,
  signPetition,
} from "../../../src/modules/petition/petition.store.js";
import * as petitionStore from "../../../src/modules/petition/petition.store.js";
import * as petitionIndex from "../../../src/modules/petition/index.js";
import { sampleMember } from "../../../src/modules/member/member.sample.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { FIXTURE_INITIATIVE_ID, seedOpenPetition } from "./petition-test-helpers.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiSrcDir = path.resolve(currentDir, "../../../src");

/**
 * Recovery Task 24 — "Implement Mongo-Backed Petition and Petition Signature
 * Aggregates with Direct Initiative Validation and Transactional Signing".
 *
 * This file used to pin the PRE-migration behavior documented in
 * `architecture/recovery/PETITION_PERSISTENCE_AND_INITIATIVE_BOUNDARY_v1.0.md`
 * (process-local `Map` storage, no Initiative existence check, a reproduced
 * concurrent-duplicate-signature race). Task 24 closes every one of those
 * defects. Per Recovery Task 24 Part 20, this file is REWRITTEN — not
 * deleted — into migration-assertion tests that document what changed and
 * assert the new target guarantees. Each `describe` block below states the
 * historical finding it replaces before asserting the new behavior.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const createdPetitionIds: string[] = [];

function nextId(label: string): string {
  const id = `petition-task24-${label}-${testRunId}`;
  createdPetitionIds.push(id);
  return id;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const petitionId of createdPetitionIds) {
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);
  }

  await deletePetitionsByInitiativeIdForTests(
    "initiative-does-not-exist-task24-probe",
  );
  await disconnectMongoClient();
});

describe("1. Petition persistence is now Mongo-backed, not an in-process Map (closes Task 23 §1.6)", () => {
  it("petition.store.ts no longer declares a bare in-process Petition Map", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");

    assert.equal(/const petitions = new Map<string, Petition>/.test(source), false);
  });

  it("petition.store.ts and its persistence layer now use runMongoTransaction and a ClientSession for signing", () => {
    const storeSource = readFileSync(
      path.join(apiSrcDir, "modules/petition/petition.store.ts"),
      "utf8",
    );
    const repositorySource = readFileSync(
      path.join(apiSrcDir, "modules/petition/persistence/petition-signature.repository.ts"),
      "utf8",
    );

    assert.match(storeSource, /runMongoTransaction/);
    assert.match(repositorySource, /ClientSession/);
  });

  it("a Petition created through the store is independently readable directly from the petitions Mongo collection", async () => {
    const petitionId = nextId("mongo-backed");
    const decisionId = `decision-task24-mongo-backed-${testRunId}`;

    await seedOpenPetition(petitionId, decisionId);

    const rawDocument = await getMongoCollection(MONGO_COLLECTIONS.petitions).findOne({
      petitionId,
    });

    assert.ok(rawDocument, "Petition must be persisted as a document in the petitions collection");
    assert.equal(rawDocument.status, "Open");
    assert.equal(rawDocument.subject.initiativeId, FIXTURE_INITIATIVE_ID);
    assert.equal("signatures" in rawDocument, false, "Petition document must not embed signatures");
  });
});

describe("2. Nonexistent Initiative is now rejected at Petition creation (closes Task 23 §1.8 / Task 22 stop condition)", () => {
  const probeInitiativeId = "initiative-does-not-exist-task24-probe";
  const probeDecisionId = `decision-task24-probe-2-${testRunId}`;
  const probePetitionId = `petition-task24-probe-2-${testRunId}`;

  it("the probe initiativeId genuinely does not exist", () => {
    assert.equal(getInitiativeById(probeInitiativeId), null);
  });

  it("creating a Petition against that Initiative now throws and persists nothing", async () => {
    await assert.rejects(
      () => seedOpenPetition(probePetitionId, probeDecisionId, probeInitiativeId),
      /does not exist/i,
    );

    const persisted = await getPetition(probePetitionId);
    assert.equal(persisted, null, "rejected ancestry must leave no Petition document behind");
  });
});

describe("4. Duplicate-signature behavior — sequential unchanged, concurrent race now closed (closes Task 23 §1.7 KNOWN DEFECT)", () => {
  it("sequential duplicate signing by the same participant is still rejected", async () => {
    const petitionId = nextId("dup-seq");
    const decisionId = `decision-task24-dup-seq-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const first = await signPetition(petitionId, sampleMember.id);
    assert.equal(first?.signatures.length, 1);

    await assert.rejects(() => signPetition(petitionId, sampleMember.id), /already signed/);

    const persisted = await getPetition(petitionId);
    assert.equal(persisted?.signatures.length, 1, "sequential duplicate must not create a second signature");
  });

  it("FIXED — concurrent duplicate signing by the same participant now produces exactly one stored Signature", async () => {
    const petitionId = nextId("dup-race");
    const decisionId = `decision-task24-dup-race-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    // Historical note: pre-Task-24, signPetition's duplicate check ran
    // synchronously BEFORE the only await point, so two concurrent calls for
    // the same participant both passed the duplicate check before either
    // appended, producing two active signatures with an identical,
    // non-unique signatureId (Task 23 §1.7, "KNOWN DEFECT"). Task 24 closes
    // this by making the Signature insert transactional and backed by a
    // `unique(petitionId, memberId)` Mongo index, so the database itself is
    // now the final duplicate authority regardless of application-level
    // timing.
    const results = await Promise.allSettled([
      signPetition(petitionId, sampleMember.id),
      signPetition(petitionId, sampleMember.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1, "exactly one concurrent signing attempt must succeed");
    assert.equal(rejected.length, 1, "exactly one concurrent signing attempt must fail as a duplicate");

    const finalPetition = await getPetition(petitionId);
    assert.equal(
      finalPetition?.signatures.length,
      1,
      "concurrent duplicate signing must produce exactly one stored Signature",
    );
  });
});

describe("5/6. Petition and signature lookup counts during signing (unchanged target: 1 Petition lookup, 0 Initiative lookups)", () => {
  it("signPetition reads the Petition exactly once via findPetitionById", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    // Slice ends at the next export (`withdrawPetitionSignature`, added by
    // Initiative Lifecycle — Part F Section 8). Ending at `closePetition`
    // would incorrectly include the withdrawal helper's own lookup.
    const signPetitionBody = source.slice(
      source.indexOf("export async function signPetition"),
      source.indexOf("export async function withdrawPetitionSignature"),
    );

    const petitionLookupOccurrences = signPetitionBody.match(/findPetitionById\(/g) ?? [];
    assert.equal(petitionLookupOccurrences.length, 1);
  });

  it("signPetition performs zero Initiative lookups — the persisted, creation-validated initiativeId is trusted as-is", () => {
    const source = readFileSync(path.join(apiSrcDir, "modules/petition/petition.store.ts"), "utf8");
    const signPetitionBody = source.slice(
      source.indexOf("export async function signPetition"),
      source.indexOf("export async function withdrawPetitionSignature"),
    );

    assert.equal(/getInitiativeById\(/.test(signPetitionBody), false);
    assert.equal(/validateDirectInitiativeAncestry\(/.test(signPetitionBody), false);
  });
});

describe("7/8. Petition detail response and Signature shape remain unchanged (API compatibility)", () => {
  it("the signing response embeds the same public Signature shape inside the returned Petition", async () => {
    const petitionId = nextId("shape");
    const decisionId = `decision-task24-shape-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    const signed = await signPetition(petitionId, sampleMember.id, "Public");

    assert.ok(signed);
    assert.equal(Array.isArray(signed!.signatures), true);
    assert.equal(signed!.signatures.length, 1);

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
    assert.equal(signature.petitionId, petitionId);
    assert.equal(signature.participantId, sampleMember.id);
    assert.equal(signature.status, "Active");
    assert.equal(signature.participationMode, "Public");
    assert.equal(typeof signature.signatureId, "string");
    assert.ok(signature.signatureId.length > 0);
  });

  it("signatures are still not independently addressable via a public get-signature-by-id export", () => {
    const exportedNames = Object.keys(petitionIndex);

    for (const name of exportedNames) {
      assert.equal(
        /signature/i.test(name) && /^get/i.test(name),
        false,
        `unexpected addressable signature export "${name}"`,
      );
    }
  });
});

describe("9. Process-local reset behavior — narrow ForTests cleanup helpers now exist (closes Task 23 §1.10 gap)", () => {
  it("the petition module now exports narrow, exact-selector ForTests cleanup helpers", () => {
    // Intentionally checked on `petition.store.ts` directly, not the public
    // `index.ts` barrel: Part 19 requires "no HTTP exposure" for these
    // test-only helpers, so they are deliberately left out of the module's
    // normal public surface.
    const exportedNames = Object.keys(petitionStore);
    const forTestsExports = exportedNames.filter((name) => /ForTests$/.test(name));

    assert.ok(
      forTestsExports.length > 0,
      "expected at least one ForTests cleanup export from the petition module",
    );

    for (const name of forTestsExports) {
      assert.match(
        name,
        /^delete(Petitions|Signatures)By(Id|InitiativeId|PetitionId|MemberId)ForTests$/,
        `ForTests export "${name}" must use an exact-selector naming convention, not a wildcard`,
      );
    }
  });

  it("no ForTests helper accepts a wildcard/delete-all invocation", async () => {
    // Exact-selector contract: calling with a random, non-matching selector
    // must delete nothing.
    const deletedCount = await deletePetitionsByIdForTests(
      `nonexistent-petition-${testRunId}`,
    );
    assert.equal(deletedCount, 0);
  });
});

describe("10. FIXED — Petition now survives repository/process reconstruction (closes Task 23 §1.6 restart-loss defect)", () => {
  it("a Petition created before disconnecting is still readable from a freshly-reconnected Mongo client", async () => {
    const petitionId = nextId("restart");
    const decisionId = `decision-task24-restart-${testRunId}`;
    await seedOpenPetition(petitionId, decisionId);

    // Historical note: pre-Task-24, `petitions` was a bare in-process Map —
    // a Petition created in one Node process was invisible to a freshly
    // spawned process (Task 23 §1.6, proven via a writer/reader subprocess
    // pair). Task 24 replaces the Map with Mongo-backed persistence, so
    // disconnecting and reconnecting the Mongo client — the in-process
    // equivalent of "this process no longer holds the state in memory" —
    // must not lose the Petition. (A true separate-OS-process reload is
    // exercised end-to-end by `verify-petition-persistence.ts`, run twice.)
    await disconnectMongoClient();
    await connectMongoClient();

    const reloaded = await getPetition(petitionId);
    assert.ok(reloaded, "Petition must survive Mongo client reconnection");
    assert.equal(reloaded!.petitionId, petitionId);
    assert.equal(reloaded!.status, "Open");
  });
});

describe("11. Petition remains mapped to the canonical civic artifact vocabulary (unchanged)", () => {
  it('"petition" is a CIVIC_ARTIFACT_TYPE mapped to the "petition" module', () => {
    assert.equal((CIVIC_ARTIFACT_TYPES as readonly string[]).includes("petition"), true);
    assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.petition, "petition");
  });
});

describe("12. FIXED — the PetitionSigned durable event now exists (Task 24 explicitly did not add it; Recovery Task 25 closes that precondition)", () => {
  it("CATALOGUE_EVENTS contains exactly one Petition-related entry: petitionSigned/PetitionSigned", () => {
    const entries = Object.entries(CATALOGUE_EVENTS);
    const petitionRelated = entries.filter(
      ([key, value]) => /petition/i.test(key) || /petition/i.test(value),
    );

    assert.deepEqual(petitionRelated, [["petitionSigned", "PetitionSigned"]]);
  });
});
