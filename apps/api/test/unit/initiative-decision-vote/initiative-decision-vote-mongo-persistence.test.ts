import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import {
  buildInitiativeDecisionVoteHistoryId,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote-history.mongo-document.js";
import {
  buildInitiativeDecisionVoteId,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote.mongo-document.js";
import {
  insertInitiativeDecisionVoteHistory,
} from "../../../src/modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.js";
import {
  castOrChangeInitiativeDecisionVote,
  countActiveVotesForDecision,
  deleteVotesByDecisionIdForTests,
  getActiveVoteForParticipant,
  getVoteById,
  listVoteHistoryForDecision,
  listVoteHistoryForParticipant,
  listVotesForDecision,
  listVotesForParticipant,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import {
  computeInitiativeDecisionVoteAggregates,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-aggregates.js";

/**
 * Recovery Task 31 Part 20 — focused characterization tests for the
 * dedicated, transaction-capable Mongo persistence boundary. These tests
 * exercise the store/repository layer directly (real decisionId/
 * participantId/initiativeId strings, no Initiative/Decision/Member
 * fixtures required) since `castOrChangeInitiativeDecisionVote` performs no
 * ancestry or eligibility validation itself — that remains the
 * application-service layer's responsibility (Part 12), covered separately
 * by `initiative-decision-vote-ancestry.test.ts` and
 * `initiative-decision-vote-mutation-lifecycle.test.ts`.
 *
 * Requires MongoDB; skipped when MONGODB_URI is not configured.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function fixtureIds(label: string) {
  return {
    decisionId: `mongo-persistence-${label}-decision-${testRunId}`,
    initiativeId: `mongo-persistence-${label}-initiative-${testRunId}`,
    participantId: `mongo-persistence-${label}-participant-${testRunId}`,
  };
}

const allFixtureDecisionIds: string[] = [];

function trackDecision(decisionId: string): string {
  allFixtureDecisionIds.push(decisionId);
  return decisionId;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const decisionId of allFixtureDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
  }
});

describe("Persistence — Vote is durable, independently addressable Mongo state (Part 20 §Persistence)", () => {
  it("persists in Mongo as its own document, independently addressable by voteId, and survives a fresh repository read", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("durability");
    trackDecision(decisionId);

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const document = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    assert.ok(document, "Vote must exist as its own addressable Mongo document");
    assert.equal(document?.decisionId, decisionId);
    assert.equal(document?.participantId, participantId);

    // "Survives repository reconstruction": a brand-new read through the
    // store's public API (no cached reference to `cast`) returns the same
    // committed state.
    const reloaded = await getVoteById(cast.voteId);
    assert.deepEqual(reloaded, cast);
  });

  it("never performs a whole-collection replace: an unrelated pre-existing Vote on a different Decision is untouched by a cast on this Decision", async () => {
    const other = fixtureIds("untouched-sibling");
    trackDecision(other.decisionId);
    const sibling = await castOrChangeInitiativeDecisionVote({
      decisionId: other.decisionId,
      participantId: other.participantId,
      initiativeId: other.initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const { decisionId, initiativeId, participantId } = fixtureIds("no-collection-replace");
    trackDecision(decisionId);
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    const siblingAfter = await getVoteById(sibling.voteId);
    assert.deepEqual(siblingAfter, sibling, "an unrelated Vote must be untouched by a different cast");
  });
});

describe("Identity and uniqueness — deterministic, retry-safe Vote identity, database-enforced (Part 20 §Identity)", () => {
  it("Vote ID policy is deterministic (natural-key-derived, no timestamp/randomness) and therefore retry-safe", () => {
    const idA = buildInitiativeDecisionVoteId("decision-x", "participant-y");
    const idB = buildInitiativeDecisionVoteId("decision-x", "participant-y");

    assert.equal(idA, idB, "the same (decisionId, participantId) must always derive the same voteId");
    assert.equal(idA, "initiative-decision-vote:decision-x:participant-y");
  });

  it("sequential duplicate casts create exactly one Vote (not one per call)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("sequential-duplicate");
    trackDecision(decisionId);

    const first = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    const second = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    assert.equal(first.voteId, second.voteId);
    assert.equal((await listVotesForDecision(decisionId)).length, 1);
  });

  it("concurrent duplicate first-cast attempts create exactly one Vote (database-enforced, not application-checked)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("concurrent-duplicate");
    trackDecision(decisionId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "support",
          transparencyCohort: "verified",
        }),
      ),
    );

    const distinctVoteIds = new Set(results.map((vote) => vote.voteId));
    assert.equal(distinctVoteIds.size, 1, "all concurrent callers must resolve to the same single voteId");
    assert.equal((await listVotesForDecision(decisionId)).length, 1);
  });

  it("different Participants voting on the same Decision each get their own Vote", async () => {
    const { decisionId, initiativeId } = fixtureIds("distinct-participants");
    trackDecision(decisionId);

    const voteA = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: `${decisionId}-participant-a`,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    const voteB = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: `${decisionId}-participant-b`,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    assert.notEqual(voteA.voteId, voteB.voteId);
    assert.equal((await listVotesForDecision(decisionId)).length, 2);
  });

  it("the same Participant can vote on two different Decisions independently", async () => {
    const fixtureA = fixtureIds("multi-decision-a");
    const fixtureB = fixtureIds("multi-decision-b");
    trackDecision(fixtureA.decisionId);
    trackDecision(fixtureB.decisionId);
    const participantId = `${testRunId}-multi-decision-shared-participant`;

    const voteA = await castOrChangeInitiativeDecisionVote({
      decisionId: fixtureA.decisionId,
      participantId,
      initiativeId: fixtureA.initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    const voteB = await castOrChangeInitiativeDecisionVote({
      decisionId: fixtureB.decisionId,
      participantId,
      initiativeId: fixtureB.initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    assert.notEqual(voteA.voteId, voteB.voteId);
    assert.equal((await listVotesForParticipant(participantId)).length, 2);
  });
});

describe("First cast (Part 20 §First cast)", () => {
  it("inserts one Vote with version 1, correct participantId/decisionId, and one durable cast history row, committed atomically", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("first-cast");
    trackDecision(decisionId);

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    assert.equal(cast.version, 1);
    assert.equal(cast.decisionId, decisionId);
    assert.equal(cast.participantId, participantId);
    assert.equal(cast.castAt, cast.updatedAt, "votedAt/updatedAt coincide at first cast");

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.newChoice, "support");
    assert.equal(history[0]?.previousChoice, undefined);
    assert.equal(history[0]?.voteId, cast.voteId);

    // initiativeId is persisted on the Mongo document but never exposed on
    // the public InitiativeDecisionVote response shape (Part 13).
    assert.equal((cast as unknown as { initiativeId?: string }).initiativeId, undefined);
    const document = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    assert.equal(document?.initiativeId, initiativeId);
  });
});

describe("Same-choice re-submit (Part 20 §Same-choice re-submit)", () => {
  it("is a pure no-op: no second Vote, no version bump, no new history row", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("no-op");
    trackDecision(decisionId);

    const first = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    const historyAfterFirst = await listVoteHistoryForParticipant(decisionId, participantId);

    const repeated = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    assert.equal(repeated.voteId, first.voteId);
    assert.equal(repeated.version, first.version, "no version bump on identical choice");
    assert.equal(repeated.updatedAt, first.updatedAt, "no write occurred at all — updatedAt is untouched");
    assert.equal((await listVotesForDecision(decisionId)).length, 1);
    assert.deepEqual(await listVoteHistoryForParticipant(decisionId, participantId), historyAfterFirst);
  });

  it("concurrent same-choice submissions do not duplicate the Vote or its history", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("no-op-concurrent");
    trackDecision(decisionId);

    await Promise.all(
      Array.from({ length: 4 }, () =>
        castOrChangeInitiativeDecisionVote({
          decisionId,
          participantId,
          initiativeId,
          choice: "support",
          transparencyCohort: "verified",
        }),
      ),
    );

    assert.equal((await listVotesForDecision(decisionId)).length, 1);
    assert.equal((await listVoteHistoryForParticipant(decisionId, participantId)).length, 1);
  });
});

describe("Changed choice (Part 20 §Changed choice)", () => {
  it("updates the same Vote row: voteId unchanged, version increments exactly once, updatedAt changes, exactly one new history row with correct previous/new choices, committed atomically", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("changed-choice");
    trackDecision(decisionId);

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    await new Promise((resolve) => setTimeout(resolve, 2));

    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    assert.equal(changed.voteId, cast.voteId);
    assert.equal(changed.version, cast.version + 1);
    assert.equal(changed.castAt, cast.castAt, "votedAt (first-cast timestamp) never changes on a mutation");
    assert.notEqual(changed.updatedAt, cast.updatedAt);

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(history.length, 2);
    assert.equal(history[1]?.previousChoice, "support");
    assert.equal(history[1]?.newChoice, "do_not_support");
  });

  it("a history-insert failure during a change-choice mutation rolls back the Vote update — no partial commit", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("rollback");
    trackDecision(decisionId);

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    // Pre-seed the exact historyId the next change-choice mutation would
    // need to insert, forcing a genuine duplicate-key failure inside the
    // real transaction — a controlled way to force a transaction failure
    // without adding any test-only hook to production code.
    const collidingHistoryId = buildInitiativeDecisionVoteHistoryId(decisionId, participantId, 2);
    await insertInitiativeDecisionVoteHistory({
      historyId: collidingHistoryId,
      voteId: cast.voteId,
      decisionId,
      participantId,
      newChoice: "abstain",
      changedAt: new Date().toISOString(),
      transparencyCohort: "verified",
    });

    await assert.rejects(() =>
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      }),
    );

    const stillOriginal = await getVoteById(cast.voteId);
    assert.equal(stillOriginal?.choice, "support", "Vote update must be rolled back");
    assert.equal(stillOriginal?.version, 1, "version must not be bumped by a rolled-back mutation");

    const history = await listVoteHistoryForDecision(decisionId);
    assert.equal(
      history.length,
      2,
      "only the original cast row and the artificially pre-seeded collision row exist — no row from the failed attempt",
    );
  });
});

describe("Concurrency (Part 20 §Concurrency)", () => {
  it("concurrent changed-choice requests from the same current version settle deterministically: both committed changes are honored in some order, version remains monotonic, history reflects only committed mutations", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("concurrent-change");
    trackDecision(decisionId);

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    // Recovery Task 31 Part 10/11: an optimistic-concurrency-guarded update
    // (`voteId` + expected `version`) never silently drops a losing
    // mutation. When the current Vote is mutable and both concurrent
    // requests target different, non-no-op choices, the retry loop
    // (Part 9) re-reads authoritative state and re-applies the losing
    // request against the new current version instead of discarding it.
    // The database — not application luck — decides the interleaving
    // order, so both changes are honored in *some* deterministic order:
    // version advances monotonically from 1 (cast) through exactly one
    // committed transition per request (here, 2), and history contains
    // exactly one row per committed transition with no gaps or duplicates.
    const [changeA, changeB] = await Promise.all([
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      }),
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "abstain",
        transparencyCohort: "verified",
      }),
    ]);

    assert.equal(changeA.voteId, changeB.voteId);

    const final = await getVoteById(changeA.voteId);
    assert.ok(final);
    assert.ok(
      final?.choice === "do_not_support" || final?.choice === "abstain",
      "final choice must be exactly one of the two concurrently-attempted choices",
    );
    assert.equal(
      final?.version,
      3,
      "version is monotonic and reflects the initial cast plus both committed changes (no change is silently dropped)",
    );

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    assert.equal(
      history.length,
      3,
      "history reflects exactly the committed cast + both committed changes, no gaps or duplicates",
    );

    const historyChoices = history.map((entry) => entry.newChoice).sort();
    assert.deepEqual(
      historyChoices,
      ["abstain", "do_not_support", "support"],
      "history contains exactly the three committed transitions, each exactly once",
    );
  });

  it("two Participants voting concurrently on the same Decision each get exactly one Vote and the tally counts both", async () => {
    const { decisionId, initiativeId } = fixtureIds("concurrent-two-participants");
    trackDecision(decisionId);

    await Promise.all([
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId: `${decisionId}-p1`,
        initiativeId,
        choice: "support",
        transparencyCohort: "verified",
      }),
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId: `${decisionId}-p2`,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      }),
    ]);

    assert.equal((await countActiveVotesForDecision(decisionId)), 2);
    const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(aggregates.total.totalVotes, 2, "tallies count one logical Vote per participant, no inflation");
  });

  it("one Participant voting concurrently on two Decisions ends up with one independent Vote per Decision", async () => {
    const fixtureA = fixtureIds("concurrent-multi-decision-a");
    const fixtureB = fixtureIds("concurrent-multi-decision-b");
    trackDecision(fixtureA.decisionId);
    trackDecision(fixtureB.decisionId);
    const participantId = `${testRunId}-concurrent-multi-decision-participant`;

    await Promise.all([
      castOrChangeInitiativeDecisionVote({
        decisionId: fixtureA.decisionId,
        participantId,
        initiativeId: fixtureA.initiativeId,
        choice: "support",
        transparencyCohort: "verified",
      }),
      castOrChangeInitiativeDecisionVote({
        decisionId: fixtureB.decisionId,
        participantId,
        initiativeId: fixtureB.initiativeId,
        choice: "abstain",
        transparencyCohort: "verified",
      }),
    ]);

    assert.equal((await listVotesForDecision(fixtureA.decisionId)).length, 1);
    assert.equal((await listVotesForDecision(fixtureB.decisionId)).length, 1);
    assert.equal((await listVotesForParticipant(participantId)).length, 2);
  });
});

describe("Read compatibility (Part 20 §Read compatibility)", () => {
  it("list-by-decision, find-by-participant-and-decision, and aggregate counts all agree with the committed row set", async () => {
    const { decisionId, initiativeId } = fixtureIds("read-compatibility");
    trackDecision(decisionId);

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: `${decisionId}-verified-support`,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: `${decisionId}-unverified-abstain`,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "unverified",
    });

    const list = await listVotesForDecision(decisionId);
    assert.equal(list.length, 2);

    const found = await getActiveVoteForParticipant(decisionId, `${decisionId}-verified-support`);
    assert.equal(found?.choice, "support");

    const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(aggregates.total.totalVotes, 2);
    assert.equal(aggregates.verified.support, 1);
    assert.equal(aggregates.unverified.abstain, 1);
  });

  it("history ordering is deterministic (chronological by changedAt)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("history-ordering");
    trackDecision(decisionId);

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "verified",
    });

    const history = await listVoteHistoryForParticipant(decisionId, participantId);
    const changedAtValues = history.map((entry) => Date.parse(entry.changedAt));
    const sorted = [...changedAtValues].sort((a, b) => a - b);
    assert.deepEqual(changedAtValues, sorted, "history must be returned in chronological order");
  });
});

describe("Transaction readiness (Part 20 §Transaction readiness / Part 18 Gate 7 prerequisite)", () => {
  it("repository write functions accept a session, and Vote + history commit within the same transaction/session", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("transaction-readiness");
    trackDecision(decisionId);

    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    // Both writes are visible immediately after the call returns, which is
    // only possible if they committed together (not in two separate
    // fire-and-forget writes) — the transaction already committed by the
    // time `castOrChangeInitiativeDecisionVote` resolves.
    const voteDocument = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).findOne({
      voteId: cast.voteId,
    });
    const historyDocument = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    ).findOne({ voteId: cast.voteId });

    assert.ok(voteDocument, "Vote document must be committed");
    assert.ok(historyDocument, "history document must be committed in the same transaction");
  });

  it("Vote casting enqueues exactly one durable Cast outbox event, but Participant Action remains untouched (Recovery Task 32 supersedes Task 31's 'no durable Vote event' baseline — see initiative-decision-vote-events.test.ts for the full producer characterization)", async () => {
    const { decisionId, initiativeId, participantId } = fixtureIds("cast-outbox-event");
    trackDecision(decisionId);

    const outboxCountBefore = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({});
    const participantActionCountBefore = await getMongoCollection(
      MONGO_COLLECTIONS.participantActions,
    ).countDocuments({});

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const outboxCountAfter = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({});
    const participantActionCountAfter = await getMongoCollection(
      MONGO_COLLECTIONS.participantActions,
    ).countDocuments({});

    assert.equal(
      outboxCountAfter,
      outboxCountBefore + 1,
      "Recovery Task 32 — a first cast now enqueues exactly one durable InitiativeDecisionVoteCast outbox event",
    );
    assert.equal(
      participantActionCountAfter,
      participantActionCountBefore,
      "Recovery Task 32 stops at the outbox: no Vote event consumer exists yet, so Participant Action remains untouched",
    );
  });
});
