/**
 * TASK-022 — Decision Session end-to-end verification.
 * Run: npm run verify:decision-session
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DecisionSessionStatus } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const participantA: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const participantB: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = ["authorId", "stewardId", "memberId", "email", "participantId"];

const VOTING_TERMS = ["ballot", "voteCount", "tally", "castVote", "collectVotes"];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

interface EligibleInitiativeContext {
  initiativeId: string;
  analysisId: string;
  proposalId: string;
  initiativeCreatedAt: string;
}

async function buildEligibleInitiativeContext(): Promise<EligibleInitiativeContext> {
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");

  const draft = createInitiativeDraft(participantA, {
    title: "E2E Decision Session Initiative",
    description: "Initiative for decision session verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const projected = publishInitiative(participantA, draft.initiativeId);
  assert(projected.lifecyclePhase === "projected", "Initiative should be projected");

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(participantB, {
    initiativeId: projected.initiativeId,
    title: "E2E Decision Session Analysis",
    summary: "Analysis supporting decision session eligibility.",
    supportingEvidence: "Community input supports structured decision preparation.",
    risks: "Timing coordination required.",
    suggestedImprovements: "Clarify decision scope.",
    references: "Participation records.",
  });

  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    participantB,
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(participantB, {
    analysisId: publishedAnalysis.analysisId,
    targetSection: "Description",
    currentIssue: "Decision scope unclear.",
    proposedChange: "Add explicit decision scope section.",
    rationale: "Improves informed public decisions.",
    expectedImprovement: "Clearer decision question framing.",
    references: "Steward feedback.",
  });

  const submittedProposal = submitInitiativeImprovementProposal(
    participantB,
    proposalDraft.proposalId,
  );

  const decidedProposal = decideInitiativeImprovementProposal(
    participantA,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Scope clarification accepted for revision.",
    },
  );

  createInitiativeRevisionDraft(participantA, projected.initiativeId);

  saveInitiativeRevisionDraft(participantA, projected.initiativeId, {
    title: "E2E Decision Session Initiative (Revised)",
    description: "Revised initiative ready for decision session preparation.",
    revisionSummary: "Added decision scope based on accepted proposal.",
    appliedProposalIds: [decidedProposal.proposalId],
  });

  publishInitiativeRevision(participantA, projected.initiativeId);

  return {
    initiativeId: projected.initiativeId,
    analysisId: publishedAnalysis.analysisId,
    proposalId: decidedProposal.proposalId,
    initiativeCreatedAt: projected.createdAt,
  };
}

function verifyPublicExperienceUnchanged(): void {
  const publicExperienceScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "../../../web/src/scripts/verify-decision-session-public-experience.ts",
  );
  const result = spawnSync("npx", ["tsx", publicExperienceScriptPath], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../../.."),
    stdio: "inherit",
    encoding: "utf-8",
  });

  assert(result.status === 0, "Public experience providers should remain unchanged");
}

async function runMainVerification(): Promise<void> {
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const { createInitiativeImprovementProposalDraft, submitInitiativeImprovementProposal } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const {
    createDecisionSessionDraft,
    saveDecisionSessionDraft,
    publishDecisionSession,
    closeDecisionSession,
    archiveDecisionSession,
    getDecisionSessionEligibility,
  } = await import("../modules/decision-session/decision-session.service.js");
  const {
    getPublicDecisionSession,
    listPublicDecisionSessionsForInitiative,
    computeDecisionSessionMetrics,
  } = await import("../modules/decision-session/public-decision-session.projection.js");
  const { getRevisionById } =
    await import("../modules/initiative-version-revision/initiative-version-revision.store.js");
  const { getAnalysisById } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js");
  const { getProposalById } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.store.js");
  const { getSessionById } = await import("../modules/decision-session/decision-session.store.js");
  const decisionSessionModuleSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/decision-session/decision-session.service.ts",
    ),
    "utf-8",
  );

  console.log("1. Scenario A — projected initiative without analyses rejects creation");

  const scenarioA = createInitiativeDraft(participantA, {
    title: "Scenario A Initiative",
    description: "No analyses yet.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projectedA = publishInitiative(participantA, scenarioA.initiativeId);

  const eligibilityA = getDecisionSessionEligibility(projectedA.initiativeId);
  assert(!eligibilityA.eligible, "Scenario A should be ineligible");
  assert(
    eligibilityA.reasons.some((reason) => reason.includes("collaborative analysis")),
    "Scenario A should require analyses",
  );

  assertThrows(
    () =>
      createDecisionSessionDraft(participantA, {
        initiativeId: projectedA.initiativeId,
        title: "Rejected Session",
        purpose: "Should not be created.",
        decisionQuestion: "Should this fail?",
        opensAt: futureIsoDate(7),
        closesAt: futureIsoDate(14),
      }),
    "Scenario A creation must be rejected",
  );

  console.log("2. Scenario B — analyses without steward-reviewed proposals rejects creation");

  const scenarioB = createInitiativeDraft(participantA, {
    title: "Scenario B Initiative",
    description: "Analysis only.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projectedB = publishInitiative(participantA, scenarioB.initiativeId);

  const analysisB = createInitiativeCollaborativeAnalysisDraft(participantB, {
    initiativeId: projectedB.initiativeId,
    title: "Scenario B Analysis",
    summary: "Published analysis without steward-reviewed proposal.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  publishInitiativeCollaborativeAnalysis(participantB, analysisB.analysisId);

  const eligibilityB = getDecisionSessionEligibility(projectedB.initiativeId);
  assert(!eligibilityB.eligible, "Scenario B should be ineligible");
  assert(
    eligibilityB.reasons.some((reason) => reason.includes("steward-reviewed")),
    "Scenario B should require steward-reviewed proposals",
  );

  const submittedOnlyProposal = createInitiativeImprovementProposalDraft(participantB, {
    analysisId: analysisB.analysisId,
    targetSection: "Description",
    currentIssue: "Issue.",
    proposedChange: "Change.",
    rationale: "Rationale.",
    expectedImprovement: "Improvement.",
    references: "References.",
  });
  submitInitiativeImprovementProposal(participantB, submittedOnlyProposal.proposalId);

  assertThrows(
    () =>
      createDecisionSessionDraft(participantA, {
        initiativeId: projectedB.initiativeId,
        title: "Rejected Session B",
        purpose: "Should not be created.",
        decisionQuestion: "Should this fail?",
        opensAt: futureIsoDate(7),
        closesAt: futureIsoDate(14),
      }),
    "Scenario B creation must be rejected",
  );

  console.log("3. Scenario C — full collective intelligence allows draft creation");

  const eligible = await buildEligibleInitiativeContext();
  const eligibilityC = getDecisionSessionEligibility(eligible.initiativeId);
  assert(eligibilityC.eligible, "Scenario C should be eligible");

  const sessionDraft = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "E2E Decision Session",
    purpose: "Prepare society for an informed public decision on the garden initiative.",
    decisionQuestion: "Should the community proceed with the revised garden plan?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  assert(sessionDraft.status === "draft", "Created session should be draft");

  console.log("4. Steward workflow — edit, publish, close, archive");

  const edited = saveDecisionSessionDraft(participantA, sessionDraft.sessionId, {
    title: "E2E Decision Session (Edited)",
    purpose: "Updated purpose for public decision preparation.",
  });
  assert(edited.status === "draft", "Edited session should remain draft");
  assert(edited.title.includes("Edited"), "Draft edit should persist");

  const published = publishDecisionSession(participantA, sessionDraft.sessionId);
  assert(published.status === "published", "Published session status");
  assert(published.packageReferences !== undefined, "Published session should capture package");
  assert(published.publishedAt !== undefined, "Published session should have publishedAt");

  console.log("6. Decision package — reference integrity without duplicated content");

  if (!published.packageReferences) {
    throw new Error("Package references required");
  }

  const { revisionIds, analysisIds, proposalIds } = published.packageReferences;

  assert(revisionIds.length >= 2, "Package should include revision history");
  assert(analysisIds.length >= 1, "Package should include published analyses");
  assert(proposalIds.length >= 1, "Package should include reviewed proposals");

  for (const revisionId of revisionIds) {
    assert(getRevisionById(revisionId) !== null, `Revision reference ${revisionId} must resolve`);
  }

  for (const analysisId of analysisIds) {
    const analysis = getAnalysisById(analysisId);
    assert(analysis !== null && analysis.status === "published", "Analysis reference must resolve");
  }

  for (const proposalId of proposalIds) {
    const proposal = getProposalById(proposalId);
    assert(proposal !== null, `Proposal reference ${proposalId} must resolve`);
    if (!proposal) {
      continue;
    }
    assert(
      ["accepted", "partially_accepted", "declined"].includes(proposal.status),
      "Package proposals must be steward-reviewed",
    );
  }

  const storedSession = getSessionById(sessionDraft.sessionId);
  assert(storedSession?.packageReferences !== undefined, "Stored session retains references only");
  assert(
    !JSON.stringify(storedSession).includes('"description"'),
    "Decision session store should not duplicate initiative content in package",
  );

  console.log("7. Public page projection");

  const publicPublished = getPublicDecisionSession(sessionDraft.sessionId);
  assert(publicPublished !== null, "Published session should be publicly visible");
  if (!publicPublished) {
    throw new Error("Published session should be publicly visible");
  }

  assert(publicPublished.purpose.length > 0, "Public page should show purpose");
  assert(publicPublished.decisionQuestion.length > 0, "Public page should show decision question");
  assert(publicPublished.initiativeVersion >= 2, "Public page should show current version");
  assert(publicPublished.status === "published", "Public page should show published status");
  assert(publicPublished.opensAt.length > 0, "Public page should show opening date");
  assert(publicPublished.closesAt.length > 0, "Public page should show closing date");
  assert(publicPublished.decisionPackage.revisions.length >= 2, "Public page revision history");
  assert(publicPublished.decisionPackage.analyses.length >= 1, "Public page analyses");
  assert(publicPublished.decisionPackage.proposals.length >= 1, "Public page proposals");
  assert(publicPublished.stewardDisplayName.length > 0, "Public page steward display name");
  assertNoPrivateFields(publicPublished, "Public decision session");

  const closed = closeDecisionSession(participantA, sessionDraft.sessionId);
  assert(closed.status === "closed", "Closed session status");
  assert(closed.closedAt !== undefined, "Closed session should have closedAt");

  const publicClosed = getPublicDecisionSession(sessionDraft.sessionId);
  assert(publicClosed !== null, "Closed session should remain publicly visible");
  if (!publicClosed) {
    throw new Error("Closed session should remain publicly visible");
  }
  assert(publicClosed.status === "closed", "Public page should show closed status");

  console.log("5. Ownership — non-steward cannot manage decision sessions");

  const ownedSession = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Ownership Test Session",
    purpose: "Ownership verification.",
    decisionQuestion: "Ownership question?",
    opensAt: futureIsoDate(10),
    closesAt: futureIsoDate(20),
  });

  assertThrows(
    () =>
      saveDecisionSessionDraft(participantB, ownedSession.sessionId, {
        title: "Unauthorized edit",
      }),
    "Non-steward cannot edit decision session",
  );

  assertThrows(
    () => publishDecisionSession(participantB, ownedSession.sessionId),
    "Non-steward cannot publish decision session",
  );

  assertThrows(
    () => closeDecisionSession(participantB, ownedSession.sessionId),
    "Non-steward cannot close decision session",
  );

  assertThrows(
    () => archiveDecisionSession(participantB, ownedSession.sessionId),
    "Non-steward cannot archive decision session",
  );

  assertThrows(
    () =>
      createDecisionSessionDraft(participantB, {
        initiativeId: eligible.initiativeId,
        title: "Unauthorized create",
        purpose: "Should fail.",
        decisionQuestion: "Should fail?",
        opensAt: futureIsoDate(7),
        closesAt: futureIsoDate(14),
      }),
    "Non-steward cannot create decision session",
  );

  console.log("8. Initiative integration — published/closed visible, archived hidden");

  const publishedForList = publishDecisionSession(participantA, ownedSession.sessionId);
  assert(publishedForList.status === "published", "Second session should publish for list test");

  const publicList = listPublicDecisionSessionsForInitiative(eligible.initiativeId);
  const visibleIds = new Set(publicList.map((session) => session.sessionId));
  assert(visibleIds.has(sessionDraft.sessionId), "Closed session should appear on initiative page");
  assert(
    visibleIds.has(ownedSession.sessionId),
    "Published session should appear on initiative page",
  );

  console.log("10. Metrics readiness");

  const metrics = computeDecisionSessionMetrics(eligible.initiativeId);
  assert(metrics.decisionSessionCount === 2, "Metrics should count published and closed sessions");
  assert(
    metrics.averageRevisionCountBeforeDecision >= 2,
    "Average revision count should reflect package",
  );
  assert(
    metrics.averageAnalysisCountBeforeDecision >= 1,
    "Average analysis count should reflect package",
  );
  assert(
    metrics.averageProposalCountBeforeDecision >= 1,
    "Average proposal count should reflect package",
  );
  assert(
    metrics.averagePreparationTimeDays !== null && metrics.averagePreparationTimeDays >= 0,
    "Average preparation time should be computed",
  );

  archiveDecisionSession(participantA, ownedSession.sessionId);
  const listAfterArchive = listPublicDecisionSessionsForInitiative(eligible.initiativeId);
  assert(
    !listAfterArchive.some((session) => session.sessionId === ownedSession.sessionId),
    "Archived session should be hidden from initiative page",
  );
  assert(
    listAfterArchive.some((session) => session.sessionId === sessionDraft.sessionId),
    "Closed session should remain listed",
  );

  console.log("9. Public Experience — bootstrap and API providers unchanged");

  verifyPublicExperienceUnchanged();

  console.log("11. Archive lifecycle transition");

  const archived = archiveDecisionSession(participantA, sessionDraft.sessionId);
  assert(archived.status === "archived", "Archived session status");
  assert(
    getPublicDecisionSession(sessionDraft.sessionId) === null,
    "Archived session should not be publicly visible",
  );

  console.log("12. Privacy — no internal identifiers in public projections");

  assertNoPrivateFields(publicList, "Public decision session list");
  assertNoPrivateFields(metrics, "Decision session metrics");

  console.log("13. No voting — decision session remains preparation only");

  for (const term of VOTING_TERMS) {
    assert(
      !decisionSessionModuleSource.includes(term),
      `Decision session module must not include ${term}`,
    );
  }

  const decisionSessionRoutesSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/decision-session/decision-session.routes.ts",
    ),
    "utf-8",
  );
  for (const term of VOTING_TERMS) {
    assert(
      !decisionSessionRoutesSource.includes(term),
      `Decision session routes must not include ${term}`,
    );
  }
}

function assertSessionReloadsFromFile(
  sessionId: string,
  expectedStatus: DecisionSessionStatus,
  filePath: string,
): void {
  const reloadScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "verify-decision-session-store-reload.ts",
  );
  const result = spawnSync("npx", ["tsx", reloadScriptPath, sessionId, expectedStatus], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: {
      ...process.env,
      DECISION_SESSION_PERSISTENCE: "file",
      DECISION_SESSION_PERSISTENCE_PATH: filePath,
    },
    stdio: "pipe",
    encoding: "utf-8",
  });

  assert(result.status === 0, `Session should reload as ${expectedStatus} after API restart`);
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-decision-session-e2e-"));
  const persistencePath = path.join(tempDir, "decision-sessions.json");

  process.env.DECISION_SESSION_PERSISTENCE = "file";
  process.env.DECISION_SESSION_PERSISTENCE_PATH = persistencePath;

  const { createFileDecisionSessionPersistenceAdapter } =
    await import("../modules/decision-session/persistence/decision-session-file.persistence.js");
  const {
    createDecisionSessionDraft,
    publishDecisionSession,
    closeDecisionSession,
    archiveDecisionSession,
  } = await import("../modules/decision-session/decision-session.service.js");

  const eligible = await buildEligibleInitiativeContext();

  const draft = createDecisionSessionDraft(participantA, {
    initiativeId: eligible.initiativeId,
    title: "Persistence Decision Session",
    purpose: "Verify persistence across API restarts.",
    decisionQuestion: "Persistence question?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(14),
  });

  const adapterAfterDraft = createFileDecisionSessionPersistenceAdapter();
  assert(
    adapterAfterDraft.load().sessions[draft.sessionId]?.status === "draft",
    "Draft should persist to file",
  );
  assertSessionReloadsFromFile(draft.sessionId, "draft", persistencePath);

  const published = publishDecisionSession(participantA, draft.sessionId);
  assert(
    createFileDecisionSessionPersistenceAdapter().load().sessions[draft.sessionId]?.status ===
      "published",
    "Published state should persist to file",
  );
  assert(published.packageReferences !== undefined, "Published package should persist");
  assertSessionReloadsFromFile(draft.sessionId, "published", persistencePath);

  closeDecisionSession(participantA, draft.sessionId);
  assert(
    createFileDecisionSessionPersistenceAdapter().load().sessions[draft.sessionId]?.status ===
      "closed",
    "Closed state should persist to file",
  );
  assertSessionReloadsFromFile(draft.sessionId, "closed", persistencePath);

  archiveDecisionSession(participantA, draft.sessionId);
  assert(
    createFileDecisionSessionPersistenceAdapter().load().sessions[draft.sessionId]?.status ===
      "archived",
    "Archived state should persist to file",
  );
  assertSessionReloadsFromFile(draft.sessionId, "archived", persistencePath);

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("13. Persistence — draft, published, closed, archived survive API restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_DECISION_SESSION_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Decision Session persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_DECISION_SESSION_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Decision Session E2E checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E verification FAILED: ${message}`);
  process.exit(1);
});
