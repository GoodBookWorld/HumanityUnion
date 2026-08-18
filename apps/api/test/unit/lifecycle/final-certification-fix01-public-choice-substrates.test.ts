import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateInitiativeCollectiveDecisionLifecycleDraftForPublication } from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.validators.js";
import { validateInitiativeCivicArchiveLifecycleDraftForPublication } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle.validators.js";

describe("Final Certification Fix 01 — PUBLIC_CHOICE substrate gates", () => {
  it("allows Collective Decision publication without Decision Session on PUBLIC_CHOICE", () => {
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    assert.doesNotThrow(() =>
      validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
        {
          draftId: "d1",
          initiativeId: "i1",
          authorId: "a1",
          title: "Public Choice Decision",
          decisionSummary: "Outcome summary",
          approvedActions: ["Advance"],
          rejectedAlternatives: [],
          responsibleRoles: [],
          implementationPriorities: [],
          implementationTimeline: "",
          decisionRationale: "Author outcome",
          decisionRisks: [],
          successCriteria: [],
          requiredResources: [],
          supportingReferences: [],
          participationScope: "world",
          closesAt,
          decisionSessionId: null,
          decisionSessionVersion: null,
          petitionId: null,
          petitionVersion: null,
          revisionId: null,
          revisionVersion: null,
          analysisId: null,
          analysisVersion: null,
          proposalIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { lifecycleProfile: "PUBLIC_CHOICE" },
      ),
    );
  });

  it("still requires Decision Session reference on STANDARD", () => {
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          {
            draftId: "d1",
            initiativeId: "i1",
            authorId: "a1",
            title: "Standard Decision",
            decisionSummary: "Outcome summary",
            approvedActions: ["Advance"],
            rejectedAlternatives: [],
            responsibleRoles: [],
            implementationPriorities: [],
            implementationTimeline: "",
            decisionRationale: "Author outcome",
            decisionRisks: [],
            successCriteria: [],
            requiredResources: [],
            supportingReferences: [],
            participationScope: "world",
            closesAt,
            decisionSessionId: null,
            decisionSessionVersion: null,
            petitionId: null,
            petitionVersion: null,
            revisionId: null,
            revisionVersion: null,
            analysisId: null,
            analysisVersion: null,
            proposalIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { lifecycleProfile: "STANDARD" },
        ),
      /Decision Session reference is required/,
    );
  });

  it("allows Civic Archive publication without Public Impact on PUBLIC_CHOICE", () => {
    assert.doesNotThrow(() =>
      validateInitiativeCivicArchiveLifecycleDraftForPublication(
        {
          draftId: "a1",
          initiativeId: "i1",
          authorId: "steward",
          finalArchiveTitle: "Archive",
          finalSummary: "Summary",
          lessonsLearned: "",
          knowledgeContribution: "",
          publicImpactReportId: null,
          sections: [
            {
              sectionId: "executive_summary",
              title: "Executive Summary",
              body: "Body",
              sourceRecordIds: [],
            },
          ],
          timeline: [],
          completeness: {
            stagesPublished: ["initiative", "discussion", "collective_decision"],
            stagesMissing: [],
            notes: [],
          },
          participationStatistics: {
            signatureCount: 0,
            supportCount: 0,
            reactionCount: 0,
            activeAllyCount: 0,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as never,
        { lifecycleProfile: "PUBLIC_CHOICE" },
      ),
    );
  });

  it("still requires Public Impact on STANDARD Archive publish", () => {
    assert.throws(
      () =>
        validateInitiativeCivicArchiveLifecycleDraftForPublication(
          {
            draftId: "a1",
            initiativeId: "i1",
            authorId: "steward",
            finalArchiveTitle: "Archive",
            finalSummary: "Summary",
            lessonsLearned: "",
            knowledgeContribution: "",
            publicImpactReportId: null,
            sections: [
              {
                sectionId: "executive_summary",
                title: "Executive Summary",
                body: "Body",
                sourceRecordIds: [],
              },
            ],
            timeline: [],
            completeness: {
              stagesPublished: [],
              stagesMissing: [],
              notes: [],
            },
            participationStatistics: {
              signatureCount: 0,
              supportCount: 0,
              reactionCount: 0,
              activeAllyCount: 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as never,
          { lifecycleProfile: "STANDARD" },
        ),
      /Public Impact Report is required/,
    );
  });
});
