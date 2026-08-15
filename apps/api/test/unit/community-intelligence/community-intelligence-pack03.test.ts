import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";
import {
  buildEmptyAssistantCommunityContext,
  formatCommunityIntelligenceForAssistantPrompt,
  instructionsRequestCommunityIntelligence,
} from "../../../src/modules/community-intelligence/community-intelligence-matching.js";
import { COMMUNITY_SIMILARITY_ALGORITHM_VERSION } from "../../../src/modules/community-intelligence/community-intelligence.constants.js";

describe("Community Intelligence Pack 03", () => {
  it("Assistant recognizes creation-overlap questions as Community Intelligence requests", () => {
    assert.equal(
      instructionsRequestCommunityIntelligence("Why am I seeing this related Initiative?"),
      true,
    );
    assert.equal(
      instructionsRequestCommunityIntelligence("Do I have to stop creating my Initiative?"),
      true,
    );
  });

  it("Assistant explains structured reasons and never claims AI similarity alone", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const context = buildEmptyAssistantCommunityContext(
      "deterministic",
      "source-1",
      [
        {
          initiativeId: "peer-1",
          title: "Improve cycling safety education programs",
          relationshipType: "related",
          score: 0.61,
          reasons: [{ code: "area", message: "Same Participation Area: Mobility" }],
          sharedTopics: ["cycling"],
          sharedParticipationAreas: ["Mobility"],
          sharedPriorities: [],
          keyDifferences: [],
          publicUrl: "/initiatives/public/peer-1",
        },
      ],
      [],
    );
    const block = formatCommunityIntelligenceForAssistantPrompt(context);
    const result = await provider.assist({
      initiativeId: "source-1",
      stageId: "initiative",
      stageLabel: "Initiative",
      operation: "answer_question",
      participantDisplayName: "CI",
      initiativeTitle: "Expand downtown protected cycling corridor network",
      presentationMode: "public",
      availableSourceLabels: ["Community Intelligence"],
      instructions: "Why am I seeing this related Initiative?",
      sourceContextSummary: block,
    });

    const text = result.suggestions.map((item) => item.suggestedText).join("\n");
    assert.match(text, /Same Participation Area: Mobility/);
    assert.match(text, /Improve cycling safety education programs/);
    assert.doesNotMatch(text, /\bAI thinks they are similar\b/i);
    assert.match(text, /identifiable public signals/i);
    assert.match(text, /possible overlap, not a confirmed duplicate/i);
  });

  it("Assistant confirms creation is not blocked/merged/suppressed", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "platform",
      stageId: "initiative",
      stageLabel: "Initiative",
      operation: "answer_question",
      participantDisplayName: "CI",
      initiativeTitle: "Draft",
      presentationMode: "public",
      availableSourceLabels: ["Platform knowledge"],
      instructions: "Do I have to stop creating my Initiative?",
      sourceContextSummary: "Initiative creation",
    });
    const text = result.suggestions.map((item) => item.suggestedText).join("\n");
    assert.match(text, /No\. The platform surfaces related work/i);
    assert.match(text, /does not automatically block, merge or suppress/i);
  });

  it("algorithm version remains available and semantic_future stays unused", () => {
    assert.equal(COMMUNITY_SIMILARITY_ALGORITHM_VERSION.startsWith("ci-similarity-"), true);
    assert.doesNotMatch(COMMUNITY_SIMILARITY_ALGORITHM_VERSION, /semantic/i);
  });
});
