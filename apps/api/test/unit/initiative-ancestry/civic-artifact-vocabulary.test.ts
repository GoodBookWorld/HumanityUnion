import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE,
  CIVIC_ARTIFACT_TYPES,
  isCivicArtifactType,
} from "@hu/types";
import type { CivicArtifactType, ParentArtifactLookupResult } from "@hu/types";

import {
  validateTransitiveInitiativeAncestry,
  type InitiativeExistenceChecker,
  type ParentArtifactInitiativeResolver,
} from "../../../src/shared/initiative-ancestry/index.js";

/**
 * Recovery Task 11 — Civic Artifact Vocabulary contract tests.
 *
 * Purpose: pin the canonical meaning of every `CivicArtifactType` member —
 * in particular `"decision"`, which was previously ambiguous only in ADR
 * prose (Task 10 finding) — as an executable, test-enforced contract,
 * *before* any production module adopts
 * `validateTransitiveInitiativeAncestry`. This file introduces no
 * production resolver and migrates no consumer module: every "resolver" is
 * a pure, in-memory fake, and `CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE` is
 * documentation-as-data (a plain string-to-string map), not a lookup
 * dependency.
 *
 * No MongoDB dependency: every test uses only pure fakes and the
 * already-Mongo-independent shared validator (see Task 04).
 */

const EXISTING_INITIATIVE_ID = "initiative-vocabulary-1";

function fakeInitiativeExistence(knownIds: readonly string[]): InitiativeExistenceChecker {
  return {
    initiativeExists: (id) => knownIds.includes(id),
  };
}

/** A minimal, Collective-Decision-shaped fake parent record: has its own `initiativeId`. */
interface FakeCollectiveDecisionShapedParent {
  readonly decisionId: string;
  readonly initiativeId: string;
}

/**
 * A minimal, legacy-Activity-Decision-shaped fake parent record. The real
 * `apps/api/src/modules/decision` module's `DecisionRecord` has no
 * `initiativeId` field at all (only `proposalId`/`activityId`) — it is
 * structurally incapable of satisfying `ParentArtifactLookupResult` with a
 * real Initiative reference, which is itself evidence that `"decision"`
 * cannot correctly mean "legacy Activity Decision" in this contract.
 */
interface FakeActivityDecisionShapedParent {
  readonly decisionId: string;
  readonly proposalId: string;
  readonly activityId: string;
}

function fakeCollectiveDecisionResolver(
  decisions: readonly FakeCollectiveDecisionShapedParent[],
): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId): ParentArtifactLookupResult {
      if (parentArtifactType !== "decision") {
        return { found: false };
      }

      const match = decisions.find((decision) => decision.decisionId === parentArtifactId);

      return match ? { found: true, initiativeId: match.initiativeId } : { found: false };
    },
  };
}

describe("CivicArtifactType vocabulary contract (Recovery Task 11)", () => {
  describe("runtime schema (isCivicArtifactType)", () => {
    it("accepts every declared CivicArtifactType member", () => {
      for (const artifactType of CIVIC_ARTIFACT_TYPES) {
        assert.equal(isCivicArtifactType(artifactType), true, `expected "${artifactType}" to be accepted`);
      }
    });

    it("rejects unknown, legacy-looking, or malformed artifact type strings", () => {
      const rejectedValues: unknown[] = [
        "activity",
        "Decision",
        "decision-session",
        "vote",
        "collective-decision",
        "",
        "   ",
        null,
        undefined,
        42,
        {},
        ["decision"],
      ];

      for (const value of rejectedValues) {
        assert.equal(isCivicArtifactType(value), false, `expected ${JSON.stringify(value)} to be rejected`);
      }
    });
  });

  describe('canonical meaning of "decision" (Case D resolution)', () => {
    it('has exactly one documented canonical module: "initiative-collective-decision"', () => {
      assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.decision, "initiative-collective-decision");
    });

    it("is not, and does not resolve to, the legacy Activity-scoped decision module", () => {
      assert.notEqual(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.decision, "decision");
      assert.notEqual(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.decision, "apps/api/src/modules/decision");
    });

    it("cannot structurally resolve a legacy-Activity-Decision-shaped parent (no initiativeId field exists to resolve)", () => {
      const legacyActivityDecision: FakeActivityDecisionShapedParent = {
        decisionId: "activity-decision-1",
        proposalId: "activity-proposal-1",
        activityId: "activity-1",
      };

      // The legacy shape has no initiativeId at all — a resolver keyed off
      // it cannot honestly report `found: true` with a real Initiative
      // reference. This demonstrates the two "decision" concepts are not
      // even structurally interchangeable, independent of documentation.
      assert.equal("initiativeId" in legacyActivityDecision, false);
    });

    it("resolves a Collective-Decision-shaped parent through the transitive validator using the canonical parent type", async () => {
      const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
      const resolver = fakeCollectiveDecisionResolver([
        { decisionId: "collective-decision-1", initiativeId: EXISTING_INITIATIVE_ID },
      ]);

      const ancestry = await validateTransitiveInitiativeAncestry(
        { parentArtifactType: "decision", parentArtifactId: "collective-decision-1" },
        { ...existence, ...resolver },
      );

      assert.deepEqual(ancestry, {
        kind: "transitive",
        parentArtifactType: "decision",
        parentArtifactId: "collective-decision-1",
        initiativeId: EXISTING_INITIATIVE_ID,
      });
    });

    it("preserves the parent artifact type and id exactly as supplied", async () => {
      const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
      const resolver = fakeCollectiveDecisionResolver([
        { decisionId: "collective-decision-42", initiativeId: EXISTING_INITIATIVE_ID },
      ]);

      const ancestry = await validateTransitiveInitiativeAncestry(
        { parentArtifactType: "decision", parentArtifactId: "collective-decision-42" },
        { ...existence, ...resolver },
      );

      assert.equal(ancestry.parentArtifactType, "decision");
      assert.equal(ancestry.parentArtifactId, "collective-decision-42");
      assert.equal(ancestry.initiativeId, EXISTING_INITIATIVE_ID);
    });

    it("rejects a decision-typed parent that the resolver cannot find, without inventing a fallback interpretation", async () => {
      const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
      const resolver = fakeCollectiveDecisionResolver([]);

      await assert.rejects(() =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "decision", parentArtifactId: "does-not-exist" },
          { ...existence, ...resolver },
        ),
      );
    });
  });

  describe("CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE completeness", () => {
    it("documents exactly one canonical module for every CivicArtifactType member, no more, no fewer", () => {
      const documentedTypes = Object.keys(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE).sort();
      const declaredTypes = [...CIVIC_ARTIFACT_TYPES].sort();

      assert.deepEqual(documentedTypes, declaredTypes);
    });

    it("maps every member to a canonical initiative-* (or petition) module, never a legacy path", () => {
      const legacyModuleNames = new Set([
        "activity",
        "discussion",
        "proposal",
        "decision",
        "collaborative-analysis",
        "collective-decision",
        "implementation-commitment",
        "implementation",
      ]);

      for (const artifactType of CIVIC_ARTIFACT_TYPES) {
        const canonicalModule = CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE[artifactType];

        assert.equal(
          legacyModuleNames.has(canonicalModule),
          false,
          `"${artifactType}" must not map to legacy module "${canonicalModule}"`,
        );
      }
    });

    it("maps discussion, contribution, and evidence to the Collaborative Analysis stage (ADR §9)", () => {
      assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.discussion, "initiative-collaborative-analysis");
      assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.contribution, "initiative-collaborative-analysis");
      assert.equal(CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.evidence, "initiative-collaborative-analysis");
    });
  });

  describe("no production persistence dependency introduced", () => {
    it("resolves ancestry using only pure, in-memory fakes (this file imports no store, no Mongo, no Express)", async () => {
      // Structural confirmation, not a runtime assertion: this test file's
      // only imports are @hu/types (pure data) and the shared,
      // dependency-injected validator (apps/api/src/shared/initiative-ancestry).
      // No `*.store.js`, `*persistence*`, or `mongodb` import appears
      // anywhere in this file.
      const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
      const resolver = fakeCollectiveDecisionResolver([
        { decisionId: "collective-decision-99", initiativeId: EXISTING_INITIATIVE_ID },
      ]);

      const ancestry = await validateTransitiveInitiativeAncestry(
        { parentArtifactType: "decision", parentArtifactId: "collective-decision-99" },
        { ...existence, ...resolver },
      );

      assert.equal(ancestry.kind, "transitive");
    });
  });

  describe("type-level exhaustiveness (mirrors Task 04's switch-based check)", () => {
    it("every CivicArtifactType member is covered by an exhaustive switch", () => {
      for (const artifactType of CIVIC_ARTIFACT_TYPES) {
        const canonicalModule: string = ((): string => {
          switch (artifactType as CivicArtifactType) {
            case "discussion":
            case "contribution":
            case "evidence":
            case "proposal":
            case "petition":
            case "decision":
            case "implementation_commitment":
            case "implementation":
            case "impact":
              return CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE[artifactType];
            default: {
              const exhaustiveCheck: never = artifactType;
              throw new Error(`Unhandled civic artifact type: ${exhaustiveCheck as string}`);
            }
          }
        })();

        assert.equal(typeof canonicalModule, "string");
      }
    });
  });
});
