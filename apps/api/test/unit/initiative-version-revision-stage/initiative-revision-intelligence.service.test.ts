import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeRevisionChange } from "@hu/types";

import {
  buildConflictWarnings,
  buildConsistencyChecks,
  isTracedChange,
} from "../../../src/modules/initiative-version-revision/initiative-revision-intelligence.service.js";

/**
 * Initiative Lifecycle — Part E, Section 3: Intelligent Revision Builder —
 * Conflict warnings / Missing references / Consistency checks. Pure,
 * deterministic functions — no Mongo, no AI — exercised directly against
 * hand-built `InitiativeRevisionChange` fixtures.
 */

function buildChange(overrides: Partial<InitiativeRevisionChange> = {}): InitiativeRevisionChange {
  const now = new Date().toISOString();
  return {
    changeId: "initiative-revision-change-fixture",
    section: "description",
    sectionLabel: "Description",
    before: "Before text.",
    after: "After text.",
    origin: "proposal",
    proposalIds: ["proposal-1"],
    authorOriginatedReason: null,
    explanation: "Explanation",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("isTracedChange (Section 5 — Canonical Traceability)", () => {
  it("treats a Proposal-based change with at least one Proposal ID as traced", () => {
    assert.equal(isTracedChange(buildChange({ origin: "proposal", proposalIds: ["proposal-1"] })), true);
  });

  it("treats a Proposal-based change with zero Proposal IDs as untraced", () => {
    assert.equal(isTracedChange(buildChange({ origin: "proposal", proposalIds: [] })), false);
  });

  it("treats an Author-originated change with a non-empty reason as traced", () => {
    assert.equal(
      isTracedChange(
        buildChange({ origin: "author_originated", proposalIds: [], authorOriginatedReason: "Clarity." }),
      ),
      true,
    );
  });

  it("treats an Author-originated change with a null reason as untraced", () => {
    assert.equal(
      isTracedChange(buildChange({ origin: "author_originated", proposalIds: [], authorOriginatedReason: null })),
      false,
    );
  });

  it("treats an Author-originated change with a whitespace-only reason as untraced", () => {
    assert.equal(
      isTracedChange(buildChange({ origin: "author_originated", proposalIds: [], authorOriginatedReason: "   " })),
      false,
    );
  });
});

describe("buildConflictWarnings", () => {
  it("returns nothing when no two changes share a section", () => {
    const warnings = buildConflictWarnings([
      buildChange({ changeId: "change-1", section: "title", sectionLabel: "Title" }),
      buildChange({ changeId: "change-2", section: "description", sectionLabel: "Description" }),
    ]);

    assert.deepEqual(warnings, []);
  });

  it("flags exactly one warning when two changes target the same section", () => {
    const warnings = buildConflictWarnings([
      buildChange({ changeId: "change-1", section: "description", sectionLabel: "Description", proposalIds: ["proposal-1"] }),
      buildChange({ changeId: "change-2", section: "description", sectionLabel: "Description", proposalIds: ["proposal-2"] }),
    ]);

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]!.code, "multiple_changes_same_section");
    assert.equal(warnings[0]!.section, "description");
    assert.equal(warnings[0]!.params.changeCount, 2);
    assert.deepEqual(warnings[0]!.changeIds.sort(), ["change-1", "change-2"]);
    assert.deepEqual(warnings[0]!.proposalIds.sort(), ["proposal-1", "proposal-2"]);
    assert.match(warnings[0]!.message, /2 changes target the Description section/);
  });

  it("deduplicates proposalIds shared by the conflicting changes", () => {
    const warnings = buildConflictWarnings([
      buildChange({ changeId: "change-1", section: "title", sectionLabel: "Title", proposalIds: ["proposal-1"] }),
      buildChange({ changeId: "change-2", section: "title", sectionLabel: "Title", proposalIds: ["proposal-1"] }),
    ]);

    assert.deepEqual(warnings[0]!.proposalIds, ["proposal-1"]);
  });

  it("never warns about a section with only a single change", () => {
    const warnings = buildConflictWarnings([buildChange({ section: "custom", sectionLabel: "Custom" })]);
    assert.deepEqual(warnings, []);
  });
});

describe("buildConsistencyChecks", () => {
  it("reports 'ok' for both checks when nothing is missing or untraced", () => {
    const checks = buildConsistencyChecks([buildChange({})], []);

    const byId = new Map(checks.map((check) => [check.checkId, check]));
    assert.equal(byId.get("accepted-proposals-traced")!.status, "ok");
    assert.equal(byId.get("accepted-proposals-traced")!.params.count, 0);
    assert.equal(byId.get("changes-have-origin")!.status, "ok");
    assert.equal(byId.get("changes-have-origin")!.params.count, 0);
  });

  it("reports 'warning' on 'accepted-proposals-traced' when a curated proposal has no backing change", () => {
    const checks = buildConsistencyChecks([], ["proposal-missing"]);
    const check = checks.find((entry) => entry.checkId === "accepted-proposals-traced")!;

    assert.equal(check.status, "warning");
    assert.equal(check.params.count, 1);
    assert.match(check.detail, /1 proposal\(s\)/);
  });

  it("reports 'warning' on 'changes-have-origin' when a change is untraced", () => {
    const traced = buildChange({ changeId: "change-1", origin: "proposal", proposalIds: ["proposal-1"] });
    const untraced = buildChange({
      changeId: "change-2",
      origin: "author_originated",
      proposalIds: [],
      authorOriginatedReason: null,
    });

    const checks = buildConsistencyChecks([traced, untraced], []);
    const check = checks.find((entry) => entry.checkId === "changes-have-origin")!;

    assert.equal(check.status, "warning");
    assert.equal(check.params.count, 1);
    assert.match(check.detail, /1 change\(s\)/);
  });
});
