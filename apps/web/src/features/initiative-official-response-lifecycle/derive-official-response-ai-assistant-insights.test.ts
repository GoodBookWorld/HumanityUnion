/**
 * Pack 02G Task 08E.8f — Official Response derive emits structured Web advisories.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeOfficialResponseIntelligenceSnapshot,
  InitiativeOfficialResponseLifecycleDraft,
} from "@hu/types";

import { deriveOfficialResponseAiAssistantInsights } from "./derive-official-response-ai-assistant-insights";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDay(isoDay: string, deltaDays: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function snapshot(
  overrides: Partial<InitiativeOfficialResponseIntelligenceSnapshot> = {},
): InitiativeOfficialResponseIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    trackingPackageReference: null,
    trackingRecords: [],
    activeAllyCount: 0,
    consistencyChecks: [],
    isTrackingPackageAvailable: false,
    isEmpty: true,
    ...overrides,
  } as InitiativeOfficialResponseIntelligenceSnapshot;
}

function draft(
  overrides: Partial<InitiativeOfficialResponseLifecycleDraft> = {},
): InitiativeOfficialResponseLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Responses",
    summary: "Summary",
    outcomeKind: "responses_received",
    candidates: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as InitiativeOfficialResponseLifecycleDraft;
}

describe("Pack 02G Task 08E.8f — deriveOfficialResponseAiAssistantInsights", () => {
  it("sources summary params preserve tracking + counts; civic title raw", () => {
    const insights = deriveOfficialResponseAiAssistantInsights(
      snapshot({
        activeAllyCount: 2,
        trackingRecords: [{ trackingId: "t1" } as never],
        trackingPackageReference: { title: "Civic Tracking Title" } as never,
      }),
      null,
    );
    assert.equal(insights.sourcesSummary.code, "official_response.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      hasTracking: 1,
      trackingRecordCount: 1,
      activeAllyCount: 2,
    });
    assert.equal(insights.sourcesSummary.civic?.title, "Civic Tracking Title");
  });

  it("unused missingTrackingPackageWarnings stay English and unmigrated", () => {
    const insights = deriveOfficialResponseAiAssistantInsights(snapshot(), null);
    assert.equal(insights.missingTrackingPackageWarnings.length, 1);
    assert.match(insights.missingTrackingPackageWarnings[0]!, /Tracking Package/);
  });

  it("future received date uses TODAY_ISO boundary; subject civic preserved", () => {
    const tomorrow = shiftIsoDay(todayIso(), 1);
    const insights = deriveOfficialResponseAiAssistantInsights(
      snapshot({ trackingPackageReference: { title: "T" } as never }),
      draft({
        candidates: [
          {
            candidateId: "c1",
            subject: "Civic Subject",
            institution: "City",
            organization: "",
            summary: "Summary",
            relatedActions: ["a"],
            relatedTrackingIds: ["t1"],
            documentIds: ["d1"],
            links: [],
            receivedAt: tomorrow,
          } as never,
        ],
      }),
    );
    assert.equal(insights.inconsistentDateWarnings[0]?.code, "official_response.date.future_received");
    assert.equal(insights.inconsistentDateWarnings[0]?.civic?.subject, "Civic Subject");
  });

  it("today received date is not future; advisory notes are descriptors", () => {
    const insights = deriveOfficialResponseAiAssistantInsights(
      snapshot({ trackingPackageReference: { title: "T" } as never }),
      draft({
        candidates: [
          {
            candidateId: "c1",
            subject: "S",
            institution: "I",
            organization: "",
            summary: "Sum",
            relatedActions: ["a"],
            relatedTrackingIds: ["t1"],
            documentIds: ["d1"],
            links: [],
            receivedAt: todayIso(),
          } as never,
        ],
      }),
    );
    assert.equal(insights.inconsistentDateWarnings.length, 0);
    assert.deepEqual(
      insights.advisoryNotes.map((item) => item.code),
      ["official_response.note.advisory_only"],
    );
  });

  it("passes through API consistency detail without rewriting", () => {
    const insights = deriveOfficialResponseAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "tracking-package-available",
            label: "API",
            status: "warning",
            detail: "Opaque OR consistency detail.",
            params: {},
          },
        ],
      }),
      draft(),
    );
    assert.equal(insights.consistencyWarnings[0]?.detail, "Opaque OR consistency detail.");
    assert.equal(insights.clarityWarnings.length, 0);
  });
});
