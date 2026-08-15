import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactReportSection,
} from "@hu/types";

import {
  validateInitiativePublicImpactLifecycleDraftForPublication,
  validateSaveInitiativePublicImpactLifecycleDraftInput,
} from "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-lifecycle.validators.js";

function buildSection(
  overrides: Partial<InitiativePublicImpactReportSection> = {},
): InitiativePublicImpactReportSection {
  return {
    sectionId: "executive_summary",
    title: "Executive Summary",
    body: "Published outcomes for the Initiative are summarised here.",
    evidenceReferences: ["official-response-package-1"],
    ...overrides,
  };
}

function buildDraft(
  overrides: Partial<InitiativePublicImpactLifecycleDraft> = {},
): InitiativePublicImpactLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Public Impact Report: Test",
    officialResponsePackageId: "official-response-package-1",
    trackingPackageId: "tracking-package-1",
    commitmentPackageId: "commitment-package-1",
    decisionId: "decision-1",
    sections: [
      buildSection(),
      buildSection({
        sectionId: "evidence",
        title: "Evidence",
        body: "Evidence references from published sources.",
        evidenceReferences: ["tracking-package-1", "https://example.org/evidence"],
      }),
      buildSection({
        sectionId: "objectives",
        title: "Objectives",
        body: "Decision question restated.",
        evidenceReferences: ["decision-1"],
      }),
    ],
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 2,
    },
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateSaveInitiativePublicImpactLifecycleDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(() => validateSaveInitiativePublicImpactLifecycleDraftInput(null), /required/i);
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativePublicImpactLifecycleDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.sections, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativePublicImpactLifecycleDraftInput({ title: 1 }),
      /title/i,
    );
  });

  it("rejects sections that is not an array", () => {
    assert.throws(
      () => validateSaveInitiativePublicImpactLifecycleDraftInput({ sections: "nope" }),
      /sections/i,
    );
  });

  it("rejects a section with an invalid sectionId", () => {
    assert.throws(
      () =>
        validateSaveInitiativePublicImpactLifecycleDraftInput({
          sections: [buildSection({ sectionId: "not-a-section" as never })],
        }),
      /sectionId/i,
    );
  });

  it("rejects a section missing evidenceReferences array", () => {
    assert.throws(
      () =>
        validateSaveInitiativePublicImpactLifecycleDraftInput({
          sections: [
            {
              sectionId: "executive_summary",
              title: "Executive Summary",
              body: "Body",
            },
          ],
        }),
      /evidenceReferences/i,
    );
  });

  it("rejects invalid participationStatistics", () => {
    assert.throws(
      () =>
        validateSaveInitiativePublicImpactLifecycleDraftInput({
          participationStatistics: { signatureCount: -1 },
        }),
      /signatureCount/i,
    );
  });

  it("accepts a complete sections payload and nullable package ids", () => {
    const input = validateSaveInitiativePublicImpactLifecycleDraftInput({
      title: "Public Impact Report",
      officialResponsePackageId: "official-response-package-1",
      trackingPackageId: null,
      sections: [buildSection()],
      participationStatistics: {
        signatureCount: 1,
        supportCount: 2,
        reactionCount: 3,
        activeAllyCount: 4,
      },
    });
    assert.equal(input.title, "Public Impact Report");
    assert.equal(input.trackingPackageId, null);
    assert.equal(input.sections?.[0]?.sectionId, "executive_summary");
    assert.equal(input.participationStatistics?.activeAllyCount, 4);
  });
});

describe("validateInitiativePublicImpactLifecycleDraftForPublication", () => {
  it("passes for a complete draft with Official Response Package and required sections", () => {
    assert.doesNotThrow(() =>
      validateInitiativePublicImpactLifecycleDraftForPublication(buildDraft()),
    );
  });

  it("rejects an empty title", () => {
    assert.throws(
      () => validateInitiativePublicImpactLifecycleDraftForPublication(buildDraft({ title: "  " })),
      /title/i,
    );
  });

  it("rejects a missing officialResponsePackageId — the stage's one mandatory source", () => {
    assert.throws(
      () =>
        validateInitiativePublicImpactLifecycleDraftForPublication(
          buildDraft({ officialResponsePackageId: null }),
        ),
      /Official Response Package/i,
    );
  });

  it("rejects an empty executive_summary section", () => {
    assert.throws(
      () =>
        validateInitiativePublicImpactLifecycleDraftForPublication(
          buildDraft({
            sections: [
              buildSection({ body: "  ", evidenceReferences: [] }),
              buildSection({
                sectionId: "evidence",
                title: "Evidence",
                body: "Evidence body",
                evidenceReferences: ["tracking-package-1"],
              }),
            ],
          }),
        ),
      /executive_summary/i,
    );
  });

  it("rejects an empty evidence section", () => {
    assert.throws(
      () =>
        validateInitiativePublicImpactLifecycleDraftForPublication(
          buildDraft({
            sections: [
              buildSection(),
              buildSection({
                sectionId: "evidence",
                title: "Evidence",
                body: "  ",
                evidenceReferences: [],
              }),
            ],
          }),
        ),
      /evidence/i,
    );
  });

  it("rejects a non-empty section body without evidenceReferences", () => {
    assert.throws(
      () =>
        validateInitiativePublicImpactLifecycleDraftForPublication(
          buildDraft({
            sections: [
              buildSection(),
              buildSection({
                sectionId: "evidence",
                title: "Evidence",
                body: "Evidence body",
                evidenceReferences: ["tracking-package-1"],
              }),
              buildSection({
                sectionId: "lessons_learned",
                title: "Lessons Learned",
                body: "Unsupported claim without citations.",
                evidenceReferences: [],
              }),
            ],
          }),
        ),
      /unsupported/i,
    );
  });

  it("allows empty section bodies without evidenceReferences", () => {
    assert.doesNotThrow(() =>
      validateInitiativePublicImpactLifecycleDraftForPublication(
        buildDraft({
          sections: [
            buildSection(),
            buildSection({
              sectionId: "evidence",
              title: "Evidence",
              body: "Evidence body",
              evidenceReferences: ["tracking-package-1"],
            }),
            buildSection({
              sectionId: "lessons_learned",
              title: "Lessons Learned",
              body: "",
              evidenceReferences: [],
            }),
          ],
        }),
      ),
    );
  });
});
