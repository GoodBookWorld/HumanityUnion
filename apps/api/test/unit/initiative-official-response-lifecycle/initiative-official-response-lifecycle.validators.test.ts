import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeOfficialResponseCandidate, InitiativeOfficialResponseLifecycleDraft } from "@hu/types";

import {
  validateInitiativeOfficialResponseLifecycleDraftForPublication,
  validateSaveInitiativeOfficialResponseLifecycleDraftInput,
} from "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-lifecycle.validators.js";

function buildCandidate(
  overrides: Partial<InitiativeOfficialResponseCandidate> = {},
): InitiativeOfficialResponseCandidate {
  return {
    candidateId: "official-response-candidate-0",
    institution: "City Sustainability Office",
    organization: "",
    responseType: "official_letter",
    subject: "Response regarding: Pilot in two districts first",
    receivedAt: "2026-08-08",
    summary: "The city confirmed the pilot's completion.",
    referenceNumber: "REF-001",
    relatedActions: ["Pilot in two districts first"],
    relatedCommitmentIds: ["commitment-1"],
    relatedTrackingIds: ["tracking-1"],
    documentIds: [],
    links: [],
    verificationStatus: "pending",
    notes: "",
    references: ["Tracking tracking-1", "tracking-package-1"],
    ...overrides,
  };
}

function buildDraft(
  overrides: Partial<InitiativeOfficialResponseLifecycleDraft> = {},
): InitiativeOfficialResponseLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Official Responses: Test",
    summary: "Two compost hubs were piloted and evidence was published.",
    trackingPackageId: "tracking-package-1",
    outcomeKind: "responses_received",
    noResponseDetail: {
      contactedOrganizations: [],
      contactedDates: [],
      note: "",
    },
    candidates: [buildCandidate()],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateSaveInitiativeOfficialResponseLifecycleDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(() => validateSaveInitiativeOfficialResponseLifecycleDraftInput(null), /required/i);
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativeOfficialResponseLifecycleDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.candidates, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativeOfficialResponseLifecycleDraftInput({ title: 1 }),
      /title/i,
    );
  });

  it("rejects candidates that is not an array", () => {
    assert.throws(
      () => validateSaveInitiativeOfficialResponseLifecycleDraftInput({ candidates: "nope" }),
      /candidates/i,
    );
  });

  it("rejects a candidate missing a required field", () => {
    assert.throws(
      () =>
        validateSaveInitiativeOfficialResponseLifecycleDraftInput({
          candidates: [{ candidateId: "official-response-candidate-0" }],
        }),
      /institution/i,
    );
  });

  it("rejects a candidate with an invalid responseType", () => {
    assert.throws(
      () =>
        validateSaveInitiativeOfficialResponseLifecycleDraftInput({
          candidates: [buildCandidate({ responseType: "not-a-type" as never })],
        }),
      /responseType/i,
    );
  });

  it("rejects a candidate with an invalid verificationStatus", () => {
    assert.throws(
      () =>
        validateSaveInitiativeOfficialResponseLifecycleDraftInput({
          candidates: [buildCandidate({ verificationStatus: "not-a-status" as never })],
        }),
      /verificationStatus/i,
    );
  });

  it("accepts a candidate with a valid trackingPackageId and every valid field", () => {
    const input = validateSaveInitiativeOfficialResponseLifecycleDraftInput({
      trackingPackageId: "tracking-package-1",
      candidates: [buildCandidate()],
    });
    assert.equal(input.trackingPackageId, "tracking-package-1");
    assert.equal(input.candidates?.[0]?.institution, "City Sustainability Office");
  });

  it("accepts a null trackingPackageId", () => {
    const input = validateSaveInitiativeOfficialResponseLifecycleDraftInput({ trackingPackageId: null });
    assert.equal(input.trackingPackageId, null);
  });
});

describe("validateInitiativeOfficialResponseLifecycleDraftForPublication", () => {
  it("passes for a complete draft with a Tracking Package reference and at least one candidate", () => {
    assert.doesNotThrow(() =>
      validateInitiativeOfficialResponseLifecycleDraftForPublication(buildDraft()),
    );
  });

  it("rejects an empty title", () => {
    assert.throws(
      () => validateInitiativeOfficialResponseLifecycleDraftForPublication(buildDraft({ title: "  " })),
      /title/i,
    );
  });

  it("rejects a missing trackingPackageId — the stage's one mandatory source", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({ trackingPackageId: null }),
        ),
      /Implementation Tracking Package/i,
    );
  });

  it("rejects a draft with no candidates unless No Response is recorded", () => {
    assert.throws(
      () => validateInitiativeOfficialResponseLifecycleDraftForPublication(buildDraft({ candidates: [] })),
      /candidate|No official response/i,
    );
  });

  it("accepts an explicit No Response outcome with zero candidates", () => {
    assert.doesNotThrow(() =>
      validateInitiativeOfficialResponseLifecycleDraftForPublication(
        buildDraft({
          outcomeKind: "no_official_response_received",
          candidates: [],
          noResponseDetail: {
            contactedOrganizations: ["City Hall"],
            contactedDates: ["2026-08-01"],
            note: "No reply after two follow-ups.",
          },
        }),
      ),
    );
  });

  it("rejects No Response outcome that still includes candidates", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({
            outcomeKind: "no_official_response_received",
            candidates: [buildCandidate()],
          }),
        ),
      /No-response outcome cannot include/i,
    );
  });

  it("rejects a candidate with neither institution nor organization filled in", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({ candidates: [buildCandidate({ institution: "  ", organization: "  " })] }),
        ),
      /institution or organization/i,
    );
  });

  it("accepts a candidate with only organization filled in", () => {
    assert.doesNotThrow(() =>
      validateInitiativeOfficialResponseLifecycleDraftForPublication(
        buildDraft({
          candidates: [buildCandidate({ institution: "", organization: "Neighborhood Alliance" })],
        }),
      ),
    );
  });

  it("rejects a candidate with an empty subject", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({ candidates: [buildCandidate({ subject: "  " })] }),
        ),
      /subject/i,
    );
  });

  it("rejects a candidate with an empty summary", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({ candidates: [buildCandidate({ summary: "  " })] }),
        ),
      /summary/i,
    );
  });

  it("rejects a candidate with an empty receivedAt", () => {
    assert.throws(
      () =>
        validateInitiativeOfficialResponseLifecycleDraftForPublication(
          buildDraft({ candidates: [buildCandidate({ receivedAt: "  " })] }),
        ),
      /received date/i,
    );
  });
});
