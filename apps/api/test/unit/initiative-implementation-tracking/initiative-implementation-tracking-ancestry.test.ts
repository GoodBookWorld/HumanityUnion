import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeImplementationCommitment } from "@hu/types";

import {
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  ParentArtifactMissingInitiativeAncestryError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createInitiativeImplementationTrackingDraft,
  createTrackingInitiativeExistenceChecker,
  createTrackingParentCommitmentResolver,
  resolveTrackingInitiativeAncestry,
  type InitiativeImplementationTrackingAncestryDependencies,
} from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js";
import {
  deleteTrackingsByParticipantIdForTests,
  listTrackingsByCommitment,
  listTrackingsByParticipant,
} from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";

/**
 * Recovery Task 16 — coverage notes.
 *
 * Inspection (Part 1/2) found that `InitiativeImplementationTracking` stores
 * its own `initiativeId`, but `CreateInitiativeImplementationTrackingDraftInput`
 * carries ONLY a `commitmentId` — there is no independently-supplied
 * `initiativeId` anywhere in the creation path (unlike Task 15's
 * Implementation Commitment, which independently supplies both an
 * `initiativeId` and a `decisionId`). This is the task's "Model B —
 * transitive Commitment child":
 *
 * - Ancestry is TRANSITIVE (`validateTransitiveInitiativeAncestry` with
 *   `parentArtifactType: "implementation_commitment"`). There is no second,
 *   independently-supplied Initiative reference to reconcile, so no
 *   Initiative/Commitment mismatch is structurally reachable and no
 *   `ImplementationTrackingInitiativeMismatchError` was introduced — tests
 *   21-24 ("if both Initiative and Commitment IDs are supplied") are not
 *   implemented as executable tests; their precondition does not hold.
 * - Decision is never stored, accepted, or looked up by this module, before
 *   or after this task (0 Decision lookups; tests 32-34 do not apply).
 * - Tracking is an independent aggregate root (own store, id, lifecycle) —
 *   not embedded in Commitment and not a projection — so tests 29-31
 *   ("embedded or append-only") do not apply to the Tracking aggregate
 *   itself. (`ImplementationTrackingUpdate` execution-journal entries ARE
 *   append-only, but that pre-existing behavior is untouched by this task
 *   and is not re-verified here — see `verify-initiative-implementation-
 *   tracking-e2e.ts` step 4.)
 * - Pre-existing eligibility rules — Commitment must be "published", and
 *   only the Commitment's author may begin tracking — are preserved via
 *   `assessInitiativeImplementationTrackingEligibilityForResolved`, tested
 *   below unchanged in message and precedence.
 * - There is no duplicate/cardinality rule on creation today (0..N Tracking
 *   records per Commitment). Test below confirms two independent Tracking
 *   drafts against the same Commitment both persist successfully,
 *   unchanged.
 * - Creation never emits an event or notification (only
 *   `addImplementationTrackingUpdate` does, untouched by this task), so
 *   "no event after ancestry/parent failure" is trivially true by
 *   construction, not merely by omission of a spy.
 */

const TEST_PARTICIPANT_ID = "test-participant-implementation-tracking-ancestry";
const OTHER_PARTICIPANT_ID = "test-other-participant-implementation-tracking-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-it-1";
const KNOWN_COMMITMENT_ID = "implementation-commitment-ancestry-fixture-it-1";

const IDENTITY = { participantId: TEST_PARTICIPANT_ID };

const VALID_INPUT_BASE = {
  currentStage: "Preparation",
  summary: "Fixture tracking summary.",
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

function buildFakeCommitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  return {
    commitmentId: KNOWN_COMMITMENT_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    decisionId: "collective-decision-fixture-it-1",
    participantId: TEST_PARTICIPANT_ID,
    commitmentTitle: "Fixture Commitment",
    commitmentSummary: "Fixture summary.",
    commitmentScope: "Fixture scope.",
    status: "published",
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDependencySpies(
  commitmentsById: ReadonlyMap<string, InitiativeImplementationCommitment>,
  initiativesById: ReadonlyMap<string, Initiative>,
): {
  dependencies: InitiativeImplementationTrackingAncestryDependencies;
  commitmentCalls: string[];
  initiativeCalls: string[];
} {
  const commitmentCalls: string[] = [];
  const initiativeCalls: string[] = [];

  return {
    dependencies: {
      getCommitment(commitmentId) {
        commitmentCalls.push(commitmentId);
        return commitmentsById.get(commitmentId) ?? null;
      },
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
    },
    commitmentCalls,
    initiativeCalls,
  };
}

describe("Initiative Implementation Tracking ancestry enforcement (Recovery Task 16 — transitive)", () => {
  after(() => {
    deleteTrackingsByParticipantIdForTests(TEST_PARTICIPANT_ID);
    deleteTrackingsByParticipantIdForTests(OTHER_PARTICIPANT_ID);
  });

  describe("resolveTrackingInitiativeAncestry — transitive ancestry shape", () => {
    it("resolves successfully with kind=transitive, canonical parent type, and preserved ids", async () => {
      const { dependencies, commitmentCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const resolved = await resolveTrackingInitiativeAncestry(KNOWN_COMMITMENT_ID, dependencies);

      assert.deepEqual(resolved.ancestry, {
        kind: "transitive",
        parentArtifactType: "implementation_commitment",
        parentArtifactId: KNOWN_COMMITMENT_ID,
        initiativeId: KNOWN_INITIATIVE_ID,
      });
      assert.equal(resolved.commitment.commitmentId, KNOWN_COMMITMENT_ID);
      assert.equal(resolved.initiative.initiativeId, KNOWN_INITIATIVE_ID);

      // Single resolution (Part 5): each dependency called exactly once.
      assert.deepEqual(commitmentCalls, [KNOWN_COMMITMENT_ID]);
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID]);
    });

    it("rejects a missing commitmentId (empty), without looking up any Commitment or Initiative", async () => {
      const { dependencies, commitmentCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolveTrackingInitiativeAncestry("", dependencies),
        /Implementation commitment not found\.$/,
      );
      assert.equal(commitmentCalls.length, 0);
      assert.equal(initiativeCalls.length, 0);
    });

    it("rejects a nonexistent Implementation Commitment (translated to the pre-existing message), without looking up any Initiative", async () => {
      const { dependencies, commitmentCalls, initiativeCalls } = createDependencySpies(
        new Map(),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolveTrackingInitiativeAncestry("does-not-exist", dependencies),
        /Implementation commitment not found\.$/,
      );
      assert.deepEqual(commitmentCalls, ["does-not-exist"]);
      assert.equal(
        initiativeCalls.length,
        0,
        "Initiative lookup must not run when the commitment is missing",
      );
    });

    it("rejects an Implementation Commitment with a missing (empty) Initiative ancestry using the shared parent-ancestry error", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment({ initiativeId: "" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      // Unreachable for any Commitment created through the real service
      // (Task 15 validates Initiative ancestry at Commitment creation) —
      // exercised here only to prove the shared validator's own guard.
      await assert.rejects(
        () => resolveTrackingInitiativeAncestry(KNOWN_COMMITMENT_ID, dependencies),
        ParentArtifactMissingInitiativeAncestryError,
      );
    });

    it("rejects an Implementation Commitment with a malformed Initiative id", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment({ initiativeId: " padded-id " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolveTrackingInitiativeAncestry(KNOWN_COMMITMENT_ID, dependencies),
        InitiativeIdMalformedError,
      );
    });

    it("rejects when the Implementation Commitment's Initiative no longer exists — this is the new check Task 16 adds", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([
          [KNOWN_COMMITMENT_ID, buildFakeCommitment({ initiativeId: "vanished-initiative" })],
        ]),
        new Map(),
      );

      await assert.rejects(
        () => resolveTrackingInitiativeAncestry(KNOWN_COMMITMENT_ID, dependencies),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["vanished-initiative"]);
    });
  });

  describe("createInitiativeImplementationTrackingDraft ancestry/parent-failure paths (no MongoDB required)", () => {
    it("rejects tracking for a nonexistent Commitment and persists nothing", async () => {
      const { dependencies } = createDependencySpies(new Map(), new Map());

      await assert.rejects(
        () =>
          createInitiativeImplementationTrackingDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, commitmentId: "does-not-exist" },
            dependencies,
          ),
        /Implementation commitment not found\.$/,
      );

      assert.equal(listTrackingsByParticipant(TEST_PARTICIPANT_ID).length, 0);
    });

    it("rejects tracking when the Commitment's Initiative no longer exists, and persists nothing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([
          [KNOWN_COMMITMENT_ID, buildFakeCommitment({ initiativeId: "vanished-initiative" })],
        ]),
        new Map(),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationTrackingDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, commitmentId: KNOWN_COMMITMENT_ID },
            dependencies,
          ),
        InitiativeNotFoundError,
      );

      assert.equal(listTrackingsByCommitment(KNOWN_COMMITMENT_ID).length, 0);
    });

    it("rejects an unpublished (draft) Commitment, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment({ status: "draft" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationTrackingDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, commitmentId: KNOWN_COMMITMENT_ID },
            dependencies,
          ),
        /requires a published implementation commitment/,
      );

      assert.equal(listTrackingsByCommitment(KNOWN_COMMITMENT_ID).length, 0);
    });

    it("rejects a non-author participant, preserving the existing authorization message", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment({ participantId: TEST_PARTICIPANT_ID })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImplementationTrackingDraft(
            { participantId: OTHER_PARTICIPANT_ID },
            { ...VALID_INPUT_BASE, commitmentId: KNOWN_COMMITMENT_ID },
            dependencies,
          ),
        /Only the commitment author may begin implementation tracking/,
      );

      assert.equal(listTrackingsByCommitment(KNOWN_COMMITMENT_ID).length, 0);
    });
  });

  describe("createInitiativeImplementationTrackingDraft ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft, checking Commitment and Initiative exactly once each", async () => {
      const { dependencies, commitmentCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeImplementationTrackingDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, commitmentId: KNOWN_COMMITMENT_ID },
        dependencies,
      );

      assert.equal(
        created.initiativeId,
        KNOWN_INITIATIVE_ID,
        "Persisted tracking uses the ancestry-resolved initiativeId",
      );
      assert.equal(
        created.commitmentId,
        KNOWN_COMMITMENT_ID,
        "Persisted tracking uses the resolved Commitment id",
      );
      assert.equal(created.participantId, TEST_PARTICIPANT_ID);
      assert.equal(created.status, "draft", "Initial status is unchanged");
      assert.equal(created.currentStage, VALID_INPUT_BASE.currentStage);
      assert.equal(created.summary, VALID_INPUT_BASE.summary);
      assert.deepEqual(
        commitmentCalls,
        [KNOWN_COMMITMENT_ID],
        "Commitment lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
    });
  });

  describe("existing rules unaffected by ancestry integration", () => {
    it("preserves the existing 'no duplicate protection' rule: a second Tracking draft for the same Commitment also persists", async () => {
      const commitmentId = "implementation-commitment-duplicate-fixture-it";
      const { dependencies } = createDependencySpies(
        new Map([[commitmentId, buildFakeCommitment({ commitmentId })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const first = await createInitiativeImplementationTrackingDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, commitmentId },
        dependencies,
      );
      const second = await createInitiativeImplementationTrackingDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, commitmentId },
        dependencies,
      );

      assert.notEqual(first.trackingId, second.trackingId);

      const persistedForCommitment = listTrackingsByCommitment(commitmentId).filter(
        (tracking) => tracking.participantId === TEST_PARTICIPANT_ID,
      );
      assert.equal(persistedForCommitment.length, 2, "Both independent Tracking drafts should be persisted");
    });
  });

  describe("createTrackingParentCommitmentResolver (production ParentArtifactInitiativeResolver adapter)", () => {
    it('resolves a known Implementation Commitment for parentArtifactType "implementation_commitment"', () => {
      const commitment = buildFakeCommitment();
      const resolvedCommitmentBox: { value: InitiativeImplementationCommitment | null } = {
        value: null,
      };
      const resolver = createTrackingParentCommitmentResolver(
        (id) => (id === commitment.commitmentId ? commitment : null),
        resolvedCommitmentBox,
      );

      const result = resolver.resolveParentInitiativeId(
        "implementation_commitment",
        commitment.commitmentId,
      );

      assert.deepEqual(result, { found: true, initiativeId: commitment.initiativeId });
      assert.equal(resolvedCommitmentBox.value, commitment);
    });

    it("reports found:false for an unknown Commitment id, without throwing", () => {
      const resolvedCommitmentBox: { value: InitiativeImplementationCommitment | null } = {
        value: null,
      };
      const resolver = createTrackingParentCommitmentResolver(() => null, resolvedCommitmentBox);

      const result = resolver.resolveParentInitiativeId("implementation_commitment", "does-not-exist");

      assert.deepEqual(result, { found: false });
      assert.equal(resolvedCommitmentBox.value, null);
    });

    it('fails explicitly (found:false) for any parent artifact type other than "implementation_commitment"', () => {
      const commitment = buildFakeCommitment();
      const resolvedCommitmentBox: { value: InitiativeImplementationCommitment | null } = {
        value: null,
      };
      let unexpectedLookupCalls = 0;
      const resolver = createTrackingParentCommitmentResolver((id) => {
        unexpectedLookupCalls += 1;
        return id === commitment.commitmentId ? commitment : null;
      }, resolvedCommitmentBox);

      for (const otherType of ["decision", "proposal", "petition", "implementation"] as const) {
        const result = resolver.resolveParentInitiativeId(otherType, commitment.commitmentId);
        assert.deepEqual(result, { found: false });
      }

      assert.equal(unexpectedLookupCalls, 0);
      assert.equal(resolvedCommitmentBox.value, null);
    });
  });

  describe("createTrackingInitiativeExistenceChecker (production InitiativeExistenceChecker adapter)", () => {
    it("reports true and captures the resolved Initiative for a known id", () => {
      const initiative = buildFakeInitiative();
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createTrackingInitiativeExistenceChecker(
        (id) => (id === initiative.initiativeId ? initiative : null),
        resolvedInitiativeBox,
      );

      const exists = checker.initiativeExists(initiative.initiativeId);

      assert.equal(exists, true);
      assert.equal(resolvedInitiativeBox.value, initiative);
    });

    it("reports false and leaves the box empty for an unknown id", () => {
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createTrackingInitiativeExistenceChecker(() => null, resolvedInitiativeBox);

      const exists = checker.initiativeExists("does-not-exist");

      assert.equal(exists, false);
      assert.equal(resolvedInitiativeBox.value, null);
    });
  });
});
