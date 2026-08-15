import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type {
  DecisionSession,
  Initiative,
  InitiativeCollectiveDecisionEligibility,
  ParticipationScope,
} from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  CollectiveDecisionInitiativeMismatchError,
  createInitiativeCollectiveDecisionDraft,
  type InitiativeCollectiveDecisionAncestryDependencies,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.service.js";
import {
  deleteDecisionsByStewardIdForTests,
  listDecisionsBySteward,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";

/**
 * Recovery Task 09 — coverage notes.
 *
 * Inspection (Part 1/2) found that `CreateInitiativeCollectiveDecisionDraftInput`
 * carries BOTH an independent, direct `initiativeId` AND a mandatory
 * `decisionSessionId` — unlike Decision Session (Recovery Task 08), which has
 * no upstream-artifact reference at all. This is the task's "Model A —
 * direct ancestry plus parent consistency": `InitiativeCollectiveDecision`
 * stores its own `initiativeId` directly, and Decision Session consistency
 * (`decision.initiativeId === decisionSession.initiativeId`) is a separate,
 * pre-existing invariant (previously enforced only via a plain reasons-list
 * string, now also surfaced as `CollectiveDecisionInitiativeMismatchError`).
 * Consequently:
 *
 * - Ancestry is DIRECT (`validateDirectInitiativeAncestry`). Transitive
 *   ancestry does not apply: an independent `initiativeId` is always
 *   supplied, so there is nothing to resolve through a parent artifact.
 * - Tests 26-31 ("if transitive ancestry is used") are not implemented as
 *   executable tests: their preconditions do not hold under the current
 *   contract. Tests 9-12 below exercise the real Initiative/Decision-Session
 *   mismatch invariant instead.
 */

const TEST_STEWARD_ID = "test-steward-collective-decision-ancestry";
const OTHER_STEWARD_ID = "test-other-steward-collective-decision-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-icd-1";
const OTHER_INITIATIVE_ID = "initiative-ancestry-fixture-icd-2";
const KNOWN_SESSION_ID = "decision-session-ancestry-fixture-icd-1";

const IDENTITY = { participantId: TEST_STEWARD_ID };

function futureIsoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

const VALID_INPUT_BASE = {
  participationScope: "community" as ParticipationScope,
  closesAt: futureIsoDate(30),
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

function buildFakeSession(overrides: Partial<DecisionSession> = {}): DecisionSession {
  return {
    sessionId: KNOWN_SESSION_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    initiativeVersion: 3,
    stewardId: TEST_STEWARD_ID,
    title: "Fake Decision Session",
    purpose: "Fake purpose.",
    decisionQuestion: "Should the fixture proceed?",
    status: "closed",
    opensAt: futureIsoDate(-10),
    closesAt: futureIsoDate(-1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mirrors the real `assessInitiativeCollectiveDecisionEligibilityForResolved`
 * reason precedence (not found > mismatch > status > question) as a fully
 * isolated fake, so tests do not depend on the real Initiative Version
 * Revision store for `initiativeVersion`.
 */
function fakeAssessEligibility(
  initiative: Initiative,
  session: DecisionSession | null,
): InitiativeCollectiveDecisionEligibility {
  const reasons: string[] = [];

  if (!session) {
    reasons.push("Decision session not found.");
  } else {
    if (session.initiativeId !== initiative.initiativeId) {
      reasons.push("Decision session does not belong to this initiative.");
    }
    if (session.status !== "published" && session.status !== "closed") {
      reasons.push("Decision session must be published before opening a collective decision.");
    }
    if (!session.decisionQuestion.trim()) {
      reasons.push("Decision session must have a non-empty decision question.");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    decisionSessionId: session?.sessionId,
    initiativeVersion: 3,
  };
}

function createDependencySpies(
  initiativesById: ReadonlyMap<string, Initiative>,
  sessionsById: ReadonlyMap<string, DecisionSession>,
): {
  dependencies: InitiativeCollectiveDecisionAncestryDependencies;
  initiativeCalls: string[];
  sessionCalls: string[];
  eligibilityCalls: string[];
} {
  const initiativeCalls: string[] = [];
  const sessionCalls: string[] = [];
  const eligibilityCalls: string[] = [];

  return {
    dependencies: {
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
      getSession(decisionSessionId) {
        sessionCalls.push(decisionSessionId);
        return sessionsById.get(decisionSessionId) ?? null;
      },
      assessEligibility(initiative, session) {
        eligibilityCalls.push(initiative.initiativeId);
        return fakeAssessEligibility(initiative, session);
      },
    },
    initiativeCalls,
    sessionCalls,
    eligibilityCalls,
  };
}

describe("Initiative Collective Decision ancestry enforcement (Recovery Task 09)", () => {
  after(() => {
    deleteDecisionsByStewardIdForTests(TEST_STEWARD_ID);
    deleteDecisionsByStewardIdForTests(OTHER_STEWARD_ID);
  });

  describe("ancestry failure paths (no MongoDB required, fake lookups)", () => {
    it("rejects a missing initiativeId even when called directly", async () => {
      const { dependencies, initiativeCalls, sessionCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "", decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run for a missing id");
      assert.equal(sessionCalls.length, 0, "Session lookup must not run for a missing Initiative id");
    });

    it("rejects a whitespace-only initiativeId", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "   ", decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a padded/malformed initiativeId", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: " padded-id ", decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative, without looking up the Decision Session", async () => {
      const { dependencies, initiativeCalls, sessionCalls } = createDependencySpies(
        new Map(),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "does-not-exist", decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["does-not-exist"]);
      assert.equal(sessionCalls.length, 0, "Session lookup must not run when the Initiative is missing");
    });

    it("rejects a missing Decision Session", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map(),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: "does-not-exist" },
            dependencies,
          ),
        /Decision session not found/,
      );
    });

    it("rejects an ineligible (draft) Decision Session status — Part G unlocks Collective Decision on publish", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession({ status: "draft" })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        /must be published/,
      );
    });

    it("rejects an Initiative/Decision-Session mismatch with the new typed error", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession({ initiativeId: OTHER_INITIATIVE_ID })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        CollectiveDecisionInitiativeMismatchError,
      );
    });

    it("preserves existing ownership behavior: a non-steward cannot create a decision for the Initiative", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative({ stewardId: OTHER_STEWARD_ID })]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        /do not have access/,
      );
    });

    it("preserves existing ownership-before-eligibility error precedence for a compound-invalid request", async () => {
      // Non-owner AND an ineligible (non-closed) session: the pre-existing
      // implementation checked ownership before eligibility, so the
      // ownership failure must still win.
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative({ stewardId: OTHER_STEWARD_ID })]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession({ status: "published" })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
            dependencies,
          ),
        /do not have access/,
      );
    });

    it("persists no decision when ancestry validation fails", async () => {
      const { dependencies } = createDependencySpies(new Map(), new Map());

      await assert.rejects(() =>
        createInitiativeCollectiveDecisionDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: "does-not-exist", decisionSessionId: KNOWN_SESSION_ID },
          dependencies,
        ),
      );

      // No event is emitted on failure either: createInitiativeCollectiveDecisionDraft
      // never calls emitCivicNotificationEvent (only open/close do).
      assert.equal(listDecisionsBySteward(TEST_STEWARD_ID).length, 0);
    });

    it("persists no decision when the Decision Session is missing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map(),
      );

      await assert.rejects(() =>
        createInitiativeCollectiveDecisionDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: "does-not-exist" },
          dependencies,
        ),
      );

      assert.equal(listDecisionsBySteward(TEST_STEWARD_ID).length, 0);
    });

    it("persists no decision when the Initiative/Decision-Session mismatch is detected", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession({ initiativeId: OTHER_INITIATIVE_ID })]]),
      );

      await assert.rejects(() =>
        createInitiativeCollectiveDecisionDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
          dependencies,
        ),
      );

      assert.equal(listDecisionsBySteward(TEST_STEWARD_ID).length, 0);
    });
  });

  describe("ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft, checking Initiative and Decision Session exactly once each", async () => {
      const { dependencies, initiativeCalls, sessionCalls, eligibilityCalls } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[KNOWN_SESSION_ID, buildFakeSession()]]),
      );

      const created = await createInitiativeCollectiveDecisionDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: KNOWN_SESSION_ID },
        dependencies,
      );

      assert.equal(created.initiativeId, KNOWN_INITIATIVE_ID, "Persisted decision uses the validated initiativeId");
      assert.equal(
        created.decisionSessionId,
        KNOWN_SESSION_ID,
        "Persisted decision uses the resolved Decision Session id",
      );
      assert.equal(created.stewardId, TEST_STEWARD_ID);
      assert.equal(created.status, "draft", "Initial status is unchanged");
      assert.equal(created.question, "Should the fixture proceed?", "Question is sourced from the session");
      assert.equal(created.participationScope, "community");
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        sessionCalls,
        [KNOWN_SESSION_ID],
        "Decision Session lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        eligibilityCalls,
        [KNOWN_INITIATIVE_ID],
        "Eligibility must be assessed exactly once for a successful creation",
      );
    });

    it("attributes stewardship to the calling participant identity unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([
          ["session-stewardship-fixture", buildFakeSession({ sessionId: "session-stewardship-fixture" })],
        ]),
      );

      const created = await createInitiativeCollectiveDecisionDraft(
        { participantId: TEST_STEWARD_ID, displayName: "Tester" },
        {
          ...VALID_INPUT_BASE,
          initiativeId: KNOWN_INITIATIVE_ID,
          decisionSessionId: "session-stewardship-fixture",
        },
        dependencies,
      );

      assert.equal(created.stewardId, TEST_STEWARD_ID);
      assert.equal(created.status, "draft");
    });
  });

  describe("duplicate Collective Decision protection (pre-existing rule, unaffected)", () => {
    it("rejects a second decision for the same Decision Session and persists only the first", async () => {
      const sessionId = "session-duplicate-fixture";
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
        new Map([[sessionId, buildFakeSession({ sessionId })]]),
      );

      const first = await createInitiativeCollectiveDecisionDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: sessionId },
        dependencies,
      );

      await assert.rejects(
        () =>
          createInitiativeCollectiveDecisionDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID, decisionSessionId: sessionId },
            dependencies,
          ),
        /already exists for this decision session/,
      );

      const persistedForSession = listDecisionsBySteward(TEST_STEWARD_ID).filter(
        (decision) => decision.decisionSessionId === sessionId,
      );
      assert.equal(persistedForSession.length, 1, "Only the first decision should be persisted");
      assert.equal(persistedForSession[0]?.decisionId, first.decisionId);
    });
  });
});
