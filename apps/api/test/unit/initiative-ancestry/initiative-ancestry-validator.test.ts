import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CivicArtifactType } from "@hu/types";
import { CIVIC_ARTIFACT_TYPES } from "@hu/types";

import {
  InitiativeAncestryMissingError,
  InitiativeAncestryResolutionInconsistentError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
  ParentArtifactMissingInitiativeAncestryError,
  ParentArtifactNotFoundError,
  UnsupportedParentArtifactTypeError,
  validateDirectInitiativeAncestry,
  validateTransitiveInitiativeAncestry,
} from "../../../src/shared/initiative-ancestry/index.js";
import type {
  InitiativeExistenceChecker,
  ParentArtifactInitiativeResolver,
  ParentArtifactLookupResult,
} from "../../../src/shared/initiative-ancestry/index.js";

const EXISTING_INITIATIVE_ID = "initiative-1";
const OTHER_EXISTING_INITIATIVE_ID = "initiative-2";

function fakeInitiativeExistence(
  knownInitiativeIds: readonly string[],
): InitiativeExistenceChecker {
  return {
    initiativeExists(initiativeId) {
      return knownInitiativeIds.includes(initiativeId);
    },
  };
}

interface FakeParent {
  readonly type: CivicArtifactType;
  readonly id: string;
  readonly lookup: ParentArtifactLookupResult;
}

function fakeParentResolver(parents: readonly FakeParent[]): ParentArtifactInitiativeResolver {
  return {
    resolveParentInitiativeId(parentArtifactType, parentArtifactId) {
      const match = parents.find(
        (parent) => parent.type === parentArtifactType && parent.id === parentArtifactId,
      );

      return match ? match.lookup : { found: false };
    },
  };
}

describe("validateDirectInitiativeAncestry", () => {
  it("succeeds for an existing Initiative", async () => {
    const deps = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);

    const ancestry = await validateDirectInitiativeAncestry(
      { initiativeId: EXISTING_INITIATIVE_ID },
      deps,
    );

    assert.deepEqual(ancestry, { kind: "direct", initiativeId: EXISTING_INITIATIVE_ID });
  });

  it("rejects an empty initiativeId", async () => {
    const deps = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: "" }, deps),
      InitiativeAncestryMissingError,
    );

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: undefined }, deps),
      InitiativeAncestryMissingError,
    );
  });

  it("rejects a malformed initiativeId", async () => {
    const deps = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: "   " }, deps),
      InitiativeIdMalformedError,
    );

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: " padded " }, deps),
      InitiativeIdMalformedError,
    );

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: 12345 }, deps),
      InitiativeIdMalformedError,
    );
  });

  it("rejects a missing Initiative", async () => {
    const deps = fakeInitiativeExistence([OTHER_EXISTING_INITIATIVE_ID]);

    await assert.rejects(
      () => validateDirectInitiativeAncestry({ initiativeId: "does-not-exist" }, deps),
      InitiativeNotFoundError,
    );
  });

  it("preserves the direct ancestry kind and initiativeId", async () => {
    const deps = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);

    const ancestry = await validateDirectInitiativeAncestry(
      { initiativeId: EXISTING_INITIATIVE_ID },
      deps,
    );

    assert.equal(ancestry.kind, "direct");
    assert.equal(ancestry.initiativeId, EXISTING_INITIATIVE_ID);
  });
});

describe("validateTransitiveInitiativeAncestry", () => {
  it("resolves a valid parent artifact to its Initiative", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([
      {
        type: "proposal",
        id: "proposal-1",
        lookup: { found: true, initiativeId: EXISTING_INITIATIVE_ID },
      },
    ]);

    const ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "proposal", parentArtifactId: "proposal-1" },
      { ...existence, ...resolver },
    );

    assert.deepEqual(ancestry, {
      kind: "transitive",
      parentArtifactType: "proposal",
      parentArtifactId: "proposal-1",
      initiativeId: EXISTING_INITIATIVE_ID,
    });
  });

  it("rejects an unsupported parent artifact type", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([]);

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "workspace", parentArtifactId: "anything" },
          { ...existence, ...resolver },
        ),
      UnsupportedParentArtifactTypeError,
    );
  });

  it("rejects Activity supplied as a canonical parent artifact type", async () => {
    // Activity is not modeled as a civic root and is intentionally excluded
    // from CIVIC_ARTIFACT_TYPES (ADR §8, §12): Activity may only ever be a
    // trace record of a Member action within an Initiative's lifecycle, so
    // it must never be accepted here as an ancestry-anchoring parent.
    assert.equal((CIVIC_ARTIFACT_TYPES as readonly string[]).includes("activity"), false);

    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([]);

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "activity", parentArtifactId: "activity-1" },
          { ...existence, ...resolver },
        ),
      UnsupportedParentArtifactTypeError,
    );
  });

  it("rejects a missing parent artifact", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([]);

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "proposal", parentArtifactId: "does-not-exist" },
          { ...existence, ...resolver },
        ),
      ParentArtifactNotFoundError,
    );
  });

  it("rejects a parent artifact without its own Initiative ancestry", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([
      { type: "proposal", id: "proposal-orphan", lookup: { found: true, initiativeId: null } },
    ]);

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "proposal", parentArtifactId: "proposal-orphan" },
          { ...existence, ...resolver },
        ),
      ParentArtifactMissingInitiativeAncestryError,
    );
  });

  it("rejects when the resolved Initiative does not exist", async () => {
    const existence = fakeInitiativeExistence([OTHER_EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([
      {
        type: "proposal",
        id: "proposal-1",
        lookup: { found: true, initiativeId: "some-other-initiative" },
      },
    ]);

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "proposal", parentArtifactId: "proposal-1" },
          { ...existence, ...resolver },
        ),
      InitiativeNotFoundError,
    );
  });

  it("rejects an inconsistent resolver result shape", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const brokenResolver: ParentArtifactInitiativeResolver = {
      // Intentionally violates the ParentArtifactLookupResult contract to
      // exercise the defensive guard.
      resolveParentInitiativeId: () => ({}) as unknown as ParentArtifactLookupResult,
    };

    await assert.rejects(
      () =>
        validateTransitiveInitiativeAncestry(
          { parentArtifactType: "proposal", parentArtifactId: "proposal-1" },
          { ...existence, ...brokenResolver },
        ),
      InitiativeAncestryResolutionInconsistentError,
    );
  });

  it("preserves the transitive ancestry kind, parent reference, and resolved initiativeId", async () => {
    const existence = fakeInitiativeExistence([EXISTING_INITIATIVE_ID]);
    const resolver = fakeParentResolver([
      {
        type: "petition",
        id: "petition-1",
        lookup: { found: true, initiativeId: EXISTING_INITIATIVE_ID },
      },
    ]);

    const ancestry = await validateTransitiveInitiativeAncestry(
      { parentArtifactType: "petition", parentArtifactId: "petition-1" },
      { ...existence, ...resolver },
    );

    assert.equal(ancestry.kind, "transitive");
    assert.equal(ancestry.parentArtifactType, "petition");
    assert.equal(ancestry.parentArtifactId, "petition-1");
    assert.equal(ancestry.initiativeId, EXISTING_INITIATIVE_ID);
  });

  it("maintains type-level exhaustiveness over every civic artifact type", () => {
    for (const artifactType of CIVIC_ARTIFACT_TYPES) {
      switch (artifactType) {
        case "discussion":
        case "contribution":
        case "evidence":
        case "proposal":
        case "petition":
        case "decision":
        case "implementation_commitment":
        case "implementation":
        case "impact":
          continue;
        default: {
          const exhaustiveCheck: never = artifactType;
          throw new Error(`Unhandled civic artifact type: ${exhaustiveCheck as string}`);
        }
      }
    }
  });
});
