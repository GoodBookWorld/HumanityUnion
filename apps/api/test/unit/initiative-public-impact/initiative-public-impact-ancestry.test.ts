import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeImplementationTracking } from "@hu/types";

import {
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  ParentArtifactMissingInitiativeAncestryError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createImpactInitiativeExistenceChecker,
  createImpactParentTrackingResolver,
  createInitiativePublicImpactDraft,
  resolvePublicImpactInitiativeAncestry,
  type InitiativePublicImpactAncestryDependencies,
} from "../../../src/modules/initiative-public-impact/initiative-public-impact.service.js";
import {
  deletePublicImpactsByParticipantIdForTests,
  listImpactsByParticipant,
  listImpactsByTracking,
} from "../../../src/modules/initiative-public-impact/initiative-public-impact.store.js";

/**
 * Recovery Task 17 — coverage notes.
 *
 * Inspection (Part 1/2) found that `InitiativePublicImpact` stores its own
 * `initiativeId`, but `CreateInitiativePublicImpactDraftInput` carries ONLY a
 * `trackingId` — there is no independently-supplied `initiativeId` anywhere
 * in the creation path. This is the same "Model B — transitive Tracking
 * child" shape Task 16 found for Implementation Tracking's own relationship
 * to Implementation Commitment:
 *
 * - Ancestry is TRANSITIVE (`validateTransitiveInitiativeAncestry` with
 *   `parentArtifactType: "implementation"`, the canonical type for
 *   `initiative-implementation-tracking` per Task 11). There is no second,
 *   independently-supplied Initiative reference to reconcile, so no
 *   Initiative/Tracking mismatch is structurally reachable and no
 *   `PublicImpactInitiativeMismatchError` was introduced — tests 21-24 ("if
 *   both Initiative and Tracking IDs are supplied") are not implemented as
 *   executable tests; their precondition does not hold.
 * - Commitment and Decision are never stored, accepted, or looked up by this
 *   module, before or after this task (0 Commitment lookups, 0 Decision
 *   lookups; tests 29-32 do not apply).
 * - Public Impact is an independent aggregate root (own store, id,
 *   lifecycle) — not embedded in Tracking and not a mere read projection
 *   (the separate `public-initiative-public-impact.projection.ts` is a
 *   downstream read projection built FROM this aggregate) — so tests 33-35
 *   ("Public Impact is a projection") do not apply to the aggregate itself.
 * - Pre-existing eligibility rules — Tracking must be "completed", and only
 *   the Tracking's author may document public impact — are preserved via
 *   `assessInitiativePublicImpactEligibilityForResolved`, tested below
 *   unchanged in message and precedence.
 * - There is no duplicate/cardinality rule on creation today (0..N Public
 *   Impact records per Tracking). Test below confirms two independent
 *   Public Impact drafts against the same Tracking both persist
 *   successfully, unchanged.
 * - Creation never emits an event or notification (only
 *   `verifyInitiativePublicImpact` does, untouched by this task), so "no
 *   event after ancestry/parent failure" is trivially true by construction,
 *   not merely by omission of a spy.
 */

const TEST_PARTICIPANT_ID = "test-participant-public-impact-ancestry";
const OTHER_PARTICIPANT_ID = "test-other-participant-public-impact-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-pi-1";
const KNOWN_TRACKING_ID = "implementation-tracking-ancestry-fixture-pi-1";

const IDENTITY = { participantId: TEST_PARTICIPANT_ID };

const VALID_INPUT_BASE = {
  title: "Fixture Impact",
  summary: "Fixture impact summary.",
  observedImpact: "Fixture observed impact.",
  affectedCommunity: "Fixture community.",
  evidenceSummary: "Fixture evidence summary.",
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

function buildFakeTracking(
  overrides: Partial<InitiativeImplementationTracking> = {},
): InitiativeImplementationTracking {
  return {
    trackingId: KNOWN_TRACKING_ID,
    commitmentId: "implementation-commitment-fixture-pi-1",
    initiativeId: KNOWN_INITIATIVE_ID,
    participantId: TEST_PARTICIPANT_ID,
    status: "completed",
    currentStage: "Completed",
    summary: "Fixture tracking summary.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDependencySpies(
  trackingsById: ReadonlyMap<string, InitiativeImplementationTracking>,
  initiativesById: ReadonlyMap<string, Initiative>,
): {
  dependencies: InitiativePublicImpactAncestryDependencies;
  trackingCalls: string[];
  initiativeCalls: string[];
} {
  const trackingCalls: string[] = [];
  const initiativeCalls: string[] = [];

  return {
    dependencies: {
      getTracking(trackingId) {
        trackingCalls.push(trackingId);
        return trackingsById.get(trackingId) ?? null;
      },
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
    },
    trackingCalls,
    initiativeCalls,
  };
}

describe("Initiative Public Impact ancestry enforcement (Recovery Task 17 — transitive)", () => {
  after(() => {
    deletePublicImpactsByParticipantIdForTests(TEST_PARTICIPANT_ID);
    deletePublicImpactsByParticipantIdForTests(OTHER_PARTICIPANT_ID);
  });

  describe("resolvePublicImpactInitiativeAncestry — transitive ancestry shape", () => {
    it("resolves successfully with kind=transitive, canonical parent type, and preserved ids", async () => {
      const { dependencies, trackingCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const resolved = await resolvePublicImpactInitiativeAncestry(KNOWN_TRACKING_ID, dependencies);

      assert.deepEqual(resolved.ancestry, {
        kind: "transitive",
        parentArtifactType: "implementation",
        parentArtifactId: KNOWN_TRACKING_ID,
        initiativeId: KNOWN_INITIATIVE_ID,
      });
      assert.equal(resolved.tracking.trackingId, KNOWN_TRACKING_ID);
      assert.equal(resolved.initiative.initiativeId, KNOWN_INITIATIVE_ID);

      // Single resolution (Part 5): each dependency called exactly once.
      assert.deepEqual(trackingCalls, [KNOWN_TRACKING_ID]);
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID]);
    });

    it("rejects a missing trackingId (empty), without looking up any Tracking or Initiative", async () => {
      const { dependencies, trackingCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolvePublicImpactInitiativeAncestry("", dependencies),
        /Implementation tracking not found\.$/,
      );
      assert.equal(trackingCalls.length, 0);
      assert.equal(initiativeCalls.length, 0);
    });

    it("rejects a nonexistent Implementation Tracking (translated to the pre-existing message), without looking up any Initiative", async () => {
      const { dependencies, trackingCalls, initiativeCalls } = createDependencySpies(
        new Map(),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolvePublicImpactInitiativeAncestry("does-not-exist", dependencies),
        /Implementation tracking not found\.$/,
      );
      assert.deepEqual(trackingCalls, ["does-not-exist"]);
      assert.equal(
        initiativeCalls.length,
        0,
        "Initiative lookup must not run when the tracking is missing",
      );
    });

    it("rejects an Implementation Tracking with a missing (empty) Initiative ancestry using the shared parent-ancestry error", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ initiativeId: "" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      // Unreachable for any Tracking created through the real service (Task
      // 16 validates Initiative ancestry at Tracking creation) — exercised
      // here only to prove the shared validator's own guard.
      await assert.rejects(
        () => resolvePublicImpactInitiativeAncestry(KNOWN_TRACKING_ID, dependencies),
        ParentArtifactMissingInitiativeAncestryError,
      );
    });

    it("rejects an Implementation Tracking with a malformed Initiative id", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ initiativeId: " padded-id " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () => resolvePublicImpactInitiativeAncestry(KNOWN_TRACKING_ID, dependencies),
        InitiativeIdMalformedError,
      );
    });

    it("rejects when the Implementation Tracking's Initiative no longer exists — this is the new check Task 17 adds", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ initiativeId: "vanished-initiative" })]]),
        new Map(),
      );

      await assert.rejects(
        () => resolvePublicImpactInitiativeAncestry(KNOWN_TRACKING_ID, dependencies),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, ["vanished-initiative"]);
    });
  });

  describe("createInitiativePublicImpactDraft ancestry/parent-failure paths (no MongoDB required)", () => {
    it("rejects an impact draft for a nonexistent Tracking and persists nothing", async () => {
      const { dependencies } = createDependencySpies(new Map(), new Map());

      await assert.rejects(
        () =>
          createInitiativePublicImpactDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, trackingId: "does-not-exist" },
            dependencies,
          ),
        /Implementation tracking not found\.$/,
      );

      assert.equal(listImpactsByParticipant(TEST_PARTICIPANT_ID).length, 0);
    });

    it("rejects an impact draft when the Tracking's Initiative no longer exists, and persists nothing", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ initiativeId: "vanished-initiative" })]]),
        new Map(),
      );

      await assert.rejects(
        () =>
          createInitiativePublicImpactDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, trackingId: KNOWN_TRACKING_ID },
            dependencies,
          ),
        InitiativeNotFoundError,
      );

      assert.equal(listImpactsByTracking(KNOWN_TRACKING_ID).length, 0);
    });

    it("rejects a non-completed (active) Tracking, preserving the existing eligibility message", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ status: "active" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativePublicImpactDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, trackingId: KNOWN_TRACKING_ID },
            dependencies,
          ),
        /requires completed implementation tracking/,
      );

      assert.equal(listImpactsByTracking(KNOWN_TRACKING_ID).length, 0);
    });

    it("rejects a non-author participant, preserving the existing authorization message", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking({ participantId: TEST_PARTICIPANT_ID })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativePublicImpactDraft(
            { participantId: OTHER_PARTICIPANT_ID },
            { ...VALID_INPUT_BASE, trackingId: KNOWN_TRACKING_ID },
            dependencies,
          ),
        /Only the tracking author may document public impact/,
      );

      assert.equal(listImpactsByTracking(KNOWN_TRACKING_ID).length, 0);
    });
  });

  describe("createInitiativePublicImpactDraft ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft, checking Tracking and Initiative exactly once each", async () => {
      const { dependencies, trackingCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_TRACKING_ID, buildFakeTracking()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativePublicImpactDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, trackingId: KNOWN_TRACKING_ID },
        dependencies,
      );

      assert.equal(
        created.initiativeId,
        KNOWN_INITIATIVE_ID,
        "Persisted impact uses the ancestry-resolved initiativeId",
      );
      assert.equal(
        created.trackingId,
        KNOWN_TRACKING_ID,
        "Persisted impact uses the resolved Tracking id",
      );
      assert.equal(created.participantId, TEST_PARTICIPANT_ID);
      assert.equal(created.status, "draft", "Initial status is unchanged");
      assert.equal(created.title, VALID_INPUT_BASE.title);
      assert.equal(created.summary, VALID_INPUT_BASE.summary);
      assert.deepEqual(
        trackingCalls,
        [KNOWN_TRACKING_ID],
        "Tracking lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
    });
  });

  describe("existing rules unaffected by ancestry integration", () => {
    it("preserves the existing 'no duplicate protection' rule: a second Public Impact draft for the same Tracking also persists", async () => {
      const trackingId = "implementation-tracking-duplicate-fixture-pi";
      const { dependencies } = createDependencySpies(
        new Map([[trackingId, buildFakeTracking({ trackingId })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const first = await createInitiativePublicImpactDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, trackingId },
        dependencies,
      );
      const second = await createInitiativePublicImpactDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, trackingId },
        dependencies,
      );

      assert.notEqual(first.impactId, second.impactId);

      const persistedForTracking = listImpactsByTracking(trackingId).filter(
        (impact) => impact.participantId === TEST_PARTICIPANT_ID,
      );
      assert.equal(persistedForTracking.length, 2, "Both independent Impact drafts should be persisted");
    });
  });

  describe("createImpactParentTrackingResolver (production ParentArtifactInitiativeResolver adapter)", () => {
    it('resolves a known Implementation Tracking for parentArtifactType "implementation"', () => {
      const tracking = buildFakeTracking();
      const resolvedTrackingBox: { value: InitiativeImplementationTracking | null } = {
        value: null,
      };
      const resolver = createImpactParentTrackingResolver(
        (id) => (id === tracking.trackingId ? tracking : null),
        resolvedTrackingBox,
      );

      const result = resolver.resolveParentInitiativeId("implementation", tracking.trackingId);

      assert.deepEqual(result, { found: true, initiativeId: tracking.initiativeId });
      assert.equal(resolvedTrackingBox.value, tracking);
    });

    it("reports found:false for an unknown Tracking id, without throwing", () => {
      const resolvedTrackingBox: { value: InitiativeImplementationTracking | null } = {
        value: null,
      };
      const resolver = createImpactParentTrackingResolver(() => null, resolvedTrackingBox);

      const result = resolver.resolveParentInitiativeId("implementation", "does-not-exist");

      assert.deepEqual(result, { found: false });
      assert.equal(resolvedTrackingBox.value, null);
    });

    it('fails explicitly (found:false) for any parent artifact type other than "implementation"', () => {
      const tracking = buildFakeTracking();
      const resolvedTrackingBox: { value: InitiativeImplementationTracking | null } = {
        value: null,
      };
      let unexpectedLookupCalls = 0;
      const resolver = createImpactParentTrackingResolver((id) => {
        unexpectedLookupCalls += 1;
        return id === tracking.trackingId ? tracking : null;
      }, resolvedTrackingBox);

      for (const otherType of ["decision", "proposal", "petition", "implementation_commitment"] as const) {
        const result = resolver.resolveParentInitiativeId(otherType, tracking.trackingId);
        assert.deepEqual(result, { found: false });
      }

      assert.equal(unexpectedLookupCalls, 0);
      assert.equal(resolvedTrackingBox.value, null);
    });
  });

  describe("createImpactInitiativeExistenceChecker (production InitiativeExistenceChecker adapter)", () => {
    it("reports true and captures the resolved Initiative for a known id", () => {
      const initiative = buildFakeInitiative();
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createImpactInitiativeExistenceChecker(
        (id) => (id === initiative.initiativeId ? initiative : null),
        resolvedInitiativeBox,
      );

      const exists = checker.initiativeExists(initiative.initiativeId);

      assert.equal(exists, true);
      assert.equal(resolvedInitiativeBox.value, initiative);
    });

    it("reports false and leaves the box empty for an unknown id", () => {
      const resolvedInitiativeBox: { value: Initiative | null } = { value: null };
      const checker = createImpactInitiativeExistenceChecker(() => null, resolvedInitiativeBox);

      const exists = checker.initiativeExists("does-not-exist");

      assert.equal(exists, false);
      assert.equal(resolvedInitiativeBox.value, null);
    });
  });
});
