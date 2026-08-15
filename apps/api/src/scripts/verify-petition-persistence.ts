/**
 * Recovery Task 24 Part 22 — bounded Petition persistence verification.
 *
 * Proves, end-to-end against a real MongoDB instance, that:
 *   1. a Petition created via the store is durably persisted;
 *   2. it survives being read from a freshly-started OS process;
 *   3. the full Draft → Ready → Published → Open lifecycle persists;
 *   4. signing inserts exactly one Signature document;
 *   5. concurrent duplicate signing by the same Member produces exactly
 *      one stored Signature (Recovery Task 23's proven race, closed);
 *   6. the Signature also survives a freshly-started OS process.
 *
 * No `PetitionSigned` (or any other) durable event is asserted or expected
 * — Task 24 explicitly does not add one.
 *
 * Run: tsx src/scripts/verify-petition-persistence.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned Petition/Signature fixture is deleted in a `finally` block)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Initiative } from "@hu/types";

import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "./run-verification-subprocess.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const RELOAD_SCRIPT_PATH = path.resolve(path.dirname(SCRIPT_PATH), "verify-petition-persistence-reload.ts");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function reload(petitionId: string, expectedStatus: string, expectedSignatureCount?: number): void {
  const args = [petitionId, expectedStatus];

  if (expectedSignatureCount !== undefined) {
    args.push(String(expectedSignatureCount));
  }

  const result = runVerificationSubprocess(RELOAD_SCRIPT_PATH, args);
  assertVerificationSubprocessSucceeded(result, "verify-petition-persistence-reload.ts");
}

async function main(): Promise<void> {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const initiativeId = `initiative-petition-persistence-verify-${runId}`;
  const decisionId = `decision-petition-persistence-verify-${runId}`;
  const petitionId = `petition-petition-persistence-verify-${runId}`;
  const signerMemberId = "member-bootstrap-001";

  const { createInitiative } = await import("../modules/initiatives/initiative.store.js");
  const { createDecision } = await import("../modules/collective-decision/collective-decision.store.js");
  const { bootstrapCollectiveDecision } = await import(
    "../modules/collective-decision/bootstrap-collective-decision.js"
  );
  const {
    createPetition,
    preparePetition,
    publishPetition,
    openPetition,
    signPetition,
    getPetition,
    deletePetitionsByIdForTests,
    deleteSignaturesByPetitionIdForTests,
  } = await import("../modules/petition/petition.store.js");
  const { defaultPetitionPolicy } = await import("../modules/petition/petition.defaults.js");

  try {
    console.log("1. Create valid Initiative fixture");
    const now = new Date().toISOString();
    const initiative: Initiative = {
      initiativeId,
      stewardId: signerMemberId,
      createdAt: now,
      updatedAt: now,
      title: "Petition Persistence Verification Initiative",
      description: "Exists only to satisfy direct Initiative ancestry validation for this run.",
      status: "draft",
      lifecyclePhase: "draft",
      visibility: { policy: "steward_only" },
      metadata: {
        category: "Community",
        tags: ["Verification"],
        region: "British Columbia",
        language: "en",
        communitySlug: `petition-persistence-verify-${runId}`,
        activityArea: "Environment",
      },
      revisions: [],
      contributions: [],
      timeline: [],
    };
    createInitiative(initiative);

    console.log("2. Create valid Collective Decision fixture (Approved)");
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId,
      decisionSubjectId: initiativeId,
    });

    console.log("3. Create Petition");
    await createPetition({
      petitionId,
      collectiveDecisionId: decisionId,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      subject: {
        decisionId,
        initiativeId,
        title: "Petition Persistence Verification",
        summary: "Exercises Mongo-backed Petition/Signature persistence end-to-end.",
      },
      policy: structuredClone(defaultPetitionPolicy),
      shareLink: null,
      signatures: [],
      supportMetrics: {
        totalSignatures: 0,
        participantSignatures: 0,
        dailyActivity: [],
        supportThresholdStatus: {
          thresholdDefined: false,
          thresholdReached: false,
          currentCount: 0,
          thresholdCount: null,
        },
      },
      outcome: null,
    });

    console.log("4. Reconstruct: read the freshly-created Petition from a new OS process");
    reload(petitionId, "Draft");

    console.log("5. Read Petition");
    const draft = await getPetition(petitionId);
    assert(draft !== null, "Petition must be readable immediately after creation");
    assert(draft!.subject.initiativeId === initiativeId, "Petition must carry the validated initiativeId");

    console.log("6. Open Petition (Draft -> Ready -> Published -> Open)");
    await preparePetition(petitionId);
    await publishPetition(petitionId);
    const opened = await openPetition(petitionId);
    assert(opened?.status === "Open", "Petition must transition to Open");

    console.log("7. Sign once");
    const signed = await signPetition(petitionId, signerMemberId, "Public");
    assert(signed?.signatures.length === 1, "exactly one Signature must exist after signing once");

    console.log("8. Attempt concurrent duplicate signing");
    const concurrentResults = await Promise.allSettled([
      signPetition(petitionId, signerMemberId, "Public"),
      signPetition(petitionId, signerMemberId, "Public"),
    ]);
    const concurrentFulfilled = concurrentResults.filter((result) => result.status === "fulfilled");
    const concurrentRejected = concurrentResults.filter((result) => result.status === "rejected");
    assert(
      concurrentFulfilled.length === 0 && concurrentRejected.length === 2,
      "both concurrent duplicate signing attempts by an already-signed Member must fail",
    );

    console.log("9. Confirm exactly one stored Signature");
    const afterConcurrent = await getPetition(petitionId);
    assert(
      afterConcurrent?.signatures.length === 1,
      `expected exactly 1 Signature, found ${String(afterConcurrent?.signatures.length)}`,
    );

    console.log("10. Reconstruct/read again from a new OS process");
    reload(petitionId, "Open", 1);

    console.log("11. Clean only owned fixtures");
    await deleteSignaturesByPetitionIdForTests(petitionId);
    await deletePetitionsByIdForTests(petitionId);

    console.log("Petition persistence verification passed.");
  } catch (error) {
    // Best-effort cleanup even on failure, so a failed run never leaks
    // fixtures into subsequent runs.
    await deleteSignaturesByPetitionIdForTests(petitionId).catch(() => undefined);
    await deletePetitionsByIdForTests(petitionId).catch(() => undefined);
    throw error;
  }
}

await runVerificationScript(main);
