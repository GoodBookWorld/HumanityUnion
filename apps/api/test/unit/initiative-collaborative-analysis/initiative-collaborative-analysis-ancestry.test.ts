import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../../src/shared/initiative-ancestry/index.js";
import {
  createInitiativeCollaborativeAnalysisDraft,
  type InitiativeCollaborativeAnalysisAncestryDependencies,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js";
import {
  deleteAnalysesByAuthorIdForTests,
  listAnalysesByAuthor,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";

const TEST_AUTHOR_ID = "test-author-collaborative-analysis-ancestry";
const KNOWN_INITIATIVE_ID = "initiative-ancestry-fixture-ca-1";

const VALID_INPUT_BASE = {
  title: "Test Analysis",
  summary: "Test summary.",
  supportingEvidence: "Test evidence.",
  risks: "Test risks.",
  suggestedImprovements: "Test improvements.",
  references: "Test references.",
};

const IDENTITY = { participantId: TEST_AUTHOR_ID };

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

function createLookupSpy(initiativesById: ReadonlyMap<string, Initiative>): {
  dependencies: InitiativeCollaborativeAnalysisAncestryDependencies;
  calls: string[];
} {
  const calls: string[] = [];

  return {
    dependencies: {
      getInitiative(initiativeId) {
        calls.push(initiativeId);
        return initiativesById.get(initiativeId) ?? null;
      },
    },
    calls,
  };
}

describe("Initiative Collaborative Analysis ancestry enforcement (Recovery Task 06)", () => {
  after(() => {
    // File-backed persistence has no full reset-for-tests hook; remove only
    // the fixture records this suite created.
    deleteAnalysesByAuthorIdForTests(TEST_AUTHOR_ID);
  });

  describe("ancestry failure paths (no MongoDB required, fake Initiative lookup)", () => {
    it("rejects an empty initiativeId even when called directly", async () => {
      const { dependencies, calls } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollaborativeAnalysisDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "" },
            dependencies,
          ),
        InitiativeAncestryMissingError,
      );
      assert.equal(calls.length, 0, "Initiative lookup must not run for a missing id");
    });

    it("rejects a whitespace-only initiativeId", async () => {
      const { dependencies, calls } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollaborativeAnalysisDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "   " },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
      assert.equal(calls.length, 0, "Initiative lookup must not run for a malformed id");
    });

    it("rejects a malformed identifier according to the current shared identifier convention", async () => {
      const { dependencies } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollaborativeAnalysisDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: " padded-id " },
            dependencies,
          ),
        InitiativeIdMalformedError,
      );
    });

    it("rejects a nonexistent Initiative", async () => {
      const { dependencies, calls } = createLookupSpy(new Map());

      await assert.rejects(
        () =>
          createInitiativeCollaborativeAnalysisDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: "does-not-exist" },
            dependencies,
          ),
        InitiativeNotFoundError,
      );
      assert.deepEqual(calls, ["does-not-exist"]);
    });

    it("rejects an Initiative that exists but is not published or projected (pre-existing eligibility rule, unaffected)", async () => {
      const { dependencies } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative({ lifecyclePhase: "draft" })]]),
      );

      await assert.rejects(
        () =>
          createInitiativeCollaborativeAnalysisDraft(
            IDENTITY,
            { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
            dependencies,
          ),
        /published or projected/,
      );
    });

    it("persists no analysis when ancestry validation fails", async () => {
      const { dependencies } = createLookupSpy(new Map());

      await assert.rejects(() =>
        createInitiativeCollaborativeAnalysisDraft(
          IDENTITY,
          { ...VALID_INPUT_BASE, initiativeId: "does-not-exist" },
          dependencies,
        ),
      );

      // No event is published on failure either: creation only calls
      // createAnalysis() after ancestry succeeds, and no event is emitted
      // anywhere in the creation path (only publishInitiativeCollaborativeAnalysis,
      // untouched by this task, emits "analysis_published").
      const persisted = listAnalysesByAuthor(TEST_AUTHOR_ID);
      assert.equal(persisted.length, 0);
    });
  });

  describe("ancestry success path (file-backed persistence, no MongoDB required)", () => {
    it("creates a valid draft using the validated initiativeId, checking existence exactly once", async () => {
      const { dependencies, calls } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeCollaborativeAnalysisDraft(
        IDENTITY,
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
        dependencies,
      );

      assert.equal(created.initiativeId, KNOWN_INITIATIVE_ID);
      assert.equal(created.authorId, TEST_AUTHOR_ID);
      assert.equal(created.status, "draft");
      assert.deepEqual(
        calls,
        [KNOWN_INITIATIVE_ID],
        "Initiative existence must be checked exactly once for a successful creation",
      );
    });

    it("preserves existing content/evidence fields unchanged (evidence validation unchanged)", async () => {
      const { dependencies } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeCollaborativeAnalysisDraft(
        IDENTITY,
        {
          ...VALID_INPUT_BASE,
          initiativeId: KNOWN_INITIATIVE_ID,
          supportingEvidence: "Distinct evidence text.",
        },
        dependencies,
      );

      assert.equal(created.supportingEvidence, "Distinct evidence text.");
      assert.equal(created.risks, VALID_INPUT_BASE.risks);
      assert.equal(created.suggestedImprovements, VALID_INPUT_BASE.suggestedImprovements);
      assert.equal(created.references, VALID_INPUT_BASE.references);
    });

    it("attributes authorship to the calling participant identity unchanged (participant validation unchanged)", async () => {
      const { dependencies } = createLookupSpy(
        new Map([[KNOWN_INITIATIVE_ID, buildFakeInitiative()]]),
      );

      const created = await createInitiativeCollaborativeAnalysisDraft(
        { participantId: TEST_AUTHOR_ID, displayName: "Tester" },
        { ...VALID_INPUT_BASE, initiativeId: KNOWN_INITIATIVE_ID },
        dependencies,
      );

      assert.equal(created.authorId, TEST_AUTHOR_ID);
    });
  });
});
