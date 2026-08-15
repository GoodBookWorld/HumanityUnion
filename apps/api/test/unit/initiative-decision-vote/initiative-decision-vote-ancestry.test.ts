import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  ParentArtifactMissingInitiativeAncestryError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  castOrUpdateInitiativeDecisionVote,
  createVoteInitiativeExistenceChecker,
  createVoteParentDecisionResolver,
  resolveVoteInitiativeAncestry,
  type InitiativeDecisionVoteAncestryDependencies,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import {
  deleteVotesByParticipantIdForTests,
  getActiveVoteForParticipant,
  listVoteHistoryForDecision,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";

/**
 * Recovery Task 31 note: since Task 31, `InitiativeDecisionVote` persistence
 * is unconditionally MongoDB-backed (no in-memory/file fallback — see
 * `initiative-decision-vote.store.ts`), so the "persists nothing" assertions
 * below now perform real (fast, single-document) Mongo reads. This file is
 * therefore skipped when MONGODB_URI is not configured, per the existing
 * repository convention.
 */
if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

/**
 * Recovery Task 12 — coverage notes (supersedes Task 10's version of this
 * file; see git history for the module-local-only implementation).
 *
 * As of Task 12, `resolveVoteInitiativeAncestry` uses
 * `validateTransitiveInitiativeAncestry` in production — the vocabulary's
 * first production integration (Recovery Task 11 pinned `"decision"` to
 * `initiative-collective-decision`). Vote remains Model C — a
 * participation record — unchanged: no `initiativeId` was added to it, and
 * it was not added to `CivicArtifactType`.
 *
 * `evaluateVoteEligibility` (Member verification + participation-area
 * eligibility) still depends on the real, MongoDB-backed `getMemberById`,
 * unreachable in this sandboxed environment. Consequently, as in Task 10:
 *
 * - All tests below exercise ONLY the ancestry-resolution boundary, which
 *   fully resolves or rejects BEFORE `evaluateVoteEligibility` is ever
 *   called. (Recovery Task 31 update: the "persists nothing" assertions do
 *   now touch MongoDB — a plain read/delete against the dedicated Vote
 *   collection — since the store has no in-memory fallback anymore; they
 *   never reach `evaluateVoteEligibility` or its Member lookup.)
 * - A full successful vote cast, duplicate/replacement semantics, and
 *   voting-window/eligibility behavior are NOT re-implemented here (they
 *   require the real Member store); `verify-vote-casting-e2e.ts` and
 *   `verify-collective-decision-e2e.ts` exercise them as far as the
 *   environment allows (see the final task report). Since this task does
 *   not touch `assertDecisionAcceptsVotes`, `evaluateVoteEligibility`, or
 *   any duplicate/replacement logic, that pre-existing behavior is
 *   unaffected by construction, not merely by omission of new tests.
 * - Decision Session lookup remains zero: no function in this module
 *   accepts or calls a Decision Session dependency at all (unchanged since
 *   Task 10), so there is nothing to spy on for that invariant.
 */

const TEST_PARTICIPANT_ID = "test-participant-decision-vote-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-vote-1";
const KNOWN_DECISION_ID = "collective-decision-ancestry-fixture-vote-1";

const IDENTITY = { participantId: TEST_PARTICIPANT_ID };

function futureIsoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function buildFakeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: KNOWN_INITIATIVE_ID,
    stewardId: "test-steward-decision-vote-ancestry",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "Fake Initiative",
    description: "Fake description.",
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
    ...overrides,
  };
}

function buildFakeDecision(
  overrides: Partial<InitiativeCollectiveDecision> = {},
): InitiativeCollectiveDecision {
  return {
    decisionId: KNOWN_DECISION_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    decisionSessionId: "decision-session-ancestry-fixture-vote-1",
    stewardId: "test-steward-decision-vote-ancestry",
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Should the fixture proceed?",
    openedAt: futureIsoDate(-1),
    closesAt: futureIsoDate(10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDependencySpies(
  decisionsById: ReadonlyMap<string, InitiativeCollectiveDecision>,
  initiativesById: ReadonlyMap<string, Initiative>,
): {
  dependencies: InitiativeDecisionVoteAncestryDependencies;
  decisionCalls: string[];
  initiativeCalls: string[];
} {
  const decisionCalls: string[] = [];
  const initiativeCalls: string[] = [];

  return {
    dependencies: {
      getDecision(decisionId) {
        decisionCalls.push(decisionId);
        return decisionsById.get(decisionId) ?? null;
      },
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
    },
    decisionCalls,
    initiativeCalls,
  };
}

describe("Initiative Decision Vote ancestry enforcement (Recovery Task 12 — transitive)", () => {
  after(async () => {
    await deleteVotesByParticipantIdForTests(TEST_PARTICIPANT_ID);
  });

  describe("resolveVoteInitiativeAncestry — transitive ancestry shape", () => {
    it("resolves successfully with kind=transitive, canonical parent type, and preserved ids", async () => {
      const { dependencies, decisionCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const resolved = await resolveVoteInitiativeAncestry(KNOWN_DECISION_ID, dependencies);

      assert.deepEqual(resolved.ancestry, {
        kind: "transitive",
        parentArtifactType: "decision",
        parentArtifactId: KNOWN_DECISION_ID,
        initiativeId: KNOWN_INITIATIVE_ID,
      });
      assert.equal(resolved.decision.decisionId, KNOWN_DECISION_ID);
      assert.equal(resolved.initiative.initiativeId, KNOWN_INITIATIVE_ID);

      // Single resolution (Part 5): each dependency called exactly once.
      assert.deepEqual(decisionCalls, [KNOWN_DECISION_ID]);
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID]);
    });

    it("rejects a nonexistent Collective Decision (translated to the pre-existing message), without looking up any Initiative", async () => {
      const { dependencies, decisionCalls, initiativeCalls } = createDependencySpies(
        new Map(),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolveVoteInitiativeAncestry("does-not-exist", dependencies),
        /Collective decision not found\.$/,
      );
      assert.deepEqual(decisionCalls, ["does-not-exist"]);
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run when the decision is missing");
    });

    it("rejects a Collective Decision with a missing (empty) Initiative ancestry using the shared parent-ancestry error", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: "" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      // Task 12 change (Part 7, documented in the service module comment):
      // this now surfaces as ParentArtifactMissingInitiativeAncestryError
      // (the shared validator's own, more accurate description of "the
      // parent artifact has no Initiative ancestry of its own"), replacing
      // Task 10's InitiativeAncestryMissingError for this exact case. HTTP
      // status is unchanged (400 via the route's existing default), and
      // this case is unreachable for any Collective Decision created
      // through the real service (Task 09 validates ancestry at creation).
      await assert.rejects(
        () => resolveVoteInitiativeAncestry(KNOWN_DECISION_ID, dependencies),
        ParentArtifactMissingInitiativeAncestryError,
      );
    });

    it("rejects a Collective Decision with a malformed Initiative id (unchanged error type/message from Task 10)", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: " padded-id " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolveVoteInitiativeAncestry(KNOWN_DECISION_ID, dependencies),
        InitiativeIdMalformedError,
      );
    });

    it("rejects when the Collective Decision's Initiative no longer exists (unchanged error type/message from Task 10)", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: "vanished-initiative" })]]),
        new Map(),
      );

      await assert.rejects(
        () => resolveVoteInitiativeAncestry(KNOWN_DECISION_ID, dependencies),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["vanished-initiative"]);
    });
  });

  describe("castOrUpdateInitiativeDecisionVote ancestry-failure paths (no MongoDB required)", () => {
    it("rejects a vote for a nonexistent Collective Decision and persists nothing", async () => {
      const { dependencies } = createDependencySpies(new Map(), new Map());

      await assert.rejects(
        () =>
          castOrUpdateInitiativeDecisionVote(
            IDENTITY,
            "does-not-exist",
            { choice: "support" },
            dependencies,
          ),
        /Collective decision not found\.$/,
      );

      assert.equal(await getActiveVoteForParticipant("does-not-exist", TEST_PARTICIPANT_ID), null);
      assert.equal((await listVoteHistoryForDecision("does-not-exist")).length, 0);
    });

    it("rejects a vote when the Collective Decision's Initiative no longer exists, and persists nothing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: "vanished-initiative" })]]),
        new Map(),
      );

      await assert.rejects(
        () =>
          castOrUpdateInitiativeDecisionVote(
            IDENTITY,
            KNOWN_DECISION_ID,
            { choice: "support" },
            dependencies,
          ),
        InitiativeNotFoundError,
      );

      // No vote record, no history entry, and therefore no tally change and
      // no event: castOrUpdateInitiativeDecisionVote never imports or calls
      // an event/notification publisher anywhere in this module, and
      // ancestry validation runs strictly before saveVoteRecord/
      // appendVoteHistoryEntry are ever reached.
      assert.equal(await getActiveVoteForParticipant(KNOWN_DECISION_ID, TEST_PARTICIPANT_ID), null);
      assert.equal((await listVoteHistoryForDecision(KNOWN_DECISION_ID)).length, 0);
    });

    it("rejects a vote when the Collective Decision carries a malformed Initiative id, and persists nothing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: " padded-id " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          castOrUpdateInitiativeDecisionVote(
            IDENTITY,
            KNOWN_DECISION_ID,
            { choice: "support" },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );

      assert.equal(await getActiveVoteForParticipant(KNOWN_DECISION_ID, TEST_PARTICIPANT_ID), null);
    });

    it("rejects a vote when the Collective Decision has no Initiative ancestry of its own, and persists nothing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: "" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          castOrUpdateInitiativeDecisionVote(
            IDENTITY,
            KNOWN_DECISION_ID,
            { choice: "support" },
            dependencies,
          ),
        ParentArtifactMissingInitiativeAncestryError,
      );

      assert.equal(await getActiveVoteForParticipant(KNOWN_DECISION_ID, TEST_PARTICIPANT_ID), null);
      assert.equal((await listVoteHistoryForDecision(KNOWN_DECISION_ID)).length, 0);
    });
  });

  describe("createVoteParentDecisionResolver (production ParentArtifactInitiativeResolver adapter)", () => {
    it('resolves a known Collective Decision for parentArtifactType "decision"', () => {
      const decision = buildFakeDecision();
      const resolvedDecisionBox: { value: InitiativeCollectiveDecision | null } = { value: null };
      const resolver = createVoteParentDecisionResolver(
        (id) => (id === decision.decisionId ? decision : null),
        resolvedDecisionBox,
      );

      const result = resolver.resolveParentInitiativeId("decision", decision.decisionId);

      assert.deepEqual(result, { found: true, initiativeId: decision.initiativeId });
      assert.equal(resolvedDecisionBox.value, decision);
    });

    it("reports found:false for an unknown Collective Decision id, without throwing", () => {
      const resolvedDecisionBox: { value: InitiativeCollectiveDecision | null } = { value: null };
      const resolver = createVoteParentDecisionResolver(() => null, resolvedDecisionBox);

      const result = resolver.resolveParentInitiativeId("decision", "does-not-exist");

      assert.deepEqual(result, { found: false });
      assert.equal(resolvedDecisionBox.value, null);
    });

    it('fails explicitly (found:false) for any parent artifact type other than "decision", never delegating to the legacy Activity Decision module', () => {
      const decision = buildFakeDecision();
      const resolvedDecisionBox: { value: InitiativeCollectiveDecision | null } = { value: null };
      let legacyLookupCalls = 0;
      const resolver = createVoteParentDecisionResolver((id) => {
        // This getDecision fake represents the canonical
        // initiative-collective-decision store only. It must never be
        // reached for a non-"decision" parent type.
        legacyLookupCalls += 1;
        return id === decision.decisionId ? decision : null;
      }, resolvedDecisionBox);

      for (const otherType of ["proposal", "petition", "implementation"] as const) {
        const result = resolver.resolveParentInitiativeId(otherType, decision.decisionId);
        assert.deepEqual(result, { found: false });
      }

      assert.equal(legacyLookupCalls, 0);
      assert.equal(resolvedDecisionBox.value, null);
    });
  });

  describe("createVoteInitiativeExistenceChecker (production InitiativeExistenceChecker adapter)", () => {
    it("reports true and captures the resolved Initiative for a known id", () => {
      const initiative = buildFakeInitiative();
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createVoteInitiativeExistenceChecker(
        (id) => (id === initiative.initiativeId ? initiative : null),
        resolvedInitiativeBox,
      );

      const exists = checker.initiativeExists(initiative.initiativeId);

      assert.equal(exists, true);
      assert.equal(resolvedInitiativeBox.value, initiative);
    });

    it("reports false and leaves the box empty for an unknown id", () => {
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createVoteInitiativeExistenceChecker(() => null, resolvedInitiativeBox);

      const exists = checker.initiativeExists("does-not-exist");

      assert.equal(exists, false);
      assert.equal(resolvedInitiativeBox.value, null);
    });
  });
});
