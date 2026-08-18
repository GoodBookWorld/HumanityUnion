/**
 * INITIATIVE LIFECYCLE SIMPLIFICATION — STEP 04
 * Legacy progression disconnect proofs (static + authority freeze).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES } from "../../../src/shared/lifecycle/lifecycle-progression-authority.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(HERE, "../../../src");

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(API_SRC, ...parts), "utf8");
}

describe("Step 04 — legacy Lifecycle progression disconnect", () => {
  it("Author Collective Decision pack does not call session-bound create eligibility", () => {
    const source = readSrc(
      "modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.service.ts",
    );
    assert.equal(source.includes("createInitiativeCollectiveDecisionDraft"), false);
    assert.equal(source.includes("assessInitiativeCollectiveDecisionEligibility"), false);
    assert.match(source, /createDecision\(/);
  });

  it("canonical experience archive progression ignores TASK-037 public-civic-archive records", () => {
    const experience = readSrc("modules/initiatives/public-initiative-experience.service.ts");
    const adapter = readSrc("modules/initiatives/initiative-lifecycle-stage-adapter.ts");

    // Progression records for archive must come from Part M only.
    assert.match(experience, /Canonical progression counts Author Part M Archive only/);
    assert.equal(
      /records\.set\(\s*"archive",[\s\S]*archive\./.test(experience),
      false,
      "TASK-037 archive must not be written into progression stage records",
    );

    assert.equal(
      adapter.includes("getLatestPublishedPublicCivicArchiveForInitiative"),
      false,
      "stage adapter must not treat TASK-037 as published Author Archive",
    );
  });

  it("disconnected authorities list covers Cap02, status, and legacy eligibility families", () => {
    for (const key of [
      "capability02.buildPipelineStatus",
      "legacy.collectiveDecision.sessionBoundEligibility",
      "legacy.implementationCommitment.perRecordEligibility",
      "legacy.implementationTracking.perRecordEligibility",
      "legacy.publicImpact.perRecordEligibility",
      "task037.publicCivicArchive.progressionCounts",
      "initiative.status",
    ] as const) {
      assert.ok(
        (LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES as readonly string[]).includes(key),
        key,
      );
    }
  });

  it("web shell no longer exports obsolete requires* progression helpers", () => {
    const shell = readFileSync(
      path.resolve(
        HERE,
        "../../../../web/src/features/public-initiative-experience/initiative-lifecycle-shell.ts",
      ),
      "utf8",
    );
    assert.equal(shell.includes("requiresDecisionSessionBeforeCollectiveDecision"), false);
    assert.equal(shell.includes("requiresPublicImpactBeforeCivicArchive"), false);
  });
});
