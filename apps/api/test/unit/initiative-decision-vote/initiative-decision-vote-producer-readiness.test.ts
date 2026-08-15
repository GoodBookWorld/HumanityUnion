import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { evaluateDecisionParticipationEligibility } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  dispatchEnvelopeToHandlers,
  registerDomainEventHandler,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import type { CanonicalDomainEventEnvelope } from "../../../src/infrastructure/events/domain-event.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import {
  computeInitiativeDecisionVoteAggregates,
  assertUnweightedVoteCounts,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-aggregates.js";
import {
  castOrUpdateInitiativeDecisionVote,
  type InitiativeDecisionVoteAncestryDependencies,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import {
  castOrChangeInitiativeDecisionVote,
  deleteVotesByDecisionIdForTests,
  deleteVotesByParticipantIdForTests,
  getActiveVoteForParticipant,
  getVoteById,
  listVotesForDecision,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

/**
 * Recovery Task 28 — Focused characterization tests for Initiative Decision
 * Vote producer readiness (Part 14).
 *
 * Recovery Task 31 update: `InitiativeDecisionVote` persistence is no longer
 * file/snapshot-mirror-backed — it is a dedicated, transaction-capable Mongo
 * collection (see `initiative-decision-vote.store.ts` /
 * `persistence/initiative-decision-vote.repository.ts`). This file is
 * updated per Task 31's explicit instruction: "Task 28 characterization
 * tests that intentionally prove old defects must be updated only where the
 * defect is now closed. Preserve tests for permanent architectural
 * boundaries." Accordingly:
 *
 * - The "defaults to file/snapshot persistence" and "fire-and-forget Mongo
 *   mirror" tests are REPLACED with tests confirming the new, closed
 *   classification (dedicated Mongo repository, real `runMongoTransaction`,
 *   `ClientSession`-accepting writes).
 * - The "REPRODUCES the defect: two concurrent vote rows" test is REPLACED
 *   with a test confirming the defect is now CLOSED (database-enforced
 *   uniqueness rejects/retries the race into exactly one Vote row).
 * - The dead `{ status: 1 }` index test is REPLACED with a test confirming
 *   the dead index no longer exists in real Mongo index metadata, and the
 *   required unique indexes do.
 * - The Vote-mutability test (Part 7) and derived-counters test (Part 9)
 *   describe permanent architectural boundaries (mutable Vote row, no
 *   stored tally) that remain true post-Task-31; they are preserved but
 *   rewritten against the new API (`castOrChangeInitiativeDecisionVote` /
 *   async `computeInitiativeDecisionVoteAggregates`) since `saveVoteRecord`
 *   no longer exists.
 * - The Vote-after-close gating, Member-status independence, "no durable
 *   event", and Participant Action consumer framework tests describe
 *   pre-existing behavior this task does not touch, and are unchanged.
 *
 * All tests that touch the store now require MongoDB (there is no more
 * in-memory fallback), so this whole file is skipped when MONGODB_URI is
 * not configured, per the existing repository convention.
 */

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(MODULE_DIR, "../../../src");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(API_SRC, relativePath), "utf-8");
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
});

describe("Initiative Decision Vote — Persistence classification is now Mongo-backed and transaction-capable (Recovery Task 31, closes Gate 1/6)", () => {
  it("no file/memory/snapshot-mirror persistence adapter exists for Vote anymore", () => {
    assert.equal(
      fs.existsSync(
        path.join(
          API_SRC,
          "modules/initiative-decision-vote/persistence/initiative-decision-vote-file.persistence.ts",
        ),
      ),
      false,
      "the file-mode adapter must be removed",
    );
    assert.equal(
      fs.existsSync(
        path.join(
          API_SRC,
          "modules/initiative-decision-vote/persistence/initiative-decision-vote-mongo.persistence.ts",
        ),
      ),
      false,
      "the fire-and-forget Mongo mirror adapter must be removed",
    );
    assert.equal(
      fs.existsSync(
        path.join(
          API_SRC,
          "modules/initiative-decision-vote/persistence/resolve-initiative-decision-vote-persistence.ts",
        ),
      ),
      false,
      "the persistence-mode resolver must be removed — there is no mode to resolve anymore",
    );

    const storeSource = readSource("modules/initiative-decision-vote/initiative-decision-vote.store.ts");
    assert.ok(
      !storeSource.includes("resolveInitiativeDecisionVotePersistenceAdapter"),
      "the store must not resolve a persistence mode",
    );
    assert.ok(
      !storeSource.includes("INITIATIVE_DECISION_VOTE_PERSISTENCE"),
      "the store must not branch on a persistence-mode env var",
    );
  });

  it("the Vote store's sole write path opens a real Mongo transaction with a ClientSession (closes Gate 6)", () => {
    const storeSource = readSource("modules/initiative-decision-vote/initiative-decision-vote.store.ts");

    assert.ok(storeSource.includes("runMongoTransaction"), "runMongoTransaction must be used");
    assert.ok(
      storeSource.includes("async (session) =>"),
      "the transaction callback must receive a session",
    );
  });

  it("repository write functions accept an optional ClientSession (Part 8/18 outbox readiness)", () => {
    const repositorySource = readSource(
      "modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.ts",
    );

    assert.ok(repositorySource.includes("session?: ClientSession"), "RepositorySessionOptions must exist");
    for (const fn of [
      "insertInitiativeDecisionVote",
      "insertInitiativeDecisionVoteHistory",
      "updateInitiativeDecisionVoteChoice",
      "findInitiativeDecisionVoteByDecisionAndParticipant",
    ]) {
      const marker = `export async function ${fn}(`;
      const start = repositorySource.indexOf(marker);
      assert.notEqual(start, -1, `${fn} must exist`);
      // Several of these signatures take a multi-line parameter that is
      // itself an inline object type (e.g. `params: { voteId: string; ... }`),
      // whose own `{`/`}` would otherwise be mistaken for the function
      // body's opening brace. Anchor on the return-type arrow (`): Promise<`)
      // instead, which only ever appears once the parameter list has closed.
      const returnTypeMarker = repositorySource.indexOf("): Promise<", start);
      assert.notEqual(returnTypeMarker, -1, `${fn} must declare a Promise return type`);
      const signatureEnd = repositorySource.indexOf("{", returnTypeMarker);
      const signature = repositorySource.slice(start, signatureEnd);
      assert.ok(
        signature.includes("RepositorySessionOptions") || signature.includes("options"),
        `${fn} must accept a session-carrying options parameter`,
      );
    }
  });

  it("the underlying write is never a whole-collection replace (no deleteMany({}) / insertMany(allVotes))", () => {
    const repositorySource = readSource(
      "modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.ts",
    );

    assert.ok(!repositorySource.includes("deleteMany({})"), "no unconditional deleteMany({})");
    assert.ok(!repositorySource.includes("insertMany("), "no bulk insertMany");
    assert.ok(!repositorySource.includes(".replaceOne("), "no whole-document blind replaceOne");
  });
});

describe("Initiative Decision Vote — Database-enforced concurrency (Recovery Task 31, closes Gate 5)", () => {
  const decisionId = `readiness-concurrency-decision-${Date.now()}`;
  const initiativeId = `readiness-concurrency-initiative-${Date.now()}`;
  const participantId = `readiness-concurrency-participant-${Date.now()}`;

  after(async () => {
    await deleteVotesByDecisionIdForTests(decisionId);
  });

  it("the dead 'status' index no longer exists in real Mongo index metadata, and the required unique indexes do", async () => {
    const indexes = await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).indexes();
    const indexNames = indexes.map((index) => index.name);

    assert.ok(
      !indexNames.includes("status_1"),
      "the dead 'status' index (InitiativeDecisionVote has no status field) must not exist",
    );
    assert.ok(
      indexNames.includes("initiative_decision_votes_vote_id_unique"),
      "unique(voteId) index must exist",
    );
    assert.ok(
      indexNames.includes("initiative_decision_votes_decision_participant_unique"),
      "unique(decisionId, participantId) index must exist",
    );

    const voteIdUniqueIndex = indexes.find(
      (index) => index.name === "initiative_decision_votes_vote_id_unique",
    );
    const naturalKeyUniqueIndex = indexes.find(
      (index) => index.name === "initiative_decision_votes_decision_participant_unique",
    );

    assert.equal(voteIdUniqueIndex?.unique, true);
    assert.equal(naturalKeyUniqueIndex?.unique, true);
  });

  it("CLOSED DEFECT: two concurrent first-cast requests for the same (decisionId, participantId) settle into exactly one Vote row, never two", async () => {
    const [voteA, voteB] = await Promise.all([
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "support",
        transparencyCohort: "verified",
      }),
      castOrChangeInitiativeDecisionVote({
        decisionId,
        participantId,
        initiativeId,
        choice: "do_not_support",
        transparencyCohort: "verified",
      }),
    ]);

    assert.equal(voteA.voteId, voteB.voteId, "both concurrent callers must resolve to the same voteId");

    const rows = await listVotesForDecision(decisionId);
    assert.equal(
      rows.length,
      1,
      "FIXED: the database's unique (decisionId, participantId) index — not an in-memory check — guarantees exactly one Vote row survives the race",
    );

    const active = await getActiveVoteForParticipant(decisionId, participantId);
    assert.notEqual(active, null);

    const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(
      aggregates.total.totalVotes,
      1,
      "FIXED: the aggregate no longer double-counts this participant — there is only one committed row to count",
    );
    assert.ok(assertUnweightedVoteCounts(rows, aggregates));
  });
});

describe("Initiative Decision Vote — Vote mutability collapses lifecycle facts into one mutable row (Part 7, permanent architectural boundary)", () => {
  const decisionId = `readiness-mutability-decision-${Date.now()}`;
  const initiativeId = `readiness-mutability-initiative-${Date.now()}`;
  const participantId = `readiness-mutability-participant-${Date.now()}`;

  after(async () => {
    await deleteVotesByParticipantIdForTests(participantId);
  });

  it("castOrChangeInitiativeDecisionVote mutates the same voteId in place; the append-only history collection — not the Vote row — captures the prior choice", async () => {
    const cast = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });

    const changed = await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId,
      initiativeId,
      choice: "abstain",
      transparencyCohort: "verified",
    });

    assert.equal(changed.voteId, cast.voteId, "same voteId reused — a mutation, not a new fact");

    const stored = await getVoteById(cast.voteId);
    assert.equal(stored?.choice, "abstain", "the Vote row now reflects only the latest choice");
    assert.equal(stored?.version, 2);
    assert.equal(
      (await listVotesForDecision(decisionId)).length,
      1,
      "exactly one Vote row exists for this participant+decision after the change",
    );
  });
});

describe("Initiative Decision Vote — Vote-after-close gating happens before any Member lookup (Part 6.6 / Part 8, no Mongo write path reached)", () => {
  const decisionId = "readiness-closed-decision-fixture";
  const initiativeId = "readiness-closed-initiative-fixture";

  function buildDeps(
    decision: InitiativeCollectiveDecision,
  ): InitiativeDecisionVoteAncestryDependencies {
    const initiative = {
      initiativeId,
      stewardId: "readiness-steward",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: "Fixture",
      description: "Fixture",
      status: "poll",
      lifecyclePhase: "projected",
      visibility: { policy: "public" },
      metadata: {
        category: "environment",
        tags: [],
        region: "Global",
        language: "en",
        communitySlug: "test-community",
        activityArea: "Environment",
      },
      revisions: [],
      contributions: [],
      timeline: [],
    } as unknown as Initiative;

    return {
      getDecision: (id) => (id === decisionId ? decision : null),
      getInitiative: (id) => (id === initiativeId ? initiative : null),
    };
  }

  it("rejects casting on a closed decision without ever reaching eligibility/Member lookup", async () => {
    const closedDecision: InitiativeCollectiveDecision = {
      decisionId,
      initiativeId,
      decisionSessionId: "readiness-session",
      stewardId: "readiness-steward",
      sequenceNumber: 1,
      participationScope: "world",
      status: "closed",
      question: "Fixture?",
      closesAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(
          { participantId: "readiness-voter" },
          decisionId,
          { choice: "support" },
          buildDeps(closedDecision),
        ),
      /not open for voting/,
    );
  });

  it("rejects casting before the voting window opens without ever reaching eligibility/Member lookup", async () => {
    const notYetOpenDecision: InitiativeCollectiveDecision = {
      decisionId,
      initiativeId,
      decisionSessionId: "readiness-session",
      stewardId: "readiness-steward",
      sequenceNumber: 1,
      participationScope: "world",
      status: "opened",
      question: "Fixture?",
      openedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      closesAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(
          { participantId: "readiness-voter" },
          decisionId,
          { choice: "support" },
          buildDeps(notYetOpenDecision),
        ),
      /voting window is not open yet/,
    );
  });
});

describe("Initiative Decision Vote — Derived counters are recomputed, never stored (Part 9, permanent architectural boundary)", () => {
  const decisionId = `readiness-counters-decision-${Date.now()}`;
  const initiativeId = `readiness-counters-initiative-${Date.now()}`;
  const participantA = `readiness-counters-a-${Date.now()}`;
  const participantB = `readiness-counters-b-${Date.now()}`;

  after(async () => {
    await deleteVotesByParticipantIdForTests(participantA);
    await deleteVotesByParticipantIdForTests(participantB);
  });

  it("InitiativeCollectiveDecision carries no stored vote-count/tally field", () => {
    const source = fs.readFileSync(
      path.resolve(API_SRC, "../../../packages/types/src/domain/initiative-collective-decision.ts"),
      "utf-8",
    );
    const interfaceBlock = source.slice(
      source.indexOf("interface InitiativeCollectiveDecision {"),
      source.indexOf("}", source.indexOf("interface InitiativeCollectiveDecision {")),
    );

    for (const forbidden of ["voteCount", "totalVotes", "tally", "support:", "doNotSupport"]) {
      assert.ok(
        !interfaceBlock.includes(forbidden),
        `InitiativeCollectiveDecision must not store a "${forbidden}" counter field`,
      );
    }
  });

  it("computeInitiativeDecisionVoteAggregates recomputes from live Vote rows on every call, with no separate increment step", async () => {
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: participantA,
      initiativeId,
      choice: "support",
      transparencyCohort: "verified",
    });
    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: participantB,
      initiativeId,
      choice: "support",
      transparencyCohort: "unverified",
    });

    const beforeChange = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(beforeChange.total.support, 2);
    assert.equal(beforeChange.total.doNotSupport, 0);

    await castOrChangeInitiativeDecisionVote({
      decisionId,
      participantId: participantB,
      initiativeId,
      choice: "do_not_support",
      transparencyCohort: "unverified",
    });

    const afterChange = await computeInitiativeDecisionVoteAggregates(decisionId);
    assert.equal(
      afterChange.total.support,
      1,
      "recomputed aggregate reflects the mutated choice immediately, with no counter to reconcile",
    );
    assert.equal(afterChange.total.doNotSupport, 1);
  });
});

describe("Initiative Decision Vote — Member-status independence and ambiguity (Part 12, no Mongo write path reached)", () => {
  const baseInput = {
    participantId: "readiness-eligibility-fixture",
    isRegistered: true,
    participantStatus: "active" as const,
    activeParticipationArea: { countrySlug: "canada", regionSlug: "bc", communitySlug: "test" },
    verificationStatus: "verified" as const,
    pendingTransition: null,
    decisionParticipationScope: "world" as const,
    initiativeScopeMetadata: {
      countrySlug: "canada",
      regionSlug: "bc",
      communitySlug: "test",
      isGlobal: true,
    },
    decisionStatus: "opened" as const,
    openedAt: new Date(Date.now() - 86_400_000).toISOString(),
    closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  };

  it("is eligible when registered AND participantStatus is 'active'", () => {
    const result = evaluateDecisionParticipationEligibility(baseInput);
    assert.equal(result.eligible, true);
  });

  it("DEFECT/AMBIGUITY: an unregistered actor (no Member record at all) is rejected — 'account' eligibility is gated on Member existence, not a Participant-only concept", () => {
    const result = evaluateDecisionParticipationEligibility({ ...baseInput, isRegistered: false });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "not_registered");
  });

  it("DEFECT/AMBIGUITY: a registered Member whose status is not 'active' (e.g. 'inactive') is rejected purely on Member-status grounds, conflating 'active account' with earned Member status", () => {
    const result = evaluateDecisionParticipationEligibility({
      ...baseInput,
      participantStatus: "inactive",
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "inactive_participant");
  });
});

describe("Initiative Decision Vote — durable events now exist (Recovery Task 32, closes Gate 7)", () => {
  it("CATALOGUE_EVENTS has exactly the two expected InitiativeDecisionVote entries, using the exact required names", () => {
    const values = Object.values(CATALOGUE_EVENTS as Record<string, string>);
    const voteRelated = values.filter((value) => value.toLowerCase().includes("vote"));

    assert.deepEqual(
      voteRelated.sort(),
      ["InitiativeDecisionVoteCast", "InitiativeDecisionVoteChanged"],
      "exactly these two Vote-related catalogue events must exist, using the exact required names",
    );
  });

  it("the Vote store references the outbox and enqueues a domain event within its sole transaction boundary (Recovery Task 32 Part 9/10/17)", () => {
    const storeSource = readSource("modules/initiative-decision-vote/initiative-decision-vote.store.ts");

    assert.ok(storeSource.includes("enqueueDomainEvent"), "the store must enqueue the constructed Vote events");
    assert.ok(
      storeSource.includes("createInitiativeDecisionVoteCastEvent"),
      "the store must construct the Cast event via its narrow factory",
    );
    assert.ok(
      storeSource.includes("createInitiativeDecisionVoteChangedEvent"),
      "the store must construct the Changed event via its narrow factory",
    );
  });

  it("the Vote service (application/domain boundary above the store) does not itself construct or enqueue events (Part 17 producer boundary: the transaction service, not routes/controllers, owns production)", () => {
    const serviceSource = readSource("modules/initiative-decision-vote/initiative-decision-vote.service.ts");

    for (const forbidden of ["enqueueDomainEvent", "createDomainEvent", "createInitiativeDecisionVoteCastEvent", "createInitiativeDecisionVoteChangedEvent"]) {
      assert.ok(!serviceSource.includes(forbidden), `unexpected "${forbidden}" reference found in the service layer`);
    }
  });

  it("CLOSED (Recovery Task 33): a Vote event consumer/handler is now registered, and Participant Action vocabulary now includes Vote's two action types plus its source type", () => {
    // This test previously asserted the OPPOSITE — that no Vote token existed
    // anywhere in the Participant Action module — documenting Task 32's own
    // explicit non-goal. Recovery Task 33 is exactly the follow-up task named
    // by that non-goal (see this file's Part 21 scope-boundary note and
    // `INITIATIVE_DECISION_VOTE_PARTICIPANT_ACTION_PRODUCER_READINESS_v1.0.md`
    // §19.17 "Exact Next Task"), so per this file's own header comment rule
    // ("Task 28 characterization tests that intentionally prove old defects
    // must be updated only where the defect is now closed"), this assertion
    // is updated to reflect the newly-closed state rather than preserved
    // as a stale prohibition.
    const requiredTokensPresentSomewhere = [
      "InitiativeDecisionVoteCast",
      "InitiativeDecisionVoteChanged",
      "initiative_decision_vote_cast",
      "initiative_decision_vote_changed",
    ];

    // The type-level tokens (`InitiativeDecisionVoteCast`/`...Changed`) are
    // exported by name from `index.ts` itself; the snake_case action-type
    // string literals live in the domain vocabulary module that `index.ts`
    // re-exports from. Both are "the Participant Action module" for the
    // purpose of this module-boundary check.
    const indexSource = readSource("modules/participant-action/index.ts");
    const typesSourceForTokenCheck = readSource("modules/participant-action/domain/participant-action.types.ts");
    const combinedModuleSource = `${indexSource}\n${typesSourceForTokenCheck}`;
    for (const token of requiredTokensPresentSomewhere) {
      assert.ok(
        combinedModuleSource.includes(token),
        `Participant Action module must now reference "${token}" (Recovery Task 33)`,
      );
    }

    // Petition's own files remain untouched by Vote-specific tokens — the
    // Vote projection lives in its own dedicated mapper/handler files, never
    // inside the Petition mapper/handler (Part 17 compatibility).
    for (const relativePath of [
      "modules/participant-action/application/petition-signed.participant-action-handler.ts",
      "modules/participant-action/application/petition-signed-to-participant-action.mapper.ts",
    ]) {
      const source = readSource(relativePath);
      for (const forbidden of requiredTokensPresentSomewhere) {
        assert.ok(
          !source.includes(forbidden),
          `Petition's own consumer/mapper must not reference "${forbidden}" in ${relativePath}`,
        );
      }
    }

    const typesSource = readSource("modules/participant-action/domain/participant-action.types.ts");
    assert.ok(
      typesSource.includes('"petition_signed"') &&
        typesSource.includes('"initiative_decision_vote_cast"') &&
        typesSource.includes('"initiative_decision_vote_changed"'),
      "ParticipantActionType must now include petition_signed plus both Vote action types",
    );
    assert.ok(
      typesSource.includes('"petition_signature"') && typesSource.includes('"initiative_decision_vote"'),
      "ParticipantActionSourceType must now include petition_signature plus initiative_decision_vote",
    );
  });
});

describe("Initiative Decision Vote — Participant Action consumer framework accepts additive registration without redesign (Part 11 / Part 13, unchanged by Task 31)", () => {
  it("two independently-registered handlers for two different event names coexist and each receives only its own event", async () => {
    const receivedByProbeA: string[] = [];
    const receivedByProbeB: string[] = [];

    const probeEventNameA = `__readiness_probe_petition_signed__${Date.now()}`;
    const probeEventNameB = `__readiness_probe_initiative_decision_vote_cast__${Date.now()}`;

    const unregisterA = registerDomainEventHandler({
      consumerId: `readiness-probe-a-${Date.now()}`,
      eventName: probeEventNameA,
      handle: async (envelope) => {
        receivedByProbeA.push(envelope.eventName);
      },
    });
    const unregisterB = registerDomainEventHandler({
      consumerId: `readiness-probe-b-${Date.now()}`,
      eventName: probeEventNameB,
      handle: async (envelope) => {
        receivedByProbeB.push(envelope.eventName);
      },
    });

    try {
      const envelopeA: CanonicalDomainEventEnvelope = {
        eventId: "probe-a-1",
        eventName: probeEventNameA,
        aggregateType: "ProbeAggregate",
        aggregateId: "probe-a-1",
        payload: {},
        metadata: {
          correlationId: "probe-a-1",
          causationId: null,
          actorId: null,
          schemaVersion: "1.0",
          occurredAt: new Date().toISOString(),
        },
      };
      const envelopeB: CanonicalDomainEventEnvelope = {
        ...envelopeA,
        eventId: "probe-b-1",
        eventName: probeEventNameB,
        aggregateId: "probe-b-1",
      };

      await dispatchEnvelopeToHandlers(envelopeA, (handler, envelope) => handler.handle(envelope));
      await dispatchEnvelopeToHandlers(envelopeB, (handler, envelope) => handler.handle(envelope));

      assert.deepEqual(receivedByProbeA, [probeEventNameA]);
      assert.deepEqual(receivedByProbeB, [probeEventNameB]);
    } finally {
      unregisterA();
      unregisterB();
    }
  });

  // Explicitly NOT exercised here: clearDomainEventHandlers() is never
  // called, because the registry is process-global and shared with every
  // other test file (including the real PetitionSigned Participant Action
  // consumer). Clearing it would silently unregister unrelated handlers for
  // the remainder of the test run.
  void clearDomainEventHandlers;
});
