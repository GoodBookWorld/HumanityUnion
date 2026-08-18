import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCollectiveDecisionSourceEmptyState } from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-source-empty.js";
import { resolveCivicArchiveSourceEmptyState } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-source-empty.js";
import { validateInitiativeDecisionSessionDraftForPublication } from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-lifecycle.validators.js";
import { validateInitiativeCollectiveDecisionLifecycleDraftForPublication } from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.validators.js";
import { validateInitiativeImplementationCommitmentLifecycleDraftForPublication } from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.validators.js";
import { validateInitiativeOfficialResponseLifecycleDraftForPublication } from "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-lifecycle.validators.js";
import { validateInitiativePublicImpactLifecycleDraftForPublication } from "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-lifecycle.validators.js";
import { validateInitiativeCivicArchiveLifecycleDraftForPublication } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle.validators.js";
import { generateDecisionSessionDraftContent } from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-draft-builder.js";
import { generateImplementationCommitmentDraftContent } from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-draft-builder.js";
import { generateOfficialResponseDraftContent } from "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-draft-builder.js";
import { generatePublicImpactDraftContent } from "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-draft-builder.js";

describe("Initiative Lifecycle Step 03 — remove cross-stage progression gates", () => {
  it("A — Decision Session publish validation allows missing Petition", () => {
    const opensAt = new Date(Date.now() + 60_000).toISOString();
    const closesAt = new Date(Date.now() + 120_000).toISOString();
    assert.doesNotThrow(() =>
      validateInitiativeDecisionSessionDraftForPublication({
        draftId: "d1",
        initiativeId: "i1",
        stewardId: "s1",
        title: "Decision",
        decisionQuestion: "Should we proceed?",
        decisionContext: "From Initiative context without Petition.",
        objectives: [],
        options: ["Approve", "Decline"],
        supportingArguments: [],
        risks: [],
        dependencies: [],
        requiredResources: [],
        suggestedTimeline: "",
        suggestedParticipants: [],
        suggestedResponsibleRoles: [],
        unresolvedQuestions: [],
        purpose: "",
        opensAt,
        closesAt,
        petitionId: null,
        revisionId: null,
        revisionVersion: null,
        analysisId: null,
        analysisVersion: null,
        proposalIds: [],
        createdAt: opensAt,
        updatedAt: opensAt,
      } as never),
    );
  });

  it("B — Decision Session draft builder consumes Petition when present", async () => {
    const content = await generateDecisionSessionDraftContent({
      initiativeId: "i1",
      initiativeTitle: "Clean Water",
      petitionReference: {
        petitionId: "pet-1",
        title: "Water Petition",
        summary: "Secure clean water",
        participantSignatures: 3,
        memberSignatures: 1,
        visitorSignals: 2,
        revisionId: "rev-1",
        revisionVersion: 1,
        analysisId: "an-1",
        analysisVersion: 1,
        proposalIds: [],
      },
      revisionReference: null,
      analysisReference: null,
      proposalReferences: [],
      allyRecommendations: [],
      openComments: [],
      activeAllyCount: 0,
      consistencyChecks: [],
      isPetitionAvailable: true,
      isEmpty: false,
      generatedAt: new Date().toISOString(),
    } as never);

    assert.match(content.decisionQuestion, /Water Petition/);
    assert.match(content.decisionContext, /Published Petition/);
  });

  it("C — Collective Decision publish allows missing Decision Session", () => {
    const closesAt = new Date(Date.now() + 120_000).toISOString();
    assert.doesNotThrow(() =>
      validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
        {
          title: "CD",
          decisionSummary: "Summary",
          approvedActions: ["Action 1"],
          decisionSessionId: null,
          participationScope: "community",
          closesAt,
        } as never,
        { lifecycleProfile: "STANDARD" },
      ),
    );
  });

  it("D — Commitments publish without mandatory Collective Decision id", () => {
    assert.doesNotThrow(() =>
      validateInitiativeImplementationCommitmentLifecycleDraftForPublication({
        title: "Commitments",
        summary: "",
        decisionId: null,
        candidates: [
          {
            candidateId: "c1",
            approvedAction: "Build well",
            description: "Build well",
            suggestedResponsibleRole: "Steward",
            suggestedTimeline: "",
            priority: "medium",
            requiredResources: [],
            relatedRisks: [],
            references: [],
            proposedParticipantId: null,
            status: "draft",
          },
        ],
      } as never),
    );
  });

  it("E/F — Official Responses publish without Tracking; supports No Response", () => {
    assert.doesNotThrow(() =>
      validateInitiativeOfficialResponseLifecycleDraftForPublication({
        title: "OR",
        summary: "",
        trackingPackageId: null,
        outcomeKind: "no_official_response_received",
        candidates: [],
        noResponseDetail: { contactedOrganizations: [], contactedDates: [], note: "None" },
      } as never),
    );
  });

  it("G — Public Impact publish without Official Responses package", () => {
    assert.doesNotThrow(() =>
      validateInitiativePublicImpactLifecycleDraftForPublication({
        title: "Impact",
        officialResponsePackageId: null,
        trackingPackageId: null,
        commitmentPackageId: null,
        decisionId: null,
        sections: [
          {
            sectionId: "executive_summary",
            title: "Executive",
            body: "Incomplete upstream — uncertainty noted.",
            sourceRecordIds: [],
            evidenceReferences: ["Initiative context"],
          },
          {
            sectionId: "evidence",
            title: "Evidence",
            body: "Missing evidence recorded.",
            sourceRecordIds: [],
            evidenceReferences: ["No Official Response package"],
          },
        ],
        participationStatistics: {},
      } as never),
    );
  });

  it("H — Civic Archive publish without Public Impact", () => {
    assert.doesNotThrow(() =>
      validateInitiativeCivicArchiveLifecycleDraftForPublication(
        {
          finalArchiveTitle: "Archive",
          finalSummary: "Historical journey archived as-is.",
          lessonsLearned: "",
          knowledgeContribution: "",
          publicImpactReportId: null,
          sections: [
            { sectionId: "overview", title: "Overview", body: "History", sourceRecordIds: [] },
          ],
        } as never,
        { lifecycleProfile: "STANDARD" },
      ),
    );
  });

  it("I/K — source-empty never hard-requires upstream; missing ≠ not applicable", () => {
    assert.deepEqual(
      resolveCollectiveDecisionSourceEmptyState({
        hasInitiative: true,
        decisionSessionAvailable: false,
        lifecycleProfile: "STANDARD",
      }),
      { requireDecisionSession: false, isEmpty: false },
    );
    assert.deepEqual(
      resolveCivicArchiveSourceEmptyState({
        hasInitiative: true,
        publicImpactAvailable: false,
        lifecycleProfile: "STANDARD",
      }),
      { requirePublicImpact: false, isEmpty: false },
    );
  });

  it("J — Commitments / OR / PI builders still consume upstream when present", async () => {
    const commitments = await generateImplementationCommitmentDraftContent({
      initiativeTitle: "T",
      decisionReference: {
        decisionId: "cd-1",
        decisionSummary: "Approved",
        approvedActions: ["Do it"],
        responsibleRoles: ["Steward"],
        implementationTimeline: "30d",
        implementationPriorities: ["high"],
        requiredResources: [],
        decisionRisks: [],
        supportingReferences: [],
      },
    } as never);
    assert.equal(commitments.decisionId, "cd-1");
    assert.equal(commitments.candidates.length, 1);

    const orDraft = await generateOfficialResponseDraftContent({
      initiativeTitle: "T",
      trackingPackageReference: {
        packageId: "trk-1",
        summary: "Tracking summary",
        decisionId: "cd-1",
      },
      trackingRecords: [],
      generatedAt: new Date().toISOString(),
    } as never);
    assert.equal(orDraft.trackingPackageId, "trk-1");

    const pi = await generatePublicImpactDraftContent({
      initiativeTitle: "T",
      officialResponsePackageReference: {
        packageId: "or-1",
        title: "OR",
        outcomeKind: "responses_received",
        responseIds: ["r1"],
      },
      trackingPackageReference: null,
      commitmentPackageReference: null,
      decisionReference: null,
      decisionSessionReference: null,
      petitionReference: null,
      initiativeDescription: "",
      trackingRecords: [],
      officialResponseSummaries: [{ responseId: "r1", summary: "ok" }],
      evidenceItems: [],
      completedCommitmentCount: 0,
      participationStatistics: {},
    } as never);
    assert.equal(pi.officialResponsePackageId, "or-1");
  });
});
