/**
 * Public Choice Fix 07B — sidebar allowlist + Civic Archive presentation + roster.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveParticipantFacingCurrentStageId } from "@hu/types";

import {
  publicChoiceSidebarAllows,
  resolvePublicChoiceSidebarAllowlist,
} from "../public-initiative-experience/public-choice-sidebar-allowlist";
import {
  resolveLifecycleShellHash,
  selectLifecycleNavStagesForDisplay,
} from "../public-initiative-experience/initiative-lifecycle-shell";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");
const repoRoot = path.resolve(dir, "../../../../../");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function stage(
  stageId: string,
  state: "not_started" | "in_progress" | "completed" | "not_applicable" = "not_started",
) {
  return {
    stageId,
    label: stageId === "archive" ? "Civic Archive" : stageId,
    hash: stageId,
    state,
    stateLabel: state,
    recordCount: 0,
  };
}

describe("Public Choice Fix 07B — sidebar allowlist", () => {
  it("Visitor allowlist is Candidates + Related only", () => {
    const allow = resolvePublicChoiceSidebarAllowlist({ authenticated: false });
    assert.deepEqual([...allow], ["candidates", "related_initiatives"]);
    assert.equal(publicChoiceSidebarAllows(allow, "your_participation"), false);
  });

  it("Participant/Author allowlist is Candidates + Your Participation + Related", () => {
    const allow = resolvePublicChoiceSidebarAllowlist({ authenticated: true });
    assert.deepEqual([...allow], [
      "candidates",
      "your_participation",
      "related_initiatives",
    ]);
  });

  it("PUBLIC_CHOICE sidebar mounts only allowlisted widgets; STANDARD keeps Allies", () => {
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /resolvePublicChoiceSidebarAllowlist/);
    assert.match(sidebar, /isPublicChoice/);
    assert.match(sidebar, /InitiativeActiveAlliesWidget/);
    // Allies only on STANDARD branch (after PC early return).
    const pcBlock = sidebar.slice(
      sidebar.indexOf("if (isPublicChoice)"),
      sidebar.indexOf("return (", sidebar.indexOf("if (isPublicChoice)") + 1),
    );
    assert.doesNotMatch(pcBlock, /InitiativeActiveAlliesWidget/);
    assert.doesNotMatch(pcBlock, /PublicInitiativeLatestInitiatives/);
    assert.doesNotMatch(pcBlock, /PublicInitiativeRevisionHistory/);
    assert.doesNotMatch(pcBlock, /PublicInitiativeSupportStatistics/);
  });

  it("PUBLIC_CHOICE never mounts Working Sidebar or icw Channel", () => {
    const branch = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebarOrChannel.tsx",
    );
    assert.match(branch, /Fix 07B — PUBLIC_CHOICE Overview always uses the public allowlisted sidebar/);
    assert.match(
      branch,
      /if \(isPublicChoice\) \{\s*return <PublicExperienceSidebar/,
    );
    // Channel / Working Sidebar remain only on the STANDARD branch after the PC early return.
    const afterPcReturn = branch.slice(branch.indexOf("if (isPublicChoice)"));
    const pcEarly = afterPcReturn.slice(
      0,
      afterPcReturn.indexOf("Initiative Lifecycle Part A Completion"),
    );
    assert.doesNotMatch(pcEarly, /InitiativeCollaborationWorkspace/);
    assert.doesNotMatch(pcEarly, /InitiativeLifecycleWorkingSidebar/);
  });
});

describe("Public Choice Fix 07B — Civic Archive presentation current stage", () => {
  it("clamps PUBLIC_CHOICE archive current → collective_decision", () => {
    assert.equal(
      resolveParticipantFacingCurrentStageId("archive", "PUBLIC_CHOICE"),
      "collective_decision",
    );
    assert.equal(
      resolveParticipantFacingCurrentStageId("collective_decision", "PUBLIC_CHOICE"),
      "collective_decision",
    );
    assert.equal(resolveParticipantFacingCurrentStageId("archive", "STANDARD"), "archive");
  });

  it("nav omits archive; page + center use presentation resolver", () => {
    const displayed = selectLifecycleNavStagesForDisplay(
      [
        stage("initiative"),
        stage("discussion"),
        stage("collective_decision"),
        stage("archive"),
      ],
      "PUBLIC_CHOICE",
    );
    assert.deepEqual(
      displayed.map((item) => item.stageId),
      ["initiative", "discussion", "collective_decision"],
    );

    const page = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeExperiencePage.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(page, /resolveParticipantFacingCurrentStageId/);
    assert.match(page, /presentationCurrentStageId/);
    assert.match(center, /resolveParticipantFacingCurrentStageId/);
  });
});

describe("Public Choice Fix 07B — Visitor public roster", () => {
  it("shared-documents auth is path-scoped so public initiative GET is not 401", () => {
    const routes = readRepo(
      "apps/api/src/modules/shared-documents/shared-documents.initiatives.routes.ts",
    );
    assert.match(routes, /Fix 07B — Auth must be path-scoped/);
    assert.match(routes, /\/:initiativeId\/collaboration-channel/);
    assert.doesNotMatch(
      routes,
      /sharedDocumentsInitiativesRouter\.use\(requireJwtAuthenticationMiddleware\);/,
    );
  });

  it("Overview does not swallow candidate list failures as empty array", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const loader = readWeb(
      "features/public-choice-candidate/public-choice-election-result-surface.ts",
    );
    // Fix 07C — Overview loads via shared surface; roster failures must still surface.
    assert.match(overview, /loadPublicChoiceElectionResultSurface/);
    assert.match(loader, /listPublicChoiceCandidates\(initiativeId\)/);
    assert.doesNotMatch(loader, /listPublicChoiceCandidates\(initiativeId\)\.catch\(\(\) => \[\]\)/);
    assert.match(overview, /\/register\?returnTo=/);
  });

  it("public candidate projection omits ownership / visitor fields", () => {
    const projection = readRepo("packages/types/src/domain/public-choice-candidate.ts");
    assert.match(
      projection,
      /export interface PublicChoiceCandidatePublicProjection \{[^}]*candidateId[^}]*initiativeId[^}]*name/,
    );
    assert.doesNotMatch(
      projection,
      /export interface PublicChoiceCandidatePublicProjection \{[^}]*submittedByParticipantId/,
    );
    assert.doesNotMatch(
      projection,
      /export interface PublicChoiceCandidatePublicProjection \{[^}]*visitorKey/,
    );
  });
});

describe("Public Choice Fix 07B — role matrix + hash fallback", () => {
  it("Visitor/Participant/Author Overview share Select/Recall; Visitor Register CTA for Add", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /\bSelect\b/);
    assert.match(overview, /\bRecall\b/);
    assert.match(overview, /authenticated \? \(/);
    assert.match(overview, /\/register\?returnTo=/);
    assert.match(overview, /PublicChoiceCandidateSubmitPanel/);
  });

  it("#civic-archive and #collaboration-channel fall back on PUBLIC_CHOICE", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "completed"),
      stage("collective_decision", "in_progress"),
      stage("archive", "not_started"),
    ];
    assert.deepEqual(resolveLifecycleShellHash("#civic-archive", stages, { lifecycleProfile: "PUBLIC_CHOICE" }), {
      kind: "fallback_overview",
      reason: "not_applicable",
    });
    assert.deepEqual(
      resolveLifecycleShellHash("#collaboration-channel", stages, { lifecycleProfile: "PUBLIC_CHOICE" }),
      { kind: "fallback_overview", reason: "not_applicable" },
    );
    assert.equal(
      resolveLifecycleShellHash("#collaboration-channel", stages, { lifecycleProfile: "STANDARD" }).kind,
      "collaboration",
    );
  });
});
