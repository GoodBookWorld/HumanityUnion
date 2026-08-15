import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createInitiativeImprovementProposalDraft,
  type InitiativeImprovementProposalAncestryDependencies,
} from "../../../src/modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js";
import {
  deleteProposalsByAuthorIdForTests,
  listProposalsByAuthor,
} from "../../../src/modules/initiative-improvement-proposal/initiative-improvement-proposal.store.js";

/**
 * Recovery Task 07 — coverage notes.
 *
 * `CreateInitiativeImprovementProposalDraftInput` has no independent
 * `initiativeId` field: `analysisId` is the sole, mandatory input, and
 * `initiativeId` is always derived from the referenced (published)
 * Analysis. This means:
 *
 * - "Empty/whitespace/malformed initiativeId" and "nonexistent Initiative"
 *   scenarios are exercised via a fake Analysis whose own `initiativeId`
 *   field is empty/whitespace/malformed/unknown (that is the only lever a
 *   caller has, direct or HTTP, to influence the validated initiativeId).
 * - "Analysis belongs to another Initiative" (a genuine cross-Initiative
 *   mismatch) is NOT constructible: `ancestry.initiativeId` is always the
 *   exact string handed to `validateDirectInitiativeAncestry`
 *   (`analysis.initiativeId`), so there is no second, independently
 *   supplied `initiativeId` that could ever disagree with it. Tests 17-19
 *   from the task's Part 13 list are therefore not implemented as
 *   executable tests; see the module's TSDoc for the corresponding
 *   defensive-guard rationale.
 */

const TEST_AUTHOR_ID = "test-author-improvement-proposal-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-ip-1";
const KNOWN_ANALYSIS_ID = "analysis-ancestry-fixture-ip-1";

const IDENTITY = { participantId: TEST_AUTHOR_ID };

const VALID_INPUT_BASE = {
  targetSection: "Test section",
  currentIssue: "Test current issue.",
  proposedChange: "Test proposed change.",
  rationale: "Test rationale.",
  expectedImprovement: "Test expected improvement.",
  references: "Test references.",
};

function buildFakeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    initiativeId: KNOWN_INITIATIVE_ID,
    stewardId: "fake-steward",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "Fake Initiative",
    description: "Fake description.",
    status: "poll",
    lifecyclePhase: "published",
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

function buildFakeAnalysis(
  overrides: Partial<InitiativeCollaborativeAnalysis> = {},
): InitiativeCollaborativeAnalysis {
  return {
    analysisId: KNOWN_ANALYSIS_ID,
    initiativeId: KNOWN_INITIATIVE_ID,
    authorId: "fake-analyst",
    title: "Fake Analysis",
    summary: "Fake summary.",
    supportingEvidence: "Fake evidence.",
    risks: "Fake risks.",
    suggestedImprovements: "Fake improvements.",
    references: "Fake references.",
    status: "published",
    initiativeVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDependencySpies(
  analysesById: ReadonlyMap<string, InitiativeCollaborativeAnalysis>,
  initiativesById: ReadonlyMap<string, Initiative>,
): {
  dependencies: InitiativeImprovementProposalAncestryDependencies;
  analysisCalls: string[];
  initiativeCalls: string[];
} {
  const analysisCalls: string[] = [];
  const initiativeCalls: string[] = [];

  return {
    dependencies: {
      getAnalysis(analysisId) {
        analysisCalls.push(analysisId);
        return analysesById.get(analysisId) ?? null;
      },
      getInitiative(initiativeId) {
        initiativeCalls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
    },
    analysisCalls,
    initiativeCalls,
  };
}

describe("Initiative Improvement Proposal ancestry enforcement (Recovery Task 07)", () => {
  after(() => {
    deleteProposalsByAuthorIdForTests(TEST_AUTHOR_ID);
  });

  describe("ancestry failure paths (no MongoDB required, fake lookups)", () => {
    it("rejects a nonexistent Analysis (pre-existing behavior, unaffected)", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(new Map(), new Map());

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: "does-not-exist" },
            dependencies,
          ),
        /Analysis not found/,
      );
      assert.equal(initiativeCalls.length, 0, "Initiative lookup must not run without an Analysis");
    });

    it("rejects an Analysis that is not published (pre-existing eligibility rule, unaffected)", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis({ status: "draft" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
            dependencies,
          ),
        /can only be created from published analyses/,
      );
    });

    it("rejects an empty initiativeId carried by the Analysis", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis({ initiativeId: "" })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(initiativeCalls.length, 0);
    });

    it("rejects a whitespace-only initiativeId carried by the Analysis", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis({ initiativeId: "   " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a padded/malformed initiativeId carried by the Analysis", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis({ initiativeId: " padded-id " })]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative referenced by the Analysis", async () => {
      const { dependencies, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis()]]),
        new Map(),
      );

      await assert.rejects(
        () =>
          createInitiativeImprovementProposalDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(initiativeCalls, [KNOWN_INITIATIVE_ID]);
    });

    it("persists no proposal when ancestry validation fails", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis()]]),
        new Map(),
      );

      await assert.rejects(() =>
        createInitiativeImprovementProposalDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
          dependencies,
        ),
      );

      // No event is emitted on failure either: creation only calls
      // createProposal() after ancestry succeeds, and no event is emitted
      // anywhere in the creation path (only submitInitiativeImprovementProposal
      // and decideInitiativeImprovementProposal, both untouched by this
      // task, emit events).
      assert.equal(listProposalsByAuthor(TEST_AUTHOR_ID).length, 0);
    });
  });

  describe("ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft using the validated initiativeId, checking each dependency exactly once", async () => {
      const { dependencies, analysisCalls, initiativeCalls } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeImprovementProposalDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
        dependencies,
      );

      assert.equal(created.initiativeId, KNOWN_INITIATIVE_ID);
      assert.equal(created.analysisId, KNOWN_ANALYSIS_ID);
      assert.equal(created.authorId, TEST_AUTHOR_ID);
      assert.equal(created.status, "draft");
      assert.deepEqual(
        analysisCalls,
        [KNOWN_ANALYSIS_ID],
        "Analysis lookup must run exactly once for a successful creation",
      );
      assert.deepEqual(
        initiativeCalls,
        [KNOWN_INITIATIVE_ID],
        "Initiative lookup must run exactly once for a successful creation",
      );
    });

    it("preserves existing content fields unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeImprovementProposalDraft(
        IDENTITY,
        {
          ...VALID_INPUT_BASE,
          analysisId: KNOWN_ANALYSIS_ID,
          proposedChange: "Distinct proposed change.",
        },
        dependencies,
      );

      assert.equal(created.proposedChange, "Distinct proposed change.");
      assert.equal(created.targetSection, VALID_INPUT_BASE.targetSection);
      assert.equal(created.currentIssue, VALID_INPUT_BASE.currentIssue);
      assert.equal(created.rationale, VALID_INPUT_BASE.rationale);
      assert.equal(created.expectedImprovement, VALID_INPUT_BASE.expectedImprovement);
      assert.equal(created.references, VALID_INPUT_BASE.references);
    });

    it("attributes authorship to the calling participant identity unchanged", async () => {
      const { dependencies } = createDependencySpies(
        new Map([[KNOWN_ANALYSIS_ID, buildFakeAnalysis()]]),
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeImprovementProposalDraft(
        { participantId: TEST_AUTHOR_ID, displayName: "Tester" },
        { ...VALID_INPUT_BASE, analysisId: KNOWN_ANALYSIS_ID },
        dependencies,
      );

      assert.equal(created.authorId, TEST_AUTHOR_ID);
      assert.equal(created.status, "draft");
    });
  });
});
