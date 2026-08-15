import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { DecisionSessionEligibility, Initiative } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createDecisionSessionDraft,
  type DecisionSessionAncestryDependencies,
} from "../../../src/modules/decision-session/decision-session.service.js";
import {
  deleteSessionsByStewardIdForTests,
  listSessionsBySteward,
} from "../../../src/modules/decision-session/decision-session.store.js";

/**
 * Recovery Task 08 — coverage notes.
 *
 * Inspection (Part 1/2) found that `CreateDecisionSessionDraftInput` carries
 * a direct, independent `initiativeId` — unlike Initiative Improvement
 * Proposal (Recovery Task 07), whose `initiativeId` is derived from a
 * mandatory Analysis reference. `DecisionSession` stores this `initiativeId`
 * directly, matching "Model A" storage shape. However, unlike the Model A
 * described in the task prompt, Decision Session creation does NOT accept or
 * store an independent Improvement Proposal (or Collaborative Analysis) ID
 * at all: eligibility is an aggregate, Initiative-scoped rule ("at least one
 * published Analysis and one steward-reviewed Proposal exist for this
 * Initiative" — see `decision-session-eligibility.ts`), not a reference to a
 * *specific* upstream artifact. Both artifact lists in that rule are looked
 * up by the same, already-validated `initiativeId`, so cross-artifact
 * Initiative consistency is guaranteed structurally and there is no
 * independently suppliable Analysis/Proposal identifier that could ever
 * disagree with it. Consequently:
 *
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`); transitive
 *   ancestry does not apply and is not used.
 * - Tests 16-22 (Part 15 "if Proposal is referenced") and 23-32 ("if
 *   transitive ancestry is used" / "if multiple upstream artifacts exist")
 *   are not implemented as executable tests: their preconditions do not
 *   hold under the current contract. Test 6 ("Initiative lifecycle
 *   ineligibility preserves existing behavior") below exercises the nearest
 *   real invariant: the pre-existing, Initiative-scoped eligibility rule.
 */

const TEST_STEWARD_ID = "test-steward-decision-session-ancestry";
const OTHER_STEWARD_ID = "test-other-steward-decision-session-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-ds-1";

const IDENTITY = { participantId: TEST_STEWARD_ID };

const VALID_INPUT_BASE = {
  title: "Test Decision Session",
  purpose: "Test purpose.",
  decisionQuestion: "Test decision question?",
  opensAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  closesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
};

const ELIGIBLE_ELIGIBILITY: DecisionSessionEligibility = {
  eligible: true,
  reasons: [],
  initiativeVersion: 3,
  publishedAnalysisCount: 1,
  stewardReviewedProposalCount: 1,
};

const INELIGIBLE_ELIGIBILITY: DecisionSessionEligibility = {
  eligible: false,
  reasons: ["At least one steward-reviewed improvement proposal is required."],
  initiativeVersion: 0,
  publishedAnalysisCount: 1,
  stewardReviewedProposalCount: 0,
};

function buildFakeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: KNOWN_INITIATIVE_ID,
    stewardId: TEST_STEWARD_ID,
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

function createDependencySpies(
  initiativesById: ReadonlyMap<string, Initiative>,
  eligibilityByInitiativeId: ReadonlyMap<string, DecisionSessionEligibility> = new Map(),
): {
  dependencies: DecisionSessionAncestryDependencies;
  initiativeCalls: string[];
  eligibilityCalls: string[];
} {
  const initiativeCalls: string[] = [];
  const eligibilityCalls: string[] = [];

  return {
    dependencies: {
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
      assessEligibility(initiative) {
        eligibilityCalls.push(initiative.initiativeId);
        return eligibilityByInitiativeId.get(initiative.initiativeId) ?? ELIGIBLE_ELIGIBILITY;
      },
    },
    initiativeCalls,
    eligibilityCalls,
  };
}

describe("Decision Session ancestry enforcement (Recovery Task 08)", () => {
  after(() => {
    deleteSessionsByStewardIdForTests(TEST_STEWARD_ID);
  });

  describe("ancestry failure paths (no MongoDB required, fake lookups)", () => {
    it("rejects an empty initiativeId even when called directly", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "" },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run for a missing id");
    });

    it("rejects a whitespace-only initiativeId", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "   " },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run for a malformed id");
    });

    it("rejects a padded/malformed initiativeId", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: " padded-id " },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative", async () => {
      const { dependencies, initiativeCalls, eligibilityCalls } = createDependencySpies(new Map());

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "does-not-exist" },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["does-not-exist"]);
      assert.equal(eligibilityCalls.length, 0, "Eligibility must not run when the Initiative is missing");
    });

    it("preserves existing eligibility behavior for an ineligible Initiative (pre-existing rule, unaffected)", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_INITIATIVE_ID, INELIGIBLE_ELIGIBILITY]]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
            dependencies,
          ),
        /steward-reviewed improvement proposal/,
      );
    });

    it("preserves existing ownership behavior: a non-steward cannot create a session for the Initiative", async () => {
      const { dependencies } = createDependencySpies(
        new Map([
          [KNOWN_INITIATIVE_ID, buildFakeInitiative({ stewardId: OTHER_STEWARD_ID })],
        ]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
            dependencies,
          ),
        /do not have access/,
      );
    });

    it("persists no session when ancestry validation fails", async () => {
      const { dependencies } = createDependencySpies(new Map());

      await assert.rejects(() =>
        createDecisionSessionDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: "does-not-exist" },
          dependencies,
        ),
      );

      // No event is emitted on failure either: decision-session.service.ts
      // never imports or calls emitCivicNotificationEvent anywhere in this
      // module (creation, publish, close, and archive are all silent).
      assert.equal(listSessionsBySteward(TEST_STEWARD_ID).length, 0);
    });

    it("persists no session when the closing/opening date rule fails after ancestry succeeds", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createDecisionSessionDraft(
            IDENTITY,
            {
              ...VALID_INPUT_BASE,
              initiativeId: KNOWN_INITIATIVE_ID,
              opensAt: VALID_INPUT_BASE.closesAt,
              closesAt: VALID_INPUT_BASE.opensAt,
            },
            dependencies,
          ),
        /Closing date must be after opening date/,
      );
      assert.equal(listSessionsBySteward(TEST_STEWARD_ID).length, 0);
    });
  });

  describe("ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft using the validated initiativeId, checking Initiative existence and eligibility exactly once", async () => {
      const { dependencies, initiativeCalls, eligibilityCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createDecisionSessionDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
        dependencies,
      );

      assert.equal(created.initiativeId, KNOWN_INITIATIVE_ID);
      assert.equal(created.stewardId, TEST_STEWARD_ID);
      assert.equal(created.status, "draft");
      assert.equal(created.initiativeVersion, ELIGIBLE_ELIGIBILITY.initiativeVersion);
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        eligibilityCalls,
        [KNOWN_INITIATIVE_ID],
        "Eligibility must be assessed exactly once for a successful creation",
      );
    });

    it("preserves existing content/agenda fields unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createDecisionSessionDraft(
        IDENTITY,
        {
          ...VALID_INPUT_BASE,
          initiativeId: KNOWN_INITIATIVE_ID,
          title: "Distinct Session Title",
        },
        dependencies,
      );

      assert.equal(created.title, "Distinct Session Title");
      assert.equal(created.purpose, VALID_INPUT_BASE.purpose);
      assert.equal(created.decisionQuestion, VALID_INPUT_BASE.decisionQuestion);
      assert.equal(created.opensAt, VALID_INPUT_BASE.opensAt);
      assert.equal(created.closesAt, VALID_INPUT_BASE.closesAt);
    });

    it("attributes stewardship to the calling participant identity unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createDecisionSessionDraft(
        { participantId: TEST_STEWARD_ID, displayName: "Tester" },
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
        dependencies,
      );

      assert.equal(created.stewardId, TEST_STEWARD_ID);
      assert.equal(created.status, "draft");
    });
  });
});
