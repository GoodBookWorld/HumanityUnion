/**
 * Pack 02G Task 08E.8e — Implementation Tracking derive emits structured Web advisories.
 * Date/overdue/stalled computations stay derive-owned; tests use the same ISO-day clock.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

import { deriveImplementationTrackingAiAssistantInsights } from "./derive-implementation-tracking-ai-assistant-insights";

/** Same clock strategy as derive: UTC ISO calendar day. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDay(isoDay: string, deltaDays: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function snapshot(
  overrides: Partial<InitiativeImplementationTrackingIntelligenceSnapshot> = {},
): InitiativeImplementationTrackingIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    packageReference: null,
    acceptedCommitments: [],
    decisionApprovedActions: [],
    activeAllyCount: 0,
    consistencyChecks: [],
    isCommitmentPackageAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<InitiativeImplementationTrackingCandidate> = {},
): InitiativeImplementationTrackingCandidate {
  return {
    candidateId: "m1",
    commitmentId: "c1",
    title: "Milestone",
    description: "Desc",
    approvedAction: "Action",
    responsibleParticipantId: "member-2",
    currentStatus: "In progress",
    progress: 40,
    plannedStartDate: null,
    targetDate: shiftIsoDay(todayIso(), 7),
    startedDate: null,
    completedDate: null,
    dependencies: [],
    obstacles: [],
    evidenceReferences: [],
    notes: "",
    ...overrides,
  };
}

function draft(
  overrides: Partial<InitiativeImplementationTrackingLifecycleDraft> = {},
): InitiativeImplementationTrackingLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Tracking",
    summary: "Intent",
    packageId: "pkg-1",
    candidates: [candidate()],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8e — deriveImplementationTrackingAiAssistantInsights", () => {
  it("sources summary params preserve package/commitments/actions/allies; civic title raw", () => {
    const insights = deriveImplementationTrackingAiAssistantInsights(
      snapshot({
        isEmpty: false,
        activeAllyCount: 2,
        decisionApprovedActions: ["A", "B"],
        acceptedCommitments: [{ commitmentId: "c1" } as never],
        packageReference: {
          packageId: "pkg-1",
          title: "Civic Package Title",
        } as never,
      }),
      null,
    );
    assert.equal(insights.sourcesSummary.code, "implementation_tracking.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasPackage: 1,
      acceptedCommitmentCount: 1,
      decisionActionCount: 2,
      activeAllyCount: 2,
    });
    assert.equal(insights.sourcesSummary.civic?.title, "Civic Package Title");
  });

  it("unused missingCommitmentPackageWarnings stay English strings and unmigrated", () => {
    const insights = deriveImplementationTrackingAiAssistantInsights(snapshot(), draft({ candidates: [] }));
    assert.ok(insights.missingCommitmentPackageWarnings.length >= 2);
    for (const warning of insights.missingCommitmentPackageWarnings) {
      assert.equal(typeof warning, "string");
      assert.match(warning, /[A-Za-z]/);
    }
    assert.ok(
      insights.missingCommitmentPackageWarnings.some((item) =>
        item.includes("No Commitment Package yet"),
      ),
    );
  });

  it("overdue boundaries: yesterday overdue; today not; Completed/100% excluded", () => {
    const today = todayIso();
    const yesterday = shiftIsoDay(today, -1);

    const overdue = deriveImplementationTrackingAiAssistantInsights(
      snapshot(),
      draft({
        candidates: [
          candidate({
            candidateId: "o1",
            targetDate: yesterday,
            currentStatus: "In progress",
            progress: 50,
          }),
          candidate({
            candidateId: "o2",
            targetDate: today,
            currentStatus: "In progress",
            progress: 50,
          }),
          candidate({
            candidateId: "o3",
            targetDate: yesterday,
            currentStatus: "Completed",
            progress: 90,
          }),
          candidate({
            candidateId: "o4",
            targetDate: yesterday,
            currentStatus: "In progress",
            progress: 100,
          }),
        ],
      }),
    );
    assert.equal(overdue.overdueWarnings[0]?.code, "implementation_tracking.overdue.count");
    assert.equal(overdue.overdueWarnings[0]?.params?.count, 1);
  });

  it("blocked, evidence@100%, stalled Preparation+0%, missing target, unassigned, clarity fields", () => {
    const insights = deriveImplementationTrackingAiAssistantInsights(
      snapshot(),
      draft({
        title: "",
        summary: "  ",
        candidates: [
          candidate({
            candidateId: "b1",
            obstacles: ["Civic blocker text"],
            evidenceReferences: [],
            progress: 100,
            currentStatus: "Done-ish",
            targetDate: null,
            responsibleParticipantId: "  ",
          }),
          candidate({
            candidateId: "s1",
            obstacles: [],
            progress: 0,
            currentStatus: "Preparation",
            targetDate: shiftIsoDay(todayIso(), 3),
            responsibleParticipantId: "member-9",
          }),
        ],
      }),
    );

    assert.equal(insights.blockedWarnings[0]?.code, "implementation_tracking.blocked.count");
    assert.equal(insights.blockedWarnings[0]?.params?.count, 1);
    assert.equal(
      insights.missingEvidenceWarnings[0]?.code,
      "implementation_tracking.evidence.missing_at_complete",
    );
    assert.equal(insights.missingEvidenceWarnings[0]?.params?.count, 1);
    assert.equal(insights.stalledWarnings[0]?.code, "implementation_tracking.stalled.not_started");
    assert.equal(insights.stalledWarnings[0]?.params?.count, 1);
    assert.equal(
      insights.timelineConflictWarnings[0]?.code,
      "implementation_tracking.timeline.missing_target_date",
    );
    assert.equal(insights.timelineConflictWarnings[0]?.params?.count, 1);
    assert.deepEqual(
      insights.clarityWarnings.map((item) => item.code),
      [
        "implementation_tracking.clarity.unassigned",
        "implementation_tracking.clarity.title_empty",
        "implementation_tracking.clarity.summary_empty",
      ],
    );
    assert.equal(insights.clarityWarnings[0]?.params?.count, 1);
    assert.deepEqual(insights.clarityWarnings[1]?.civic?.implementationTrackingFieldIds, ["title"]);
    assert.deepEqual(insights.clarityWarnings[2]?.civic?.implementationTrackingFieldIds, [
      "summary",
    ]);
  });

  it("stalled requires exact English free-text status Preparation and progress 0", () => {
    const insights = deriveImplementationTrackingAiAssistantInsights(
      snapshot(),
      draft({
        candidates: [
          candidate({ progress: 0, currentStatus: "preparation" }),
          candidate({ progress: 1, currentStatus: "Preparation" }),
          candidate({ progress: 0, currentStatus: "Not started" }),
        ],
      }),
    );
    assert.equal(insights.stalledWarnings.length, 0);
  });

  it("passes through API consistency warning detail without rewriting", () => {
    const insights = deriveImplementationTrackingAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "t1",
            label: "API",
            status: "warning",
            detail: "Opaque tracking consistency detail.",
          },
        ],
      }),
      draft(),
    );
    assert.equal(insights.consistencyWarnings.length, 1);
    assert.equal(insights.consistencyWarnings[0]?.detail, "Opaque tracking consistency detail.");
  });
});
