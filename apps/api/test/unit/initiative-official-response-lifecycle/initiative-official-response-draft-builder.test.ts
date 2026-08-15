import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeOfficialResponseIntelligenceSnapshot } from "@hu/types";

import { generateOfficialResponseDraftContent } from "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-draft-builder.js";

function buildSnapshot(
  overrides: Partial<InitiativeOfficialResponseIntelligenceSnapshot> = {},
): InitiativeOfficialResponseIntelligenceSnapshot {
  return {
    initiativeId: "initiative-part-k",
    generatedAt: "2026-08-08T00:00:00.000Z",
    initiativeTitle: "Community Compost Network",
    initiativeDescription: "Build neighborhood compost hubs.",
    trackingPackageReference: {
      packageId: "tracking-package-1",
      title: "Implementation Tracking: Community Compost Network",
      summary: "Two compost hubs were piloted and evidence was published.",
      publishedAt: "2026-08-06T00:00:00.000Z",
      trackingIds: ["tracking-1", "tracking-2"],
      commitmentPackageId: "commitment-package-1",
      decisionId: "decision-1",
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
    activeAllyCount: 2,
    decisionId: "decision-1",
    consistencyChecks: [],
    isTrackingPackageAvailable: true,
    isEmpty: false,
    ...overrides,
  };
}

describe("generateOfficialResponseDraftContent (Response Candidate Builder)", () => {
  it("titles the draft from the Initiative title", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.equal(content.title, "Official Responses: Community Compost Network");
  });

  it("builds the summary from the Tracking Package summary", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.equal(content.summary, "Two compost hubs were piloted and evidence was published.");
  });

  it("carries the Tracking Package id onto the draft", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.equal(content.trackingPackageId, "tracking-package-1");
  });

  it("generates one Candidate per eligible Tracking Record (progress>0 or completed/active)", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.equal(content.candidates.length, 2);
    assert.deepEqual(content.candidates[0]!.relatedTrackingIds, ["tracking-1"]);
    assert.deepEqual(content.candidates[1]!.relatedTrackingIds, ["tracking-2"]);
  });

  it("carries the Tracking Record's approvedAction/commitmentId onto the Candidate", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.deepEqual(content.candidates[0]!.relatedActions, ["Pilot in two districts first"]);
    assert.deepEqual(content.candidates[0]!.relatedCommitmentIds, ["commitment-1"]);
  });

  it("never invents an institution or organization name", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.equal(candidate.institution, "");
      assert.equal(candidate.organization, "");
    }
  });

  it("defaults every Candidate to responseType 'other' and verificationStatus 'pending'", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.equal(candidate.responseType, "other");
      assert.equal(candidate.verificationStatus, "pending");
    }
  });

  it("sets receivedAt from the snapshot's generatedAt date portion", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    for (const candidate of content.candidates) {
      assert.equal(candidate.receivedAt, "2026-08-08");
    }
  });

  it("assigns deterministic candidateIds from index", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.equal(content.candidates[0]!.candidateId, "official-response-candidate-0");
    assert.equal(content.candidates[1]!.candidateId, "official-response-candidate-1");
  });

  it("references the Tracking id and Tracking Package id", async () => {
    const content = await generateOfficialResponseDraftContent(buildSnapshot());
    assert.deepEqual(content.candidates[0]!.references, ["Tracking tracking-1", "tracking-package-1"]);
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot();
    const first = await generateOfficialResponseDraftContent(snapshot);
    const second = await generateOfficialResponseDraftContent(snapshot);
    assert.deepEqual(first, second);
  });

  it("falls back to one general Candidate for the Initiative when no Tracking Record is eligible", async () => {
    const content = await generateOfficialResponseDraftContent(
      buildSnapshot({
        trackingRecords: [
          {
            trackingId: "tracking-3",
            commitmentId: "commitment-3",
            approvedAction: null,
            participantId: "ally-3",
            status: "planned",
            progress: 0,
            evidenceReferences: [],
            summary: "Not started.",
          },
        ],
      }),
    );
    assert.equal(content.candidates.length, 1);
    assert.equal(content.candidates[0]!.candidateId, "official-response-candidate-0");
    assert.deepEqual(content.candidates[0]!.relatedTrackingIds, []);
    assert.equal(content.candidates[0]!.subject, "Response regarding: Community Compost Network");
  });

  it("never invents any content when no Tracking Package is available", async () => {
    const content = await generateOfficialResponseDraftContent(
      buildSnapshot({
        trackingPackageReference: null,
        trackingRecords: [],
        isTrackingPackageAvailable: false,
        isEmpty: true,
      }),
    );
    assert.equal(content.summary, "");
    assert.equal(content.trackingPackageId, null);
    assert.deepEqual(content.candidates, []);
  });
});
