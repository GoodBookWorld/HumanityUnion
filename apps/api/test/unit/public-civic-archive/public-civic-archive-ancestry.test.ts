import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type {
  Initiative,
  InitiativeCollectiveDecision,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativePublicImpact,
} from "@hu/types";

import {
  InitiativeIdMalformedError,
  ParentArtifactMissingInitiativeAncestryError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createArchiveInitiativeExistenceChecker,
  createArchiveParentImpactResolver,
  createPublicCivicArchiveDraft,
  resolvePublicCivicArchiveSource,
  type PublicCivicArchiveAncestryDependencies,
} from "../../../src/modules/public-civic-archive/public-civic-archive.service.js";
import {
  deleteArchiveRecordsByAuthorIdForTests,
  listArchiveRecordsByAuthor,
} from "../../../src/modules/public-civic-archive/public-civic-archive.store.js";

/**
 * Recovery Task 18 — coverage notes.
 *
 * Inspection (Part 1/2/3) found `PublicCivicArchiveRecord` stores its own
 * `initiativeId` and `impactId`, but `CreatePublicCivicArchiveDraftInput`
 * carries ONLY `impactId` — there is no independently-supplied
 * `initiativeId` anywhere in the creation path. This is the same
 * "Model B — transitive child" shape Task 17 found for Public Impact's own
 * relationship to Implementation Tracking, one level further down the
 * chain (Initiative ← Commitment ← Tracking ← Public Impact ← Civic
 * Archive):
 *
 * - Ancestry is TRANSITIVE (`validateTransitiveInitiativeAncestry` with
 *   `parentArtifactType: "impact"`, the canonical type for
 *   `initiative-public-impact` per Task 11). There is no second,
 *   independently-supplied Initiative reference to reconcile, so no
 *   Initiative/Impact mismatch is structurally reachable and no
 *   `CivicArchiveInitiativeMismatchError` was introduced — the "if both
 *   Initiative and Impact IDs are supplied" tests are not implemented as
 *   executable tests; their precondition does not hold.
 * - `parentArtifactType` is a hardcoded literal (`"impact"`), never
 *   caller-supplied, so `UnsupportedParentArtifactTypeError` is not
 *   reachable through this module's public surface either — covered only
 *   by the shared validator's own test suite.
 * - Tracking, Commitment, and Decision ARE looked up (once each) — unlike
 *   Task 17's Public Impact — because real, pre-existing eligibility rules
 *   (Tracking completed, Decision closed) and the `references` snapshot
 *   already required them. They are resolved once per creation, not
 *   ancestry-validated (Public Impact's own Initiative ancestry was already
 *   validated at Impact-creation time, Task 17), and are reused for both
 *   eligibility and snapshot construction.
 * - Pre-existing eligibility rules — verified Impact, author match,
 *   completed Tracking, closed Decision, projected Initiative, no existing
 *   draft for the Impact — are preserved via
 *   `assessPublicCivicArchiveEligibilityForResolved`, unchanged in message
 *   and precedence for every case except one: an Impact whose Initiative no
 *   longer exists now fails fast during ancestry resolution with only the
 *   translated "Initiative not found." message, instead of also
 *   accumulating unrelated eligibility reasons in the same combined
 *   message. This can only occur for corrupted/fixture data — Task 17
 *   guarantees a real Public Impact's `initiativeId` always resolves.
 * - `PublicCivicArchiveRecord` is its own write-side aggregate (own id,
 *   own draft/published lifecycle, author-entered title/summary/lessons/
 *   knowledge fields) — not a mere read projection — so "if
 *   projection-only" tests do not apply to the aggregate itself (the
 *   separate `public-civic-archive.projection.ts` /
 *   `public-civic-archive-lifecycle.projection.ts` are downstream read
 *   projections built FROM this aggregate).
 * - There is a real duplicate rule — at most one *draft* archive per
 *   Public Impact (`getDraftArchiveRecordForImpact`) — confirmed unchanged
 *   below.
 */

const TEST_AUTHOR_ID = "test-participant-civic-archive-ancestry";
const OTHER_PARTICIPANT_ID = "test-other-participant-civic-archive-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-ca-1";
const KNOWN_IMPACT_ID = "public-impact-ancestry-fixture-ca-1";
const KNOWN_TRACKING_ID = "implementation-tracking-ancestry-fixture-ca-1";
const KNOWN_COMMITMENT_ID = "implementation-commitment-ancestry-fixture-ca-1";
const KNOWN_DECISION_ID = "collective-decision-ancestry-fixture-ca-1";

const IDENTITY = { participantId: TEST_AUTHOR_ID };

const VALID_INPUT_BASE = {
  title: "Fixture Civic Archive",
  summary: "Fixture archive summary.",
  lessonsLearned: {
    whatWorked: "Worked",
    whatDidNotWork: "Did not",
    recommendationsForFuture: "Recommend",
    transferableExperience: "Transfer",
  },
  knowledgeContribution: {
    socialBenefits: "Social",
    environmentalBenefits: "Environmental",
    economicBenefits: "Economic",
    governanceBenefits: "Governance",
    educationalBenefits: "Educational",
    additionalObservations: "Observations",
  },
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

function buildFakeImpact(overrides: Partial<InitiativePublicImpact> = {}): InitiativePublicImpact {
  return {
    impactId: KNOWN_IMPACT_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    trackingId: KNOWN_TRACKING_ID,
    participantId: TEST_AUTHOR_ID,
    title: "Fixture Impact",
    summary: "Fixture impact summary.",
    observedImpact: "Fixture observed impact.",
    affectedCommunity: "Fixture community.",
    evidenceSummary: "Fixture evidence summary.",
    status: "verified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildFakeTracking(
  overrides: Partial<InitiativeImplementationTracking> = {},
): InitiativeImplementationTracking {
  return {
    trackingId: KNOWN_TRACKING_ID,
    commitmentId: KNOWN_COMMITMENT_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    participantId: TEST_AUTHOR_ID,
    status: "completed",
    currentStage: "Completed",
    summary: "Fixture tracking summary.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildFakeCommitment(
  overrides: Partial<InitiativeImplementationCommitment> = {},
): InitiativeImplementationCommitment {
  return {
    commitmentId: KNOWN_COMMITMENT_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    decisionId: KNOWN_DECISION_ID,
    participantId: TEST_AUTHOR_ID,
    commitmentTitle: "Fixture Commitment",
    commitmentSummary: "Fixture commitment summary.",
    commitmentScope: "Fixture scope.",
    status: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildFakeDecision(
  overrides: Partial<InitiativeCollectiveDecision> = {},
): InitiativeCollectiveDecision {
  return {
    decisionId: KNOWN_DECISION_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    decisionSessionId: "decision-session-fixture-ca-1",
    stewardId: "steward-fixture",
    sequenceNumber: 1,
    participationScope: "community",
    status: "closed",
    question: "Proceed?",
    closesAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDependencySpies(fixtures: {
  impacts?: ReadonlyMap<string, InitiativePublicImpact>;
  initiatives?: ReadonlyMap<string, Initiative>;
  trackings?: ReadonlyMap<string, InitiativeImplementationTracking>;
  commitments?: ReadonlyMap<string, InitiativeImplementationCommitment>;
  decisions?: ReadonlyMap<string, InitiativeCollectiveDecision>;
}): {
  dependencies: PublicCivicArchiveAncestryDependencies;
  impactCalls: string[];
  initiativeCalls: string[];
  trackingCalls: string[];
  commitmentCalls: string[];
  decisionCalls: string[];
} {
  const impacts = fixtures.impacts ?? new Map<string, InitiativePublicImpact>();
  const initiatives = fixtures.initiatives ?? new Map<string, Initiative>();
  const trackings = fixtures.trackings ?? new Map<string, InitiativeImplementationTracking>();
  const commitments = fixtures.commitments ?? new Map<string, InitiativeImplementationCommitment>();
  const decisions = fixtures.decisions ?? new Map<string, InitiativeCollectiveDecision>();

  const impactCalls: string[] = [];
  const initiativeCalls: string[] = [];
  const trackingCalls: string[] = [];
  const commitmentCalls: string[] = [];
  const decisionCalls: string[] = [];

  return {
    dependencies: {
      getImpact(impactId) {
        impactCalls.push(impactId);
        return impacts.get(impactId) ?? null;
      },
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiatives.get(initiativeId) ?? null;
      },
      getTracking(trackingId) {
        trackingCalls.push(trackingId);
        return trackings.get(trackingId) ?? null;
      },
      getCommitment(commitmentId) {
        commitmentCalls.push(commitmentId);
        return commitments.get(commitmentId) ?? null;
      },
      getDecision(decisionId) {
        decisionCalls.push(decisionId);
        return decisions.get(decisionId) ?? null;
      },
    },
    impactCalls,
    initiativeCalls,
    trackingCalls,
    commitmentCalls,
    decisionCalls,
  };
}

function fullFixtureMaps() {
  return {
    impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact()]]),
    initiatives: new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
    trackings: new Map([[KNOWN_TRACKING_ID, buildFakeTracking()]]),
    commitments: new Map([[KNOWN_COMMITMENT_ID, buildFakeCommitment()]]),
    decisions: new Map([[KNOWN_DECISION_ID, buildFakeDecision()]]),
  };
}

describe("Public Civic Archive ancestry enforcement (Recovery Task 18 — transitive via Public Impact)", () => {
  after(() => {
    deleteArchiveRecordsByAuthorIdForTests(TEST_AUTHOR_ID);
    deleteArchiveRecordsByAuthorIdForTests(OTHER_PARTICIPANT_ID);
  });

  describe("resolvePublicCivicArchiveSource — transitive ancestry shape", () => {
    it("resolves successfully with kind=transitive, canonical parent type, and preserved ids", async () => {
      const { dependencies, impactCalls, initiativeCalls, trackingCalls, commitmentCalls, decisionCalls } =
        createDependencySpies(fullFixtureMaps());

      const resolved = await resolvePublicCivicArchiveSource(KNOWN_IMPACT_ID, dependencies);

      assert.deepEqual(resolved.ancestry, {
        kind: "transitive",
        parentArtifactType: "impact",
        parentArtifactId: KNOWN_IMPACT_ID,
        initiativeId: KNOWN_INITIATIVE_ID,
      });
      assert.equal(resolved.impact.impactId, KNOWN_IMPACT_ID);
      assert.equal(resolved.initiative.initiativeId, KNOWN_INITIATIVE_ID);
      assert.equal(resolved.tracking?.trackingId, KNOWN_TRACKING_ID);
      assert.equal(resolved.commitment?.commitmentId, KNOWN_COMMITMENT_ID);
      assert.equal(resolved.decision?.decisionId, KNOWN_DECISION_ID);

      // Single resolution (Part 6/7/8): each dependency called exactly once.
      assert.deepEqual(impactCalls, [KNOWN_IMPACT_ID]);
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID]);
      assert.deepEqual(trackingCalls, [KNOWN_TRACKING_ID]);
      assert.deepEqual(commitmentCalls, [KNOWN_COMMITMENT_ID]);
      assert.deepEqual(decisionCalls, [KNOWN_DECISION_ID]);
    });

    it("rejects a missing impactId (empty), without looking up any Impact or Initiative", async () => {
      const { dependencies, impactCalls, initiativeCalls } = createDependencySpies(fullFixtureMaps());

      await assert.rejects(
        () => resolvePublicCivicArchiveSource("", dependencies),
        /Public impact record not found\.$/,
      );
      assert.equal(impactCalls.length, 0);
      assert.equal(initiativeCalls.length, 0);
    });

    it("rejects a nonexistent Public Impact (translated to the pre-existing message), without looking up any Initiative", async () => {
      const { dependencies, impactCalls, initiativeCalls } = createDependencySpies({
        initiatives: new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      });

      await assert.rejects(
        () => resolvePublicCivicArchiveSource("does-not-exist", dependencies),
        /Public impact record not found\.$/,
      );
      assert.deepEqual(impactCalls, ["does-not-exist"]);
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run when the impact is missing");
    });

    it("rejects a Public Impact with a missing (empty) Initiative ancestry using the shared parent-ancestry error", async () => {
      const { dependencies } = createDependencySpies({
        impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact({ initiativeId: "" })]]),
        initiatives: new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      });

      // Unreachable for any Public Impact created through the real service
      // (Task 17 validates Initiative ancestry at Impact creation) —
      // exercised here only to prove the shared validator's own guard.
      await assert.rejects(
        () => resolvePublicCivicArchiveSource(KNOWN_IMPACT_ID, dependencies),
        ParentArtifactMissingInitiativeAncestryError,
      );
    });

    it("rejects a Public Impact with a malformed Initiative id", async () => {
      const { dependencies } = createDependencySpies({
        impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact({ initiativeId: " padded-id " })]]),
        initiatives: new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      });

      await assert.rejects(
        () => resolvePublicCivicArchiveSource(KNOWN_IMPACT_ID, dependencies),
        InitiativeIdMalformedError,
      );
    });

    it("rejects when the Public Impact's Initiative no longer exists — translated to the pre-existing message", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies({
        impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact({ initiativeId: "vanished-initiative" })]]),
      });

      await assert.rejects(
        () => resolvePublicCivicArchiveSource(KNOWN_IMPACT_ID, dependencies),
        /Initiative not found\.$/,
      );
      assert.deepEqual(initiativeCalls, ["vanished-initiative"]);
    });
  });

  describe("createPublicCivicArchiveDraft ancestry/parent-failure paths (no MongoDB required)", () => {
    it("rejects an archive draft for a nonexistent Public Impact and persists nothing", async () => {
      const { dependencies } = createDependencySpies({});

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: "does-not-exist" },
            dependencies,
          ),
        /Public impact record not found\.$/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects an archive draft when the Public Impact's Initiative no longer exists, and persists nothing", async () => {
      const { dependencies } = createDependencySpies({
        impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact({ initiativeId: "vanished-initiative" })]]),
      });

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /Initiative not found\.$/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects a non-verified Public Impact, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies({
        ...fullFixtureMaps(),
        impacts: new Map([[KNOWN_IMPACT_ID, buildFakeImpact({ status: "published" })]]),
      });

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /Only verified public impact may enter the civic archive/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects a non-completed Tracking, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies({
        ...fullFixtureMaps(),
        trackings: new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ status: "active" })]]),
      });

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /requires completed implementation tracking/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects a non-closed Decision, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies({
        ...fullFixtureMaps(),
        decisions: new Map([[KNOWN_DECISION_ID, buildFakeDecision({ status: "opened" })]]),
      });

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /requires a closed collective decision/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects a non-projected Initiative, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies({
        ...fullFixtureMaps(),
        initiatives: new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative({ lifecyclePhase: "poll" })]]),
      });

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /requires a projected initiative/,
      );

      assert.equal(listArchiveRecordsByAuthor(TEST_AUTHOR_ID).length, 0);
    });

    it("rejects a non-author participant, preserving the existing authorization message", async () => {
      const { dependencies } = createDependencySpies(fullFixtureMaps());

      await assert.rejects(
        () =>
          createPublicCivicArchiveDraft(
            { participantId: OTHER_PARTICIPANT_ID },
            { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
            dependencies,
          ),
        /Only the implementation author may prepare an archive draft/,
      );

      assert.equal(listArchiveRecordsByAuthor(OTHER_PARTICIPANT_ID).length, 0);
    });
  });

  describe("createPublicCivicArchiveDraft ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft, checking Impact, Initiative, Tracking, Commitment, and Decision exactly once each", async () => {
      const { dependencies, impactCalls, initiativeCalls, trackingCalls, commitmentCalls, decisionCalls } =
        createDependencySpies(fullFixtureMaps());

      const created = await createPublicCivicArchiveDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, impactId: KNOWN_IMPACT_ID },
        dependencies,
      );

      assert.equal(
        created.initiativeId,
        KNOWN_INITIATIVE_ID,
        "Persisted archive uses the ancestry-resolved initiativeId",
      );
      assert.equal(created.impactId, KNOWN_IMPACT_ID, "Persisted archive uses the resolved Impact id");
      assert.equal(created.authorId, TEST_AUTHOR_ID);
      assert.equal(created.status, "draft", "Initial status is unchanged");
      assert.equal(created.archivedVersion, 0);
      assert.deepEqual(
        created.references,
        {
          initiativeId: KNOWN_INITIATIVE_ID,
          initiativeVersion: 1,
          decisionId: KNOWN_DECISION_ID,
          commitmentId: KNOWN_COMMITMENT_ID,
          trackingId: KNOWN_TRACKING_ID,
          impactId: KNOWN_IMPACT_ID,
        },
        "references snapshot preserves the exact pre-existing shape",
      );

      assert.deepEqual(impactCalls, [KNOWN_IMPACT_ID], "Impact lookup must run exactly once");
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID], "Initiative lookup must run exactly once");
      assert.deepEqual(trackingCalls, [KNOWN_TRACKING_ID], "Tracking lookup must run exactly once");
      assert.deepEqual(commitmentCalls, [KNOWN_COMMITMENT_ID], "Commitment lookup must run exactly once");
      assert.deepEqual(decisionCalls, [KNOWN_DECISION_ID], "Decision lookup must run exactly once");
    });
  });

  describe("existing rules unaffected by ancestry integration", () => {
    it("preserves the existing 'one draft per Impact' duplicate rule", async () => {
      const impactId = "public-impact-duplicate-fixture-ca";
      const { dependencies } = createDependencySpies({
        ...fullFixtureMaps(),
        impacts: new Map([[impactId, buildFakeImpact({ impactId })]]),
      });

      await createPublicCivicArchiveDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, impactId },
        dependencies,
      );

      await assert.rejects(
        () => createPublicCivicArchiveDraft(IDENTITY, { ...VALID_INPUT_BASE, impactId }, dependencies),
        /An archive draft already exists for this public impact record/,
      );
    });
  });

  describe("createArchiveParentImpactResolver (production ParentArtifactInitiativeResolver adapter)", () => {
    it('resolves a known Public Impact for parentArtifactType "impact"', () => {
      const impact = buildFakeImpact();
      const resolvedImpactBox: { value: InitiativePublicImpact | null } = { value: null };
      const resolver = createArchiveParentImpactResolver(
        (id) => (id === impact.impactId ? impact : null),
        resolvedImpactBox,
      );

      const result = resolver.resolveParentInitiativeId("impact", impact.impactId);

      assert.deepEqual(result, { found: true, initiativeId: impact.initiativeId });
      assert.equal(resolvedImpactBox.value, impact);
    });

    it("reports found:false for an unknown Impact id, without throwing", () => {
      const resolvedImpactBox: { value: InitiativePublicImpact | null } = { value: null };
      const resolver = createArchiveParentImpactResolver(() => null, resolvedImpactBox);

      const result = resolver.resolveParentInitiativeId("impact", "does-not-exist");

      assert.deepEqual(result, { found: false });
      assert.equal(resolvedImpactBox.value, null);
    });

    it('fails explicitly (found:false) for any parent artifact type other than "impact"', () => {
      const impact = buildFakeImpact();
      const resolvedImpactBox: { value: InitiativePublicImpact | null } = { value: null };
      let unexpectedLookupCalls = 0;
      const resolver = createArchiveParentImpactResolver((id) => {
        unexpectedLookupCalls += 1;
        return id === impact.impactId ? impact : null;
      }, resolvedImpactBox);

      for (const otherType of ["decision", "proposal", "petition", "implementation"] as const) {
        const result = resolver.resolveParentInitiativeId(otherType, impact.impactId);
        assert.deepEqual(result, { found: false });
      }

      assert.equal(unexpectedLookupCalls, 0);
      assert.equal(resolvedImpactBox.value, null);
    });
  });

  describe("createArchiveInitiativeExistenceChecker (production InitiativeExistenceChecker adapter)", () => {
    it("reports true and captures the resolved Initiative for a known id", () => {
      const initiative = buildFakeInitiative();
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createArchiveInitiativeExistenceChecker(
        (id) => (id === initiative.initiativeId ? initiative : null),
        resolvedInitiativeBox,
      );

      const exists = checker.initiativeExists(initiative.initiativeId);

      assert.equal(exists, true);
      assert.equal(resolvedInitiativeBox.value, initiative);
    });

    it("reports false and leaves the box empty for an unknown id", () => {
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createArchiveInitiativeExistenceChecker(() => null, resolvedInitiativeBox);

      const exists = checker.initiativeExists("does-not-exist");

      assert.equal(exists, false);
      assert.equal(resolvedInitiativeBox.value, null);
    });
  });

});
