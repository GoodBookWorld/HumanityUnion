/**
 * Lifecycle Staging Fix 03B — deterministic whole-document multi-field suggestions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeLifecycleStageId } from "@hu/types";

import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";
import { ASSISTANT_AUTO_PUBLISH_REPLY } from "../../../src/modules/lifecycle-ai/assistant-core-policy.js";

const STAGES: readonly InitiativeLifecycleStageId[] = [
  "analysis",
  "proposal",
  "petition",
  "decision_session",
  "collective_decision",
  "commitment",
  "tracking",
  "official_response",
  "public_impact",
  "archive",
];

describe("Lifecycle Staging Fix 03B — whole-document AI suggestions", () => {
  const provider = new DeterministicLifecycleAiProvider();

  for (const stageId of STAGES) {
    it(`${stageId}: generate_draft returns multiple sectioned fields`, async () => {
      const specialization = resolveAssistantSpecialization(
        stageId === "initiative" ? "initiative" : (stageId as never),
      );
      assert.equal(specialization.canApplySuggestionsToDraft, true);

      const result = await provider.assist({
        initiativeId: "fix03b-init",
        stageId,
        stageLabel: specialization.featureLabel,
        operation: "generate_draft",
        participantDisplayName: "Author",
        initiativeTitle: "Historical Parks Renewal",
        lifecycleProfile: stageId === "collective_decision" || stageId === "archive" ? "PUBLIC_CHOICE" : "STANDARD",
        presentationMode: "author_workspace",
        availableSourceLabels: ["Initiative"],
        sourceContextSummary: "Canonical Initiative sources only.",
        prompt: { systemPrompt: "test", userPrompt: "test" },
      });

      const sectioned = result.suggestions.filter(
        (item) => item.targetSectionId && item.targetSectionId !== "assistant",
      );
      assert.ok(
        sectioned.length >= 2,
        `${stageId} must return multiple field sections, got ${sectioned.length}`,
      );

      const joined = result.suggestions.map((item) => item.suggestedText).join("\n");
      if (stageId === "collective_decision") {
        assert.match(joined, /Do not invent vote totals|without fabricating voting results/i);
      }
      if (stageId === "official_response") {
        assert.match(joined, /Never fabricate/i);
      }
      if (stageId === "tracking" || stageId === "commitment") {
        assert.match(joined, /Unassigned|Never invent|never invent/i);
      }
      if (stageId === "archive") {
        assert.match(joined, /Do not rewrite historical/i);
      }
    });
  }

  it("AI cannot auto-publish", () => {
    assert.match(ASSISTANT_AUTO_PUBLISH_REPLY, /cannot publish/i);
  });
});
