import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativePublicImpactIntelligenceSnapshot } from "@hu/types";

import { generatePublicImpactDraftContent } from "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativePublicImpactIntelligenceSnapshot> = {},
): InitiativePublicImpactIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-l",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    analysisReference: {
      analysisId: "analysis-1",
      title: "Compost analysis",
      summary: "Neighbors need compost hubs.",
      version: 1,
    },
    revisionReference: {
      revisionId: "revision-1",
      title: "Community Compost Network",
      summary: "Incorporated composting Proposal.",
      version: 1,
    },
    petitionReference: {
      petitionId: "petition-1",
      title: "Fund the compost pilot",
      summary: "Ask the city to fund the pilot.",
      version: 1,
    },
    decisionSessionReference: {
      sessionId: "session-1",
      title: "Compost funding session",
      summary: "Should the city fund the compost pilot?",
      version: 1,
    },
    decisionReference: {
      decisionId: "decision-1",
      title: "Approve pilot funding",
      summary: "Pilot funding approved.",
      question: "Should the city fund the compost pilot this fiscal year?",
    },
    commitmentPackageReference: {
      packageId: "commitment-package-1",
      title: "Commitments: Community Compost Network",
      summary: "Two accepted commitments.",
      commitmentIds: ["commitment-1", "commitment-2"],
      decisionId: "decision-1",
      publishedAt: "2026-08-05T00:00:00.000Z",
    },
    trackingPackageReference: {
      packageId: "tracking-package-1",
      title: "Implementation Tracking: Community Compost Network",
      summary: "Two compost hubs were piloted and evidence was published.",
      trackingIds: ["tracking-1", "tracking-2"],
      commitmentPackageId: "commitment-package-1",
      decisionId: "decision-1",
      publishedAt: "2026-08-06T00:00:00.000Z",
    },
    officialResponsePackageReference: {
      packageId: "official-response-package-1",
      title: "Official Responses: Community Compost Network",
      summary: "City and regional responses recorded.",
      responseIds: ["response-1", "response-2"],
      trackingPackageId: "tracking-package-1",
      decisionId: "decision-1",
      publishedAt: "2026-08-07T00:00:00.000Z",
    },
    trackingRecords: [
      {
        trackingId: "tracking-1",
        commitmentId: "commitment-1",
        approvedAction: "Pilot in two districts first",
        participantId: "ally-1",
        status: "completed",
        progress: 100,
        evidenceReferences: ["https://example.org/evidence"],
        summary: "Pilot completed in both districts.",
      },
      {
        trackingId: "tracking-2",
        commitmentId: "commitment-2",
        approvedAction: "Publish a community update",
        participantId: "ally-2",
        status: "active",
        progress: 40,
        evidenceReferences: [],
        summary: "Community update in progress.",
      },
    ],
    completedCommitmentCount: 1,
    officialResponseSummaries: [
      {
        responseId: "response-1",
        institution: "City Sustainability Office",
        organization: "",
        subject: "Response regarding: Pilot in two districts first",
        verificationStatus: "pending",
        summary: "The city confirmed the pilot's completion.",
      },
      {
        responseId: "response-2",
        institution: "",
        organization: "Regional Composting Alliance",
        subject: "Response regarding: Publish a community update",
        verificationStatus: "pending",
        summary: "Alliance acknowledged the update plan.",
      },
    ],
    participationStatistics: {
      signatureCount: 12,
      supportCount: 4,
      reactionCount: 3,
      activeAllyCount: 2,
    },
    evidenceItems: [
      "https://example.org/evidence",
      "response-1",
      "City Sustainability Office",
      "official-response-package-1",
      "tracking-package-1",
      "commitment-package-1",
    ],
    consistencyChecks: [],
    isOfficialResponsePackageAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generatePublicImpactDraftContent (Impact Builder)", () => {
  it("titles the draft from the Initiative title", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    assert.equal(content.title, "Public Impact Report: Community Compost Network");
  });

  it("carries Official Response / Tracking / Commitment package ids and decision id", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    assert.equal(content.officialResponsePackageId, "official-response-package-1");
    assert.equal(content.trackingPackageId, "tracking-package-1");
    assert.equal(content.commitmentPackageId, "commitment-package-1");
    assert.equal(content.decisionId, "decision-1");
  });

  it("generates all eleven canonical sections", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    assert.equal(content.sections.length, 11);
    assert.deepEqual(
      content.sections.map((section) => section.sectionId),
      [
        "executive_summary",
        "objectives",
        "implemented_actions",
        "completed_commitments",
        "implementation_progress",
        "official_responses",
        "community_participation",
        "outstanding_issues",
        "lessons_learned",
        "evidence",
        "impact_references",
      ],
    );
  });

  it("fills executive_summary and evidence from published sources", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    const executive = content.sections.find((section) => section.sectionId === "executive_summary");
    const evidence = content.sections.find((section) => section.sectionId === "evidence");
    assert.ok(executive?.body.includes("Community Compost Network"));
    assert.ok(executive?.body.includes("Official Responses package"));
    assert.ok(evidence?.body.includes("https://example.org/evidence"));
  });

  it("gives every non-empty section at least one evidenceReference", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    for (const section of content.sections) {
      if (section.body.trim()) {
        assert.ok(
          section.evidenceReferences.length >= 1,
          `${section.sectionId} must cite evidence`,
        );
      }
    }
  });

  it("cites real package/response/tracking ids — never invents achievements", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    const official = content.sections.find((section) => section.sectionId === "official_responses");
    assert.ok(official?.body.includes("response-1"));
    assert.ok(official?.body.includes("City Sustainability Office"));
    assert.ok(official?.evidenceReferences.includes("official-response-package-1"));
    assert.ok(!/great success|triumphant|failed spectacularly/i.test(JSON.stringify(content)));
  });

  it("summarises outstanding Tracking Records without inventing completion", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    const outstanding = content.sections.find((section) => section.sectionId === "outstanding_issues");
    assert.ok(outstanding?.body.includes("tracking-2"));
    assert.ok(outstanding?.body.includes("status=active"));
  });

  it("copies participation statistics from the snapshot", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    assert.deepEqual(content.participationStatistics, {
      signatureCount: 12,
      supportCount: 4,
      reactionCount: 3,
      activeAllyCount: 2,
    });
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generatePublicImpactDraftContent(snapshot);
    const second = await generatePublicImpactDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("never invents section bodies when no Official Response Package is available", async () => {
    const content = await generatePublicImpactDraftContent(
      buildSnapshot({
        officialResponsePackageReference: null,
        officialResponseSummaries: [],
        isOfficialResponsePackageAvailable: false,
        isEmpty: true,
      }),
    );
    assert.equal(content.officialResponsePackageId, null);
    assert.equal(content.sections.length, 11);
    assert.ok(content.sections.every((section) => section.body === ""));
    assert.ok(content.sections.every((section) => section.evidenceReferences.length === 0));
  });

  it("lists Approved Actions only when present on Tracking Records", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    const actions = content.sections.find((section) => section.sectionId === "implemented_actions");
    assert.ok(actions?.body.includes("Pilot in two districts first"));
    assert.ok(actions?.body.includes("Publish a community update"));
  });

  it("includes impact_references pointing at real upstream ids", async () => {
    const content = await generatePublicImpactDraftContent(buildSnapshot());
    const refs = content.sections.find((section) => section.sectionId === "impact_references");
    assert.ok(refs?.body.includes("analysis-1"));
    assert.ok(refs?.body.includes("petition-1"));
    assert.ok(refs?.body.includes("decision-1"));
    assert.ok(refs?.body.includes("official-response-package-1"));
  });
});
