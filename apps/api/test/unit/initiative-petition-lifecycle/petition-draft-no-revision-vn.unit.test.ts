import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generatePetitionDraftContent,
  petitionDraftContainsBannedRevisionLabel,
} from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft-builder.js";
import type { InitiativePetitionIntelligenceSnapshot } from "@hu/types";

describe("Petition draft builder — no Revision vN English templates", () => {
  it("uses numeric published version + lifecycle tokens, never Revision vN", async () => {
    const snapshot = {
      initiativeTitle: "Community Garden",
      initiativeDescription: "Grow food together.",
      revisionReference: {
        revisionId: "initiative-version-revision-123-abc",
        version: 1,
        revisionSummary: "Initial published version.",
      },
      analysisReference: { analysisId: "ca-1", summary: "Analysis summary." },
      proposalReferences: [{ proposalId: "p1", title: "Compost", summary: "Add compost." }],
    } as unknown as InitiativePetitionIntelligenceSnapshot;

    const draft = await generatePetitionDraftContent(snapshot);
    const joined = [
      draft.title,
      draft.expectedOutcome,
      draft.supportingContext,
      ...draft.keyArguments,
    ].join("\n");

    assert.equal(petitionDraftContainsBannedRevisionLabel(joined), false);
    assert.match(joined, /published version 1/);
    assert.match(joined, /\{lifecycleStage:analysis\}/);
    assert.match(joined, /\{lifecycleStage:proposal\}/);
    assert.doesNotMatch(joined, /Revision v1|Revision \(v1\)/);
    // Technical IDs must not be invented into body prose.
    assert.doesNotMatch(joined, /initiative-version-revision-/);
  });
});
