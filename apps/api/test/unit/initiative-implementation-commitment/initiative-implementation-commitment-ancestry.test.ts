import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createInitiativeImplementationCommitmentDraft,
  ImplementationCommitmentInitiativeMismatchError,
  type InitiativeImplementationCommitmentAncestryDependencies,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js";
import {
  deleteCommitmentsByParticipantIdForTests,
  listCommitmentsByParticipant,
} from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import type { InitiativeImplementationCommitmentEligibility } from "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment-eligibility.js";

/**
 * Recovery Task 15 — coverage notes.
 *
 * Inspection (Part 1/2) found that
 * `CreateInitiativeImplementationCommitmentDraftInput` carries BOTH an
 * independent, direct `initiativeId` AND a mandatory `decisionId` — the
 * same shape Recovery Task 09 found for Initiative Collective Decision.
 * This is the task's "Model C — direct artifact with mandatory Decision
 * consistency": `InitiativeImplementationCommitment` stores its own
 * `initiativeId` directly, and Decision consistency
 * (`commitment.initiativeId === collectiveDecision.initiativeId`) is a
 * separate, pre-existing invariant (previously enforced only via a plain
 * reasons-list string, now also surfaced as
 * `ImplementationCommitmentInitiativeMismatchError`). Consequently:
 *
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`). Transitive
 *   ancestry does not apply: an independent `initiativeId` is always
 *   supplied, so there is nothing to resolve through a parent artifact.
 * - Tests 20-22 ("if transitive ancestry is used") are not implemented as
 *   executable tests: their preconditions do not hold under the current
 *   contract. Tests 9-15 below exercise the real Initiative/Decision
 *   mismatch invariant, Decision-not-found, and Decision-lifecycle-
 *   ineligible cases instead.
 * - There is no ownership/authorization check on creation today (any
 *   authenticated participant may record a commitment once the Decision
 *   is closed). Test 21 below confirms this remains unchanged.
 * - There is no duplicate/cardinality rule on creation today (0..N
 *   commitments per Initiative, 0..N per Decision). Test 9 (existing
 *   duplicate rule) below confirms two independent commitments against
 *   the same Decision both persist successfully, unchanged.
 */

const TEST_PARTICIPANT_ID = "test-participant-implementation-commitment-ancestry";
const OTHER_PARTICIPANT_ID = "test-other-participant-implementation-commitment-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-ic-1";
const OTHER_INITIATIVE_ID = "initiative-ancestry-fixture-ic-2";
const KNOWN_DECISION_ID = "collective-decision-ancestry-fixture-ic-1";

const IDENTITY = { participantId: TEST_PARTICIPANT_ID };

const VALID_INPUT_BASE = {
  commitmentTitle: "Fixture Commitment",
  commitmentSummary: "Fixture summary.",
  commitmentScope: "Fixture scope.",
};

function buildFakeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: KNOWN_INITIATIVE_ID,
    stewardId: "steward-fixture",
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
    decisionSessionId: "decision-session-fixture-ic-1",
    stewardId: "steward-fixture",
    sequenceNumber: 1,
    participationScope: "community",
    status: "closed",
    question: "Should the fixture proceed?",
    closesAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mirrors the real
 * `assessInitiativeImplementationCommitmentEligibilityForResolved` reason
 * precedence (not found > mismatch > status) as a fully isolated fake, so
 * these tests exercise the dependency-injection contract directly rather
 * than importing the real function under test twice.
 */
function fakeAssessEligibility(
  initiative: Initiative,
  decision: InitiativeCollectiveDecision | null,
): InitiativeImplementationCommitmentEligibility {
  const reasons: string[] = [];

  if (!decision) {
    reasons.push("Collective decision not found.");
  } else if (decision.initiativeId !== initiative.initiativeId) {
    reasons.push("Collective decision does not belong to this initiative.");
  } else if (decision.status !== "closed") {
    reasons.push("Collective decision must be closed before implementation commitments can begin.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

function createDependencySpies(
  initiativesById: ReadonlyMap<string, Initiative>,
  decisionsById: ReadonlyMap<string, InitiativeCollectiveDecision>,
): {
  dependencies: InitiativeImplementationCommitmentAncestryDependencies;
  initiativeCalls: string[];
  decisionCalls: string[];
  eligibilityCalls: string[];
} {
  const initiativeCalls: string[] = [];
  const decisionCalls: string[] = [];
  const eligibilityCalls: string[] = [];

  return {
    dependencies: {
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
      getDecision(decisionId) {
        decisionCalls.push(decisionId);
        return decisionsById.get(decisionId) ?? null;
      },
      assessEligibility(initiative, decision) {
        eligibilityCalls.push(initiative.initiativeId);
        return fakeAssessEligibility(initiative, decision);
      },
    },
    initiativeCalls,
    decisionCalls,
    eligibilityCalls,
  };
}

describe("Initiative Implementation Commitment ancestry enforcement (Recovery Task 15)", () => {
  after(() => {
    deleteCommitmentsByParticipantIdForTests(TEST_PARTICIPANT_ID);
    deleteCommitmentsByParticipantIdForTests(OTHER_PARTICIPANT_ID);
  });

  describe("ancestry failure paths (no MongoDB required, fake lookups)", () => {
    it("rejects a missing initiativeId even when called directly", async () => {
      const { dependencies, initiativeCalls, decisionCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "", decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run for a missing id");
      assert.equal(decisionCalls.length, 0, "Decision lookup must not run for a missing Initiative id");
    });

    it("rejects a whitespace-only initiativeId", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "   ", decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a padded/malformed initiativeId", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: " padded-id ", decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative, without looking up the Collective Decision", async () => {
      const { dependencies, initiativeCalls, decisionCalls } = createDependencySpies(
        new Map(),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "does-not-exist", decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["does-not-exist"]);
      assert.equal(decisionCalls.length, 0, "Decision lookup must not run when the Initiative is missing");
    });

    it("rejects a missing Collective Decision", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map(),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: "does-not-exist" },
            dependencies,
          ),
        /Collective decision not found/,
      );
    });

    it("rejects an ineligible (non-closed) Collective Decision status, preserving the existing message", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ status: "opened" })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        /must be closed/,
      );
    });

    it("rejects an Initiative/Decision mismatch with the new typed error", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: OTHER_INITIATIVE_ID })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationCommitmentDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: KNOWN_DECISION_ID },
            dependencies,
          ),
        ImplementationCommitmentInitiativeMismatchError,
      );
    });

    it("persists no commitment when ancestry validation fails", async () => {
      const { dependencies } = createDependencySpies(new Map(), new Map());

      await assert.rejects(() =>
        createInitiativeImplementationCommitmentDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: "does-not-exist", decisionId: KNOWN_DECISION_ID },
          dependencies,
        ),
      );

      assert.equal(listCommitmentsByParticipant(TEST_PARTICIPANT_ID).length, 0);
    });

    it("persists no commitment when the Collective Decision is missing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map(),
      );

      await assert.rejects(() =>
        createInitiativeImplementationCommitmentDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: "does-not-exist" },
          dependencies,
        ),
      );

      assert.equal(listCommitmentsByParticipant(TEST_PARTICIPANT_ID).length, 0);
    });

    it("persists no commitment when the Initiative/Decision mismatch is detected", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision({ initiativeId: OTHER_INITIATIVE_ID })]]),
      );

      await assert.rejects(() =>
        createInitiativeImplementationCommitmentDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: KNOWN_DECISION_ID },
          dependencies,
        ),
      );

      assert.equal(listCommitmentsByParticipant(TEST_PARTICIPANT_ID).length, 0);
    });
  });

  describe("ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft, checking Initiative and Collective Decision exactly once each", async () => {
      const { dependencies, initiativeCalls, decisionCalls, eligibilityCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
      );

      const created = await createInitiativeImplementationCommitmentDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId: KNOWN_DECISION_ID },
        dependencies,
      );

      assert.equal(
        created.initiativeId,
        KNOWN_INITIATIVE_ID,
        "Persisted commitment uses the validated initiativeId",
      );
      assert.equal(
        created.decisionId,
        KNOWN_DECISION_ID,
        "Persisted commitment uses the resolved Collective Decision id",
      );
      assert.equal(created.participantId, TEST_PARTICIPANT_ID);
      assert.equal(created.status, "draft", "Initial status is unchanged");
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        decisionCalls,
        [KNOWN_DECISION_ID],
        "Collective Decision lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        eligibilityCalls,
        [KNOWN_INITIATIVE_ID],
        "Eligibility must be assessed exactly once for a successful creation",
      );
    });

    it("attributes the commitment to the calling participant identity unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([
          ["decision-participant-fixture", buildFakeDecision({ decisionId: "decision-participant-fixture" })],
        ]),
      );

      const created = await createInitiativeImplementationCommitmentDraft(
        { participantId: TEST_PARTICIPANT_ID, displayName: "Tester" },
        {
          ...VALID_INPUT_BASE,
          initiativeId: KNOWN_INITIATIVE_ID,
          decisionId: "decision-participant-fixture",
        },
        dependencies,
      );

      assert.equal(created.participantId, TEST_PARTICIPANT_ID);
      assert.equal(created.status, "draft");
    });
  });

  describe("existing rules unaffected by ancestry integration", () => {
    it("preserves the existing 'no ownership check on creation' rule: any participant may commit", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative({ stewardId: "someone-else" })]]),
        new Map([["decision-no-ownership-fixture", buildFakeDecision({ decisionId: "decision-no-ownership-fixture" })]]),
      );

      const created = await createInitiativeImplementationCommitmentDraft(
        { participantId: OTHER_PARTICIPANT_ID },
        {
          ...VALID_INPUT_BASE,
          initiativeId: KNOWN_INITIATIVE_ID,
          decisionId: "decision-no-ownership-fixture",
        },
        dependencies,
      );

      assert.equal(created.participantId, OTHER_PARTICIPANT_ID);
    });

    it("preserves the existing 'no duplicate protection' rule: a second commitment for the same Decision also persists", async () => {
      const decisionId = "decision-duplicate-fixture-ic";
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[decisionId, buildFakeDecision({ decisionId })]]),
      );

      const first = await createInitiativeImplementationCommitmentDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId },
        dependencies,
      );
      const second = await createInitiativeImplementationCommitmentDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionId },
        dependencies,
      );

      assert.notEqual(first.commitmentId, second.commitmentId);

      const persistedForDecision = listCommitmentsByParticipant(TEST_PARTICIPANT_ID).filter(
        (commitment) => commitment.decisionId === decisionId,
      );
      assert.equal(persistedForDecision.length, 2, "Both independent commitments should be persisted");
    });
  });
});
