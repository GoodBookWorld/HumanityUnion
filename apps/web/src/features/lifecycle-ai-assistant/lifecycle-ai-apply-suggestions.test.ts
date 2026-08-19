/**
 * Lifecycle Staging Fix 03B — structured AI Apply across Author stages.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLifecycleAiSuggestionsToCandidateCollection,
  applyLifecycleAiSuggestionsToFields,
  applyLifecycleAiSuggestionsToPublicImpactSections,
} from "./lifecycle-ai-apply-suggestions.js";
import {
  getLifecycleAiStageApplyContract,
  isLifecycleAiApplyStageAllowedForProfile,
  PUBLIC_CHOICE_AI_APPLY_STAGE_IDS,
} from "./lifecycle-ai-stage-apply-contract.js";

const AUTHOR_APPLY_STAGES = [
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
] as const;

describe("Lifecycle Staging Fix 03B — stage Apply contract", () => {
  for (const stageId of AUTHOR_APPLY_STAGES) {
    it(`${stageId}: whole-document suggestion populates multiple valid fields`, () => {
      const contract = getLifecycleAiStageApplyContract(stageId);
      assert.ok(contract);
      assert.ok(contract.knownKeys.length >= 3);

      if (stageId === "public_impact") {
        const result = applyLifecycleAiSuggestionsToPublicImpactSections({
          title: "Old title",
          sections: contract.knownKeys
            .filter((key) => key !== "title")
            .slice(0, 4)
            .map((sectionId) => ({
              sectionId: sectionId as never,
              title: sectionId,
              body: `old-${sectionId}`,
              evidenceReferences: ["anchor"],
            })),
          suggestions: [
            { targetSectionId: "title", suggestedText: "New Impact Title" },
            { targetSectionId: "executive_summary", suggestedText: "New conclusion" },
            { targetSectionId: "objectives", suggestedText: "New objectives" },
          ],
        });
        assert.equal(result.applied, true);
        assert.ok(result.changedSectionIds.length >= 2);
        assert.equal(result.title, "New Impact Title");
        return;
      }

      if (contract.packageKeys && contract.candidateKeys) {
        const packageFields: Record<string, string> = { title: "Old", summary: "Old summary" };
        if (stageId === "official_response") {
          packageFields.noResponseNote = "Old note";
        }
        const candidate: Record<string, string> = {
          candidateId: "c1",
          description: "Old description",
          notes: "Old notes",
        };
        for (const key of contract.candidateKeys) {
          const formKey =
            key === "responseSummary" ? "summary" : key === "milestoneTitle" ? "title" : key;
          candidate[formKey] = candidate[formKey] ?? `old-${key}`;
        }
        if (stageId === "commitment") {
          candidate.proposedParticipantId = "must-preserve";
          candidate.approvedAction = "must-preserve-action";
        }
        if (stageId === "tracking") {
          candidate.responsibleParticipantId = "must-preserve-assignee";
          candidate.title = "Old milestone";
        }
        if (stageId === "official_response") {
          candidate.summary = "Old response summary";
          candidate.institution = "Old institution";
          candidate.documentIds = "doc-secret";
          candidate.verificationStatus = "pending";
        }

        const suggestions = [
          { targetSectionId: "title", suggestedText: "New package title" },
          { targetSectionId: "summary", suggestedText: "New package summary" },
          {
            targetSectionId: stageId === "tracking" ? "milestoneTitle" : "description",
            suggestedText: "New candidate field",
          },
        ];

        const candidateKeysForApply =
          stageId === "tracking"
            ? (["title", "description", "notes"] as const)
            : stageId === "official_response"
              ? (["institution", "summary", "notes"] as const)
              : contract.candidateKeys;

        const result = applyLifecycleAiSuggestionsToCandidateCollection({
          packageFields,
          candidates: [candidate],
          suggestions,
          packageKeys: contract.packageKeys,
          candidateKeys: [...candidateKeysForApply],
          forbiddenKeys: contract.forbiddenKeys,
          fallbackKey: "summary",
          candidateKeyAliases:
            stageId === "tracking"
              ? { milestoneTitle: "title" }
              : stageId === "official_response"
                ? { responseSummary: "summary" }
                : undefined,
        });

        assert.equal(result.applied, true);
        assert.ok(result.changedKeys.length >= 2);
        assert.equal(result.packageFields.title, "New package title");
        assert.equal(result.packageFields.summary, "New package summary");
        if (stageId === "commitment") {
          assert.equal(result.candidates[0]?.proposedParticipantId, "must-preserve");
        }
        if (stageId === "tracking") {
          assert.equal(result.candidates[0]?.responsibleParticipantId, "must-preserve-assignee");
        }
        if (stageId === "official_response") {
          assert.equal(result.candidates[0]?.documentIds, "doc-secret");
          assert.equal(result.candidates[0]?.verificationStatus, "pending");
        }
        return;
      }

      const current: Record<string, string> = {};
      for (const key of contract.knownKeys) {
        current[key] = `old-${key}`;
      }
      const suggestions = contract.knownKeys.slice(0, 3).map((key) => ({
        targetSectionId: key,
        suggestedText: `new-${key}`,
      }));
      const result = applyLifecycleAiSuggestionsToFields({
        current: current as never,
        suggestions,
        knownKeys: contract.knownKeys as never,
        fallbackKey: contract.fallbackKey as never,
        forbiddenKeys: contract.forbiddenKeys,
      });
      assert.equal(result.applied, true);
      assert.equal(result.changedKeys.length, 3);
      assert.equal(result.next[contract.knownKeys[0]!], `new-${contract.knownKeys[0]!}`);
      assert.equal(result.next[contract.knownKeys[3]!], `old-${contract.knownKeys[3]!}`);
    });

    it(`${stageId}: single-field suggestion preserves unrelated fields`, () => {
      const contract = getLifecycleAiStageApplyContract(stageId)!;
      const target = contract.fallbackKey;
      const other = contract.knownKeys.find((key) => key !== target)!;

      if (stageId === "public_impact") {
        const result = applyLifecycleAiSuggestionsToPublicImpactSections({
          title: "Keep title",
          sections: [
            {
              sectionId: "executive_summary",
              title: "Author conclusion",
              body: "Old conclusion",
              evidenceReferences: ["a"],
            },
            {
              sectionId: "objectives",
              title: "Objectives",
              body: "Old objectives",
              evidenceReferences: ["a"],
            },
          ],
          suggestions: [{ targetSectionId: "executive_summary", suggestedText: "Improved conclusion" }],
        });
        assert.equal(result.changedSectionIds.length, 1);
        assert.equal(
          result.sections.find((section) => section.sectionId === "objectives")?.body,
          "Old objectives",
        );
        return;
      }

      if (contract.packageKeys) {
        const result = applyLifecycleAiSuggestionsToCandidateCollection({
          packageFields: { title: "Keep", summary: "Keep summary" },
          candidates: [{ candidateId: "c1", description: "Keep description" }],
          suggestions: [{ targetSectionId: "summary", suggestedText: "Only summary" }],
          packageKeys: ["title", "summary"],
          candidateKeys: ["description"],
          forbiddenKeys: contract.forbiddenKeys,
          fallbackKey: "summary",
        });
        assert.deepEqual(result.changedKeys, ["summary"]);
        assert.equal(result.packageFields.title, "Keep");
        assert.equal(result.candidates[0]?.description, "Keep description");
        return;
      }

      const current: Record<string, string> = {
        [target]: "old-target",
        [other]: "old-other",
      };
      const result = applyLifecycleAiSuggestionsToFields({
        current: current as never,
        suggestions: [{ targetSectionId: target, suggestedText: "new-target" }],
        knownKeys: [target, other] as never,
        fallbackKey: target as never,
        forbiddenKeys: contract.forbiddenKeys,
      });
      assert.deepEqual(result.changedKeys, [target]);
      assert.equal(result.next[other], "old-other");
    });
  }

  it("forbidden vote/assignee/official keys are never applied", () => {
    const collective = applyLifecycleAiSuggestionsToFields({
      current: {
        decisionSummary: "Keep",
        votingOutcomeSummary: "7-0 fabricated",
      },
      suggestions: [
        { targetSectionId: "votingOutcomeSummary", suggestedText: "Invented 100% approval" },
        { targetSectionId: "decisionSummary", suggestedText: "Neutral summary" },
      ],
      knownKeys: ["decisionSummary", "votingOutcomeSummary"],
      fallbackKey: "decisionSummary",
      forbiddenKeys: getLifecycleAiStageApplyContract("collective_decision")!.forbiddenKeys,
    });
    assert.equal(collective.next.decisionSummary, "Neutral summary");
    assert.equal(collective.next.votingOutcomeSummary, "7-0 fabricated");

    const tracking = applyLifecycleAiSuggestionsToCandidateCollection({
      packageFields: { title: "T", summary: "S" },
      candidates: [{ candidateId: "c1", description: "D", responsibleParticipantId: "ally-1" }],
      suggestions: [
        { targetSectionId: "responsibleParticipantId", suggestedText: "invented-person" },
        { targetSectionId: "description", suggestedText: "Updated description" },
      ],
      packageKeys: ["title", "summary"],
      candidateKeys: ["description", "responsibleParticipantId"],
      forbiddenKeys: getLifecycleAiStageApplyContract("tracking")!.forbiddenKeys,
      fallbackKey: "summary",
    });
    assert.equal(tracking.candidates[0]?.responsibleParticipantId, "ally-1");
    assert.equal(tracking.candidates[0]?.description, "Updated description");
  });

  it("PUBLIC_CHOICE only allows Collective Decision + Civic Archive apply mappings", () => {
    assert.deepEqual([...PUBLIC_CHOICE_AI_APPLY_STAGE_IDS], ["collective_decision", "archive"]);
    assert.equal(isLifecycleAiApplyStageAllowedForProfile("petition", "PUBLIC_CHOICE"), false);
    assert.equal(isLifecycleAiApplyStageAllowedForProfile("collective_decision", "PUBLIC_CHOICE"), true);
    assert.equal(isLifecycleAiApplyStageAllowedForProfile("archive", "PUBLIC_CHOICE"), true);
    assert.equal(isLifecycleAiApplyStageAllowedForProfile("petition", "STANDARD"), true);
  });

  it("Apply never implies auto-save or auto-publish", () => {
    const result = applyLifecycleAiSuggestionsToFields({
      current: { summary: "" },
      suggestions: [{ targetSectionId: "summary", suggestedText: "Draft" }],
      knownKeys: ["summary"],
      fallbackKey: "summary",
    });
    assert.equal(result.applied, true);
    assert.ok(!("published" in result));
    assert.ok(!("saved" in result));
  });
});
