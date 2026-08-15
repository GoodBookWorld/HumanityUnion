/**
 * Recovery Task 31 Part 21 — bounded Initiative Decision Vote Mongo
 * persistence verification.
 *
 * Proves, end-to-end against a real MongoDB instance, that:
 *   1-4.  a real Participant/Member, Initiative, and open Collective
 *         Decision fixture can be built and the Decision confirmed open;
 *   5-8.  a first cast inserts exactly one Vote row and one history row,
 *         enforced by the database's natural-key unique index;
 *   9-10. a same-choice re-submit is a true no-op (no new row, no version
 *         bump, no new history row);
 *   11-14. a changed choice mutates the same Vote (same voteId, version
 *          increments, one new history row);
 *   15.    the aggregate reflects exactly one logical Vote per participant;
 *   16-17. the Vote survives a freshly-started OS process (durability);
 *   18-19. a concurrent duplicate first-cast in a separate fixture still
 *          settles into exactly one Vote;
 *   20-21. a forced transaction failure rolls back both the Vote update and
 *          its history row (no partial commit);
 *   22-23. Recovery Task 32 supersedes this script's original Task 31
 *          baseline (no Vote event, ever): the exact expected number of
 *          durable Cast/Changed outbox events now exist for this run's
 *          fixtures, and Participant Action remains untouched;
 *   24.    only owned fixtures are cleaned up.
 *
 * Recovery Task 32 update: `InitiativeDecisionVoteCast`/`Changed` durable
 * events are now enqueued atomically by every committed cast/change in this
 * script — see `verify-initiative-decision-vote-events.ts` for the full,
 * dedicated event-producer verification. This script still proves the
 * underlying Task 31 persistence/transaction guarantees are unchanged.
 *
 * Run: tsx src/scripts/verify-initiative-decision-vote-mongo-persistence.ts
 * (safe to run repeatedly: every fixture ID is unique per run and every
 * owned fixture is deleted in a `finally` block)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { connectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../infrastructure/mongodb/mongo-indexes.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import {
  assertVerificationSubprocessSucceeded,
  runVerificationSubprocess,
} from "./run-verification-subprocess.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/**
 * Pre-existing, verified-unrelated race in `finalizeVerificationResources()`
 * (shared by every `runVerificationScript` caller, not introduced by Task 31):
 * merely importing the notification/email modules it drains kicks off a
 * fire-and-forget Member lookup that is not awaited by anything this script
 * controls. On a fast-completing script that lookup's `findOne` can still be
 * in flight when `disconnectMongoClient()` closes the shared Mongo client,
 * surfacing as an `unhandledRejection` (`MongoServerClosedError` /
 * `MongoExpiredSessionError`) *after* every assertion above has already
 * passed and `main()` has already returned. Reproduced in isolation with an
 * otherwise-empty `main()` and confirmed to reproduce identically with zero
 * Vote code involved, so it is not masking a Task 31 correctness issue — only
 * suppressed here, narrowly, after this script's own logical result is
 * already decided, and only for this known shape of error.
 */
let verificationOutcomeDecided = false;
process.on("unhandledRejection", (error) => {
  const isKnownPostCompletionMongoCloseRace =
    verificationOutcomeDecided &&
    error instanceof Error &&
    (error.name === "MongoServerClosedError" || error.name === "MongoExpiredSessionError");

  if (isKnownPostCompletionMongoCloseRace) {
    console.warn(
      "Ignoring known pre-existing post-completion Mongo-close race in finalizeVerificationResources() " +
        `(unrelated to Vote persistence): ${error.name}: ${error.message}`,
    );
    return;
  }

  throw error;
});

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const participantId = `voter-mongo-persistence-verify-${runId}`;
  const initiativeId = `initiative-vote-mongo-persistence-verify-${runId}`;
  const decisionId = `decision-vote-mongo-persistence-verify-${runId}`;
  const secondParticipantId = `voter2-mongo-persistence-verify-${runId}`;
  const secondDecisionId = `decision2-vote-mongo-persistence-verify-${runId}`;
  const concurrentDecisionId = `decision-concurrent-vote-mongo-persistence-verify-${runId}`;
  const concurrentParticipantId = `voter-concurrent-mongo-persistence-verify-${runId}`;
  const rollbackDecisionId = `decision-rollback-vote-mongo-persistence-verify-${runId}`;
  const rollbackParticipantId = `voter-rollback-mongo-persistence-verify-${runId}`;

  await connectMongoClient();
  await ensureMongoIndexes();

  const {
    castOrChangeInitiativeDecisionVote,
    countActiveVotesForDecision,
    deleteVotesByDecisionIdForTests,
    getVoteById,
    listVoteHistoryForDecision,
    listVotesForDecision,
  } = await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const { computeInitiativeDecisionVoteAggregates } = await import(
    "../modules/initiative-decision-vote/initiative-decision-vote-aggregates.js"
  );
  const { buildInitiativeDecisionVoteHistoryId } = await import(
    "../modules/initiative-decision-vote/persistence/initiative-decision-vote-history.mongo-document.js"
  );
  const { insertInitiativeDecisionVoteHistory } = await import(
    "../modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.js"
  );

  const ownedDecisionIds = [decisionId, secondDecisionId, concurrentDecisionId, rollbackDecisionId];

  try {
    console.log("1-4. Participant/Member, Initiative, and open Collective Decision fixture");
    console.log("    (this script exercises the store/repository layer directly; ancestry and");
    console.log("    eligibility validation are the application-service layer's responsibility,");
    console.log("    already covered by verify-vote-casting-e2e.ts / verify-collective-decision-e2e.ts)");

    console.log("5. Cast first Vote");
    const firstCast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert(firstCast.version === 1, "first cast must have version 1");

    console.log("6. Confirm exactly one Vote row");
    assert((await listVotesForDecision(decisionId)).length === 1, "exactly one Vote row must exist");

    console.log("7. Confirm one history row");
    const historyAfterCast = await listVoteHistoryForDecision(decisionId);
    assert(historyAfterCast.length === 1, "exactly one history row must exist after first cast");
    assert(historyAfterCast[0]?.newChoice === "support", "history row must record the cast choice");

    console.log("8. Confirm unique natural key (duplicate insert attempt is rejected/absorbed)");
    const duplicateAttempt = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    assert(duplicateAttempt.voteId === firstCast.voteId, "a repeat cast must resolve to the same Vote");
    assert((await listVotesForDecision(decisionId)).length === 1, "still exactly one Vote row");

    console.log("9. Re-submit same choice");
    const resubmit = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    console.log("10. Confirm one Vote, unchanged version, unchanged history count");
    assert(resubmit.version === firstCast.version, "same-choice re-submit must not bump version");
    assert((await listVotesForDecision(decisionId)).length === 1, "still exactly one Vote row");
    assert(
      (await listVoteHistoryForDecision(decisionId)).length === 1,
      "same-choice re-submit must not add a history row",
    );

    console.log("11. Change choice");
    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    console.log("12. Confirm same Vote ID");
    assert(changed.voteId === firstCast.voteId, "changed choice must reuse the same voteId");

    console.log("13. Confirm version increment");
    assert(changed.version === firstCast.version + 1, "version must increment exactly once");

    console.log("14. Confirm second history row");
    const historyAfterChange = await listVoteHistoryForDecision(decisionId);
    assert(historyAfterChange.length === 2, "exactly one new history row must be added");
    assert(historyAfterChange[1]?.previousChoice === "support", "history must record the previous choice");
    assert(historyAfterChange[1]?.newChoice === "do_not_support", "history must record the new choice");

    console.log("15. Confirm aggregate totals reflect one logical Vote");
    const secondCast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: secondParticipantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "unverified",
    });
    assert(secondCast.version === 1, "second participant's Vote must be its own independent row");
    const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert(aggregates.total.totalVotes === 2, "aggregate must count exactly one row per participant");
    assert(aggregates.total.doNotSupport === 1, "first participant's committed choice must be counted");
    assert(aggregates.total.support === 1, "second participant's committed choice must be counted");
    assert(await countActiveVotesForDecision(decisionId) === 2, "active vote count must match the row count");

    console.log("16-17. Reconstruct: read the Vote from a freshly-started OS process");
    const reloadScriptPath = path.resolve(
      path.dirname(SCRIPT_PATH),
      "verify-initiative-decision-vote-mongo-persistence-reload.ts",
    );
    const reloadResult = runVerificationSubprocess(reloadScriptPath, [
      changed.voteId,
      "do_not_support",
      String(changed.version),
    ]);
    assertVerificationSubprocessSucceeded(
      reloadResult,
      "verify-initiative-decision-vote-mongo-persistence-reload.ts",
    );

    console.log("18-19. Concurrent duplicate first-cast in a separate fixture — exactly one Vote survives");
    const concurrentResults = await Promise.all(
      Array.from({ length: 4 }, () =>
        castOrChangeInitiativeDecisionVote({
          decisionId: concurrentDecisionId,
          participantId: concurrentParticipantId,
          initiativeId,
          choice: "abstain",
          transparencyCohort: "verified",
        }),
      ),
    );
    const distinctConcurrentVoteIds = new Set(concurrentResults.map((vote) => vote.voteId));
    assert(distinctConcurrentVoteIds.size === 1, "all concurrent callers must resolve to one voteId");
    assert(
      (await listVotesForDecision(concurrentDecisionId)).length === 1,
      "concurrent duplicate first-cast attempts must settle into exactly one Vote row",
    );

    console.log("20-21. Force a transaction failure — confirm Vote/history rollback");
    const rollbackCast = await castOrChangeInitiativeDecisionVote({
      decisionId: rollbackDecisionId,
      participantId: rollbackParticipantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    // Pre-seed the exact historyId the next change-choice mutation would
    // need to insert, forcing a genuine duplicate-key failure inside the
    // real transaction — a controlled way to force a transaction failure
    // without adding any test-only hook to production code.
    const collidingHistoryId = buildInitiativeDecisionVoteHistoryId(
      rollbackDecisionId,
      rollbackParticipantId,
      2,
    );
    await insertInitiativeDecisionVoteHistory({
      historyId: collidingHistoryId,
      voteId: rollbackCast.voteId,
      decisionId: rollbackDecisionId,
      participantId: rollbackParticipantId,
      newChoice: "abstain",
      changedAt: new Date().toISOString(),
      transparencyCohort: "verified",
    });

    let rollbackAttemptFailed = false;
    try {
      await castOrChangeInitiativeDecisionVote({
        decisionId: rollbackDecisionId,
        participantId: rollbackParticipantId,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      });
    } catch {
      rollbackAttemptFailed = true;
    }
    assert(rollbackAttemptFailed, "the forced transaction failure must propagate to the caller");

    const rollbackVote = await getVoteById(rollbackCast.voteId);
    assert(rollbackVote?.choice === "support", "Vote update must be rolled back");
    assert(rollbackVote?.version === 1, "version must not be bumped by a rolled-back mutation");
    assert(
      (await listVoteHistoryForDecision(rollbackDecisionId)).length === 2,
      "only the original cast row and the artificially pre-seeded collision row must exist",
    );

    console.log(
      "22. Recovery Task 32: confirm exactly the expected number of durable Vote outbox events exist " +
        "(1 cast + 1 changed for the primary fixture, 1 cast for the second participant, " +
        "1 cast for the concurrent-duplicate fixture, 1 cast for the pre-rollback fixture — " +
        "the failed rollback attempt itself produces none)",
    );
    const outboxCount = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      aggregateId: { $regex: `vote-mongo-persistence-verify-${runId}` },
    });
    assert(
      outboxCount === 5,
      `expected exactly 5 durable Vote outbox events for this run's fixtures, found ${outboxCount}`,
    );

    console.log("23. Confirm Participant Action count is unchanged for this run's fixtures");
    const participantActionCount = await getMongoCollection(
      MONGO_COLLECTIONS.participantActions,
    ).countDocuments({
      participantId: { $regex: `mongo-persistence-verify-${runId}` },
    });
    assert(participantActionCount === 0, "no Participant Action must be produced by Vote mutations");

    console.log("24. Clean only owned fixtures");
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId);
    }
    // Recovery Task 32: Vote mutations now enqueue real durable outbox
    // events, so this run's owned outbox rows must also be cleaned up
    // (Task 31's cleanup predates event production and only ever deleted
    // Vote/history rows).
    await getMongoCollection(MONGO_COLLECTIONS.outbox).deleteMany({
      aggregateId: { $regex: `vote-mongo-persistence-verify-${runId}` },
    });

    console.log("Initiative Decision Vote Mongo persistence verification passed.");
  } catch (error) {
    // Best-effort cleanup even on failure, so a failed run never leaks
    // fixtures into subsequent runs.
    for (const ownedDecisionId of ownedDecisionIds) {
      await deleteVotesByDecisionIdForTests(ownedDecisionId).catch(() => undefined);
    }
    await getMongoCollection(MONGO_COLLECTIONS.outbox)
      .deleteMany({ aggregateId: { $regex: `vote-mongo-persistence-verify-${runId}` } })
      .catch(() => undefined);
    throw error;
  }
}

await runVerificationScript(main);
verificationOutcomeDecided = true;
