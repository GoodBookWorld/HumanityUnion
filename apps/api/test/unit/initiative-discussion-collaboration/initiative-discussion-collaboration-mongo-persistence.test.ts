import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { InitiativeAllyPersistenceError } from "../../../src/modules/initiative-discussion-collaboration/initiative-discussion-collaboration.errors.js";
import type { InitiativeAllyMongoDocument } from "../../../src/modules/initiative-discussion-collaboration/persistence/initiative-ally.mongo-document.js";
import {
  deleteInitiativeAlliesByInitiativeIdForTests,
  findInitiativeAllyDocument,
  isDuplicateInitiativeAllyError,
  listActiveInitiativeAllyDocumentsByInitiativeId,
  listInitiativeAllyDocumentsByInitiativeId,
  listInitiativeAllyDocumentsByParticipantId,
  transitionInitiativeAllyStatus,
  upsertInitiativeAllyDocument,
} from "../../../src/modules/initiative-discussion-collaboration/persistence/initiative-ally.repository.js";
import type { InitiativeDiscussionProposalCandidateMongoDocument } from "../../../src/modules/initiative-discussion-collaboration/persistence/initiative-proposal-candidate.mongo-document.js";
import {
  deleteProposalCandidatesByInitiativeIdForTests,
  findProposalCandidateDocumentByCommentId,
  insertProposalCandidateDocument,
  isDuplicateProposalCandidateError,
  listProposalCandidateDocumentsByCommentIds,
} from "../../../src/modules/initiative-discussion-collaboration/persistence/initiative-proposal-candidate.repository.js";
import {
  createProposalCandidate,
  findProposalCandidateByCommentId,
} from "../../../src/modules/initiative-discussion-collaboration/initiative-proposal-candidate.store.js";
import type { InitiativeAlly, InitiativeDiscussionProposalCandidate } from "@hu/types";

/**
 * UX Evolution Pack 02.1 — Recover Durable Persistence.
 *
 * Focused characterization tests for the dedicated Mongo persistence
 * boundary that replaced the previous in-memory Maps
 * (`initiative-ally.store.ts` / `initiative-proposal-candidate.store.ts`).
 * These exercise the repository/store layer directly with real
 * initiativeId/participantId/commentId strings — no Initiative/Comment
 * fixtures required, mirroring
 * initiative-decision-vote-mongo-persistence.test.ts's structure.
 *
 * Requires MongoDB; skipped when MONGODB_URI is not configured.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function fixtureIds(label: string) {
  return {
    initiativeId: `collab-mongo-${label}-initiative-${testRunId}`,
    participantId: `collab-mongo-${label}-participant-${testRunId}`,
    commentId: `collab-mongo-${label}-comment-${testRunId}`,
  };
}

const allFixtureInitiativeIds: string[] = [];

function trackInitiative(initiativeId: string): string {
  allFixtureInitiativeIds.push(initiativeId);
  return initiativeId;
}

function buildAlly(overrides: Partial<InitiativeAlly> & Pick<InitiativeAlly, "initiativeId" | "participantId">): InitiativeAlly {
  const timestamp = new Date().toISOString();

  return {
    status: "interest_pending",
    requestedByParticipantId: overrides.participantId,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function buildCandidate(
  overrides: Partial<InitiativeDiscussionProposalCandidate> &
    Pick<InitiativeDiscussionProposalCandidate, "candidateId" | "initiativeId" | "sourceCommentId">,
): InitiativeDiscussionProposalCandidate {
  return {
    sourceParticipantId: "fixture-source-participant",
    creatorParticipantId: "fixture-creator-participant",
    commentText: "Fixture comment text.",
    status: "candidate",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

after(async () => {
  for (const initiativeId of allFixtureInitiativeIds) {
    await deleteInitiativeAlliesByInitiativeIdForTests(initiativeId);
    await deleteProposalCandidatesByInitiativeIdForTests(initiativeId);
  }
});

describe("Persistence — Ally is durable, independently addressable Mongo state", () => {
  it("persists in Mongo as its own document and survives a fresh repository read", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-durability");
    trackInitiative(initiativeId);

    const written = await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId, status: "interest_pending" }),
    );

    const document = await getMongoCollection<InitiativeAllyMongoDocument>(
      MONGO_COLLECTIONS.initiativeAllies,
    ).findOne({ initiativeId, participantId });
    assert.ok(document, "Ally must exist as its own addressable Mongo document");

    const reloaded = await findInitiativeAllyDocument(initiativeId, participantId);
    assert.deepEqual(reloaded, written);
  });

  it("never performs a whole-collection replace: an unrelated pre-existing Ally on a different initiative is untouched", async () => {
    const sibling = fixtureIds("ally-untouched-sibling");
    trackInitiative(sibling.initiativeId);
    const siblingAlly = await upsertInitiativeAllyDocument(
      buildAlly({
        initiativeId: sibling.initiativeId,
        participantId: sibling.participantId,
        status: "active",
      }),
    );

    const { initiativeId, participantId } = fixtureIds("ally-no-collection-replace");
    trackInitiative(initiativeId);
    await upsertInitiativeAllyDocument(buildAlly({ initiativeId, participantId, status: "declined" }));

    const siblingAfter = await findInitiativeAllyDocument(sibling.initiativeId, sibling.participantId);
    assert.deepEqual(siblingAfter, siblingAlly, "an unrelated Ally must be untouched by a different write");
  });

  it("status transitions are durable: the same row's status updates and survives a fresh read", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-status-transition");
    trackInitiative(initiativeId);

    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId, status: "invitation_pending" }),
    );
    const accepted = await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId, status: "active", updatedAt: new Date().toISOString() }),
    );

    assert.equal(accepted.status, "active");
    const reloaded = await findInitiativeAllyDocument(initiativeId, participantId);
    assert.equal(reloaded?.status, "active");

    const allForInitiative = await listInitiativeAllyDocumentsByInitiativeId(initiativeId);
    assert.equal(allForInitiative.length, 1, "status transitions update the one row, never add a second");
  });
});

describe("Uniqueness — one Ally row per (initiativeId, participantId), database-enforced", () => {
  it("the unique index rejects a raw duplicate insert bypassing the repository's upsert", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-raw-duplicate");
    trackInitiative(initiativeId);

    const collection = getMongoCollection<InitiativeAllyMongoDocument>(
      MONGO_COLLECTIONS.initiativeAllies,
    );
    const timestamp = new Date().toISOString();
    const rawDocument: InitiativeAllyMongoDocument = {
      initiativeId,
      participantId,
      status: "interest_pending",
      requestedByParticipantId: participantId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await collection.insertOne({ ...rawDocument });

    await assert.rejects(
      () => collection.insertOne({ ...rawDocument }),
      (error: unknown) => isDuplicateInitiativeAllyError(error),
      "a second raw insert for the same (initiativeId, participantId) must violate the unique index",
    );

    const count = await collection.countDocuments({ initiativeId, participantId });
    assert.equal(count, 1, "no partial/orphan document from the rejected duplicate insert");
  });

  it("concurrent first-time upserts for the same key converge to exactly one document (no orphan, no crash)", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-concurrent-upsert");
    trackInitiative(initiativeId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        upsertInitiativeAllyDocument(buildAlly({ initiativeId, participantId, status: "interest_pending" })),
      ),
    );

    assert.equal(results.length, 5, "every concurrent caller resolves, none crash on the race");
    const all = await listInitiativeAllyDocumentsByInitiativeId(initiativeId);
    assert.equal(all.length, 1, "concurrent first-time upserts for the same key create exactly one row");
  });

  it("different Participants on the same Initiative each get their own Ally row", async () => {
    const { initiativeId } = fixtureIds("ally-distinct-participants");
    trackInitiative(initiativeId);

    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId: `${initiativeId}-p1`, status: "active" }),
    );
    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId: `${initiativeId}-p2`, status: "interest_pending" }),
    );

    const all = await listInitiativeAllyDocumentsByInitiativeId(initiativeId);
    assert.equal(all.length, 2);

    const active = await listActiveInitiativeAllyDocumentsByInitiativeId(initiativeId);
    assert.equal(active.length, 1);
    assert.equal(active[0]?.participantId, `${initiativeId}-p1`);
  });

  it("the same Participant is Initiative-scoped: independent rows on two different Initiatives", async () => {
    const fixtureA = fixtureIds("ally-multi-initiative-a");
    const fixtureB = fixtureIds("ally-multi-initiative-b");
    trackInitiative(fixtureA.initiativeId);
    trackInitiative(fixtureB.initiativeId);
    const participantId = `${testRunId}-shared-participant`;

    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId: fixtureA.initiativeId, participantId, status: "active" }),
    );
    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId: fixtureB.initiativeId, participantId, status: "declined" }),
    );

    const onA = await findInitiativeAllyDocument(fixtureA.initiativeId, participantId);
    const onB = await findInitiativeAllyDocument(fixtureB.initiativeId, participantId);
    assert.equal(onA?.status, "active");
    assert.equal(onB?.status, "declined");
  });
});

describe("transitionInitiativeAllyStatus — real Mongo atomic compare-and-swap (Profile UX Pack 01 Part 13)", () => {
  it("transitions a matching row and reports transitioned: true", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-transition-match");
    trackInitiative(initiativeId);
    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId, status: "interest_pending" }),
    );

    const result = await transitionInitiativeAllyStatus({
      initiativeId,
      participantId,
      fromStatus: "interest_pending",
      toStatus: "active",
      updatedAt: new Date().toISOString(),
    });

    assert.equal(result.transitioned, true);
    assert.equal(result.ally.status, "active");

    const reloaded = await findInitiativeAllyDocument(initiativeId, participantId);
    assert.equal(reloaded?.status, "active");
  });

  it("does not transition a row already in a different status, and reports transitioned: false with the current state", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-transition-mismatch");
    trackInitiative(initiativeId);
    await upsertInitiativeAllyDocument(buildAlly({ initiativeId, participantId, status: "declined" }));

    const result = await transitionInitiativeAllyStatus({
      initiativeId,
      participantId,
      fromStatus: "interest_pending",
      toStatus: "active",
      updatedAt: new Date().toISOString(),
    });

    assert.equal(result.transitioned, false);
    assert.equal(result.ally.status, "declined", "the already-committed status is returned unchanged");
  });

  it("only one of two racing concurrent transitions on the same row actually transitions (Accept/Decline race)", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-transition-race");
    trackInitiative(initiativeId);
    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId, participantId, status: "interest_pending" }),
    );

    const [acceptResult, declineResult] = await Promise.all([
      transitionInitiativeAllyStatus({
        initiativeId,
        participantId,
        fromStatus: "interest_pending",
        toStatus: "active",
        updatedAt: new Date().toISOString(),
      }),
      transitionInitiativeAllyStatus({
        initiativeId,
        participantId,
        fromStatus: "interest_pending",
        toStatus: "declined",
        updatedAt: new Date().toISOString(),
      }),
    ]);

    const transitionedCount = [acceptResult, declineResult].filter((r) => r.transitioned).length;
    assert.equal(transitionedCount, 1, "exactly one of the two racing transitions must win");
    assert.equal(acceptResult.ally.status, declineResult.ally.status, "both observe the same final state");

    const reloaded = await findInitiativeAllyDocument(initiativeId, participantId);
    assert.ok(reloaded?.status === "active" || reloaded?.status === "declined");
  });

  it("throws when no row exists for the given (initiativeId, participantId)", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-transition-missing");
    trackInitiative(initiativeId);

    await assert.rejects(() =>
      transitionInitiativeAllyStatus({
        initiativeId,
        participantId,
        fromStatus: "interest_pending",
        toStatus: "active",
        updatedAt: new Date().toISOString(),
      }),
    );
  });
});

describe("listInitiativeAllyDocumentsByParticipantId — cross-Initiative Ally rows for one Participant (Profile UX Pack 01 Part 9)", () => {
  it("returns every Ally row for a Participant across multiple Initiatives", async () => {
    const fixtureA = fixtureIds("ally-by-participant-a");
    const fixtureB = fixtureIds("ally-by-participant-b");
    trackInitiative(fixtureA.initiativeId);
    trackInitiative(fixtureB.initiativeId);
    const participantId = `${testRunId}-cross-initiative-participant`;

    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId: fixtureA.initiativeId, participantId, status: "active" }),
    );
    await upsertInitiativeAllyDocument(
      buildAlly({ initiativeId: fixtureB.initiativeId, participantId, status: "interest_pending" }),
    );

    const rows = await listInitiativeAllyDocumentsByParticipantId(participantId);

    assert.equal(rows.length, 2);
    const statusesByInitiative = new Map(rows.map((row) => [row.initiativeId, row.status]));
    assert.equal(statusesByInitiative.get(fixtureA.initiativeId), "active");
    assert.equal(statusesByInitiative.get(fixtureB.initiativeId), "interest_pending");
  });

  it("returns an empty array for a Participant with no Ally rows", async () => {
    const rows = await listInitiativeAllyDocumentsByParticipantId(
      `${testRunId}-participant-with-no-allies`,
    );
    assert.deepEqual(rows, []);
  });
});

describe("Data integrity — malformed persisted documents fail loudly, never silently coerced", () => {
  it("rejects a persisted Ally document with an invalid status instead of returning corrupted data", async () => {
    const { initiativeId, participantId } = fixtureIds("ally-malformed");
    trackInitiative(initiativeId);

    const collection = getMongoCollection<InitiativeAllyMongoDocument>(
      MONGO_COLLECTIONS.initiativeAllies,
    );
    await collection.insertOne({
      initiativeId,
      participantId,
      // Deliberately invalid — not one of the four declared statuses.
      status: "friends" as unknown as InitiativeAllyMongoDocument["status"],
      requestedByParticipantId: participantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      () => findInitiativeAllyDocument(initiativeId, participantId),
      (error: unknown) => error instanceof InitiativeAllyPersistenceError,
    );
  });
});

describe("Persistence — Proposal Candidate is durable, independently addressable Mongo state", () => {
  it("persists in Mongo as its own document and survives a fresh repository read", async () => {
    const { initiativeId, commentId } = fixtureIds("candidate-durability");
    trackInitiative(initiativeId);
    const candidate = buildCandidate({
      candidateId: `${commentId}-candidate`,
      initiativeId,
      sourceCommentId: commentId,
    });

    await insertProposalCandidateDocument(candidate);

    const document = await getMongoCollection<InitiativeDiscussionProposalCandidateMongoDocument>(
      MONGO_COLLECTIONS.initiativeDiscussionProposalCandidates,
    ).findOne({ sourceCommentId: commentId });
    assert.ok(document, "Proposal Candidate must exist as its own addressable Mongo document");

    const reloaded = await findProposalCandidateDocumentByCommentId(commentId);
    assert.deepEqual(reloaded, candidate);
  });

  it("leaves the immutable candidate untouched by an unrelated candidate's insert (no whole-collection replace)", async () => {
    const sibling = fixtureIds("candidate-untouched-sibling");
    trackInitiative(sibling.initiativeId);
    const siblingCandidate = buildCandidate({
      candidateId: `${sibling.commentId}-candidate`,
      initiativeId: sibling.initiativeId,
      sourceCommentId: sibling.commentId,
    });
    await insertProposalCandidateDocument(siblingCandidate);

    const { initiativeId, commentId } = fixtureIds("candidate-no-collection-replace");
    trackInitiative(initiativeId);
    await insertProposalCandidateDocument(
      buildCandidate({ candidateId: `${commentId}-candidate`, initiativeId, sourceCommentId: commentId }),
    );

    const siblingAfter = await findProposalCandidateDocumentByCommentId(sibling.commentId);
    assert.deepEqual(siblingAfter, siblingCandidate);
  });
});

describe("Uniqueness / replay — at most one Proposal Candidate per sourceCommentId, database-enforced", () => {
  it("a second raw insert for the same sourceCommentId violates the unique index and creates no extra row", async () => {
    const { initiativeId, commentId } = fixtureIds("candidate-raw-duplicate");
    trackInitiative(initiativeId);
    const candidate = buildCandidate({
      candidateId: `${commentId}-candidate-1`,
      initiativeId,
      sourceCommentId: commentId,
    });
    await insertProposalCandidateDocument(candidate);

    await assert.rejects(
      () =>
        insertProposalCandidateDocument(
          buildCandidate({ candidateId: `${commentId}-candidate-2`, initiativeId, sourceCommentId: commentId }),
        ),
      (error: unknown) => isDuplicateProposalCandidateError(error),
    );

    const count = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeDiscussionProposalCandidates,
    ).countDocuments({ sourceCommentId: commentId });
    assert.equal(count, 1, "no partial/orphan document from the rejected duplicate insert");
  });

  it("replay: sequential createProposalCandidate calls for the same comment return the same persisted candidate, not a second one", async () => {
    const { initiativeId, commentId } = fixtureIds("candidate-sequential-replay");
    trackInitiative(initiativeId);

    const first = await createProposalCandidate(
      buildCandidate({ candidateId: `${commentId}-first-attempt`, initiativeId, sourceCommentId: commentId }),
    );
    const second = await createProposalCandidate(
      buildCandidate({ candidateId: `${commentId}-second-attempt`, initiativeId, sourceCommentId: commentId }),
    );

    assert.equal(first.candidateId, second.candidateId);
    assert.equal(second.candidateId, `${commentId}-first-attempt`, "the first-committed candidate wins");

    const persisted = await findProposalCandidateByCommentId(commentId);
    assert.equal(persisted?.candidateId, first.candidateId);
  });

  it("replay: concurrent createProposalCandidate calls for the same comment converge to exactly one persisted candidate", async () => {
    const { initiativeId, commentId } = fixtureIds("candidate-concurrent-replay");
    trackInitiative(initiativeId);

    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) =>
        createProposalCandidate(
          buildCandidate({
            candidateId: `${commentId}-attempt-${index}`,
            initiativeId,
            sourceCommentId: commentId,
          }),
        ),
      ),
    );

    const distinctCandidateIds = new Set(attempts.map((candidate) => candidate.candidateId));
    assert.equal(
      distinctCandidateIds.size,
      1,
      "all concurrent callers must resolve to the same single candidateId",
    );

    const count = await getMongoCollection(
      MONGO_COLLECTIONS.initiativeDiscussionProposalCandidates,
    ).countDocuments({ sourceCommentId: commentId });
    assert.equal(count, 1, "database-enforced: exactly one document, not one per concurrent attempt");
  });
});

describe("Read compatibility — batched lookups agree with the committed row set", () => {
  it("listProposalCandidateDocumentsByCommentIds returns exactly the committed candidates, keyed by commentId", async () => {
    const { initiativeId } = fixtureIds("candidate-batched-read");
    trackInitiative(initiativeId);
    const commentIdA = `${initiativeId}-comment-a`;
    const commentIdB = `${initiativeId}-comment-b`;
    const commentIdC = `${initiativeId}-comment-c`;

    await insertProposalCandidateDocument(
      buildCandidate({ candidateId: `${commentIdA}-candidate`, initiativeId, sourceCommentId: commentIdA }),
    );
    await insertProposalCandidateDocument(
      buildCandidate({ candidateId: `${commentIdB}-candidate`, initiativeId, sourceCommentId: commentIdB }),
    );
    // commentIdC deliberately has no candidate.

    const found = await listProposalCandidateDocumentsByCommentIds([commentIdA, commentIdB, commentIdC]);
    assert.equal(found.size, 2);
    assert.equal(found.get(commentIdA)?.sourceCommentId, commentIdA);
    assert.equal(found.get(commentIdB)?.sourceCommentId, commentIdB);
    assert.equal(found.has(commentIdC), false);
  });

  it("an empty commentIds list short-circuits to an empty map without querying Mongo", async () => {
    const found = await listProposalCandidateDocumentsByCommentIds([]);
    assert.equal(found.size, 0);
  });
});
