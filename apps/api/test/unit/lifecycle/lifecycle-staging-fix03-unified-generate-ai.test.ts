/**
 * Lifecycle Staging Fix 03 — Unified Generate + stage-aware AI Assistant contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { InitiativePublicImpactIntelligenceSnapshot } from "@hu/types";

import { ASSISTANT_AUTO_PUBLISH_REPLY } from "../../../src/modules/lifecycle-ai/assistant-core-policy.js";
import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";
import { generatePublicImpactDraftContent } from "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-draft-builder.js";
import { assessDecisionSessionEligibilityForInitiative } from "../../../src/modules/decision-session/decision-session-eligibility.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../../..");

function buildMinimalPublicImpactSnapshot(
  overrides: Partial<InitiativePublicImpactIntelligenceSnapshot> = {},
): InitiativePublicImpactIntelligenceSnapshot {
  return {
    initiativeId: "fix03-initiative",
    generatedAt: "2026-08-18T00:00:00.000Z",
    initiativeTitle: "Neighborhood Parks Renewal",
    initiativeDescription: "Improve local parks with community stewardship.",
    analysisReference: null,
    revisionReference: null,
    petitionReference: null,
    decisionSessionReference: null,
    decisionReference: {
      decisionId: "decision-fix03",
      title: "Approve park plan",
      summary: "Community approved a phased park renewal.",
      question: "Should the park renewal proceed in phases?",
    },
    commitmentPackageReference: null,
    trackingPackageReference: null,
    officialResponsePackageReference: null,
    trackingRecords: [],
    completedCommitmentCount: 0,
    officialResponseSummaries: [],
    participationStatistics: {
      signatureCount: 0,
      supportCount: 2,
      reactionCount: 1,
      activeAllyCount: 0,
    },
    evidenceItems: [],
    consistencyChecks: [],
    isOfficialResponsePackageAvailable: false,
    isEmpty: false,
    ...overrides,
  };
}

describe("Lifecycle Staging Fix 03 — unified Generate + AI contract", () => {
  it("Generate uses available canonical Initiative/decision data without Official Responses", async () => {
    const content = await generatePublicImpactDraftContent(buildMinimalPublicImpactSnapshot());
    assert.match(content.title, /Neighborhood Parks Renewal/);
    const objectives = content.sections.find((section) => section.sectionId === "objectives");
    assert.ok(objectives?.body.includes("Should the park renewal proceed"));
    assert.equal(content.decisionId, "decision-fix03");
  });

  it("Generate works with missing optional upstream artifacts and remains editable", async () => {
    const content = await generatePublicImpactDraftContent(buildMinimalPublicImpactSnapshot());
    assert.equal(content.officialResponsePackageId, null);
    assert.equal(content.trackingPackageId, null);
    assert.ok(content.sections.every((section) => section.body.trim().length > 0));
    assert.ok(content.sections.every((section) => section.evidenceReferences.length >= 1));
  });

  it("Public Impact Generate never invents Official Responses or voting results", async () => {
    const content = await generatePublicImpactDraftContent(buildMinimalPublicImpactSnapshot());
    const official = content.sections.find((section) => section.sectionId === "official_responses");
    assert.ok(official?.body.includes("No official statement is invented"));
    assert.ok(!/City Council voted 7-0|fabricated turnout|100% approval/i.test(JSON.stringify(content)));
  });

  it("AI deterministic generate_draft for public_impact returns sectioned form fields", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "fix03-initiative",
      stageId: "public_impact",
      stageLabel: "Public Impact",
      operation: "generate_draft",
      participantDisplayName: "Author",
      initiativeTitle: "Neighborhood Parks Renewal",
      lifecycleProfile: "STANDARD",
      presentationMode: "author_workspace",
      availableSourceLabels: ["Initiative", "Collective Decision"],
      sourceContextSummary: "Official Responses not published. Decision available.",
      prompt: { systemPrompt: "test", userPrompt: "test" },
    });

    const sectionIds = result.suggestions
      .map((item) => item.targetSectionId)
      .filter((value): value is string => Boolean(value));
    assert.ok(sectionIds.includes("executive_summary"));
    assert.ok(sectionIds.includes("official_responses"));
    assert.ok(
      result.suggestions.some((item) =>
        /Never fabricate an official statement|no package is published/i.test(item.suggestedText),
      ),
    );
  });

  it("AI cannot publish/complete — auto-publish reply and Author Apply remain explicit", () => {
    assert.match(ASSISTANT_AUTO_PUBLISH_REPLY, /cannot publish/i);
    const specialization = resolveAssistantSpecialization("public_impact");
    assert.equal(specialization.canApplySuggestionsToDraft, true);
  });

  it("PUBLIC_CHOICE Collective Decision specialization allows Apply for Author prose only", () => {
    const specialization = resolveAssistantSpecialization("collective_decision");
    assert.equal(specialization.canApplySuggestionsToDraft, true);
  });

  it("Decision Session remains eligible with zero proposals (Lifecycle independence)", async () => {
    const eligibility = await assessDecisionSessionEligibilityForInitiative({
      initiativeId: `fix03-indep-${Date.now()}`,
      stewardId: "steward-1",
      title: "Independence",
      description: "Fixture",
      communitySlug: "fixture",
      activityArea: "Environment",
      status: "projected",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
    assert.equal(eligibility.eligible, true);
  });

  it("Ask Assistant open button renders intel.webp at 28x28", () => {
    const openButtonPath = join(
      repoRoot,
      "apps/web/src/features/humanity-union-assistant/components/HumanityUnionAssistantOpenButton.tsx",
    );
    const source = readFileSync(openButtonPath, "utf8");
    assert.match(source, /\/icons\/workspace\/intel\.webp/);
    assert.match(source, /width=\{28\}/);
    assert.match(source, /height=\{28\}/);
    assert.match(source, /Ask Assistant/);
  });
});
